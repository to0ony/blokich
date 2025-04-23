import pdfplumber
import io

def clean_line_varijanta(line_value):
    if line_value and " " in line_value:
        parts = line_value.split(" ", 1)
        return parts[0], parts[1]
    return line_value, None

def process_row(row_data, data_list):
    if all(cell is None or cell.strip() == "" for cell in row_data):
        return

    if any("\n" in str(cell) for cell in row_data):
        split_values = [cell.split("\n") if "\n" in str(cell) else [cell, cell] for cell in row_data]

        first_entry = [split_values[i][0] for i in range(len(split_values))]
        if first_entry[0] != "P":
            linija, varijanta = clean_line_varijanta(first_entry[1])
            data_list.append({
                "br_sl": first_entry[0],
                "linija": linija,
                "varijanta": varijanta if varijanta else first_entry[2],
                "nastup_sluzbe": first_entry[3],
                "od": first_entry[4],
                "do": first_entry[5],
                "zavrsna_sluzba": first_entry[6],
                "nocni_rad": first_entry[7],
                "druga_smjena": first_entry[8],
                "efektivni_sati": first_entry[9],
                "ukupni_sati": first_entry[10]
            })

        second_entry = [split_values[i][1] for i in range(len(split_values))]
        second_entry[0] += "P"
        if second_entry[0] != "P":
            linija, varijanta = clean_line_varijanta(second_entry[1])
            data_list.append({
                "br_sl": second_entry[0],
                "linija": linija,
                "varijanta": varijanta if varijanta else second_entry[2],
                "nastup_sluzbe": second_entry[3],
                "od": second_entry[4],
                "do": second_entry[5],
                "zavrsna_sluzba": second_entry[6],
                "nocni_rad": second_entry[7],
                "druga_smjena": second_entry[8],
                "efektivni_sati": second_entry[9],
                "ukupni_sati": second_entry[10]
            })
    else:
        if row_data[0] != "P":
            linija, varijanta = clean_line_varijanta(row_data[1])
            data_list.append({
                "br_sl": row_data[0],
                "linija": linija,
                "varijanta": varijanta if varijanta else row_data[2],
                "nastup_sluzbe": row_data[3],
                "od": row_data[4],
                "do": row_data[5],
                "zavrsna_sluzba": row_data[6],
                "nocni_rad": row_data[7],
                "druga_smjena": row_data[8],
                "efektivni_sati": row_data[9],
                "ukupni_sati": row_data[10]
            })

def extract_sluzba_from_bytes(pdf_bytes: bytes):
    data_list = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if not table or len(table) < 3:
                continue

            data_rows = table[2:]

            for row in data_rows:
                if not any(cell and cell.strip() for cell in row):
                    continue

                half = len(row) // 2
                left_side = row[:half]
                right_side = row[half:]

                if any(cell and cell.strip() for cell in left_side):
                    process_row(left_side, data_list)
                if any(cell and cell.strip() for cell in right_side):
                    process_row(right_side, data_list)

    return data_list
