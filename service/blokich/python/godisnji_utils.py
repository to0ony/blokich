import pdfplumber
import io

def extract_godisnji_from_bytes(pdf_bytes: bytes):
    vozaci = []

    table_settings = {
        "vertical_strategy": "lines",
        "horizontal_strategy": "lines",
    }

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_index, original_page in enumerate(pdf.pages):
            page = original_page
            if page_index == 0:
                page = page.crop((0, 80, page.width, page.height - 50))

            tables = page.extract_tables(table_settings=table_settings)

            for table in tables:
                for row in table:
                    if not row or not row[0] or "IME" in row[0].upper():
                        continue

                    if len(row) < 13:
                        continue

                    cleaned = [(col.strip() if col else "") for col in row]

                    if cleaned[0].upper() == "RED" or cleaned[1].upper() == "SLUŽ." or "IME I PREZIME" in cleaned[2].upper():
                        continue

                    vozac = {
                        "sluz_broj": cleaned[1],
                        "ime_prezime": cleaned[2],
                        "godisnji": [
                            {"dio": "prvi", "od": cleaned[3], "do": cleaned[4], "dana": cleaned[5]},
                            {"dio": "drugi", "od": cleaned[6], "do": cleaned[7], "dana": cleaned[8]},
                            {"dio": "treci", "od": cleaned[9], "do": cleaned[10], "dana": cleaned[11]}
                        ],
                        "ukupno_dana": cleaned[12]
                    }

                    vozaci.append(vozac)

    return {"vozaci": vozaci}
