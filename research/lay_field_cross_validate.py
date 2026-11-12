#!/usr/bin/env python3
"""Chronological follow-up to PIF Lay the Field historic 2.00-touch research.

TRAIN: 2023 UK flat WIN race records, HOLDOUT: Jan-Apr 2024 (season caveat).
No prices are treated as confirmed queue fills; no betting, API secrets,
model deployment or modifications to PIF Racing live win qualifiers.
"""
import json
import re
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from lay_field_profile_scan import collect, c_name, furlongs, f_band

def series(start,end):
    d=start
    while d<=end:
        yield d
        d += timedelta(days=1)

def inspect(raw):
    output=[]
    for event in raw.values():
        name=event["name"]
        year=event["dt"][6:10] # Betfair EVENT_DT format DD-MM-YYYY ...
        if year not in ("2023","2024"): continue
        f=furlongs(name)
        vals=list(event["runners"].values())
        if len(vals)<2 or sum(w for p,w in vals)!=1: continue
        if re.search(r"\b(?:hrd|hurdle|chase|chases|chs|nhf|nh\s*flat|bumper|hunters?|steeple)\b",name,re.I):continue
        if f is None or f>20:continue
        touched=[(p,w) for p,w in vals if p is not None and 0 < p <= 2.00]
        gross=sum(not w for p,w in touched)-sum(w for p,w in touched)
        output.append({"year":year, "course":c_name(event["hint"]),"distance":str(f)+"f",
            "field":f_band(len(vals)), "exact_runners":str(len(vals)),
            "type":"handicap" if re.search(r"\b(?:hcap|handicap)\b",name,re.I) else "other",
            "two":int(len(touched)>=2),"three":int(len(touched)>=3),
            "four":int(len(touched)>=4),"gross_proxy":gross})
    return output

def aggregate(rows):
    n=len(rows)
    return {"races":n,"two":sum(r["two"] for r in rows),
        "three":sum(r["three"] for r in rows),"four":sum(r["four"] for r in rows),
        "two_pct":round(100*sum(r["two"] for r in rows)/n,1) if n else None,
        "three_pct":round(100*sum(r["three"] for r in rows)/n,1) if n else None,
        "gross_proxy_at_2":sum(r["gross_proxy"] for r in rows)}

def main():
    dates=list(series(date(2023,1,1),date(2024,4,13)))
    events,failed,loaded=collect("EonHorizons",dates)
    if loaded < 400:
        raise RuntimeError("Incomplete historical archive: "+str(loaded)+" files")
    rows=inspect(events)
    train=[r for r in rows if r["year"]=="2023"]
    holdout=[r for r in rows if r["year"]=="2024"]
    dimensions=[["field"],["distance"],["exact_runners"],["course"],
        ["distance","field"],["distance","exact_runners"],
        ["type","distance","field"],["course","distance"],
        ["course","field"],["course","distance","field"],
        ["course","distance","field","type"]]
    groups=[]
    for dims in dimensions:
        def index(vals):
            out=defaultdict(list)
            for row in vals:
                key=" | ".join(row[d] for d in dims)
                out[key].append(row)
            return out
        a=index(train);b=index(holdout)
        for label,old in a.items():
            new=b.get(label,[])
            if len(old)<20 or len(new)<8 or len(old)+len(new)<35:continue
            A,B=aggregate(old),aggregate(new)
            groups.append({"dimensions":"/".join(dims),"profile":label,
                "train_2023":A,"holdout_2024_JanApr":B,
                "combined":aggregate(old+new),
                "illustrative_proxy_nonnegative_in_both":A["gross_proxy_at_2"]>=0 and B["gross_proxy_at_2"]>=0})
    groups.sort(key=lambda x:(x["train_2023"]["three_pct"],x["holdout_2024_JanApr"]["three_pct"],x["combined"]["races"]),reverse=True)
    report={"title":"PIF Lay the Field 2.00 chronological validation",
      "source":"EonHorizons/betfair_sp archived Betfair-format UK WIN CSVs (2023-April 2024)",
      "days_loaded":loaded,"days_failed":failed,"observations":len(rows),
      "train_2023":aggregate(train),"holdout_JanApr_2024":aggregate(holdout),
      "note":"All gross figures illustrative: matched £1 at 2.00 for every IPMIN touch, no commission. Not executable returns. Betfair IPMIN filtered >£100 payouts.",
      "limits":"Older mirror not Betfair-original audited; early 2024 holdout has seasonal mismatch. Profiles discovered on 2023 are not necessarily profitable; multiple testing; no trade fills. No 2025-26 evidence.",
      "profiles":groups,
      "confirmed_profit_qualifiers":[],
      "status":"RESEARCH WATCHLIST ONLY; zero executable/trading-qualified profiles"}
    p=Path("lay_field_2023_2024_validation.json")
    p.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print("SUMMARY",json.dumps({k:v for k,v in report.items() if k!="profiles"},indent=2),flush=True)
    for row in groups[:30]:
        print("PROFILE",json.dumps(row,separators=(",",":")),flush=True)
if __name__=="__main__":main()
