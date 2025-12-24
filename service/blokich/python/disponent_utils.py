import pdfplumber
from datetime import datetime, timedelta
import re
import io

def extract_week_info(dates):
    first_date = datetime.strptime(dates[0], '%d.%m.%Y')
    week_num = first_date.isocalendar()[1]
    year = first_date.isocalendar()[0]  # Koristi ISO godinu umjesto godine iz datuma
    return year, week_num

def extract_dates_from_title(pdf):
    first_page = pdf.pages[0]
    text = first_page.extract_text()
    
    date_match = re.search(r'od (\d{1,2}\.\d{1,2}\.\d{4})\. do (\d{1,2}\.\d{1,2}\.\d{4})', text)
    if date_match:
        start_date = datetime.strptime(date_match.group(1), '%d.%m.%Y')
        end_date = datetime.strptime(date_match.group(2), '%d.%m.%Y')
        
        dates = []
        current_date = start_date
        while current_date <= end_date:
            dates.append(current_date.strftime('%d.%m.%Y'))
            current_date += timedelta(days=1)
        
        return dates
    return None

def extract_disponent_from_bytes(pdf_bytes: bytes):
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        dates = extract_dates_from_title(pdf)
        if not dates or len(dates) != 7:
            raise ValueError("Nije moguće izvući točno 7 datuma iz naslova dokumenta")
        
        year, week_num = extract_week_info(dates)
        day_abbreviations = ['pon', 'uto', 'sri', 'cet', 'pet', 'sub', 'ned']
        headers = ['radnik'] + day_abbreviations

        all_data = []
        for page in pdf.pages:
            table = page.extract_table()
            if not table:
                continue
            for row in table:
                if not row or all(cell is None or cell.strip() == "" for cell in row):
                    continue
                half = len(row) // 2
                for side in (row[:half], row[half:]):
                    if len(side) >= 8 and side[0]:
                        cleaned = [cell.strip() if cell else '' for cell in side[:8]]
                        if cleaned[0] and (cleaned[0].isdigit() or cleaned[0].startswith('0')):
                            all_data.append(cleaned)

        result = {
            "godina": year,
            "brojTjedna": week_num,
            "radnici": [{headers[i]: row[i] for i in range(len(headers))} for row in all_data]
        }
        return result
