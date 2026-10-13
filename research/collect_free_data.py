"""PIF Racing £0 data collector. Standard-library only.

Stores permitted Free API racecard snapshots and race-level results metadata.
Free results DO NOT identify winning runners or provide sectional times.
No network access is needed to run tests.
"""
import argparse
import base64
import json
import os
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode

API="https://api.theracingapi.com"
SCHEMA="""
CREATE TABLE IF NOT EXISTS snapshots (
  category TEXT NOT NULL,
  race_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  race_date TEXT,
  race_type TEXT,
  course TEXT,
  payload_json TEXT NOT NULL,
  PRIMARY KEY(category,race_id,captured_at)
);
CREATE INDEX IF NOT EXISTS snapshots_lookup ON snapshots(race_id,captured_at);
"""
def connect(path):
    db=sqlite3.connect(str(path))
    db.executescript(SCHEMA)
    return db

def get_page(path, params, username, password):
    q=urlencode(params,doseq=True)
    token=base64.b64encode(f"{username}:{password}".encode()).decode()
    req=Request(API+path+("?"+q if q else ""),headers={
       "Authorization":"Basic "+token,"Accept":"application/json",
       "User-Agent":"PIF-Racing-Research/0.1"})
    with urlopen(req,timeout=25) as response:
        return json.load(response)

def save_records(db, category, records, timestamp=None):
    if category not in ("racecard","result_summary"):
        raise ValueError("Invalid category")
    timestamp=timestamp or datetime.now(timezone.utc).isoformat()
    count=0
    with db:
        for r in records:
            if not isinstance(r,dict): continue
            rid=str(r.get("race_id") or "").strip()
            if not rid: continue
            db.execute("INSERT OR IGNORE INTO snapshots VALUES(?,?,?,?,?,?,?)",
                       (category,rid,timestamp,str(r.get("date") or ""),
                        str(r.get("type") or ""),str(r.get("course") or ""),
                        json.dumps(r,separators=(",",":"),ensure_ascii=False)))
            count+=1
    return count

def capture(db,username,password):
    stamp=datetime.now(timezone.utc).isoformat()
    counts={"racecards":0,"result_summaries":0}
    # Yesterday's and previous results are NOT accessible on the Free tier.
    for day in ("today","tomorrow"):
        skip=0
        while True:
            data=get_page("/v1/racecards/free",{"day":day,"limit":100,"skip":skip,
                                  "region_codes":["gb","ire"]},username,password)
            rows=data.get("racecards",[])
            if not isinstance(rows,list): raise ValueError("Malformed racecards payload")
            counts["racecards"]+=save_records(db,"racecard",rows,stamp)
            if len(rows)<100:break
            skip+=len(rows)
            time.sleep(1.1)
        time.sleep(1.1)
    # Free result contains race summaries, not runner outcomes.
    skip=0
    while True:
        data=get_page("/v1/results/today/free",{"limit":100,"skip":skip},
                      username,password)
        rows=data.get("results",[])
        if not isinstance(rows,list):raise ValueError("Malformed results payload")
        counts["result_summaries"]+=save_records(db,"result_summary",rows,stamp)
        if len(rows)<100:break
        skip+=len(rows)
        time.sleep(1.1)
    return counts

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--database",default="local_data/racing_snapshots.sqlite")
    a=p.parse_args()
    username=os.getenv("RACING_API_USERNAME")
    password=os.getenv("RACING_API_PASSWORD")
    if not username or not password:
        p.error("Set RACING_API_USERNAME and RACING_API_PASSWORD in your environment")
    Path(a.database).parent.mkdir(parents=True,exist_ok=True)
    db=connect(a.database)
    try:print(json.dumps(capture(db,username,password),indent=2))
    finally:db.close()

if __name__=="__main__":main()
