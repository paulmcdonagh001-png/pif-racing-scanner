"""Validate and normalise licensed historical National Hunt race-result CSVs.

One row per runner. Accept only genuine recorded race times; never infer missing data.
Outputs a clean file for subsequent speed-rating model research. No web scraping.
"""
import argparse, csv, math
from collections import defaultdict
from datetime import date
from pathlib import Path

REQUIRED = {"race_id","race_date","course","race_type","handicap",
            "distance_furlongs","going","official_time_seconds",
            "runner_id","horse_name","finish_position"}
FIELDS = ["race_id","race_date","course","race_type","handicap",
          "distance_furlongs","going","official_time_seconds",
          "runner_id","horse_name","finish_position","beaten_lengths",
          "carried_weight_lbs","official_rating","source"]

def parse_float(value, label, mandatory=False):
    if value is None or not str(value).strip():
        if mandatory: raise ValueError(f"Missing {label}")
        return ""
    num = float(value)
    if not math.isfinite(num): raise ValueError(f"Invalid {label}")
    return num

def import_csv(input_path, output_path):
    races = defaultdict(list)
    with open(input_path, newline="", encoding="utf-8-sig") as handle:
        reader=csv.DictReader(handle)
        missing=REQUIRED-set(reader.fieldnames or [])
        if missing: raise ValueError("Missing required columns: "+", ".join(sorted(missing)))
        for lineno, original in enumerate(reader,2):
            try:
                row={k:str(original.get(k) or "").strip() for k in FIELDS}
                date.fromisoformat(row["race_date"])
                if not row["race_id"] or not row["runner_id"] or not row["course"] or not row["horse_name"]:
                    raise ValueError("Missing required identity")
                if row["race_type"].lower() not in ("hurdle","chase","flat","nh flat"):
                    raise ValueError("Unsupported race_type")
                if row["handicap"].lower() not in ("true","false","1","0"):
                    raise ValueError("handicap must be true/false")
                distance=parse_float(row["distance_furlongs"],"distance_furlongs",True)
                race_time=parse_float(row["official_time_seconds"],"official_time_seconds",True)
                if distance<=0 or race_time<=0: raise ValueError("Invalid race distance or time")
                for optional in ("beaten_lengths","carried_weight_lbs","official_rating"):
                    n=parse_float(row[optional],optional)
                    if n!="" and n<0: raise ValueError("Negative "+optional)
                position=row["finish_position"]
                if position:
                    if not position.isdigit() or int(position)<1: raise ValueError("Invalid finish position")
                races[row["race_id"]].append(row)
            except (ValueError, TypeError) as exc:
                raise ValueError(f"Input line {lineno}: {exc}") from exc
    if not races: raise ValueError("No historical results")
    output=[]
    for rid, runners in sorted(races.items()):
        if len({x["runner_id"] for x in runners})!=len(runners):
            raise ValueError(f"Duplicate runner IDs in race {rid}")
        metadata=("race_date","course","race_type","handicap","distance_furlongs",
                  "going","official_time_seconds")
        for k in metadata:
            if len({x[k] for x in runners})!=1:
                raise ValueError(f"Inconsistent race {rid} field {k}")
        finishers=[r for r in runners if r["finish_position"].isdigit()]
        if sum(r["finish_position"]=="1" for r in finishers)!=1:
            raise ValueError(f"Race {rid} must contain one winner")
        output.extend(runners)
    Path(output_path).parent.mkdir(parents=True,exist_ok=True)
    with open(output_path,"w",newline="",encoding="utf-8") as handle:
        writer=csv.DictWriter(handle,fieldnames=FIELDS)
        writer.writeheader();writer.writerows(output)
    return {"races":len(races),"runners":len(output),"output":str(output_path)}

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--input",required=True,help="Licensed source CSV converted to canonical column names")
    p.add_argument("--output",required=True)
    a=p.parse_args()
    print(import_csv(a.input,a.output))
