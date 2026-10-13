"""Inspect existing PIF Racing audit workbook to establish whether a speed-based historical test is possible."""
import json
import sys
from openpyxl import load_workbook

def inspect(path):
    book=load_workbook(path,read_only=True,data_only=True)
    sheet=book["269 Race Audit"]
    iterator=iter(sheet.values)
    headings=next(iterator)
    races=[dict(zip(headings,row)) for row in iterator if row[0]]
    nh=[r for r in races if r.get("Category") in ("Hurdle","Chase")]
    hurdles=[r for r in nh if r["Category"]=="Hurdle" and "handicap" in str(r.get("Race","")).lower()]
    return {
        "races":len(races), "national_hunt_races":len(nh), "handicap_hurdles":len(hurdles),
        "start_date":min(r["Date"] for r in races),"end_date":max(r["Date"] for r in races),
        "official_race_times_present":"official_time_seconds" in headings,
        "sectional_times_present":"sectionals" in headings,
        "historical_runner_form_present":"runner_id" in headings,
        "sufficient_for_speed_figure_backtest":False
    }

if __name__=="__main__":
    print(json.dumps(inspect(sys.argv[1]),indent=2))
