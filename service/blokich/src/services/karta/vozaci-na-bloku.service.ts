import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import { toZonedTime } from 'date-fns-tz';
import { Disponent } from '../../schemas/disponent.schema';
import { Sluzba } from '../../schemas/sluzba.schema';
import { Godisnji } from '../../schemas/godisnji.schema';

dayjs.extend(isoWeek);

/** Vozač koji je po disponentu na bloku. */
export interface VozacNaBloku {
  sluz_broj: string;
  ime: string | null;
  kontakt: string | null;
  br_sl: string;
  od: string;
  do: string;
}

/** Jedan dio službe na jednom bloku (linija + V.R.) jednog dana. */
export interface SmjenaNaBloku extends VozacNaBloku {
  blok: string;
  /**
   * Početak i kraj u minutama od ponoći dana službe, po lancu dijelova
   * (01:45 nakon 21:50–01:40 je 1545). Bez njih se računa iz od/do.
   */
  pocetak?: number;
  kraj?: number;
}

const DANI = ['ned', 'pon', 'uto', 'sri', 'cet', 'pet', 'sub'] as const;
const CACHE_MS = 5 * 60 * 1000;

function minute(hhmm: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? '').trim());
  return m ? +m[1] * 60 + +m[2] : null;
}

/** Blok = linija + V.R. s dvije znamenke (109 + 2 -> 10902). */
export function blokIz(linija?: string, vr?: string): string | null {
  const l = (linija ?? '').trim();
  const v = (vr ?? '').toString().trim();
  if (!/^\d+$/.test(l) || !/^\d{1,2}$/.test(v)) return null;
  return l + v.padStart(2, '0');
}

/**
 * Dijelovi jedne službe redom (kako su u PDF-u) kao stvarni intervali u
 * minutama od ponoći dana službe. Kad vrijeme "skoči unatrag" (01:45 nakon
 * 21:50–01:40), dio je sutradan. Prvi dio vrijedi za dan pod kojim piše.
 */
export function lanacSluzbi(
  dijelovi: { od?: string; do?: string }[],
): ({ pocetak: number; kraj: number } | null)[] {
  let prije: number | null = null;
  return dijelovi.map((d) => {
    let a = minute(d.od);
    let b = minute(d.do);
    if (a === null || b === null) return null;
    // Malo preklapanje kod predaje nije novi dan – samo veliki skok unatrag.
    if (prije !== null) while (a < prije - 12 * 60) a += 24 * 60;
    while (b < a) b += 24 * 60;
    prije = b;
    return { pocetak: a, kraj: b };
  });
}

function interval(s: SmjenaNaBloku): { pocetak: number; kraj: number } | null {
  if (s.pocetak != null && s.kraj != null) return { pocetak: s.pocetak, kraj: s.kraj };
  return lanacSluzbi([s])[0];
}

/**
 * Tko sad vozi koji blok. Isto pravilo kao u aplikaciji vozača: služba traje
 * od početka do neposredno prije kraja; kod predaje (preklapanje) vozi onaj
 * koji je ranije počeo. Jučerašnje službe vrijede dok ne završe – i dijelovi
 * koji su po lancu tek nakon ponoći (21:50–01:40 pa 01:45–04:20).
 */
export function aktivniNaBlokovima(
  danas: SmjenaNaBloku[],
  jucer: SmjenaNaBloku[],
  sadMin: number,
): Map<string, VozacNaBloku> {
  const kandidati: { s: SmjenaNaBloku; pocetak: number }[] = [];
  for (const [lista, pomak] of [
    [jucer, 24 * 60],
    [danas, 0],
  ] as const) {
    for (const s of lista) {
      const i = interval(s);
      const n = sadMin + pomak;
      if (i && i.pocetak <= n && n < i.kraj) kandidati.push({ s, pocetak: i.pocetak - pomak });
    }
  }

  const rez = new Map<string, { v: VozacNaBloku; pocetak: number }>();
  for (const { s, pocetak } of kandidati) {
    const postojeci = rez.get(s.blok);
    if (!postojeci || pocetak < postojeci.pocetak) {
      const { blok: _b, pocetak: _p, kraj: _k, ...v } = s;
      rez.set(s.blok, { v, pocetak });
    }
  }
  return new Map([...rez].map(([b, { v }]) => [b, v]));
}

