import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { toZonedTime } from 'date-fns-tz';
import { Disponent } from '../../schemas/disponent.schema';
import { Sluzba } from '../../schemas/sluzba.schema';
import { Godisnji } from '../../schemas/godisnji.schema';
import { Zamjena } from '../../schemas/zamjena.schema';
import { VozacStatsService } from '../vozac-stats/vozac-stats.service';
import {
  PrimijenjenaZamjena,
  ZamjenePrimjenaService,
} from './zamjene-primjena.service';
import {
  OZNAKA_UKINUTO,
  istiRadnik,
  jeSlobodan,
  jeSluzba,
  normOznaka,
} from '../../zamjene/primijeni-zamjene';
import {
  DANI,
  SluzbaRed,
  izgradiDane,
} from '../../stats/vozac-stats.calculator';

dayjs.extend(isoWeek);

export type TjedanTip = 'trenutni' | 'naredni';
export type TipZamjene = 'zamjena' | 'ukidanje';

const MAX_KANDIDATA = 30;
const MIN_ODMOR_SATI = 12;
const NAZIVI_DANA: Record<string, string> = {
  pon: 'pon',
  uto: 'uto',
  sri: 'sri',
  cet: 'čet',
  pet: 'pet',
  sub: 'sub',
  ned: 'ned',
};

interface Tjedan {
  godina: number;
  brojTjedna: number;
  ponedjeljak: dayjs.Dayjs;
}

interface Osoba {
  ime: string | null;
  kontakt: string | null;
}

const kljuc = (g: number, t: number) => `${g}-${t}`;

/** "Šimić Ana" -> "simic ana" za pretragu. */
const zaPretragu = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

/** Dijelovi službe iz verzije: "308" je i 308 i 308P. */
function dijeloviSluzbe(sveSluzbe: any[], oznaka: string): any[] {
  const trazena = normOznaka(oznaka);
  if (!jeSluzba(trazena)) return [];
  const osnovni = trazena.replace(/P+$/, '');
  return sveSluzbe
    .filter((s) => {
      const broj = normOznaka(s.br_sl);
      return (
        broj.startsWith(osnovni) && /^P*$/.test(broj.slice(osnovni.length))
      );
    })
    .sort((a, b) => a.br_sl.length - b.br_sl.length);
}

function vrstaOznake(oznaka: string): 'sluzba' | 'slobodan' | 'odsustvo' {
  if (jeSluzba(oznaka)) return 'sluzba';
  if (jeSlobodan(oznaka)) return 'slobodan';
  return 'odsustvo';
}

@Injectable()
export class ZamjeneService {
  private readonly logger = new Logger(ZamjeneService.name);

  constructor(
    @InjectModel(Zamjena.name) private readonly zamjenaModel: Model<Zamjena>,
    @InjectModel(Disponent.name)
    private readonly disponentModel: Model<Disponent>,
    @InjectModel(Sluzba.name) private readonly sluzbaModel: Model<Sluzba>,
    @InjectModel(Godisnji.name)
    private readonly godisnjiModel: Model<Godisnji>,
    private readonly primjena: ZamjenePrimjenaService,
    private readonly stats: VozacStatsService,
  ) {}

  // ---------- pomoćno ----------

  /** Tjedan po zagrebačkom vremenu. */
  tjedan(tip: TjedanTip, sad = new Date()): Tjedan {
    const lokalno = dayjs(toZonedTime(sad, 'Europe/Zagreb'));
    const d = tip === 'naredni' ? lokalno.add(1, 'week') : lokalno;
    return {
      godina: d.isoWeekYear(),
      brojTjedna: d.isoWeek(),
      ponedjeljak: d.startOf('isoWeek'),
    };
  }

  private provjeriDan(dan: string) {
    if (!(DANI as readonly string[]).includes(dan)) {
      throw new BadRequestException('Neispravan dan.');
    }
  }

  private async ucitajTjedan(t: { godina: number; brojTjedna: number }) {
    return this.disponentModel
      .findOne({ godina: t.godina, brojTjedna: t.brojTjedna })
      .lean<any>();
  }

