"""
Vozni park AP Podsused -> src/vozni-park/podsused.json

Izvor: tema "Vozni park po registracijama" na autobusi.org (održava zajednica,
nije službeni ZET-ov podatak). Pokreće se ručno kad stignu novi autobusi:

    python scripts/vozni-park/generiraj.py

Ključ u JSON-u je garažni broj, isti kao vehicle.id u ZET-ovom GTFS-RT feedu.
"""
import html
import json
import re
import sys
import urllib.request
from collections import Counter
from pathlib import Path

URL = "https://autobusi.org/forum/index.php?topic=3819.0"
IZLAZ = Path(__file__).resolve().parents[2] / "src" / "vozni-park" / "podsused.json"

# Kratka, čitljiva imena za prikaz u aplikaciji (pun naziv ostaje u "model").
KRATKO = [
    (r"Lion's City 18E", "MAN Lion's City 18E"),
    (r"Lion's City 12E", "MAN Lion's City 12E"),
    (r"Lion's City 12C|NL 360 Lion's City 12C", "MAN Lion's City 12C"),
    (r"Lion's City 12 Hybrid|Lion's City 12 hybrid|12 EfficientHybrid", "MAN Lion's City 12 Hybrid"),
    (r"Lion's City NL 363", "MAN Lion's City NL 363"),
    (r"NL ?313 LION'S CITY", "MAN Lion's City NL 313"),
    (r"Lion's Intercity", "MAN Lion's Intercity"),
    (r"Lion's Coach", "MAN Lion's Coach"),
    (r"LION'S CLASSIC", "MAN Lion's Classic"),
    (r"Citaro C2 G", "Mercedes-Benz Citaro C2 G"),
    (r"Citaro C2", "Mercedes-Benz Citaro C2"),
    (r"CITARO G", "Mercedes-Benz Citaro G"),
    (r"Crossway LE City", "Iveco Crossway LE"),
    (r"Crossway", "Iveco Crossway"),
    (r"FBI 83 M-E", "Feniksbus FBI 83 (električni)"),
    (r"FBI 83", "Feniksbus FBI 83"),
]


def kratko_ime(model: str) -> str:
    for uzorak, ime in KRATKO:
        if re.search(uzorak, model, re.I):
            return ime
    # Rezerva: bez napomena i internih oznaka u zagradama
    return re.split(r"\s+-\s+", re.sub(r"\(.*?\)", "", model))[0].strip()


def tekst_teme() -> str:
    if len(sys.argv) > 1:  # lokalna kopija HTML-a (za testiranje)
        raw = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
    else:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Blokich vozni park)"})
        raw = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
    t = re.sub(r"<br\s*/?>", "\n", raw, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    return html.unescape(t).replace("\xa0", " ")


def main() -> None:
    redovi = [r.strip() for r in tekst_teme().split("\n")]

    pocetak = next(i for i, r in enumerate(redovi) if r == "Autobusni pogon Podsused")
    kraj = next(i for i in range(pocetak + 1, len(redovi)) if redovi[i].startswith("* označeni"))
    ocekivano = int(re.search(r"(\d+) autobusa", redovi[pocetak + 1]).group(1))

    # "*185 -- ZG-6394-JI ex ZG-8635-DU  -- MODEL -- napomena"
    red_vozila = re.compile(r"^(\*?)([A-Z]?\d{1,4})\s*-{2,}\s*(.+)$")

    vozila = {}
    for r in redovi[pocetak:kraj]:
        m = red_vozila.match(r)
        if not m:
            continue
        neregistriran, broj, ostatak = m.group(1) == "*", m.group(2), m.group(3)
        dijelovi = [d.strip() for d in re.split(r"\s+-{2,}\s+|\s*-{2,}\s*", ostatak) if d.strip()]
        if len(dijelovi) < 2:
            continue
        tablica = dijelovi[0].split(" ex ")[0].strip()
        model = re.sub(r"\s{2,}", " ", dijelovi[1])
        vozila[broj] = {
            "kratko": kratko_ime(model),
            "model": model,
            "tablica": None if neregistriran else tablica,
        }

    print(f"AP Podsused: {len(vozila)} od {ocekivano} autobusa")
    for ime, n in Counter(v["kratko"] for v in vozila.values()).most_common():
        print(f"  {n:>3}  {ime}")
    if len(vozila) != ocekivano:
        print("UPOZORENJE: broj ne odgovara zaglavlju teme – provjeri format.", file=sys.stderr)

    IZLAZ.parent.mkdir(parents=True, exist_ok=True)
    IZLAZ.write_text(
        json.dumps(dict(sorted(vozila.items(), key=lambda kv: (len(kv[0]), kv[0]))), ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    print(f"Spremljeno: {IZLAZ}")


if __name__ == "__main__":
    main()
