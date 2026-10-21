#!/usr/bin/env python3
"""Research only: Betfair UK WIN IPMIN price-touch audit at a configurable lay price.

IPMIN is a filtered historical minimum, NOT evidence that a £1 Keep lay filled.
No betting, API access, feature scoring or existing PIF racing model changes.

Example:
  python research/lay_field_2_audit.py dwbfpricesukwin*.csv \
      --price 2.0 --stake 1 --commission 0.02 --metadata race_metadata.csv \
      --output-json audit.json

Metadata is optional. Fields: event_id, distance_furlongs, surface, track_layout.
Only independently VERIFIED track-layout and surface labels should be included.
"""

import argparse
import csv
import json
import re
from collections import defaultdict
from pathlib import Path


def number(value):
    try:
        f = float(str(value).strip())
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def normalise(row):
    return {str(k).strip().upper(): v for k, v in row.items() if k is not None}


def distance_furlongs(label):
    label = str(label or '').lower()
    m = re.search(r'(?<!\w)(\d+)m(?:(\d+)f)?(?!\w)', label)
    if m:
        return int(m.group(1)) * 8 + int(m.group(2) or 0)
    f = re.search(r'(?<!\w)(\d+)f(?!\w)', label)
    return int(f.group(1)) if f else None


def load_metadata(filename):
    out = {}
    if not filename:
        return out
    with open(filename, encoding='utf-8-sig', newline='') as handle:
        for raw in csv.DictReader(handle):
            row = normalise(raw)
            key = str(row.get('EVENT_ID') or '').strip()
            if not key or key in out:
                raise ValueError('Missing/duplicate EVENT_ID in race metadata')
            surface = str(row.get('SURFACE') or 'unknown').lower().strip()
            layout = str(row.get('TRACK_LAYOUT') or 'unknown').lower().strip()
            if surface not in {'unknown', 'turf', 'all-weather'}:
                raise ValueError(f'Invalid surface for EVENT_ID {key}: {surface}')
            if layout not in {'unknown', 'straight', 'turning'}:
                raise ValueError(f'Invalid track_layout for EVENT_ID {key}: {layout}')
            try:
                distance = int(row['DISTANCE_FURLONGS']) if row.get('DISTANCE_FURLONGS') else None
            except ValueError as exc:
                raise ValueError(f'Invalid distance for EVENT_ID {key}') from exc
            out[key] = {'surface': surface, 'track_layout': layout, 'distance_furlongs': distance}
    return out


def load_events(files):
    events = defaultdict(list)
    duplicate_files = set()
    seen_rows = set()
    for filename in files:
        filename = str(filename)
        if filename in duplicate_files:
            continue
        duplicate_files.add(filename)
        if 'ukwin' not in Path(filename).name.lower():
            raise ValueError(f'Only Betfair UK WIN historical CSVs accepted: {filename}')
        with open(filename, encoding='utf-8-sig', newline='') as handle:
            reader = csv.DictReader(handle)
            required = {'EVENT_ID', 'SELECTION_ID', 'WIN_LOSE', 'IPMIN'}
            cols = {c.strip().upper() for c in (reader.fieldnames or [])}
            if not required <= cols:
                raise ValueError(f'Missing expected columns in {filename}: {required - cols}')
            for raw in reader:
                row = normalise(raw)
                eid = str(row.get('EVENT_ID') or '').strip()
                sid = str(row.get('SELECTION_ID') or '').strip()
                event_dt = str(row.get('EVENT_DT') or '').strip()
                if not eid or not sid:
                    continue
                market = (eid, event_dt)
                row_id = (market, sid)
                if row_id in seen_rows:
                    continue
                seen_rows.add(row_id)
                events[market].append({
                    'event_id': eid,
                    'event_dt': event_dt,
                    'selection_id': sid,
                    'event_name': str(row.get('EVENT_NAME') or ''),
                    'menu_hint': str(row.get('MENU_HINT') or ''),
                    'winner': str(row.get('WIN_LOSE') or '').strip() in {'1', '1.0'},
                    'ipmin': number(row.get('IPMIN')),
                })
    return events


def field_band(count):
    if count <= 6:
        return '2-6'
    if count <= 9:
        return '7-9'
    if count <= 12:
        return '10-12'
    if count <= 14:
        return '13-14'
    return '15+'


