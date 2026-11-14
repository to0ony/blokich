import { primijeniZamjene, ZamjenaUlaz } from './primijeni-zamjene';

const disp = () => ({
  radnici: [
    { radnik: '1234', sri: '45', cet: '12' },
    { radnik: '5678', sri: '112', cet: 'O' },
    { radnik: '0999', sri: 'O', cet: 'I-GO' },
  ],
});

const zamjena = (
  a: [string, string],
  b: [string, string],
  dan = 'sri',
  kreirano = 1,
): ZamjenaUlaz => ({
  godina: 2026,
  brojTjedna: 46,
  dan,
  tip: 'zamjena',
  a: { radnik: a[0], oznaka: a[1] },
  b: { radnik: b[0], oznaka: b[1] },
  kreirano,
});

describe('primijeniZamjene', () => {
  it('zamijeni oznake dvojice vozača', () => {
    const d = disp();
    const st = primijeniZamjene(d, [zamjena(['1234', '45'], ['5678', '112'])]);
    expect(st).toEqual(['primijenjena']);
    expect(d.radnici[0].sri).toBe('112');
    expect(d.radnici[1].sri).toBe('45');
    expect(d.radnici[0].cet).toBe('12');
  });

  it('služba za slobodan dan', () => {
    const d = disp();
    primijeniZamjene(d, [zamjena(['1234', '12'], ['5678', 'O'], 'cet')]);
    expect(d.radnici[0].cet).toBe('O');
    expect(d.radnici[1].cet).toBe('12');
  });

  it('ne pazi na vodeće nule i velika/mala slova', () => {
    const d = disp();
    const st = primijeniZamjene(d, [zamjena(['01234', '45'], ['999', 'o'])]);
    expect(st).toEqual(['primijenjena']);
    expect(d.radnici[0].sri).toBe('O');
    expect(d.radnici[2].sri).toBe('45');
  });

  it('ne okreće natrag zamjenu koju je disponent već upisao', () => {
    const d = disp();
    d.radnici[0].sri = '112';
    d.radnici[1].sri = '45';
    const st = primijeniZamjene(d, [zamjena(['1234', '45'], ['5678', '112'])]);
    expect(st).toEqual(['u_disponentu']);
    expect(d.radnici[0].sri).toBe('112');
    expect(d.radnici[1].sri).toBe('45');
  });

  it('zastarjela kad se disponent promijenio drukčije', () => {
    const d = disp();
    d.radnici[1].sri = '200';
    const st = primijeniZamjene(d, [zamjena(['1234', '45'], ['5678', '112'])]);
    expect(st).toEqual(['zastarjela']);
    expect(d.radnici[0].sri).toBe('45');
    expect(d.radnici[1].sri).toBe('200');
  });

  it('zastarjela kad vozača nema u disponentu', () => {
    const d = disp();
    const st = primijeniZamjene(d, [zamjena(['1234', '45'], ['4444', '7'])]);
    expect(st).toEqual(['zastarjela']);
    expect(d.radnici[0].sri).toBe('45');
  });

  it('lančane zamjene redom kojim su napravljene', () => {
    const d = disp();
    // ulaz obrnutim redom – primjenjuje se po vremenu
    const st = primijeniZamjene(d, [
      zamjena(['1234', '112'], ['0999', 'O'], 'sri', 2),
      zamjena(['1234', '45'], ['5678', '112'], 'sri', 1),
    ]);
    expect(st).toEqual(['primijenjena', 'primijenjena']);
    expect(d.radnici[0].sri).toBe('O');
    expect(d.radnici[1].sri).toBe('45');
    expect(d.radnici[2].sri).toBe('112');
  });

  describe('ukidanje', () => {
    const ukidanje = (oznaka: string): ZamjenaUlaz => ({
      godina: 2026,
      brojTjedna: 46,
      dan: 'sri',
      tip: 'ukidanje',
      a: { radnik: '1234', oznaka },
      kreirano: 1,
    });

    it('dan postaje slobodan', () => {
      const d = disp();
      expect(primijeniZamjene(d, [ukidanje('45')])).toEqual(['primijenjena']);
      expect(d.radnici[0].sri).toBe('O');
    });

    it('već slobodan u disponentu', () => {
      const d = disp();
      d.radnici[0].sri = 'Ob';
      expect(primijeniZamjene(d, [ukidanje('45')])).toEqual(['u_disponentu']);
      expect(d.radnici[0].sri).toBe('Ob');
    });

    it('zastarjelo kad je u disponentu druga služba', () => {
      const d = disp();
      d.radnici[0].sri = '77';
      expect(primijeniZamjene(d, [ukidanje('45')])).toEqual(['zastarjela']);
      expect(d.radnici[0].sri).toBe('77');
    });
  });

  it('bez disponenta sve je zastarjelo', () => {
    expect(
      primijeniZamjene(null, [zamjena(['1234', '45'], ['5678', '112'])]),
    ).toEqual(['zastarjela']);
  });
});
