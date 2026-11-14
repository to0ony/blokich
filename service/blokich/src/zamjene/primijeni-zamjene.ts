// Čista primjena zamjena na disponent – bez NestJS/Mongoose ovisnosti.

export type TipZamjene = 'zamjena' | 'ukidanje';

/**
 * - primijenjena: disponent je kakav je bio pri zamjeni, zamjena vrijedi
 * - u_disponentu: disponent već pokazuje stanje nakon zamjene (ZET ju je upisao)
 * - zastarjela: disponent se u međuvremenu promijenio drukčije, zamjena se ne primjenjuje
 */
export type StanjeZamjene = 'primijenjena' | 'u_disponentu' | 'zastarjela';

/** Oznaka koju dobije dan s ukinutom službom. */
export const OZNAKA_UKINUTO = 'O';

const OZNAKA_SLOBODAN = /^[O0][A-Z0-9]?$/i;
const OZNAKA_SLUZBE = /^\d+P*$/i;

export interface ZamjenaUlaz {
  godina: number;
  brojTjedna: number;
  dan: string;
  tip: TipZamjene | string;
  a: { radnik: string; oznaka: string };
  b?: { radnik: string; oznaka: string } | null;
  kreirano?: Date | string | number;
}

export interface DisponentZaZamjene {
  radnici: Record<string, any>[];
}

export const normOznaka = (o: unknown) =>
  String(o ?? '')
    .trim()
    .toUpperCase();

export const jeSluzba = (o: unknown) => OZNAKA_SLUZBE.test(normOznaka(o));
export const jeSlobodan = (o: unknown) => OZNAKA_SLOBODAN.test(normOznaka(o));

/** Isti vozač bez obzira na vodeće nule. */
export const istiRadnik = (a: unknown, b: unknown) =>
  Number(a) === Number(b) && !Number.isNaN(Number(a));

const vrijeme = (z: ZamjenaUlaz) => new Date(z.kreirano ?? 0).getTime();

/**
 * Primjenjuje zamjene istog tjedna na disponent (mijenja `radnici` na mjestu)
 * redom kojim su napravljene. Vraća stanje svake zamjene, istim redom kao ulaz.
 */
export function primijeniZamjene(
  disponent: DisponentZaZamjene | null | undefined,
  zamjene: ZamjenaUlaz[],
): StanjeZamjene[] {
  const stanja: StanjeZamjene[] = zamjene.map(() => 'zastarjela');
  if (!disponent?.radnici?.length) return stanja;

  const redom = zamjene
    .map((z, i) => ({ z, i }))
    .sort((x, y) => vrijeme(x.z) - vrijeme(y.z));

  for (const { z, i } of redom) {
    const ra = disponent.radnici.find((r) => istiRadnik(r?.radnik, z.a.radnik));
    if (!ra) continue;
    const sadA = normOznaka(ra[z.dan]);
    const bioA = normOznaka(z.a.oznaka);

    if (z.tip === 'ukidanje') {
      if (sadA === bioA) {
        ra[z.dan] = OZNAKA_UKINUTO;
        stanja[i] = 'primijenjena';
      } else if (jeSlobodan(sadA)) {
        stanja[i] = 'u_disponentu';
      }
      continue;
    }

    if (!z.b) continue;
    const rb = disponent.radnici.find((r) =>
      istiRadnik(r?.radnik, z.b!.radnik),
    );
    if (!rb) continue;
    const sadB = normOznaka(rb[z.dan]);
    const bioB = normOznaka(z.b.oznaka);

    if (sadA === bioA && sadB === bioB) {
      const tmp = ra[z.dan];
      ra[z.dan] = rb[z.dan];
      rb[z.dan] = tmp;
      stanja[i] = 'primijenjena';
    } else if (sadA === bioB && sadB === bioA) {
      stanja[i] = 'u_disponentu';
    }
  }

  return stanja;
}
