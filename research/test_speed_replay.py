import unittest

from research.speed_replay import replay


def race(race_id, day, winner="h1", times=220, prices=(2.0, 3.0, 5.0), going="Good"):
    rows = []
    horses = ("h1", "h2", "h3")
    margins = {"h1": 0, "h2": 2, "h3": 8}
    for i, horse in enumerate(horses):
        rows.append({
            "race_id": race_id, "race_date": day, "course": "Test Track",
            "race_type": "hurdle", "handicap": "true", "distance_furlongs": "16",
            "going": going, "official_time_seconds": str(times),
            "runner_id": f"{race_id}-{horse}", "horse_id": horse,
            "horse_name": horse, "finish_position": "1" if horse == winner else str(i + 2),
            "beaten_lengths": str(margins[horse]), "sp_decimal": str(prices[i]),
        })
    return rows


class SpeedReplayTests(unittest.TestCase):
    def test_needs_prior_standard_and_prior_horse_form(self):
        rows = []
        for n in range(1, 7):
            rows.extend(race(f"r{n}", f"2024-01-{n:02d}"))
        result = replay(rows, minimum_standards=2, minimum_horse_starts=2)
        self.assertIsNone(result["predictions"][0]["selection"])
        self.assertIsNotNone(result["predictions"][-1]["selection"])

    def test_same_date_races_cannot_update_each_other(self):
        rows = race("a", "2024-01-01") + race("b", "2024-01-01") + race("c", "2024-01-02")
        result = replay(rows, minimum_standards=1, minimum_horse_starts=1)
        self.assertEqual(result["predictions"][0]["prior_standard_count"], 0)
        self.assertEqual(result["predictions"][1]["prior_standard_count"], 0)
        self.assertEqual(result["predictions"][2]["prior_standard_count"], 2)

    def test_going_is_not_pooled(self):
        rows = []
        for n in range(1, 8):
            rows.extend(race(f"r{n}", f"2024-01-{n:02d}", going="Good" if n < 6 else "Soft"))
        result = replay(rows, minimum_standards=2, minimum_horse_starts=1)
        self.assertEqual(result["predictions"][-1]["prior_standard_count"], 1)
        self.assertIsNone(result["predictions"][-1]["selection"])

    def test_dead_heat_is_rejected(self):
        rows = race("r1", "2024-01-01")
        rows[1]["finish_position"] = "1"
        with self.assertRaisesRegex(ValueError, "exactly one winner"):
            replay(rows)

    def test_report_includes_losses_and_sp_benchmark(self):
        rows = []
        for n in range(1, 8):
            rows.extend(race(f"r{n}", f"2024-01-{n:02d}", winner="h1" if n % 2 else "h2"))
        result = replay(rows, minimum_standards=2, minimum_horse_starts=1)
        self.assertIn("longest_losing_streak", result)
        self.assertEqual(result["market_favourite_baseline"]["races_with_complete_decimal_sp"], 7)
        self.assertIsNotNone(result["theoretical_sp_roi"])


if __name__ == "__main__":
    unittest.main()
