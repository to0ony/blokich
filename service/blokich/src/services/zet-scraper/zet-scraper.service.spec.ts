import { ZetScraperService } from './zet-scraper.service';

// Izrezak stvarne stranice AP Podsused (default.aspx?id=1043), studeni 2026.
const PODSUSED_HTML = `
<div class="pageContent">
  <div class='page_slika'><img src='resize.aspx?filename=/AP Podsused/Raspored rada vozača/APP LJETO II  3.8.2026.pdf&amp;width=264&amp;height=185' alt='' /></div>
  <h1><a href="https://www.zet.hr/interno/UserDocsImages/ap podsused/DisponentRaspored 02.11.-08.11.2026.pdf"><span>SLU&#381;BE OD 02.11.&nbsp; DO&nbsp; 08.11.2026.</span></a></h1>
  <h2><strong>RASPORED RADA JESEN -&nbsp;u prometu od 2. 11. 2026. godine</strong></h2>
  <ul><li><h3><span class="podnaslov"><a href="https://www.zet.hr/interno/UserDocsImages/AP Podsused/Raspored rada voza&#269;a/APP - 2.11.2026.pdf">1 - 979</a></span></h3></li></ul>
  <ul>
    <li><h3><a href="https://www.zet.hr/interno/UserDocsImages/ap podsused/&#352;kolovanje 30.7.pdf"><em>RASPORED PREDAVANJA ZA ELEKTRI&#268;NE AUTOBUSE</em></a></h3></li>
    <li><h3><a href="https://www.zet.hr/interno/UserDocsImages/ap podsused/Pravila rada disponentske slu&#382;be.pdf">Obavijest Pravila rada disponentske slu&#382;be</a></h3></li>
  </ul>
</div>`;

describe('ZetScraperService.findLink', () => {
  const service = new ZetScraperService(
    {} as any,
    { get: () => undefined } as any,
  );

  it('nađe tjedni disponent ("SLUŽBE OD … DO …")', () => {
    const link = service.findLink(PODSUSED_HTML, 'disponent');
    expect(link?.tekst).toBe('SLUŽBE OD 02.11. DO 08.11.2026.');
    expect(decodeURI(link!.url)).toBe(
      'https://www.zet.hr/interno/UserDocsImages/ap podsused/DisponentRaspored 02.11.-08.11.2026.pdf',
    );
  });

  it('nađe službe ("Raspored rada vozača"), ne sliku iz page_slika', () => {
    const link = service.findLink(PODSUSED_HTML, 'sluzba');
    expect(decodeURI(link!.url)).toBe(
      'https://www.zet.hr/interno/UserDocsImages/AP Podsused/Raspored rada vozača/APP - 2.11.2026.pdf',
    );
  });

  it('za disponent padne na tekst ako se datoteka drugačije zove', () => {
    const html = `<div class="pageContent">
      <a href="x/Pravila rada disponentske službe.pdf">Pravila</a>
      <a href="x/Tjedni 09.11.pdf">SLUŽBE OD 09.11. DO 15.11.2026.</a>
    </div>`;
    expect(decodeURI(service.findLink(html, 'disponent')!.url)).toBe(
      'https://www.zet.hr/interno/x/Tjedni 09.11.pdf',
    );
  });

  it('vrati null kad linka nema', () => {
    const html = '<div class="pageContent"><a href="a.pdf">Nešto</a></div>';
    expect(service.findLink(html, 'disponent')).toBeNull();
    expect(service.findLink(html, 'sluzba')).toBeNull();
  });
});
