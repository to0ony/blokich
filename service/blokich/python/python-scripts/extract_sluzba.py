"""CLI: python extract_sluzba.py <pdf> -> ispiše put do privremenog JSON-a.

Logika je u ../sluzba_utils.py (isti parser kao FastAPI endpoint).
"""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from sluzba_utils import extract_sluzba_from_bytes  # noqa: E402

if __name__ == "__main__":
    try:
        data_list = extract_sluzba_from_bytes(Path(sys.argv[1]).read_bytes())
        with tempfile.NamedTemporaryFile(mode="w+", suffix=".json", delete=False,
                                         encoding="utf-8") as tmp_file:
            json.dump(data_list, tmp_file, ensure_ascii=False)
            print(tmp_file.name)
    except Exception as e:
        print(f"Greška: {str(e)}", file=sys.stderr)
        sys.exit(1)