  private async osobe(): Promise<Map<number, Osoba>> {
    const mapa = new Map<number, Osoba>();
    const najnoviji = await this.godisnjiModel
      .findOne(
        {},
        {
          'vozaci.sluz_broj': 1,
          'vozaci.ime_prezime': 1,
          'vozaci.kontakt_broj': 1,
        },
      )
      .sort({ createdAt: -1 })
      .lean();
    for (const v of najnoviji?.vozaci ?? []) {
      const ime = v.ime_prezime && v.ime_prezime !== '?' ? v.ime_prezime : null;
      mapa.set(Number(v.sluz_broj), { ime, kontakt: v.kontakt_broj || null });
    }
    return mapa;
  }

  private async sluzbeVerzija(
    verzije: (string | null | undefined)[],
  ): Promise<Map<string, SluzbaRed[]>> {
    const trazene = [...new Set(verzije.filter(Boolean))] as string[];
    const mapa = new Map<string, SluzbaRed[]>();
    if (!trazene.length) return mapa;
    const dokumenti = await this.sluzbaModel
      .find({ verzija: { $in: trazene } })
      .lean();
    for (const dok of dokumenti) {
      const lista = mapa.get(dok.verzija) ?? [];
      lista.push(...((dok.sluzbe as SluzbaRed[]) || []));
      mapa.set(dok.verzija, lista);
    }
    return mapa;
  }

  /** Aktivna (primijenjena) zamjena tog dana u kojoj sudjeluje vozač. */
  private aktivnaZa(
    zamjene: PrimijenjenaZamjena[],
    dan: string,
    radnik: string,
  ): any | null {
    return (
      zamjene.find(
        ({ zamjena: z, stanje }) =>
          stanje === 'primijenjena' &&
          z.dan === dan &&
          (istiRadnik(z.a.radnik, radnik) || istiRadnik(z.b?.radnik, radnik)),
      )?.zamjena ?? null
    );
  }

  private opisDana(sveSluzbe: any[], oznaka: string) {
    const dijelovi = dijeloviSluzbe(sveSluzbe, oznaka).map((s) => ({
      br_sl: s.br_sl,
      linija: s.linija,
      varijanta: s.varijanta,
      od: s.od,
      do: s.do,
    }));
    return {
      oznaka: (oznaka ?? '').trim(),
      vrsta: vrstaOznake(oznaka),
      od: dijelovi[0]?.od ?? null,
      do: dijelovi[dijelovi.length - 1]?.do ?? null,
      linije: [...new Set(dijelovi.map((d) => d.linija).filter(Boolean))],
      dijelovi,
    };
  }

  private async preracunaj(godina: number, brojTjedna: number) {
    this.primjena.oznaciPromjenu();
    try {
      await this.stats.preracunajTjedan(godina, brojTjedna);
    } catch (err) {
      this.logger.error('Greška pri preračunu statistike nakon zamjene', err);
    }
  }

  /**
   * Upozorenja o odmoru kraćem od 12 h za oba vozača kad bi se zamjena
   * napravila (gleda i susjedne tjedne zbog pon/ned).
   */
  private upozorenjaOdmora(
    tjedni: any[],
    sluzbePoVerziji: Map<string, SluzbaRed[]>,
    t: Tjedan,
    dan: string,
    ja: { radnik: string; oznaka: string },
    kolega: { radnik: string; oznaka: string },
  ): string[] {
    const klonovi = tjedni.map((d) => ({
      ...d,
      radnici: (d.radnici ?? [])
        .filter(
          (r: any) =>
            istiRadnik(r.radnik, ja.radnik) ||
            istiRadnik(r.radnik, kolega.radnik),
        )
        .map((r: any) => ({ ...r })),
    }));
    const ovaj = klonovi.find(
      (d) => d.godina === t.godina && d.brojTjedna === t.brojTjedna,
    );
    for (const r of ovaj?.radnici ?? []) {
      r[dan] = istiRadnik(r.radnik, ja.radnik) ? kolega.oznaka : ja.oznaka;
    }

    const dani = izgradiDane(klonovi, sluzbePoVerziji);
    const datum = t.ponedjeljak.add(DANI.indexOf(dan as any), 'day');
    const provjeri = [datum, datum.add(1, 'day')].map((d) =>
      d.format('YYYY-MM-DD'),
    );

    const poruke: string[] = [];
    for (const [tko, radnik] of [
      ['Ti', ja.radnik],
      ['Kolega', kolega.radnik],
    ] as const) {
      for (const d of dani) {
        if (!istiRadnik(d.radnik, radnik) || !provjeri.includes(d.datum)) {
          continue;
        }
        if (d.odmorPrijeSati !== null && d.odmorPrijeSati < MIN_ODMOR_SATI) {
          const naziv = NAZIVI_DANA[DANI[d.danUTjednu]];
          poruke.push(
            `${tko}: odmor prije smjene (${naziv}) bio bi ${String(d.odmorPrijeSati).replace('.', ',')} h`,
          );
        }
      }
    }
    return poruke;
  }

