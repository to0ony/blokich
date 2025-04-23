from fastapi import FastAPI, UploadFile, File, HTTPException
from disponent_utils import extract_disponent_from_bytes
from godisnji_utils import extract_godisnji_from_bytes
from sluzba_utils import extract_sluzba_from_bytes
import pdfplumber
import fitz  # PyMuPDF
import io

app = FastAPI()

@app.get("/")
def root():
    return {"message": "PDF Extraction API is running"}

@app.post("/extract-godisnji")
async def extract_godisnji(file: UploadFile = File(...)):
    try:
        content = await file.read()
        result = extract_godisnji_from_bytes(content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/extract-disponent")
async def extract_disponent(file: UploadFile = File(...)):
    try:
        content = await file.read()
        result = extract_disponent_from_bytes(content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract-sluzba")
async def extract_sluzba(file: UploadFile = File(...)):
    try:
        content = await file.read()
        result = extract_sluzba_from_bytes(content)
        return {"sluzbe": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))