/** Vozači AP Podsused po blokovima, iz disponenta i službi. */
@Injectable()
export class VozaciNaBlokuService {
  private cache = new Map<string, { do: number; smjene: Promise<SmjenaNaBloku[]> }>();

  constructor(
    @InjectModel(Disponent.name)
    private readonly disponentModel: Model<Disponent>,
    @InjectModel(Sluzba.name)
    private readonly sluzbaModel: Model<Sluzba>,
    @InjectModel(Godisnji.name)
    private readonly godisnjiModel: Model<Godisnji>,
  ) {}

  /** Blok -> vozač koji ga sad vozi (vrijeme po Zagrebu). */
  async aktivni(sad = new Date()): Promise<Map<string, VozacNaBloku>> {
    const lokalno = dayjs(toZonedTime(sad, 'Europe/Zagreb'));
    const [danas, jucer] = await Promise.all([
      this.smjeneZaDan(lokalno),
      this.smjeneZaDan(lokalno.subtract(1, 'day')),
    ]);
    return aktivniNaBlokovima(danas, jucer, lokalno.hour() * 60 + lokalno.minute());
  }

  private smjeneZaDan(dan: dayjs.Dayjs): Promise<SmjenaNaBloku[]> {
    const kljuc = dan.format('YYYY-MM-DD');
    const sad = Date.now();
    const c = this.cache.get(kljuc);
    if (c && c.do > sad) return c.smjene;

    for (const [k, v] of this.cache) if (v.do <= sad) this.cache.delete(k);
    const smjene = this.ucitajDan(dan).catch(() => [] as SmjenaNaBloku[]);
    this.cache.set(kljuc, { do: sad + CACHE_MS, smjene });
    return smjene;
  }

  private async ucitajDan(dan: dayjs.Dayjs): Promise<SmjenaNaBloku[]> {
    const ponedjeljak = dan.startOf('isoWeek');
    const godina = ponedjeljak.add(3, 'day').year();
    const brojTjedna = dan.isoWeek();
    const danKey = DANI[dan.day()];

    const disponent = await this.disponentModel.findOne({ godina, brojTjedna }).lean();
    if (!disponent) return [];

    const radnici = (disponent.radnici ?? [])
      .map((r) => ({ sluz_broj: Number(r.radnik), br_sl: (r[danKey] ?? '').trim() }))
      .filter((r) => r.br_sl && r.br_sl !== 'O');
    if (!radnici.length) return [];

    const dokumenti = await this.sluzbaModel
      .find({ verzija: disponent.verzija_sluzbe })
      .lean();
    const sveSluzbe = dokumenti.flatMap((d) => d.sluzbe ?? []);

    const godisnji = await this.godisnjiModel
      .findOne({ 'vozaci.sluz_broj': { $in: radnici.map((r) => r.sluz_broj) } })
      .sort({ createdAt: -1 })
      .lean();
    const osobe = new Map<number, { ime: string | null; kontakt: string | null }>();
    for (const v of godisnji?.vozaci ?? []) {
      osobe.set(Number(v.sluz_broj), {
        ime: v.ime_prezime || null,
        kontakt: v.kontakt_broj || null,
      });
    }

    const smjene: SmjenaNaBloku[] = [];
    for (const r of radnici) {
      const escaped = r.br_sl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}(P*)$`, 'i');
      // Svi dijelovi službe redom – lanac treba i dijelove bez bloka.
      const dijelovi = sveSluzbe.filter((s) => regex.test(s.br_sl ?? ''));
      const lanac = lanacSluzbi(dijelovi);
      dijelovi.forEach((s, i) => {
        const blok = blokIz(s.linija, s.varijanta);
        if (!blok) return;
        const osoba = osobe.get(r.sluz_broj);
        smjene.push({
          blok,
          sluz_broj: String(r.sluz_broj).padStart(5, '0'),
          ime: osoba?.ime ?? null,
          kontakt: osoba?.kontakt ?? null,
          br_sl: s.br_sl,
          od: s.od,
          do: s.do,
          pocetak: lanac[i]?.pocetak,
          kraj: lanac[i]?.kraj,
        });
      });
    }
    return smjene;
  }
}
