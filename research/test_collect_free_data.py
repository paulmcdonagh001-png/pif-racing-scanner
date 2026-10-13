import sqlite3
import tempfile
import unittest
from pathlib import Path
from research.collect_free_data import connect, save_records

class CollectorTests(unittest.TestCase):
    def test_card_and_summary_preservation(self):
        with tempfile.TemporaryDirectory() as directory:
            db=connect(Path(directory)/"test.sqlite")
            card={"race_id":"r1","date":"2026-10-13","type":"Hurdle","course":"Hereford",
                  "runners":[{"horse":"Example","form":"123"}]}
            summary={"race_id":"r1","date":"2026-10-13","type":"Hurdle","course":"Hereford"}
            self.assertEqual(save_records(db,"racecard",[card],"2026-10-13T08:00:00+00:00"),1)
            self.assertEqual(save_records(db,"result_summary",[summary],"2026-10-13T19:00:00+00:00"),1)
            results=db.execute("SELECT category,payload_json FROM snapshots ORDER BY captured_at").fetchall()
            self.assertEqual(len(results),2)
            self.assertIn('"runners"',results[0][1])
            self.assertNotIn('"runners"',results[1][1])
            db.close()

    def test_reject_bad_category(self):
        db=connect(":memory:")
        with self.assertRaises(ValueError):
            save_records(db,"runner_results",[])
        db.close()

if __name__=="__main__":
    unittest.main()
