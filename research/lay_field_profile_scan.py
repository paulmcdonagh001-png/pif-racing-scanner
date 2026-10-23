#!/usr/bin/env python3
"""Independent PIF lay-the-field historical race-profile audit.

Research-only, no wagering and no changes to live PIF Racing.
Count UNIQUE runners whose Betfair free BSP WIN-file IPMIN <= 2.00.
Betfair IPMIN ignores trades with payout <= GBP100; these are recorded
price-touch events, not execution simulations.
"""
import csv, io, json, re, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict
from datetime import date, timedelta

HEADERS={"User-Agent":"PIF-Racing-research/1.0 (historical price file analysis)"}
def get(url):
    try:
        req=urllib.request.Request(url,headers=HEADERS)
        with urllib.request.urlopen(req,timeout=14) as r:
            raw=r.read()
        return raw.decode("utf-8-sig",errors="replace"),None
    except Exception as e:
        return None,str(e)[:110]

def daterange(start,end):
    d=start
    while d<=end:
        yield d
        d+=timedelta(days=1)

def betfair_url(d):
    return "https://promo.betfair.com/betfairsp/prices/dwbfpricesukwin"+d.strftime("%d%m%Y")+".csv"

def mirror_url(d):
    return "https://raw.githubusercontent.com/EonHorizons/betfair_sp/main/data_original/horse/uk/"+d.strftime("%Y/%m/")+"dwbfpricesukwin"+d.strftime("%d%m%Y")+".csv"

