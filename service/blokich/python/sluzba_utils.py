"""
Izvlačenje službi iz ZET-ovog PDF-a "APP službe ...".

Izlaz je ravni popis zapisa, po jedan za svaki dio službe:
  * prvi dio ima br_sl "79", drugi "79P" (treći bi bio "79PP")
  * polja i formati su isti kao prije (stringovi kao u PDF-u: "1,42", "06:55")
  * sati (nocni_rad, druga_smjena, efektivni_sati, ukupni_sati) odnose se na
    cijelu službu i namjerno su upisani u svaki njezin dio
  * dodatna polja: dani, vazi_od, vazi_do, sekcija, vrsta

Zašto ovako, a ne page.extract_table():
  * extract_table() ponekad ne razdvoji dva retka ćelije, pa se vrijednost iz
    prvog dijela kopirala u drugi (npr. 361P je dobio liniju 112 umjesto 401)
  * ovdje se čitaju koordinate riječi, a granice stupaca uzimaju iz vertikalnih
    linija rešetke tablice, tako da svaka vrijednost završi u svom stupcu
  * tip dana čita se iz boje ćelija (plava = radni dan, zelena = subota,
    crvena = nedjelja; ćelija BR.SL. daje glavni dan, ćelija LIN. dodatni)
  * prazni brojevi i naslovi sekcija ("SUBOTA", "PRIČUVE"...) nisu službe
  * svaka služba se provjerava (zbroj dijelova = EFEK.), a odstupanja idu u
    "upozorenja"
"""
from __future__ import annotations

import io
import re

import pdfplumber

COLS = ["br_sl", "linija", "vozni_red", "nastup", "od", "do", "zavrsetak",
        "nocni", "druga_smjena", "efektivno", "ukupno"]
# Rezervne granice stupaca (x) za lijevu polovicu, ako se rešetka ne pronađe.
DEFAULT_GRID_LEFT = [19, 46, 70, 87, 119, 144, 170, 199, 225, 251, 277, 303]
HALF_OFFSET = 285

COLOR_NAMES = {
    (0.0, 0.0, 1.0): "plava",
    (0.196, 0.804, 0.196): "zelena",
    (1.0, 0.0, 0.0): "crvena",
}
COLOR_TO_DAY = {"plava": "RADNI_DAN", "zelena": "SUBOTA", "crvena": "NEDJELJA"}
DAY_ORDER = ["RADNI_DAN", "SUBOTA", "NEDJELJA"]

RE_TIME = re.compile(r"^\d{1,2}:\d{2}$")
RE_DEC = re.compile(r"^\d+,\d+$")
RE_INT = re.compile(r"^\d{1,4}$")
RE_DATE = re.compile(r"(\d{1,2})\.(\d{1,2})\.(\d{4})\.?")


# ----------------------------------------------------------------------------- pomoćne

