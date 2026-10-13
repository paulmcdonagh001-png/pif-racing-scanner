"""Pre-race handicap-hurdle shortlist from locally licensed result history.

This is a deterministic speed-ranking prototype, not an Andy Holding figure or
betting advice. It deliberately emits no price/value assertion: a ranking is
not a calibrated win probability. Historical winner times plus beaten lengths
are an estimate of runner times using the disclosed seconds-per-length input.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path


def norm(value: object) -> str:
    return " ".join(str(value or "").casefold().split())


def number(value: object) -> float | None:
    try:
        result = float(str(value).strip())
    except (TypeError, ValueError, AttributeError):
        return None
    return result if math.isfinite(result) else None


def truth(value: object) -> bool:
    return norm(value) in {"1", "true", "yes", "y"}


def horse_key(row: dict) -> str:
    return norm(row.get("horse_id") or row.get("horse_name"))


def condition_key(row: dict) -> tuple[str, float, str]:
    distance = number(row.get("distance_furlongs"))
    if distance is None or distance <= 0:
        raise ValueError("distance_furlongs must be a positive number")
    return (norm(row.get("course")), round(distance * 2) / 2, norm(row.get("going")))


def load_csv(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as stream:
        return list(csv.DictReader(stream))


def build_history(rows: list[dict], minimum_standards: int = 5,
                  seconds_per_length: float = 0.20) -> dict[str, list[dict]]:
    """Calculate each historical horse index using standards from earlier dates.

    All races on a date are rated before any time from that date enters a
    standard, preventing within-day future leakage. Incomplete rows are skipped
    with counts in the returned diagnostics instead of having values imputed.
    """
    if minimum_standards < 1 or seconds_per_length <= 0:
        raise ValueError("minimum_standards must be positive and seconds_per_length > 0")
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        rid = str(row.get("race_id", "")).strip()
        if not rid:
            raise ValueError("historical row missing race_id")
        grouped[rid].append(row)

    day_races: dict[date, list[tuple[str, dict, list[dict]]]] = defaultdict(list)
    skipped: dict[str, int] = defaultdict(int)
    for rid, entrants in grouped.items():
        first = entrants[0]
        try:
            day = date.fromisoformat(str(first.get("race_date", "")))
            key = condition_key(first)
            elapsed = number(first.get("official_time_seconds"))
        except (ValueError, TypeError):
            skipped["invalid_race_metadata"] += 1
            continue
        if not key[0] or not key[2] or elapsed is None or elapsed <= 0:
            skipped["missing_course_going_or_time"] += 1
            continue
        if any(condition_key(r) != key or str(r.get("race_date")) != str(first.get("race_date"))
               or number(r.get("official_time_seconds")) != elapsed for r in entrants):
            raise ValueError(f"{rid}: inconsistent race-level metadata")
        day_races[day].append((rid, first, entrants))

    standards: dict[tuple, list[float]] = defaultdict(list)
    history: dict[str, list[dict]] = defaultdict(list)
    for day in sorted(day_races):
        add_standards, add_horses = [], []
        for rid, meta, entrants in sorted(day_races[day], key=lambda x: x[0]):
            if norm(meta.get("race_type")) != "hurdle" or not truth(meta.get("handicap")):
                continue
            key = condition_key(meta)
            prior = standards[key]
            if len(prior) < minimum_standards:
                skipped["insufficient_prior_standards"] += 1
                add_standards.append((key, number(meta["official_time_seconds"])))
                continue
            standard = statistics.median(prior)
            for row in entrants:
                ident = horse_key(row)
                pos = str(row.get("finish_position", "")).strip()
                margin = number(row.get("beaten_lengths"))
                if not ident or not pos.isdigit() or margin is None or margin < 0:
                    skipped["incomplete_runner_result"] += 1
                    continue
                estimated_time = number(meta["official_time_seconds"]) + seconds_per_length * margin
                if estimated_time <= 0:
                    skipped["invalid_estimated_time"] += 1
                    continue
                add_horses.append((ident, {
                    "date": day.isoformat(), "race_id": rid, "key": key,
                    "rating": standard / estimated_time * 100.0,
                    "finish_position": int(pos),
                }))
            add_standards.append((key, number(meta["official_time_seconds"])))
        for key, elapsed in add_standards:
            standards[key].append(elapsed)
        for ident, entry in add_horses:
            history[ident].append(entry)
    return {"history": dict(history), "skipped": dict(skipped)}


def scan(history_rows: list[dict], card_rows: list[dict], *,
         minimum_standards: int = 5, minimum_horse_starts: int = 2,
         minimum_rating_gap: float = 1.0, max_picks: int = 4,
         seconds_per_length: float = 0.20) -> dict:
    """Analyze card races and return only standout historical speed candidates."""
    if minimum_horse_starts < 1 or minimum_rating_gap < 0 or max_picks < 1:
        raise ValueError("minimum starts/max picks must be positive and rating gap non-negative")
    prepared = build_history(history_rows, minimum_standards, seconds_per_length)
    horse_history = prepared["history"]
    races: dict[str, list[dict]] = defaultdict(list)
    for row in card_rows:
        rid = str(row.get("race_id", "")).strip()
        if not rid:
            raise ValueError("card row missing race_id")
        races[rid].append(row)

    candidates = []
    rejected: dict[str, int] = defaultdict(int)
    for rid, runners in races.items():
        race = runners[0]
        day = date.fromisoformat(str(race.get("race_date", "")))
        if any(str(r.get("race_date")) != day.isoformat() for r in runners):
            raise ValueError(f"{rid}: inconsistent card date")
        if norm(race.get("race_type")) != "hurdle" or not truth(race.get("handicap")):
            rejected["outside_handicap_hurdle_scope"] += 1
            continue
        key = condition_key(race)
        rated = []
        for runner in runners:
            ident = horse_key(runner)
            # Exclude every outcome on or after scan day, even if provided in a
            # mixed archive file. This makes the scanner safe for combined data.
            comparable = [h for h in horse_history.get(ident, [])
                          if h["date"] < day.isoformat() and h["key"] == key]
            recent = comparable[-3:]
            score = (statistics.median(h["rating"] for h in recent)
                     if len(recent) >= minimum_horse_starts else None)
            if score is not None:
                rated.append((score, runner, len(comparable)))
        if len(rated) < 2:
            rejected["fewer_than_two_rated_runners"] += 1
            continue
        rated.sort(key=lambda item: (-item[0], norm(item[1].get("horse_name"))))
        if rated[0][0] - rated[1][0] < minimum_rating_gap:
            rejected["top_rating_not_clear"] += 1
            continue
        score, runner, nstarts = rated[0]
        price = number(runner.get("decimal_odds"))
        candidates.append({
            "race_id": rid, "race_date": day.isoformat(), "off_time": runner.get("off_time"),
            "course": race.get("course"), "race_title": race.get("race_title"),
            "distance_furlongs": key[1], "going": race.get("going"),
            "horse_id": runner.get("horse_id"), "horse_name": runner.get("horse_name"),
            "historical_speed_index": round(score, 3), "comparable_prior_starts": nstarts,
            "top_runner_gap": round(rated[0][0] - rated[1][0], 3),
            "current_decimal_odds": price if price is not None and price > 1 else None,
            "price_status": "current price supplied; no value claim" if price and price > 1 else "price unavailable",
            "evidence": f"Top prior speed index in race; median of last 3 same-course, distance and going runs ({nstarts} comparable starts).",
        })
    candidates.sort(key=lambda c: (-c["historical_speed_index"], c["race_date"], str(c["off_time"] or "")))
    return {
        "kind": "pre-race shortlist; experimental and unvalidated",
        "scan_date": min((str(r.get("race_date")) for r in card_rows), default=None),
        "candidate_count": min(len(candidates), max_picks),
        "candidates": candidates[:max_picks],
        "rejected_races": dict(rejected), "history_rows_skipped": prepared["skipped"],
        "limitations": [
            "No calibrated win probabilities or minimum-value prices; ranking alone does not establish a bet.",
            "Runner times are estimated from winner time plus margin using the configured seconds-per-length assumption.",
            "Exact course, half-furlong distance and going matches can leave sparse histories.",
            "Horse names are identity proxies when no stable horse_id is supplied.",
            "This is a small speed-only filter, not Andy Holding's proprietary method; prices are only shown if supplied by a lawful feed.",
        ],
    }


def append_scan(ledger: str, result: dict) -> None:
    """Append a pre-race scan snapshot; never mutate it with results later."""
    path = Path(ledger)
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {"record_type": "scan", "created_at_utc": datetime.now(timezone.utc).isoformat(), **result}
    with path.open("a", encoding="utf-8") as out:
        out.write(json.dumps(record, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", required=True, help="Permitted normalized runner-level past-results CSV")
    parser.add_argument("--card", required=True, help="Today's normalized runner-level card CSV")
    parser.add_argument("--out", help="Optional JSON report")
    parser.add_argument("--ledger", help="Optional append-only pre-race JSONL archive")
    parser.add_argument("--minimum-standards", type=int, default=5)
    parser.add_argument("--minimum-horse-starts", type=int, default=2)
    parser.add_argument("--minimum-rating-gap", type=float, default=1.0)
    parser.add_argument("--max-picks", type=int, default=4)
    parser.add_argument("--seconds-per-length", type=float, default=0.20)
    args = parser.parse_args()
    result = scan(load_csv(args.history), load_csv(args.card),
                  minimum_standards=args.minimum_standards,
                  minimum_horse_starts=args.minimum_horse_starts,
                  minimum_rating_gap=args.minimum_rating_gap,
                  max_picks=args.max_picks,
                  seconds_per_length=args.seconds_per_length)
    rendered = json.dumps(result, indent=2, ensure_ascii=False)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(rendered + "\n", encoding="utf-8")
    if args.ledger:
        append_scan(args.ledger, result)
    print(rendered)


if __name__ == "__main__":
    main()
