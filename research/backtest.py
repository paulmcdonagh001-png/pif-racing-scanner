"""PIF Racing: historical pre-race prediction evaluator (standard library only).

Evaluates frozen probability/odds predictions. Does NOT generate speed figures.
All values must be genuinely historical; never use outcomes to construct predictions.
"""
import argparse, csv, json, math
from datetime import datetime
from collections import defaultdict

REQUIRED = {"race_id", "runner_id", "off_datetime", "prediction_datetime", "win_probability", "decimal_odds", "won"}

def date(s):
    result = datetime.fromisoformat(s.strip().replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("Timestamp must carry a timezone offset")
    return result

def read_csv(path):
    races = defaultdict(list)
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not REQUIRED.issubset(reader.fieldnames or []):
            raise ValueError("Missing columns: " + ", ".join(sorted(REQUIRED - set(reader.fieldnames or []))))
        for line, row in enumerate(reader, 2):
            try:
                off, timestamp = date(row["off_datetime"]), date(row["prediction_datetime"])
                if timestamp >= off: raise ValueError("Prediction is not before off time")
                p, odds, won = float(row["win_probability"]), float(row["decimal_odds"]), int(row["won"])
                if not (0 < p < 1 and odds > 1 and math.isfinite(odds) and won in (0, 1)):
                    raise ValueError("Invalid probability, odds or winner value")
                if not row["race_id"] or not row["runner_id"]: raise ValueError("Missing ID")
                races[row["race_id"]].append({"runner":row["runner_id"],"p":p,"odds":odds,"won":won,"off":off})
            except (ValueError, KeyError) as ex:
                raise ValueError(f"Row {line}: {ex}") from ex
    if not races: raise ValueError("Empty race dataset")
    for race_id, runners in races.items():
        if len({r["runner"] for r in runners}) != len(runners): raise ValueError(f"Duplicate runner: {race_id}")
        if len({r["off"] for r in runners}) != 1: raise ValueError(f"Inconsistent off time: {race_id}")
        if sum(r["won"] for r in runners) != 1: raise ValueError(f"Not exactly one winner: {race_id}")
        if abs(sum(r["p"] for r in runners) - 1) > 0.03: raise ValueError(f"Probabilities do not sum to 1: {race_id}")
    return races

def evaluate(races, min_edge=0.05, commission=0.02):
    if min_edge < 0 or not 0 <= commission < 1: raise ValueError("Invalid parameters")
    picks=[]
    all_runners=[r for runners in races.values() for r in runners]
    for race_id, runners in races.items():
        best=max(runners,key=lambda r:r["p"]*r["odds"]-1)
        edge=best["p"]*best["odds"]-1
        if edge < min_edge: continue
        profit=(best["odds"]-1)*(1-commission) if best["won"] else -1
        picks.append({"race_id":race_id,"off":best["off"],"runner":best["runner"],"edge":edge,"win":best["won"],"profit":profit})
    picks.sort(key=lambda r:(r["off"],r["race_id"]))
    balance=peak=max_drawdown=0.
    for pick in picks:
        balance+=pick["profit"]
        peak=max(peak,balance)
        max_drawdown=max(max_drawdown,peak-balance)
    n=len(picks)
    return {
       "races_evaluated":len(races),"runners_evaluated":len(all_runners),
       "selections":n,"wins":sum(x["win"] for x in picks),
       "strike_rate":round(sum(x["win"] for x in picks)/n,4) if n else None,
       "profit_units":round(balance,4),"roi":round(balance/n,4) if n else None,
       "max_drawdown_units":round(max_drawdown,4),
       "brier_score_per_runner":round(sum((r["p"]-r["won"])**2 for r in all_runners)/len(all_runners),6),
       "picks":[{"race_id":x["race_id"],"runner":x["runner"],"off_datetime":x["off"].isoformat(),"edge":round(x["edge"],4),"win":x["win"],"profit":round(x["profit"],4)} for x in picks]
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--csv",required=True)
    parser.add_argument("--min-edge",type=float,default=0.05)
    parser.add_argument("--commission",type=float,default=0.02)
    args=parser.parse_args()
    print(json.dumps(evaluate(read_csv(args.csv),args.min_edge,args.commission),indent=2))

if __name__=="__main__": main()
