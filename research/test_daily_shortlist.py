import unittest

from research.daily_shortlist import scan


def historic_race(rid, day, margin=10):
    rows = []
    for horse, pos, beaten in (("Quick Lad", "1", 0), ("Slow Lad", "2", margin)):
        rows.append({
            "race_id": rid, "race_date": day, "course": "Test Track",
            "race_type": "hurdle", "handicap": "true", "distance_furlongs": "16",
            "going": "Good", "official_time_seconds": "200", "finish_position": pos,
            "beaten_lengths": str(beaten), "horse_name": horse,
        })
    return rows


def card(day="2025-01-06"):
    return [{
        "race_id": "today1", "race_date": day, "course": "Test Track",
        "race_type": "hurdle", "handicap": "true", "distance_furlongs": "16",
        "going": "Good", "race_title": "Test handicap", "off_time": "14:00",
        "horse_name": horse, "decimal_odds": price,
    } for horse, price in (("Quick Lad", "3.5"), ("Slow Lad", "2.5"))]


class DailyShortlistTests(unittest.TestCase):
    def test_returns_only_clear_top_runner_and_preserves_price_as_unrated(self):
        rows = []
        for n in range(1, 6):
            rows.extend(historic_race(f"r{n}", f"2025-01-0{n}"))
        result = scan(rows, card(), minimum_standards=1, minimum_horse_starts=2,
                      minimum_rating_gap=0.5)
        self.assertEqual(result["candidate_count"], 1)
        pick = result["candidates"][0]
        self.assertEqual(pick["horse_name"], "Quick Lad")
        self.assertEqual(pick["current_decimal_odds"], 3.5)
        self.assertIn("no value claim", pick["price_status"])

    def test_future_race_outcomes_cannot_change_todays_rating(self):
        rows = []
        for n in range(1, 6):
            rows.extend(historic_race(f"r{n}", f"2025-01-0{n}"))
        base = scan(rows, card(), minimum_standards=1, minimum_horse_starts=2,
                    minimum_rating_gap=0.5)
        rows.extend(historic_race("future", "2025-02-01", margin=100))
        mixed = scan(rows, card(), minimum_standards=1, minimum_horse_starts=2,
                     minimum_rating_gap=0.5)
        self.assertEqual(base["candidates"], mixed["candidates"])

    def test_ties_and_scope_are_filtered(self):
        rows = []
        for n in range(1, 6):
            rows.extend(historic_race(f"r{n}", f"2025-01-0{n}", margin=0))
        tied = scan(rows, card(), minimum_standards=1, minimum_horse_starts=2,
                    minimum_rating_gap=0.5)
        self.assertEqual(tied["candidates"], [])
        outside = card()
        for row in outside:
            row["race_type"] = "chase"
        result = scan(rows, outside, minimum_standards=1, minimum_horse_starts=2)
        self.assertEqual(result["candidates"], [])
        self.assertEqual(result["rejected_races"]["outside_handicap_hurdle_scope"], 1)


if __name__ == "__main__":
    unittest.main()
