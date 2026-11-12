#!/usr/bin/env python3
"""Independent Betfair BSP UK/IRE WIN research; price touches, NOT executable fills.

Fetch daily free Betfair CSVs, analyse Flat races, and output *aggregates only*.
No exchange credentials, betting actions, licensed raw-data commits, or changes
to the PIF live horse-ranking model. Free IPMIN excludes small traded amounts.
"""
import argparse
import collections
import concurrent.futures
import csv
import datetime as dt
import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://promo.betfair.com/betfairsp/prices/"
NAME = re.compile(r"dwbfprices(uk|ire)win(\d{2})(\d{2})(\d{4})\.csv", re.I)
JUMPS = re.compile(r"\b(?:hrd|hurdle|hurdles|chas(?:e|es)|chs|nhf|nh\s*flat|bumper|hunters?|steeple)\b", re.I)
HANDICAP = re.compile(r"\b(?:hcap|handicap)\b", re.I)
MILE = re.compile(r"(?<!\w)(\d+)m(?:(\d+)f)?(?!\w)", re.I)
FURLONG = re.compile(r"(?<!\w)(\d+)f(?!\w)", re.I)
COURSES = (
    "Chelmsford City", "Wolverhampton", "Leopardstown", "Down Royal", "Downpatrick",
    "Fairyhouse", "Roscommon", "Punchestown", "Bellewstown", "Clonmel", "Kilbeggan",
    "Tipperary", "Ballinrobe", "Listowel", "Killarney", "Curragh", "Dundalk",
    "Navan", "Naas", "Gowran Park", "Cork", "Galway", "Sligo", "Tramore", "Thurles",
    "Newcastle", "Lingfield", "Southwell", "Kempton", "Newmarket", "Newbury",
    "Doncaster", "Chelmsford", "Brighton", "Windsor", "Bath", "Ascot",
    "Goodwood", "Epsom", "Leicester", "Chester", "Carlisle", "Hamilton",
    "Redcar", "Beverley", "Musselburgh", "Nottingham", "Pontefract",
    "Wetherby", "Catterick", "Ripon", "Sandown", "Haydock", "York",
    "Yarmouth", "Thirsk", "Salisbury", "Ayr", "Ffos Las", "Worcester",
    "Warwick", "Chepstow", "Stratford", "Plumpton", "Brighton",
)
COURSE_PATTERNS = [(name, re.compile(r"(?<![a-z])" + re.escape(name) + r"(?![a-z])", re.I)) for name in COURSES]

def get(url, timeout=24):
    request = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 PIF-Racing-Research/1.0",
        "Referer": "https://promo.betfair.com/",
        "Accept": "text/html,text/csv,*/*",
    })
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read(18 * 1024 * 1024 + 1)
        if len(raw) > 18 * 1024 * 1024:
            raise ValueError("Source file larger than 18MB cap: " + url)
        return raw.decode("utf-8-sig", errors="replace")

def distance(name):
    m = MILE.search(name)
    if m:
        return 8 * int(m.group(1)) + int(m.group(2) or 0)
    m = FURLONG.search(name)
    return int(m.group(1)) if m else None

def course(hint):
    for name, pat in COURSE_PATTERNS:
        if pat.search(hint):
            return "Chelmsford City" if name == "Chelmsford" else name
    return "unknown"

def field_size(n):
    if n <= 6: return "2-6"
    if n <= 9: return "7-9"
    if n <= 12: return "10-12"
    if n <= 14: return "13-14"
    return "15+"

def index_files(html, start, end):
    files = set()
    for match in NAME.finditer(html):
        region, day, month, year = match.groups()
        try:
            date = dt.date(int(year), int(month), int(day))
        except ValueError:
            continue
        if start <= date <= end:
            files.add((date, region.lower(), match.group(0).lower()))
    return sorted(files)