def summarize(events, metadata=None, price=2.0, stake=1.0, commission=0.02):
    if price <= 1.0 or stake <= 0 or not (0 <= commission < 1):
        raise ValueError('Invalid price/stake/commission')
    metadata = metadata or {}
    accepted, rejected = [], []
    for (event_id, event_dt), runners in sorted(events.items()):
        winners = [r for r in runners if r['winner']]
        selections = [r['selection_id'] for r in runners]
        if len(winners) != 1 or len(selections) != len(set(selections)) or len(runners) < 2:
            rejected.append({'event_id': event_id, 'reason': 'winner/count/duplicate invalid'})
            continue
        meta = metadata.get(event_id, {})
        distance = meta.get('distance_furlongs') or distance_furlongs(runners[0]['event_name'])
        touched = [r for r in runners if r['ipmin'] is not None and r['ipmin'] <= price]
        winner_touched = any(r['winner'] for r in touched)
        loser_touches = sum(not r['winner'] for r in touched)
        gross = stake * (loser_touches - (price - 1) * winner_touched)
        net_proxy = gross - max(0, gross) * commission
        name = runners[0]['event_name']
        accepted.append({
            'event_id': event_id, 'event_dt': event_dt,
            'race': name, 'course_hint': runners[0]['menu_hint'],
            'field_size': len(runners), 'field_band': field_band(len(runners)),
            'distance_furlongs': distance,
            'surface': meta.get('surface', 'unknown'),
            'track_layout': meta.get('track_layout', 'unknown'),
            'handicap': bool(re.search(r'\bh(?:cap|andicap)\b', name, re.I)),
            'touched': len(touched), 'loser_touches': loser_touches,
            'winner_touched': winner_touched,
            'missing_ipmin': sum(r['ipmin'] is None for r in runners),
            'hypothetical_gross': round(gross, 4),
            'hypothetical_net': round(net_proxy, 4),
        })
    def group(key):
        buckets = defaultdict(list)
        for r in accepted:
            v = key(r)
            buckets[str(v if v is not None else 'unknown')].append(r)
        return {name: {'races': len(rr),
                       'at_least_2': sum(x['touched'] >= 2 for x in rr),
                       'at_least_3': sum(x['touched'] >= 3 for x in rr),
                       'at_least_2_pct': round(100 * sum(x['touched'] >= 2 for x in rr) / len(rr), 1),
                       'hypothetical_net': round(sum(x['hypothetical_net'] for x in rr), 2)}
                for name, rr in sorted(buckets.items())}
    return {
        'definition': 'IPMIN <= lay price: filtered price touch, NOT confirmed fills or ROI',
        'price': price, 'stake': stake, 'illustrative_commission': commission,
        'valid_races': len(accepted), 'rejected_races': rejected,
        'races_with_2_plus': sum(r['touched'] >= 2 for r in accepted),
        'races_with_3_plus': sum(r['touched'] >= 3 for r in accepted),
        'hypothetical_total_net': round(sum(r['hypothetical_net'] for r in accepted), 2),
        'by_field_size': group(lambda r: r['field_band']),
        'by_distance': group(lambda r: f"{r['distance_furlongs']}f" if r['distance_furlongs'] else 'unknown'),
        'by_surface': group(lambda r: r['surface']),
        'by_track_layout': group(lambda r: r['track_layout']),
        'by_handicap': group(lambda r: 'handicap' if r['handicap'] else 'other'),
        'races': accepted,
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('bsp', nargs='+', help='Daily dwbfpricesukwin*.csv files')
    p.add_argument('--metadata', help='Optional verified event_id track layout and surface CSV')
    p.add_argument('--price', type=float, default=2.0)
    p.add_argument('--stake', type=float, default=1.0)
    p.add_argument('--commission', type=float, default=0.02)
    p.add_argument('--output-json', help='Write full diagnostics, no betting actions')
    args = p.parse_args()
    report = summarize(load_events(args.bsp), load_metadata(args.metadata), args.price, args.stake, args.commission)
    if args.output_json:
        Path(args.output_json).write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'races'}, indent=2))


if __name__ == '__main__':
    main()