def _to_min(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _iso(d: str, m: str, y: str) -> str:
    return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"


def _color_name(rgb):
    if not rgb or len(rgb) != 3:
        return None
    for ref, name in COLOR_NAMES.items():
        if all(abs(a - b) < 0.02 for a, b in zip(rgb, ref)):
            return name
    if all(abs(c - rgb[0]) < 0.02 for c in rgb):
        return None  # bijela, crna, siva (pozadina, linije, naslovi)
    return "nepoznata:" + "".join(f"{round(c * 255):02x}" for c in rgb)


def _detect_grid(page):
    """Vertikalne linije u zaglavlju tablice -> granice stupaca obje polovice."""
    xs = sorted(r["x0"] for r in page.rects
                if r["width"] < 1.5 and r["height"] > 5 and 28 < r["top"] < 60)
    dedup = []
    for x in xs:
        if not dedup or x - dedup[-1] > 2:
            dedup.append(x)
    left = [x for x in dedup if x < page.width / 2]
    right = [x for x in dedup if x >= page.width / 2 - 5]
    if len(left) >= 11 and len(right) >= 11:
        left = left[:12]
        if len(left) == 11:
            left.append(right[0])
        right = right[:12]
        if len(right) == 11:
            right.append(page.width - 20)
        return left, right
    return None


def _col_of(x0, grid):
    x = x0 + 1.5
    for i in range(len(COLS)):
        if grid[i] - 4 <= x < grid[i + 1]:
            return COLS[i]
    return None


def _parse_header(words):
    text = " ".join(w["text"] for w in sorted((w for w in words if w["top"] < 32),
                                              key=lambda w: w["x0"]))
    od = do = None
    m = re.search(r"U prometu od:\s*(.+?)(?:\s+Str\.|$)", text)
    if m:
        dates = RE_DATE.findall(m.group(1))
        if dates:
            od = _iso(*dates[0])
        if len(dates) > 1:
            do = _iso(*dates[1])
    return od, do


def _group_rows(words, tol=4.0):
    rows = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if rows and abs(w["top"] - rows[-1]["top"]) < tol:
            rows[-1]["words"].append(w)
        else:
            rows.append({"top": w["top"], "words": [w]})
    for r in rows:
        r["words"].sort(key=lambda w: w["x0"])
    return rows


def _classify_row(row, grid):
    cells = {c: [] for c in COLS}
    for w in row["words"]:
        c = _col_of(w["x0"], grid)
        if c:
            cells[c].append(w["text"])
    text_all = [w["text"] for w in row["words"]]
    if any(t == "XX" for t in text_all):
        return "legenda", cells, text_all
    if (len(cells["od"]) == 1 and RE_TIME.match(cells["od"][0])
            and len(cells["do"]) == 1 and RE_TIME.match(cells["do"][0])):
        return "segment", cells, text_all
    hours_cols = ("druga_smjena", "efektivno", "ukupno", "nocni")
    only_hours = all(
        (c in hours_cols and all(RE_DEC.match(t) or RE_TIME.match(t) for t in v))
        or (c == "br_sl" and all(t == "P" or RE_INT.match(t) for t in v))
        or not v
        for c, v in cells.items()
    ) and any(cells[c] for c in hours_cols)
    if only_hours:
        return "sati", cells, text_all
    return "tekst", cells, text_all


# ----------------------------------------------------------------------------- parsiranje

def parse_sluzbe(pdf_bytes: bytes) -> dict:
    """Puni rezultat: službe s dijelovima, stranice i upozorenja."""
    warnings: list[str] = []
    pages = []
    raw = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        last = (None, None)
        for pno, page in enumerate(pdf.pages, 1):
            words = page.extract_words()
            od, do = _parse_header(words)
            inherited = od is None and last[0] is not None
            if od is None:
                od, do = last
            else:
                last = (od, do)
            pages.append({"stranica": pno, "vazi_od": od, "vazi_do": do,
                          "zaglavlje_naslijedeno": inherited})

            grid = _detect_grid(page)
            if grid is None:
                warnings.append(f"str. {pno}: rešetka tablice nije pronađena, koriste se zadane granice")
                grid = (DEFAULT_GRID_LEFT, [x + HALF_OFFSET for x in DEFAULT_GRID_LEFT])

            colored = []
            for r in page.rects:
                if r.get("fill"):
                    name = _color_name(r.get("non_stroking_color"))
                    if name:
                        colored.append({"x0": r["x0"], "top": r["top"],
                                        "bottom": r["bottom"], "boja": name})

            mid = (grid[0][-1] + grid[1][0]) / 2
            body = [w for w in words if w["top"] > 50]
            for half, g in (("lijevi", grid[0]), ("desni", grid[1])):
                current = None
                in_legend = False
                half_duties = []
                for row in _group_rows([w for w in body if (w["x0"] < mid) == (half == "lijevi")]):
                    kind, cells, text_all = _classify_row(row, g)
                    if kind == "legenda" or (in_legend and kind == "tekst"):
                        in_legend = True
                        current = None
                        continue
                    nums = [t for t in cells["br_sl"] if RE_INT.match(t)]
                    if nums:
                        current = {"broj": int(nums[0]), "stranica": pno, "top": row["top"],
                                   "rows": [], "grid": g}
                        raw.append(current)
                        half_duties.append(current)
                    if current is None:
                        if text_all:
                            warnings.append(f"str. {pno}: tekst izvan službe: {' '.join(text_all)}")
                        continue
                    current["rows"].append((kind, cells, text_all, row["top"]))
                for i, d in enumerate(half_duties):
                    bottom = half_duties[i + 1]["top"] - 2 if i + 1 < len(half_duties) else page.height
                    d["colors"] = [c for c in colored
                                   if d["top"] - 5 <= (c["top"] + c["bottom"]) / 2 < bottom - 3
                                   and g[0] - 3 <= c["x0"] < g[3]]

    duties = sorted((_build_duty(d, warnings) for d in raw), key=lambda d: d["broj"])

    section = None
    seen = {}
    page_map = {p["stranica"]: p for p in pages}
    for d in duties:
        if d["naslov"]:
            section = d["naslov"]
        d["sekcija"] = section
        p = page_map[d["stranica"]]
        d["vazi_od"], d["vazi_do"] = p["vazi_od"], p["vazi_do"]
        if d["broj"] in seen:
            warnings.append(f"služba {d['broj']}: duplikat (str. {seen[d['broj']]} i {d['stranica']})")
        seen[d["broj"]] = d["stranica"]

    return {"sluzbe": duties, "stranice": pages, "upozorenja": warnings}


def _build_duty(d, warnings) -> dict:
    g = d["grid"]
    segs, texts = [], []
    hours = {}
    nocni = []
    lone_p = False

    for kind, cells, text_all, top in d["rows"]:
        p_flag = "P" in cells["br_sl"]
        if kind in ("segment", "sati"):
            for key in ("druga_smjena", "efektivno", "ukupno"):
                if cells[key]:
                    if key in hours:
                        warnings.append(f"služba {d['broj']}: više vrijednosti za {key}")
                    hours[key] = cells[key][0]
            nocni.extend(cells["nocni"])
        if kind == "segment":
            lin = cells["linija"]
            vr = cells["vozni_red"]
            if len(lin) > 1 and not vr:  # "112 1" u jednom stupcu
                lin, vr = lin[:1], lin[1:]
            od, do = cells["od"][0], cells["do"][0]
            dur = _to_min(do) - _to_min(od)
            segs.append({
                "oznaka_p": p_flag,
                "linija": " ".join(lin) or None,
                "varijanta": " ".join(vr) or None,
                "nastup_sluzbe": " ".join(cells["nastup"]) or None,
                "od": od,
                "do": do,
                "zavrsna_sluzba": " ".join(cells["zavrsetak"]) or None,
                "trajanje_min": dur + 1440 if dur < 0 else dur,
            })
        elif kind == "sati":
            lone_p |= p_flag
        else:
            t = " ".join(x for x in text_all if not (RE_INT.match(x) and int(x) == d["broj"]))
            if t:
                texts.append(t)

    colors = d.get("colors", [])
    names = {c["boja"] for c in colors}
    days = [x for x in DAY_ORDER if x in {COLOR_TO_DAY.get(n) for n in names}]
    unknown = sorted(n for n in names if n.startswith("nepoznata"))
    if unknown:
        warnings.append(f"služba {d['broj']}: nepoznata boja {unknown}")
    if len(set(nocni)) > 1:
        warnings.append(f"služba {d['broj']}: više vrijednosti noćnog rada {nocni}")

    if segs:
        efek = hours.get("efektivno")
        total = sum(s["trajanje_min"] for s in segs)
        if efek is None:
            warnings.append(f"služba {d['broj']}: nema efektivnog vremena")
        elif total != _to_min(efek):
            warnings.append(f"služba {d['broj']}: zbroj dijelova {total} min, EFEK. {efek}")
        if "ukupno" not in hours:
            warnings.append(f"služba {d['broj']}: nema ukupnih sati")
        if not days:
            warnings.append(f"služba {d['broj']}: tip dana (boja) nije prepoznat")
        if texts:
            warnings.append(f"služba {d['broj']}: neočekivan tekst {texts}")

    if not segs:
        vrsta = "prazna"
    elif len(segs) == 1:
        vrsta = "jednodijelna"
    elif any(s["oznaka_p"] for s in segs[1:]):
        vrsta = "s_pauzom"
    else:
        vrsta = "dvokratna"

    return {
        "broj": d["broj"],
        "stranica": d["stranica"],
        "vrsta": vrsta,
        "dani": days,
        "naslov": " ".join(texts) if texts and not segs else None,
        "nocni_rad": nocni[0] if nocni else None,
        "druga_smjena": hours.get("druga_smjena"),
        "efektivni_sati": hours.get("efektivno"),
        "ukupni_sati": hours.get("ukupno"),
        "oznaka_p_bez_dijela": lone_p,
        "dijelovi": segs,
    }


def to_flat(result: dict) -> list[dict]:
    """Ravni popis zapisa u formatu koji koristi NestJS/Mongo (SluzbaItem)."""
    flat = []
    for d in result["sluzbe"]:
        for i, s in enumerate(d["dijelovi"]):
            flat.append({
                "br_sl": str(d["broj"]) + "P" * i,
                "linija": s["linija"],
                "varijanta": s["varijanta"],
                "nastup_sluzbe": s["nastup_sluzbe"],
                "od": s["od"],
                "do": s["do"],
                "zavrsna_sluzba": s["zavrsna_sluzba"],
                "nocni_rad": d["nocni_rad"],
                "druga_smjena": d["druga_smjena"],
                "efektivni_sati": d["efektivni_sati"],
                "ukupni_sati": d["ukupni_sati"],
                "dani": d["dani"],
                "vazi_od": d["vazi_od"],
                "vazi_do": d["vazi_do"],
                "sekcija": d["sekcija"],
                "vrsta": d["vrsta"],
            })
    return flat


def extract_sluzba_full(pdf_bytes: bytes) -> dict:
    """Odgovor za /extract-sluzba: ravni zapisi + upozorenja + sažetak."""
    result = parse_sluzbe(pdf_bytes)
    flat = to_flat(result)
    working = [d for d in result["sluzbe"] if d["dijelovi"]]
    return {
        "sluzbe": flat,
        "upozorenja": result["upozorenja"],
        "sazetak": {
            "sluzbi": len(working),
            "zapisa": len(flat),
            "praznih_brojeva": len(result["sluzbe"]) - len(working),
            "po_danima": {day: sum(day in d["dani"] for d in working) for day in DAY_ORDER},
        },
    }


def extract_sluzba_from_bytes(pdf_bytes: bytes) -> list[dict]:
    """Kompatibilno sa starim pozivom: samo ravni popis zapisa."""
    return to_flat(parse_sluzbe(pdf_bytes))