def parse_file(item):
    date, region, filename = item
    err = None
    for attempt in range(3):
        try:
            contents = get(BASE + filename)
            events = collections.defaultdict(dict)
            for row in csv.DictReader(io.StringIO(contents)):
                row = {str(k).strip().upper():v for k,v in row.items() if k}
                eid = (row.get("EVENT_ID") or "").strip()
                sid = (row.get("SELECTION_ID") or "").strip()
                date_value = (row.get("EVENT_DT") or "").strip()
                if not eid or not sid:
                    continue
                key = (region, eid, date_value)
                # First runner record wins within a file; duplicate rows do not double-count.
                if sid in events[key]:
                    continue
                try:
                    ipmin = float(row.get("IPMIN") or "nan")
                except ValueError:
                    ipmin = float("nan")
                events[key][sid] = {
                    "name":row.get("EVENT_NAME") or "",
                    "hint":row.get("MENU_HINT") or "",
                    "winner": str(row.get("WIN_LOSE") or "").strip() in ("1", "1.0"),
                    "ipmin": ipmin,
                }
            return item, events, None
        except Exception as e:
            err = "%s: %s" % (type(e).__name__, str(e)[:130])
            if attempt < 2:
                time.sleep(0.5 * (attempt + 1))
    return item, {}, err

def make_race(key, runners):
    values = list(runners.values())
    if len(values) < 2 or sum(x["winner"] for x in values) != 1:
        return None
    name = values[0]["name"]
    dist = distance(name)
    if JUMPS.search(name) or dist is None or dist > 20:
        return None
    touched = [r for r in values if 0 < r["ipmin"] <= 2]
    beaten = sum(not r["winner"] for r in touched)
    winner = int(any(r["winner"] for r in touched))
    day = key[2][:10]
    # Some date formats differ. Prefer event date only when recognised.
    try:
        parsed = dt.datetime.strptime(day,"%Y-%m-%d").date()
        day = parsed.isoformat()
    except ValueError:
        day = ""
    return {
        "date": day,
        "race_key": "|".join(key),
        "region":key[0], "course":course(values[0]["hint"]),
        "distance":str(dist)+"f", "field":field_size(len(values)),
        "race_type":"handicap" if HANDICAP.search(name) else "nonhandicap",
        "touched":len(touched), "gross_proxy":beaten - winner,
        "runners":len(values),
    }

def summarise(items):
    n = len(items)
    if not n:
        return {"n":0,"two":0,"three":0,"four":0,"rate2":None,"rate3":None,"gross_proxy":0}
    two = sum(x["touched"]>=2 for x in items)
    three = sum(x["touched"]>=3 for x in items)
    four = sum(x["touched"]>=4 for x in items)
    return {"n":n,"two":two,"three":three,"four":four,
            "rate2":round(two/n*100,2),"rate3":round(three/n*100,2),
            "gross_proxy":sum(x["gross_proxy"] for x in items)}

def groups(rows, names, min_total=25, min_train=15, min_test=10):
    if not rows:
        return []
    dated = sorted(r["date"] for r in rows if r["date"])
    cutoff = dated[int((len(dated)-1)*0.75)] if dated else ""
    by_key = collections.defaultdict(list)
    for r in rows:
        for dimensions in names:
            labels = tuple(r[d] for d in dimensions)
            if "unknown" in labels:
                continue
            by_key[("/".join(dimensions), " | ".join(labels))].append(r)
    output = []
    for (grouping,label),races in by_key.items():
        if len(races)<min_total:
            continue
        past = [x for x in races if x["date"] and x["date"] <= cutoff]
        future = [x for x in races if x["date"] and x["date"] > cutoff]
        if len(past)<min_train or len(future)<min_test:
            continue
        a,b,c=summarise(past),summarise(future),summarise(races)
        output.append({"profile":grouping,"value":label,"train":a,"holdout":b,"all":c})
    output.sort(key=lambda x:(x["train"]["rate3"],x["holdout"]["rate3"],x["all"]["n"]),reverse=True)
    return cutoff,output