  // ---------- vozač ----------

  /** Moj dan i kolege s kojima se mogu zamijeniti, filtrirano po `q`. */
  async kandidati(radnik: string, tip: TjedanTip, dan: string, q = '') {
    this.provjeriDan(dan);
    const t = this.tjedan(tip);
    const susjedi = [
      t.ponedjeljak.subtract(1, 'week'),
      t.ponedjeljak.add(1, 'week'),
    ].map((d) => ({ godina: d.isoWeekYear(), brojTjedna: d.isoWeek() }));

    const [disponent, prije, poslije] = await Promise.all([
      this.ucitajTjedan(t),
      ...susjedi.map((s) => this.ucitajTjedan(s)),
    ]);
    if (!disponent) {
      throw new NotFoundException('Disponent za taj tjedan još nije učitan.');
    }

    const tjedni = [prije, disponent, poslije].filter(Boolean);
    const zamjene =
      (await this.primjena.primijeniSve(tjedni)).get(
        kljuc(t.godina, t.brojTjedna),
      ) ?? [];

    const ja = disponent.radnici.find((r: any) => istiRadnik(r.radnik, radnik));
    if (!ja) {
      throw new NotFoundException('Nisi u disponentu tog tjedna.');
    }

    const sluzbePoVerziji = await this.sluzbeVerzija(
      tjedni.map((d) => d.verzija_sluzbe),
    );
    const sveSluzbe = sluzbePoVerziji.get(disponent.verzija_sluzbe) ?? [];
    const osobe = await this.osobe();

    const mojaOznaka = (ja[dan] ?? '').trim();
    const moj = this.opisDana(sveSluzbe, mojaOznaka);
    const aktivna = this.aktivnaZa(zamjene, dan, radnik);
    const datum = t.ponedjeljak
      .add(DANI.indexOf(dan as any), 'day')
      .format('YYYY-MM-DD');

    const osnova = {
      godina: t.godina,
      brojTjedna: t.brojTjedna,
      tjedan: tip,
      dan,
      datum,
      moj,
      aktivna: aktivna ? this.zaVozaca(aktivna, radnik) : null,
      mozeUkinuti: !aktivna && moj.vrsta === 'sluzba',
    };

    const upit = zaPretragu(q.trim());
    if (aktivna || moj.vrsta === 'odsustvo' || !upit) {
      return { ...osnova, kandidati: [] };
    }

    const brojcani = /^\d+$/.test(upit);
    const rijeci = upit.split(/\s+/).filter(Boolean);

    const pogodci = disponent.radnici
      .filter((r: any) => r?.radnik && !istiRadnik(r.radnik, radnik))
      .map((r: any) => {
        const oznaka = (r[dan] ?? '').trim();
        const osoba = osobe.get(Number(r.radnik));
        return { r, oznaka, osoba, vrsta: vrstaOznake(oznaka) };
      })
      .filter(({ oznaka, vrsta }) => {
        if (!oznaka || vrsta === 'odsustvo') return false;
        // dva slobodna dana nemaju što zamijeniti
        return moj.vrsta === 'sluzba' || vrsta === 'sluzba';
      })
      .map((k) => {
        let rang = -1;
        if (brojcani) {
          const broj = String(Number(k.r.radnik));
          const trazeni = String(Number(upit));
          if (normOznaka(k.oznaka) === upit) rang = 0;
          else if (broj === trazeni) rang = 1;
          else if (broj.startsWith(trazeni)) rang = 3;
          else if (normOznaka(k.oznaka).startsWith(upit)) rang = 2;
        } else if (k.osoba?.ime) {
          const ime = zaPretragu(k.osoba.ime);
          if (rijeci.every((w) => ime.includes(w))) rang = 1;
        }
        return { ...k, rang };
      })
      .filter((k) => k.rang >= 0)
      .sort(
        (a, b) =>
          a.rang - b.rang ||
          (a.osoba?.ime ?? '').localeCompare(b.osoba?.ime ?? '', 'hr'),
      )
      .slice(0, MAX_KANDIDATA);

    const kandidati = pogodci.map(({ r, oznaka, osoba }) => {
      const zauzet = !!this.aktivnaZa(zamjene, dan, r.radnik);
      return {
        sluz_broj: r.radnik,
        ime_prezime: osoba?.ime ?? null,
        kontakt_broj: osoba?.kontakt ?? null,
        ...this.opisDana(sveSluzbe, oznaka),
        zauzet,
        upozorenja: zauzet
          ? []
          : this.upozorenjaOdmora(
              tjedni,
              sluzbePoVerziji,
              t,
              dan,
              { radnik: ja.radnik, oznaka: mojaOznaka },
              { radnik: r.radnik, oznaka },
            ),
      };
    });

    return { ...osnova, kandidati };
  }