def collect(source,dates):
    probe=[dates[i] for i in sorted(set([0,len(dates)//6,len(dates)//3,len(dates)//2,2*len(dates)//3,5*len(dates)//6,len(dates)-1]))]
    url_fn=betfair_url if source=="Betfair" else mirror_url
    probes=[(d,*get(url_fn(d))) for d in probe]
    available=[(d,s) for d,s,e in probes if s and "EVENT_ID" in s[:160].upper()]
    print("PROBE",source,"success",len(available),"of",len(probes),"errors",[(d.isoformat(),err) for d,body,err in probes if err][:3],flush=True)
    if not available:
        return {},len(probes),0
    collected={d:s for d,s in available}
    failures=0
    with ThreadPoolExecutor(max_workers=12) as pool:
        f={pool.submit(get,url_fn(d)):d for d in dates if d not in collected}
        for fut in as_completed(f):
            d=f[fut]
            s,err=fut.result()
            if s and "EVENT_ID" in s[:160].upper():
                collected[d]=s
            else:failures+=1
    print("FETCH",source,"files",len(collected),"failures",failures,flush=True)
    events={}
    for d,s in collected.items():
        for raw in csv.DictReader(io.StringIO(s)):
            row={str(k).strip().upper():v for k,v in raw.items() if k}
            eid=(row.get("EVENT_ID") or "").strip()
            dt=(row.get("EVENT_DT") or "").strip()
            sid=(row.get("SELECTION_ID") or "").strip()
            if not eid or not sid:continue
            key=eid+"|"+dt
            if key not in events:
                events[key]={"name":row.get("EVENT_NAME",""),"hint":row.get("MENU_HINT",""),"dt":dt,"runners":{}}
            if sid not in events[key]["runners"]:
                p=row.get("IPMIN") or ""
                try:price=float(p)
                except ValueError:price=None
                winner=str(row.get("WIN_LOSE","")).strip() in ("1","1.0")
                events[key]["runners"][sid]=(price,winner)
    return events,failures,len(collected)

def furlongs(s):
    m=re.search(r"(?<!\w)(\d+)m(?:(\d+)f)?(?!\w)",s,re.I)
    if m:return 8*int(m[1])+int(m[2] or 0)
    m=re.search(r"(?<!\w)(\d+)f(?!\w)",s,re.I)
    return int(m[1]) if m else None

def c_name(s):
    s=re.sub(r"^(?:GB|UK|IRE|IRL)\s*/\s*","",s,flags=re.I).strip()
    return re.sub(r"\s+\d+(?:st|nd|rd|th)\s+\w+.*$","",s,flags=re.I).strip()

def f_band(n):
    return "2-6" if n<=6 else "7-9" if n<=9 else "10-12" if n<=12 else "13-14" if n<=14 else "15+"

def parse_events(events):
    result=[]
    rejected=defaultdict(int)
    for e in events.values():
        name=e["name"]
        f=furlongs(name)
        values=list(e["runners"].values())
        if len(values)<2 or sum(w for p,w in values)!=1:rejected["invalid_winner_or_field"]+=1;continue
        if re.search(r"\b(?:hrd|hurdle|chase|chases|chs|nhf|nh\s*flat|bumper|hunters?|steeple)\b",name,re.I):rejected["jump"]+=1;continue
        if f is None or f>20:rejected["distance"]+=1;continue
        touched=sum(p is not None and p>0 and p<=2 for p,w in values)
        result.append({"course":c_name(e["hint"]),"distance":f,"field":f_band(len(values)),"n_runners":len(values),"handicap":"handicap" if re.search(r"\bh(?:cap|andicap)\b",name,re.I) else "other","three":int(touched>=3),"two":int(touched>=2),"four":int(touched>=4),"year":e["dt"][6:10],"missing":sum(p is None for p,w in values)})
    return result,dict(rejected)

def agg(rows,keys,min_n=0,limit=25):
    groups=defaultdict(lambda:[0,0,0,0])
    for r in rows:
        k="|".join(str(r[x]) for x in keys)
        a=groups[k];a[0]+=1;a[1]+=r["two"];a[2]+=r["three"];a[3]+=r["four"]
    entries=[{"profile":k,"races":n,"two":t,"three":th,"four":fo,"two_pct":round(100*t/n,1),"three_pct":round(100*th/n,1)} for k,(n,t,th,fo) in groups.items() if n>=min_n]
    return sorted(entries,key=lambda x:(-x["three_pct"],-x["races"]))[:limit]

def report(source,events,files,failures):
    rows,rejected=parse_events(events)
    s={"source":source,"days_loaded":files,"failed_days":failures,"races":len(rows),
       "total_2plus":sum(x["two"] for x in rows),"total_3plus":sum(x["three"] for x in rows),"total_4plus":sum(x["four"] for x in rows),"missing_IPMIN":sum(x["missing"] for x in rows),"rejected":rejected,
       "field":agg(rows,["field"],0,12),"exact_runners":agg(rows,["n_runners"],25,25),"distance":agg(rows,["distance"],50,20),
       "course":agg(rows,["course"],45,35),
       "handicap":agg(rows,["handicap"],0,4),
       "distance_field":agg(rows,["distance","field"],35,25),
       "distance_exact_runners":agg(rows,["distance","n_runners"],40,25),
       "race_type_distance_field":agg(rows,["handicap","distance","field"],35,30),
       "course_distance":agg(rows,["course","distance"],35,30),
       "course_distance_field":agg(rows,["course","distance","field"],20,30),
       "course_field":agg(rows,["course","field"],35,35),
       "by_year":agg(rows,["year"],0,8),
       "candidate_by_year":[e for e in agg(rows,["year","course","distance","field"],0,10000) if "|".join(e["profile"].split("|")[1:]) in {
         "Newcastle|8|2-6","Beverley|7|7-9","Newmarket|8|7-9","Windsor|6|10-12",
         "Newcastle|12|7-9","Lingfield|10|2-6","Chelmsford City|7|7-9",
         "Newcastle|5|7-9","Wolverhampton|12|7-9","Newcastle|7|7-9",
         "Southwell|6|7-9","Wolverhampton|8|7-9"}]
       }
    specials={
        "exactly_5_runners":lambda r:r["n_runners"]==5,
        "6f_5_runners":lambda r:r["distance"]==6 and r["n_runners"]==5,
        "6f_2_to_6":lambda r:r["distance"]==6 and r["field"]=="2-6",
        "7f_nonhandicap_7_to_9":lambda r:r["distance"]==7 and r["handicap"]=="other" and r["field"]=="7-9",
        "7f_7_to_9":lambda r:r["distance"]==7 and r["field"]=="7-9",
        "Newcastle_1m_2_to_6":lambda r:r["course"]=="Newcastle" and r["distance"]==8 and r["field"]=="2-6",
        "Chelmsford_7f_7_to_9":lambda r:r["course"]=="Chelmsford City" and r["distance"]==7 and r["field"]=="7-9",
        "Wolverhampton_1m_7_to_9":lambda r:r["course"]=="Wolverhampton" and r["distance"]==8 and r["field"]=="7-9",
    }
    s["specials_by_year"]={key:agg([r for r in rows if pred(r)],["year"],0,5) for key,pred in specials.items()}
    return s

def main():
    recent=list(daterange(date(2025,10,21),date(2026,10,21)))
    events,fails,n=collect("Betfair",recent)
    outputs=[]
    if n>=60:outputs.append(report("Betfair free UK WIN, Oct 2025 to Oct 2026",events,n,fails))
    else:
        print("RECENT_YEAR_UNAVAILABLE insufficient Betfair daily files; no recent-year claims",flush=True)
    old=list(daterange(date(2023,1,1),date(2024,4,13)))
    ev2,f2,n2=collect("EonHorizons",old)
    if n2>=60:outputs.append(report("Archived UK WIN, Jan 2023 to Apr 2024",ev2,n2,f2))
    print("PIF_LAY_REPORT_BEGIN")
    print(json.dumps(outputs,separators=(",",":")))
    print("PIF_LAY_REPORT_END")
if __name__=="__main__":main()
