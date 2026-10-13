"""Chronological experimental speed-rating replay for UK/Irish handicap hurdles.

This is an auditable research baseline, not an Andy Holding rating replica.
All comparisons use prior race dates only. Race-time-to-margin conversion is a
provisional 0.20 seconds per length unless a better licensed source supplies
per-runner elapsed times. No missing values are imputed.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections import defaultdict
from datetime import date
from pathlib import Path


def norm(value: object) -> str:
    return " ".join(str(value or "").casefold().split())


def is_true(value: object) -> bool:
    return norm(value) in {"1", "true", "yes", "y"}


def number(value: object) -> float | None:
    if value is None or not str(value).strip():
        return None
    try:
        result = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def decimal_sp(row: dict) -> float | None:
    """Read only an already-decimal price; do not guess fractional formats."""
    for key in ("sp_decimal", "decimal_odds", "sp"):
        price = number(row.get(key))
        if price is not None and price > 1:
            return price
    return None


def _validate_race(race_id: str, rows: list[dict]) -> tuple[dict, list[dict]]:
    first = rows[0]
    required = ("race_date", "course", "race_type", "handicap", "distance_furlongs",
                "going", "official_time_seconds")
    for key in required:
        values = {norm(r.get(key)) for r in rows}
        if len(values) != 1 or not next(iter(values), ""):
            raise ValueError(f"Race {race_id}: missing or inconsistent {key}")
    try:
        day = date.fromisoformat(str(first["race_date"]))
        distance = float(first["distance_furlongs"])
        elapsed = float(first["official_time_seconds"])
    except (ValueError, TypeError, KeyError) as exc:
        raise ValueError(f"Race {race_id}: invalid date, distance, or official time") from exc
    if distance <= 0 or elapsed <= 0 or not math.isfinite(distance + elapsed):
        raise ValueError(f"Race {race_id}: invalid distance or official time")

    ids = [norm(r.get("horse_id") or r.get("horse_name") or r.get("runner_id")) for r in rows]
    if any(not x for x in ids) or len(set(ids)) != len(ids):
        raise ValueError(f"Race {race_id}: missing or duplicate horse identities")
    winners = [r for r in rows if str(r.get("finish_position", "")).strip() == "1"]
    if len(winners) != 1:
        raise ValueError(f"Race {race_id}: expected exactly one winner; dead heats are excluded")
    meta = dict(first)
    meta["_day"] = day
    meta["_distance"] = round(distance * 2) / 2
    meta["_elapsed"] = elapsed
    return meta, rows


def replay(rows: list[dict], minimum_standards: int = 5,
           minimum_horse_starts: int = 2,
           seconds_per_length: float = 0.20) -> dict:
    """Replay one top prior-speed-rated horse per eligible race.

    Standards are the median of earlier winner times at the same course,
    half-furlong distance, and normalised going. All updates from a calendar
    date are held until that date's predictions are complete.
    """
    if minimum_standards < 1 or minimum_horse_starts < 1 or seconds_per_length <= 0:
        raise ValueError("minimums must be positive and seconds_per_length must be > 0")
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        race_id = str(row.get("race_id", "")).strip()
        if not race_id:
            raise ValueError("Missing race_id")
        grouped[race_id].append(row)

    by_day: dict[date, list[tuple[str, dict, list[dict]]]] = defaultdict(list)
    for race_id, entrants in grouped.items():
        meta, entrants = _validate_race(race_id, entrants)
        by_day[meta["_day"]].append((race_id, meta, entrants))
    for races in by_day.values():
        races.sort(key=lambda x: x[0])

    standards: dict[tuple, list[float]] = defaultdict(list)
    horse_history: dict[str, list[dict]] = defaultdict(list)
    predictions = []
    rejections: dict[str, int] = defaultdict(int)

    for day in sorted(by_day):
        pending_standards = []
        pending_horses = []
        for race_id, meta, entrants in by_day[day]:
            if norm(meta["race_type"]) != "hurdle" or not is_true(meta["handicap"]):
                continue
            course = norm(meta["course"])
            going = norm(meta["going"])
            if not course or not going:
                rejections["missing_course_or_going"] += 1
                continue
            key = (course, meta["_distance"], going)
            prior_times = standards[key]
            standard = statistics.median(prior_times) if len(prior_times) >= minimum_standards else None

            ranked = []
            for row in entrants:
                identity = norm(row.get("horse_id") or row.get("horse_name") or row.get("runner_id"))
                history = [h for h in horse_history[identity] if h["day"] < day and h["key"] == key]
                recent = history[-3:]
                score = statistics.median(h["rating"] for h in recent) if len(recent) >= minimum_horse_starts else None
                ranked.append({"identity": identity, "score": score,
                               "prior_comparable_starts": len(history),
                               "won": str(row.get("finish_position", "")).strip() == "1",
                               "sp": decimal_sp(row)})
            rated = [r for r in ranked if r["score"] is not None]
            selection = None
            if standard is None:
                rejections["insufficient_prior_standards"] += 1
            elif len(rated) < 2:
                rejections["insufficient_rated_runners"] += 1
            else:
                rated.sort(key=lambda r: r["score"], reverse=True)
                if math.isclose(rated[0]["score"], rated[1]["score"], rel_tol=0, abs_tol=1e-10):
                    rejections["joint_top_rating"] += 1
                else:
                    selection = rated[0]
            predictions.append({
                "race_id": race_id, "date": day.isoformat(), "course": meta["course"],
                "distance_furlongs": meta["_distance"], "going": meta["going"],
                "prior_standard_count": len(prior_times), "runners": len(ranked),
                "rated_runners": len(rated),
                "selection": selection["identity"] if selection else None,
                "selection_won": selection["won"] if selection else None,
                "selection_sp_decimal": selection["sp"] if selection else None,
            })

            pending_standards.append((key, meta["_elapsed"]))
            if standard is not None:
                for row in entrants:
                    position = str(row.get("finish_position", "")).strip()
                    margin = number(row.get("beaten_lengths"))
                    if not position.isdigit() or margin is None or margin < 0:
                        continue
                    adjusted_time = meta["_elapsed"] + seconds_per_length * margin
                    if adjusted_time <= 0:
                        continue
                    identity = norm(row.get("horse_id") or row.get("horse_name") or row.get("runner_id"))
                    pending_horses.append((identity, {
                        "day": day, "key": key, "rating": standard / adjusted_time * 100.0,
                    }))
        for key, elapsed in pending_standards:
            standards[key].append(elapsed)
        for identity, observation in pending_horses:
            horse_history[identity].append(observation)

    selections = [p for p in predictions if p["selection"] is not None]
    selections.sort(key=lambda p: (p["date"], p["race_id"]))
    wins = sum(bool(p["selection_won"]) for p in selections)
    losing = longest = 0
    for p in selections:
        if p["selection_won"]:
            losing = 0
        else:
            losing += 1
            longest = max(longest, losing)

    priced = [p for p in selections if p["selection_sp_decimal"] is not None]
    model_profit = sum((p["selection_sp_decimal"] - 1) if p["selection_won"] else -1 for p in priced)
    market = _market_baseline(predictions, grouped)
    yearly = {}
    for year in sorted({p["date"][:4] for p in predictions}):
        cohort = [p for p in selections if p["date"].startswith(year)]
        cohort_priced = [p for p in cohort if p["selection_sp_decimal"] is not None]
        yearly[year] = {
            "selections": len(cohort), "wins": sum(bool(p["selection_won"]) for p in cohort),
            "hit_rate": (sum(bool(p["selection_won"]) for p in cohort) / len(cohort)) if cohort else None,
            "priced_selections": len(cohort_priced),
            "theoretical_sp_roi": (_roi(cohort_priced, "selection_sp_decimal") if cohort_priced else None),
        }
    return {
        "scope": "UK/Irish National Hunt handicap hurdles only when source geography is verified",
        "races_replayed": len(predictions), "selections": len(selections), "wins": wins,
        "hit_rate": wins / len(selections) if selections else None,
        "longest_losing_streak": longest,
        "priced_selections": len(priced),
        "theoretical_sp_profit_units": round(model_profit, 4) if priced else None,
        "theoretical_sp_roi": round(model_profit / len(priced), 6) if priced else None,
        "price_basis": "recorded decimal SP; retrospective theoretical return, no execution/commission claim",
        "market_favourite_baseline": market,
        "yearly": yearly, "rejections": dict(rejections), "predictions": predictions,
        "rating_definition": "prior median of same horse's last 3 comparable speed indices; no probability output",
        "seconds_per_length_assumption": seconds_per_length,
        "horse_identity": "horse_id where supplied, otherwise normalised horse_name/runner_id proxy",
    }


def _roi(picks: list[dict], price_key: str) -> float:
    profit = sum((p[price_key] - 1) if p["selection_won"] else -1 for p in picks)
    return profit / len(picks)


def _market_baseline(predictions: list[dict], grouped: dict) -> dict:
    profits, favourite_wins, races = [], 0, 0
    by_id = {rid: entrants for rid, entrants in grouped.items()}
    for pred in predictions:
        if pred["race_id"] not in by_id:
            continue
        entrants = by_id[pred["race_id"]]
        prices = [(decimal_sp(r), str(r.get("finish_position", "")).strip() == "1") for r in entrants]
        if not prices or any(price is None for price, _ in prices):
            continue
        shortest = min(price for price, _ in prices)
        favourites = [(price, won) for price, won in prices if math.isclose(price, shortest)]
        stake = 1 / len(favourites)
        profit = sum(stake * ((price - 1) if won else -1) for price, won in favourites)
        profits.append(profit)
        favourite_wins += int(any(won for _, won in favourites))
        races += 1
    return {
        "races_with_complete_decimal_sp": races,
        "favourite_win_rate": favourite_wins / races if races else None,
        "theoretical_sp_roi_per_race": (sum(profits) / races) if races else None,
        "note": "Joint favourites share one unit; results use closing SP and ignore bookmaker terms/commission.",
    }


def read_csv(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required = {"race_id", "race_date", "course", "race_type", "handicap",
                    "distance_furlongs", "going", "official_time_seconds",
                    "finish_position"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError("Missing columns: " + ", ".join(sorted(missing)))
        return list(reader)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True, help="Locally held, permitted runner-level results CSV")
    parser.add_argument("--out", required=True)
    parser.add_argument("--minimum-standards", type=int, default=5)
    parser.add_argument("--minimum-horse-starts", type=int, default=2)
    parser.add_argument("--seconds-per-length", type=float, default=0.20)
    args = parser.parse_args()
    result = replay(read_csv(args.csv), args.minimum_standards,
                    args.minimum_horse_starts, args.seconds_per_length)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "predictions"}, indent=2))


if __name__ == "__main__":
    main()
