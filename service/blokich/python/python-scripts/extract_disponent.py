import pdfplumber
import json
import os
import re
import sys
from datetime import datetime
from dateutil import relativedelta
from datetime import timedelta

def extract_week_info(dates):
    first_date = datetime.strptime(dates[0], '%d.%m.%Y')
    week_num = first_date.isocalendar()[1]
    year = first_date.year
    return year, week_num

def extract_dates_from_title(pdf):
    first_page = pdf.pages[0]
    text = first_page.extract_text()
    
    date_match = re.search(r'od (\d{1,2}\.\d{1,2}\.\d{4})\. do (\d{1,2}\.\d{1,2}\.\d{4})', text)
    if date_match:
        start_date_str = date_match.group(1)
        end_date_str = date_match.group(2)
        
        start_date = datetime.strptime(start_date_str, '%d.%m.%Y')
        end_date = datetime.strptime(end_date_str, '%d.%m.%Y')
        
        dates = []
        current_date = start_date
        while current_date <= end_date:
            dates.append(current_date.strftime('%d.%m.%Y'))
            current_date += timedelta(days=1)  # ← koristi timedelta umjesto .replace()
        
        return dates
    
    return None

def extract_table_data(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        dates = extract_dates_from_title(pdf)
        if not dates or len(dates) != 7:
            raise ValueError("Nije moguće izvući točno 7 datuma iz naslova dokumenta")
        
        year, week_num = extract_week_info(dates)
        day_abbreviations = ['pon', 'uto', 'sri', 'cet', 'pet', 'sub', 'ned']
        headers = ['radnik'] + day_abbreviations
        
        all_data = []
        
        for page in pdf.pages:
            table = page.extract_table()
            if not table or len(table) < 1:
                continue
            
            for row in table:
                if not row or all(cell is None or cell.strip() == "" for cell in row):
                    continue
                
                half = len(row) // 2
                left_side = row[:half]
                right_side = row[half:]
                
                if len(left_side) >= 8 and left_side[0]: 
                    cleaned_left = [cell.strip() if cell else '' for cell in left_side[:8]]
                    if cleaned_left[0] and (cleaned_left[0].isdigit() or cleaned_left[0].startswith('0')):
                        all_data.append(cleaned_left)
                
                if len(right_side) >= 8 and right_side[0]:
                    cleaned_right = [cell.strip() if cell else '' for cell in right_side[:8]]
                    if cleaned_right[0] and (cleaned_right[0].isdigit() or cleaned_right[0].startswith('0')):
                        all_data.append(cleaned_right)
        
        result = {
            "godina": year,
            "brojTjedna": week_num,
            "radnici": []
        }
        
        for row in all_data:
            entry = {headers[i]: row[i] for i in range(len(headers))}
            result["radnici"].append(entry)
        
        return result

# Glavni ulaz kad se pokreće iz backend procesa
if __name__ == "__main__":
    try:
        pdf_path = sys.argv[1]
        extracted_data = extract_table_data(pdf_path)
        print(json.dumps(extracted_data, ensure_ascii=False))  # ispisujemo JSON
    except Exception as e:
        print(f"Greška pri obradi dokumenta: {str(e)}", file=sys.stderr)
        sys.exit(1)
