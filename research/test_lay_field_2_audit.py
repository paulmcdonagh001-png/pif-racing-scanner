import csv
import tempfile
import unittest
from pathlib import Path
from lay_field_2_audit import load_events, load_metadata, summarize, distance_furlongs


class LayFieldTest(unittest.TestCase):
    def test_distance(self):
        self.assertEqual(distance_furlongs('1m2f Hcap'), 10)
        self.assertEqual(distance_furlongs('6f Nov Stks'), 6)
        self.assertIsNone(distance_furlongs('Claiming Stakes'))

    def test_events_and_proxy(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / 'dwbfpricesukwin01012026.csv'
            fields = ['EVENT_ID','EVENT_DT','SELECTION_ID','EVENT_NAME','MENU_HINT','WIN_LOSE','IPMIN']
            with path.open('w', newline='') as f:
                w = csv.DictWriter(f, fieldnames=fields)
                w.writeheader()
                for eid, sid, winner, low in [('a','1',1,'1.01'),('a','2',0,'1.8'),('a','3',0,'1.9'),
                                              ('b','4',1,'1.01'),('b','5',0,'4.0')]:
                    w.writerow(dict(EVENT_ID=eid,EVENT_DT='2026-01-01',SELECTION_ID=sid,EVENT_NAME='6f Hcap',MENU_HINT='Meeting',WIN_LOSE=winner,IPMIN=low))
            events = load_events([path, path])
            report = summarize(events)
            self.assertEqual(report['valid_races'], 2)
            self.assertEqual(report['races_with_3_plus'], 1)
            self.assertEqual(report['races_with_2_plus'], 1)
            self.assertEqual(report['hypothetical_total_net'], -0.02)
            self.assertEqual(report['by_track_layout']['unknown']['races'], 2)
            mpath = Path(root) / 'meta.csv'
            mpath.write_text('event_id,distance_furlongs,surface,track_layout\na,6,all-weather,straight\nb,6,all-weather,turning\n')
            r2 = summarize(events, load_metadata(mpath))
            self.assertEqual(r2['by_track_layout']['straight']['races'], 1)
            self.assertEqual(r2['by_track_layout']['turning']['races'], 1)

    def test_missing_price_not_counted_as_touch(self):
        races = {('id','date'):[{'event_id':'id','event_dt':'date','selection_id':'a','event_name':'1m Hcap','menu_hint':'c','winner':True,'ipmin':1.01},
                               {'event_id':'id','event_dt':'date','selection_id':'b','event_name':'1m Hcap','menu_hint':'c','winner':False,'ipmin':None}]}
        r = summarize(races)
        self.assertEqual(r['races'][0]['missing_ipmin'], 1)
        self.assertEqual(r['races_with_2_plus'], 0)


if __name__ == '__main__':
    unittest.main()
