import json
import logging
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
import spacy
import uvicorn
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load scispaCy model (ensure this is installed in your environment)
NLP_MODEL = os.environ.get("SCISPACY_MODEL", "en_core_sci_sm")
try:
    nlp = spacy.load(NLP_MODEL)
    logger.info(f"Loaded scispaCy model: {NLP_MODEL}")
except Exception as e:
    logger.error(f"Failed to load scispaCy model: {e}")
    raise

# Load ICD-11 dictionary (assume it's a JSON file: {"entity": {"code": ..., "desc": ...}, ...})
ICD11_DICT_PATH = os.environ.get("ICD11_DICT_PATH", "icd11_dict.json")
try:
    with open(ICD11_DICT_PATH, "r", encoding="utf-8") as f:
        ICD11_DICT = json.load(f)
    logger.info(f"Loaded ICD-11 dictionary from {ICD11_DICT_PATH}")
except Exception as e:
    logger.error(f"Failed to load ICD-11 dictionary: {e}")
    ICD11_DICT = {}

app = FastAPI()

class AnalyzeRequest(BaseModel):
    diagnosis: Optional[str] = ""
    prescription: Optional[str] = ""
    treatment: Optional[str] = ""

class EntityResult(BaseModel):
    text: str
    label: str
    icd_code: Optional[str] = None
    icd_description: Optional[str] = None
    confidence: Optional[float] = None

class AnalyzeResponse(BaseModel):
    entities: List[EntityResult]
    icd_codes: List[Dict[str, Any]]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    try:
        text = " ".join([request.diagnosis or "", request.prescription or "", request.treatment or ""]).strip()
        if not text:
            raise HTTPException(status_code=400, detail="No text provided.")

        doc = nlp(text)
        entities = []
        icd_codes = []
        seen_codes = set()

        for ent in doc.ents:
            ent_text = ent.text.strip().lower()
            icd_info = ICD11_DICT.get(ent_text)
            icd_code = None
            icd_description = None
            confidence = 1.0 if icd_info else 0.0

            if icd_info:
                if isinstance(icd_info, dict):
                    icd_code = icd_info.get("code")
                    icd_description = icd_info.get("desc")
                else:
                    icd_code = icd_info
                if icd_code and icd_code not in seen_codes:
                    icd_codes.append({
                        "entity": ent.text,
                        "icd_code": icd_code,
                        "icd_description": icd_description,
                        "confidence": confidence
                    })
                    seen_codes.add(icd_code)
            entities.append({
                "text": ent.text,
                "label": ent.label_,
                "icd_code": icd_code,
                "icd_description": icd_description,
                "confidence": confidence
            })

        return {"entities": entities, "icd_codes": icd_codes}
    except Exception as e:
        logger.exception("Error in /analyze")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 