def run(start,end,max_workers):
    print("Fetching official free Betfair BSP price directory...",flush=True)
    index = get(BASE+"index.php",timeout=65)
    files=index_files(index,start,end)
    if not files:
        raise RuntimeError("NO daily UK/IRE WIN files listed for requested dates; no claimed recent-year backtest.")
    expected_days=(end-start).days+1
    day_by_region={region:len(set(x[0] for x in files if x[1]==region)) for region in ("uk","ire")}
    print("Indexed %s files (UK days %s; Irish days %s; window %s days)"%(len(files),day_by_region["uk"],day_by_region["ire"],expected_days),flush=True)
    failed=[]
    races={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_to_item={pool.submit(parse_file,item):item for item in files}
        for count,job in enumerate(concurrent.futures.as_completed(future_to_item),1):
            item,events,error=job.result()
            if error:
                failed.append({"file":item[2],"error":error})
            else:
                for key,runner_map in events.items():
                    r=make_race(key,runner_map)
                    if r:
                        races.setdefault(r["race_key"],r)
            if count%75==0:
                print("Processed %s/%s files, valid Flat races %s"%(count,len(files),len(races)),flush=True)
    ordered=sorted(races.values(),key=lambda x:x["date"])
    dims=[("course",),("distance",),("field",),("race_type",),
          ("course","distance"),("course","field"),("distance","field"),
          ("distance","field","race_type"),("course","distance","field"),
          ("course","distance","field","race_type")]
    cutoff,group_results=groups(ordered,dims) if ordered else ("",[])
    report={
        "definition":"Recorded IPMIN<=2.00 for distinct runners, NOT proof that a £1 lay would fill",
        "source":BASE+"index.php","requested_start":start.isoformat(),"requested_end":end.isoformat(),
        "expected_calendar_days":expected_days,"days_listed_by_region":day_by_region,
        "files_listed":len(files),"files_downloaded":len(files)-len(failed),
        "failed_files":failed[:60],"failed_files_count":len(failed),
        "flat_races":len(ordered),"coverage_race_date_start":ordered[0]["date"] if ordered else None,
        "coverage_race_date_end":ordered[-1]["date"] if ordered else None,
        "chronological_cutoff":cutoff,"overall":summarise(ordered),
        "ranked_profiles":group_results,
        "rules":"MIN sample 25; train >=15, later holdout >=10. Sort by TRAIN 3+ rate. Rates are observational only. Data snooping remains; no trading qualification without execution evidence.",
        "caveat":"IPMIN volume filter, no price order queue or fill timestamps. UNKNOWN surface/straight-turning must be event-level joined; no fabricated track classifications. May be missing days."
    }
    return report

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--start",default="2025-10-21")
    p.add_argument("--end",default="2026-10-20")
    p.add_argument("--workers",type=int,default=12)
    p.add_argument("--output",default="lay_field_latest_year_report.json")
    args=p.parse_args()
    report=run(dt.date.fromisoformat(args.start),dt.date.fromisoformat(args.end),min(max(args.workers,1),16))
    Path(args.output).write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k not in ("ranked_profiles","failed_files")},indent=2))
    print("TOP 15 OBSERVATIONAL PROFILES (NOT BETTING QUALIFIERS)")
    for item in report["ranked_profiles"][:15]:
        print("%-33s %-40s  train:%3d %5.1f%%  holdout:%3d %5.1f%%  proxy:%s"%
              (item["profile"],item["value"][:40],item["train"]["n"],item["train"]["rate3"],item["holdout"]["n"],item["holdout"]["rate3"],item["all"]["gross_proxy"]))
    if not report["flat_races"]:
        raise SystemExit("No eligible racing data retrieved.")
    if report["files_downloaded"]<len(report["files_listed"])*0.8:
        raise SystemExit("More than 20% of listed data files failed to download; result is incomplete.")

if __name__=="__main__":
    main()
