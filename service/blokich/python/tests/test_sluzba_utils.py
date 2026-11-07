"""
Testovi parsera službi na stvarnom ZET PDF-u.

PDF se ne drži u repozitoriju. Pokretanje:
    SLUZBA_PDF="C:/put/APP službe od 9.11.2026.pdf" python -m pytest python/tests
Bez SLUZBA_PDF testovi s PDF-om se preskaču.
"""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from sluzba_utils import extract_sluzba_full  # noqa: E402

PDF = os.environ.get("SLUZBA_PDF")
pytestmark = pytest.mark.skipif(not PDF or not Path(PDF).is_file(),
                                reason="postavi SLUZBA_PDF na PDF službi")


@pytest.fixture(scope="module")
def rezultat():
    return extract_sluzba_full(Path(PDF).read_bytes())


@pytest.fixture(scope="module")
def po_broju(rezultat):
    return {s["br_sl"]: s for s in rezultat["sluzbe"]}


def test_bez_upozorenja(rezultat):
    assert rezultat["upozorenja"] == []


def test_nema_praznih_ni_naslova(rezultat):
    for s in rezultat["sluzbe"]:
        assert s["od"] and s["do"], s
        assert s["linija"] not in ("SUBOTA", "NEDJELJA", "PRIČUVE", "")


def test_jedinstveni_br_sl(rezultat):
    brojevi = [s["br_sl"] for s in rezultat["sluzbe"]]
    assert len(brojevi) == len(set(brojevi))


def test_sati_po_svim_dijelovima(po_broju):
    # sati vrijede za cijelu službu i upisani su u svaki dio
    for k, s in po_broju.items():
        if k.endswith("P"):
            prvi = po_broju[k.rstrip("P")]
            assert s["efektivni_sati"] == prvi["efektivni_sati"]
            assert s["ukupni_sati"] == prvi["ukupni_sati"]


def test_zbroj_dijelova_jednak_efektivnom(po_broju):
    from collections import defaultdict
    trajanje = defaultdict(int)
    for k, s in po_broju.items():
        h1, m1 = map(int, s["od"].split(":"))
        h2, m2 = map(int, s["do"].split(":"))
        trajanje[k.rstrip("P")] += ((h2 * 60 + m2) - (h1 * 60 + m1)) % 1440
    for broj, minute in trajanje.items():
        h, m = map(int, po_broju[broj]["efektivni_sati"].split(":"))
        assert minute == h * 60 + m, broj


def test_dani_iz_boja(po_broju):
    assert all(s["dani"] for s in po_broju.values())
    assert po_broju["1"]["dani"] == ["RADNI_DAN"]
    assert po_broju["6"]["dani"] == ["RADNI_DAN", "SUBOTA"]


def test_ponasanje_specificno_za_pdf_9_11_2026(po_broju):
    """Zapisi koje je stari parser (extract_table) krivo izvukao."""
    if "361P" not in po_broju or po_broju["1"]["linija"] != "101":
        pytest.skip("drugi PDF")
    assert po_broju["361P"]["linija"] == "401"
    assert po_broju["362P"]["linija"] == "402"
    assert po_broju["363P"]["linija"] == "403"
    assert po_broju["818P"]["linija"] == "403"
    assert po_broju["818P"]["varijanta"] == "1"
    assert po_broju["821P"]["linija"] == "134"
    assert po_broju["79P"]["nastup_sluzbe"] == "MIHAL"
    assert po_broju["854"]["zavrsna_sluzba"] == "O.Š. S"
    assert po_broju["901"]["vazi_od"] == "2026-11-14"
    assert po_broju["901"]["vazi_do"] == "2026-11-15"