  /** Zamjena kako je vidi jedan od sudionika. */
  private zaVozaca(z: any, radnik: string) {
    const ja = istiRadnik(z.a.radnik, radnik);
    const kolega = ja ? z.b : z.a;
    return {
      id: String(z._id),
      dan: z.dan,
      datum: z.datum,
      tip: z.tip,
      moja: ja,
      prije: ja ? z.a.oznaka : z.b?.oznaka,
      kolega: kolega
        ? {
            sluz_broj: kolega.radnik,
            ime_prezime: kolega.ime ?? null,
            oznaka: kolega.oznaka,
          }
        : null,
      kreirano: z.kreirano,
    };
  }

  async stvori(ulaz: {
    radnik: string;
    tjedan: TjedanTip;
    dan: string;
    tip: TipZamjene;
    sa?: string;
  }) {
    const { radnik, dan, tip } = ulaz;
    if (!radnik) throw new BadRequestException('Nedostaje službeni broj.');
    this.provjeriDan(dan);
    if (tip !== 'zamjena' && tip !== 'ukidanje') {
      throw new BadRequestException('Neispravan tip zamjene.');
    }

    const t = this.tjedan(ulaz.tjedan);
    const disponent = await this.ucitajTjedan(t);
    if (!disponent) {
      throw new NotFoundException('Disponent za taj tjedan još nije učitan.');
    }
    const zamjene = await this.primjena.primijeni(disponent);

    const ja = disponent.radnici.find((r: any) => istiRadnik(r.radnik, radnik));
    if (!ja) throw new NotFoundException('Nisi u disponentu tog tjedna.');
    if (this.aktivnaZa(zamjene, dan, radnik)) {
      throw new BadRequestException(
        'Za taj dan već imaš zamjenu. Poništi je prije nove.',
      );
    }

    const mojaOznaka = (ja[dan] ?? '').trim();
    const osobe = await this.osobe();
    const ime = (r: string) => osobe.get(Number(r))?.ime ?? undefined;
    const datum = t.ponedjeljak
      .add(DANI.indexOf(dan as any), 'day')
      .format('YYYY-MM-DD');

    let b: { radnik: string; oznaka: string; ime?: string } | undefined;

    if (tip === 'ukidanje') {
      if (!jeSluzba(mojaOznaka)) {
        throw new BadRequestException('Taj dan nemaš službu koju bi ukinuo.');
      }
    } else {
      if (!ulaz.sa) throw new BadRequestException('Odaberi kolegu.');
      if (istiRadnik(ulaz.sa, radnik)) {
        throw new BadRequestException('Ne možeš se zamijeniti sam sa sobom.');
      }
      const kolega = disponent.radnici.find((r: any) =>
        istiRadnik(r.radnik, ulaz.sa),
      );
      if (!kolega) {
        throw new NotFoundException('Kolega nije u disponentu tog tjedna.');
      }
      if (this.aktivnaZa(zamjene, dan, kolega.radnik)) {
        throw new BadRequestException('Kolega za taj dan već ima zamjenu.');
      }
      const kolegaOznaka = (kolega[dan] ?? '').trim();
      const vrste = [vrstaOznake(mojaOznaka), vrstaOznake(kolegaOznaka)];
      if (!mojaOznaka || !kolegaOznaka || vrste.includes('odsustvo')) {
        throw new BadRequestException(
          'Mijenjati se mogu samo službe i slobodni dani.',
        );
      }
      if (!vrste.includes('sluzba')) {
        throw new BadRequestException('Nijedan od vas taj dan nema službu.');
      }
      b = {
        radnik: kolega.radnik,
        oznaka: kolegaOznaka,
        ime: ime(kolega.radnik),
      };
    }

    const doc = await this.zamjenaModel.create({
      godina: t.godina,
      brojTjedna: t.brojTjedna,
      dan,
      datum,
      tip,
      a: { radnik: ja.radnik, oznaka: mojaOznaka, ime: ime(ja.radnik) },
      b,
      sudionici: [Number(ja.radnik), ...(b ? [Number(b.radnik)] : [])],
      kreirano: new Date(),
    });

    await this.preracunaj(t.godina, t.brojTjedna);

    const z = doc.toObject();
    return {
      ...this.zaVozaca(z, radnik),
      poslije: tip === 'ukidanje' ? OZNAKA_UKINUTO : b!.oznaka,
    };
  }

