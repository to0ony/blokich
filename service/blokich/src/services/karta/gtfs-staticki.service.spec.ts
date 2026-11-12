import { strToU8, zipSync } from 'fflate';
import { obradiGtfs, pojednostavi, redovi } from './gtfs-staticki.service';

const zip = (datoteke: Record<string, string>) =>
  zipSync(Object.fromEntries(Object.entries(datoteke).map(([k, v]) => [k, strToU8(v)])));

describe('obradiGtfs', () => {
  const g = obradiGtfs(
    zip({
      'feed_info.txt':
        'feed_publisher_name,feed_version\n"Zagrebački Električni Tramvaj","000398"\n',
      'routes.txt':
        'route_id,agency_id,route_short_name,route_long_name,route_desc,route_type\n' +
        '1,0,"1","Zap.kol. - Borongaj",,0\n' +
        '109,0,"109","Črnomerec - Dubrava, okretište",,3\n',
      'trips.txt':
        'route_id,service_id,trip_id,trip_headsign,trip_short_name,direction_id,block_id,shape_id\r\n' +
        '109,"0_11","0_11_10902_109_1","Dubrava",,0,10902,"109_1"\r\n',
      'shapes.txt':
        'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled\n' +
        '"109_1",45.81,15.95,10002,\n' +
        '"109_1",45.80,15.94,10001,\n' +
        '"109_1",45.82,15.96,10003,\n',
      'stops.txt':
        'stop_id,stop_code,stop_name,stop_desc,stop_lat,stop_lon\n' +
        '"98_1","1","Črnomerec",,45.815002,15.934932\n' +
        '"99_2","2","Dubrava",,45.82,15.96\n',
      'stop_times.txt':
        'trip_id,arrival_time,departure_time,stop_id,stop_sequence\r\n' +
        '"0_11_10902_109_1","05:10:00","05:10:00","99_2",2\r\n' +
        '"0_11_10902_109_1","05:00:00","05:00:00","98_1",1\r\n' +
        '"0_11_99999_109_9","06:00:00","06:00:00","98_1",1\r\n',
    }),
  );

  it('verzija, linije i tip', () => {
    expect(g.verzija).toBe('000398');
    expect(g.rute.get('1')).toEqual({ id: '1', naziv: '1', opis: 'Zap.kol. - Borongaj', tip: 0 });
    expect(g.rute.get('109')?.opis).toBe('Črnomerec - Dubrava, okretište');
  });

  it('vožnja s trasom, smjerom i odredištem', () => {
    expect(g.voznje.get('0_11_10902_109_1')).toEqual({
      ruta: '109',
      oblik: '109_1',
      smjer: 0,
      cilj: 'Dubrava',
      servis: '0_11',
      polazak: 300,
    });
  });

  it('stajališta i stajališta trase po redoslijedu', () => {
    expect(g.stajalista.get('98_1')).toEqual({
      id: '98_1',
      naziv: 'Črnomerec',
      lat: 45.815,
      lon: 15.93493,
    });
    expect(g.stajalistaOblika.get('109_1')).toEqual(['98_1', '99_2']);
  });

  it('minute od polaska do stajališta trase', () => {
    expect(g.vremenaOblika?.get('109_1')).toEqual([0, 10]);
  });

  it('točke trase po redoslijedu', () => {
    // Tri točke na pravcu – srednja otpada.
    expect(g.oblici.get('109_1')).toEqual([
      [45.8, 15.94],
      [45.82, 15.96],
    ]);
  });
});

describe('redovi', () => {
  it('navodnici, zarez i dvostruki navodnik unutar polja', () => {
    expect(redovi('a,b\n"x, y","say ""hi"""\n')).toEqual([{ a: 'x, y', b: 'say "hi"' }]);
  });
});

describe('pojednostavi', () => {
  it('zadrži skretanje, izbaci točke na pravcu', () => {
    const r = pojednostavi([
      [45.8, 15.9],
      [45.8, 15.905],
      [45.8, 15.91],
      [45.81, 15.91],
    ]);
    expect(r).toEqual([
      [45.8, 15.9],
      [45.8, 15.91],
      [45.81, 15.91],
    ]);
  });
});
