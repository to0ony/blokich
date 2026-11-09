import { spojiVozilo } from './karta.service';
import { GtfsPodaci } from './gtfs-staticki.service';
import { VOZNI_PARK } from '../zet-uzivo/zet-uzivo.service';

const gtfs: GtfsPodaci = {
  verzija: '1',
  rute: new Map([
    ['109', { id: '109', naziv: '109', opis: 'Črnomerec - Dubrava', tip: 3 }],
    ['12', { id: '12', naziv: '12', opis: 'Ljubljanica - Dubrava', tip: 0 }],
  ]),
  voznje: new Map([
    ['0_1_10902_109_1', { ruta: '109', oblik: '109_1', smjer: 1, cilj: 'Dubrava' }],
    ['0_1_1203_12_1', { ruta: '12', oblik: '12_3', smjer: 0, cilj: 'Ljubljanica' }],
  ]),
  oblici: new Map(),
  stajalista: new Map(),
  stajalistaOblika: new Map(),
};

const pozicija = (vozilo: string, tripId: string, blok: string) => ({
  vozilo,
  lat: 45.8,
  lon: 15.9,
  ts: 1,
  tripId,
  ruta: tripId.split('_')[3],
  blok,
  kasnjenje: 60,
});

describe('spojiVozilo', () => {
  const podsusedBroj = Object.keys(VOZNI_PARK).find((k) => k !== 'default')!;
  const vozac = {
    sluz_broj: '00001',
    ime: 'Ivo Ivić',
    kontakt: '091',
    br_sl: '12',
    od: '05:00',
    do: '13:00',
  };

  it('bus AP Podsused: model i vozač na bloku', () => {
    const v = spojiVozilo(
      pozicija(podsusedBroj, '0_1_10902_109_1', '10902'),
      gtfs,
      new Map([['10902', vozac]]),
    );
    expect(v).toMatchObject({
      id: podsusedBroj,
      linija: '109',
      tip: 'autobus',
      oblik: '109_1',
      cilj: 'Dubrava',
      linijaBloka: '109',
      vr: '2',
      kasnjenje: 60,
      podsused: true,
      model: VOZNI_PARK[podsusedBroj].kratko,
      vozac,
    });
  });

  it('ostala vozila: bez modela i vozača', () => {
    const v = spojiVozilo(pozicija('22112', '0_1_1203_12_1', '1203'), gtfs, new Map());
    expect(v).toMatchObject({ linija: '12', tip: 'tramvaj', vr: '3', podsused: false });
    expect(v.model).toBeUndefined();
    expect(v.vozac).toBeUndefined();
  });

  it('bez GTFS-a linija iz feeda, bez trase', () => {
    const v = spojiVozilo(pozicija('22112', '0_1_1203_12_1', '1203'), null, new Map());
    expect(v).toMatchObject({ linija: '12', tip: null, oblik: null });
  });
});