  /** Poništiti smije samo vozač koji je zamjenu napravio. */
  async ponisti(id: string, radnik: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Nema te zamjene.');
    const z = await this.zamjenaModel.findById(id);
    if (!z) throw new NotFoundException('Nema te zamjene.');
    if (z.ponistena) {
      throw new BadRequestException('Zamjena je već poništena.');
    }
    if (!istiRadnik(z.a.radnik, radnik)) {
      throw new ForbiddenException(
        'Zamjenu može poništiti samo vozač koji ju je napravio.',
      );
    }
    const dozvoljeni = (['trenutni', 'naredni'] as const).map((tip) =>
      this.tjedan(tip),
    );
    if (
      !dozvoljeni.some(
        (t) => t.godina === z.godina && t.brojTjedna === z.brojTjedna,
      )
    ) {
      throw new BadRequestException(
        'Zamjene iz prošlih tjedana se ne mogu poništiti.',
      );
    }

    z.ponistena = new Date();
    await z.save();
    await this.preracunaj(z.godina, z.brojTjedna);
    return { id, ponistena: z.ponistena };
  }

  // ---------- admin ----------

  async popis(filter: { radnik?: string; od?: string; do?: string }) {
    const upit: any = {};
    if (filter.radnik) upit.sudionici = Number(filter.radnik);
    if (filter.od || filter.do) {
      upit.datum = {};
      if (filter.od) upit.datum.$gte = filter.od;
      if (filter.do) upit.datum.$lte = filter.do;
    }

    const [zamjene, sudionici] = await Promise.all([
      this.zamjenaModel
        .find(upit)
        .sort({ datum: -1, kreirano: -1 })
        .limit(300)
        .lean(),
      this.zamjenaModel.distinct('sudionici'),
    ]);

    // stanje aktivnih zamjena prema današnjem disponentu
    const tjedni = new Map<string, { godina: number; brojTjedna: number }>();
    for (const z of zamjene) {
      if (!z.ponistena) {
        tjedni.set(kljuc(z.godina, z.brojTjedna), {
          godina: z.godina,
          brojTjedna: z.brojTjedna,
        });
      }
    }
    const disponenti = tjedni.size
      ? await this.disponentModel
          .find({ $or: [...tjedni.values()] })
          .lean<any[]>()
      : [];
    const stanja = new Map<string, string>();
    for (const lista of (
      await this.primjena.primijeniSve(disponenti)
    ).values()) {
      for (const { zamjena, stanje } of lista) {
        stanja.set(String(zamjena._id), stanje);
      }
    }

    const osobe = await this.osobe();
    const strana = (s: any) =>
      s
        ? {
            sluz_broj: s.radnik,
            ime_prezime: s.ime ?? osobe.get(Number(s.radnik))?.ime ?? null,
            oznaka: s.oznaka,
          }
        : null;

    return {
      vozaci: (sudionici as number[])
        .map((broj) => ({
          sluz_broj: String(broj),
          ime_prezime: osobe.get(broj)?.ime ?? null,
        }))
        .sort((a, b) =>
          (a.ime_prezime ?? a.sluz_broj).localeCompare(
            b.ime_prezime ?? b.sluz_broj,
            'hr',
          ),
        ),
      zamjene: zamjene.map((z: any) => ({
        id: String(z._id),
        godina: z.godina,
        brojTjedna: z.brojTjedna,
        dan: z.dan,
        datum: z.datum,
        tip: z.tip,
        a: strana(z.a),
        b: strana(z.b),
        kreirano: z.kreirano,
        ponistena: z.ponistena ?? null,
        stanje: z.ponistena
          ? 'ponistena'
          : (stanja.get(String(z._id)) ?? 'zastarjela'),
      })),
    };
  }
}
