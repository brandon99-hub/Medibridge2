import csv
import json

input_file = "icd11.txt"
output_file = "icd11_dict.json"

icd_dict = {}

with open(input_file, "r", encoding="utf-8") as tsvfile:
    reader = csv.DictReader(tsvfile, delimiter="\t")
    for row in reader:
        code = row.get("Code", "").strip()
        title = row.get("Title", "").strip().strip('"').replace("-", "").strip()
        class_kind = row.get("ClassKind", "").strip()
        # Only include actual categories (not blocks/chapters)
        if code and title and class_kind == "category":
            key = title.lower()
            icd_dict[key] = {"code": code, "desc": title}

with open(output_file, "w", encoding="utf-8") as jsonfile:
    json.dump(icd_dict, jsonfile, ensure_ascii=False, indent=2)

print(f"Extracted {len(icd_dict)} ICD-11 codes to {output_file}") 