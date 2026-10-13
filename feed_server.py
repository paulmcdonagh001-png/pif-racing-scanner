"""Secure, private on-demand proxy for The Racing API free racecards.
No third-party credentials are delivered to the mobile browser.
"""
import os, base64, json, hmac, threading, time
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime,timezone
from zoneinfo import ZoneInfo

ORIGIN='https://pif-racing-scanner.onrender.com'
BASE='https://api.theracingapi.com/v1/racecards/free'
cache={}
lock=threading.Lock()

def configured():
    return all(os.getenv(x) for x in ('RACING_API_USERNAME','RACING_API_PASSWORD','SCANNER_ACCESS_PIN'))

def short(x,n=200):
    return str(x or '')[:n]

def convert(card):
    stamp=short(card.get('off_dt'))
    try:
        uk_time=datetime.fromisoformat(stamp.replace('Z','+00:00')).astimezone(ZoneInfo('Europe/London')).strftime('%H:%M')
    except (ValueError,TypeError):
        uk_time=short(card.get('off_time'))
    return {
        'feed_id':short(card.get('race_id'),80),
        'date':short(card.get('date'),10),
        'time':uk_time,
        'course':short(card.get('course')),
        'title':short(card.get('race_name')),
        'type':short(card.get('type')),
        'going':short(card.get('going')),
        'distance':short(card.get('distance') or card.get('distance_round') or (str(card['distance_f'])+'f' if card.get('distance_f') else '')),
        'status':short(card.get('race_status'),40),
        'runners':[{
            'horse_id':short(h.get('horse_id'),80),'name':short(h.get('horse')),
            'age':short(h.get('age'),10),'or':short(h.get('ofr'),10),
            'weight':short(h.get('lbs'),10),'form':short(h.get('form'),80),
            'days':short(h.get('last_run'),15),'trainer':short(h.get('trainer')),
            'jockey':short(h.get('jockey')), 'draw':short(h.get('draw'),10),
            'headgear':short(h.get('headgear'),30)
        } for h in (card.get('runners') or []) if isinstance(h,dict) and h.get('horse')]
    }

def cards(day):
    with lock:
        v=cache.get(day)
        if v and time.monotonic()-v[0]<300: return v[1]
    auth=base64.b64encode((os.environ['RACING_API_USERNAME']+':'+os.environ['RACING_API_PASSWORD']).encode()).decode()
    qs=urlencode([('day',day),('limit','500'),('region_codes','gb'),('region_codes','ire')])
    req=Request(BASE+'?'+qs, headers={'Authorization':'Basic '+auth,'Accept':'application/json','User-Agent':'PIF-Racing-Private-Scanner/0.2'})
    with urlopen(req,timeout=20) as r:
        raw=r.read(6_000_001)
    if len(raw)>6_000_000: raise ValueError('Oversized response')
    data=json.loads(raw)
    rows=data.get('racecards')
    if not isinstance(rows,list): raise ValueError('Missing racecards')
    valid=[convert(c) for c in rows if isinstance(c,dict)]
    valid=[c for c in valid if c['feed_id'] and c['date'] and c['course'] and c['runners']]
    result={'ok':True,'source':'The Racing API Free (no odds or detailed past form)','day':day,'fetched_at':datetime.now(timezone.utc).isoformat(),'races':valid}
    with lock: cache[day]=(time.monotonic(),result)
    return result

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def head(self,code,origin=None,size=None):
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer')
        self.send_header('Vary','Origin')
        if origin==ORIGIN:
            self.send_header('Access-Control-Allow-Origin',ORIGIN)
            self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS')
            self.send_header('Access-Control-Allow-Headers','Content-Type')
        if size is not None: self.send_header('Content-Length',str(size))
        self.end_headers()
    def reply(self,code,data,origin=None):
        b=json.dumps(data,separators=(',',':')).encode()
        self.head(code,origin,len(b))
        self.wfile.write(b)
    def do_GET(self):
        if self.path=='/health':
            self.reply(200,{'ok':True,'ready':configured()})
        else:
            self.reply(404,{'ok':False,'error':'Not found'})
    def do_OPTIONS(self):
        origin=self.headers.get('Origin')
        if self.path!='/racecards' or origin!=ORIGIN:
            self.reply(403,{'ok':False,'error':'Access denied'});return
        self.head(204,origin,0)
    def do_POST(self):
        origin=self.headers.get('Origin')
        if self.path!='/racecards' or origin!=ORIGIN:
            self.reply(403,{'ok':False,'error':'Access denied'});return
        if not configured():
            self.reply(503,{'ok':False,'error':'Racing API login and scanner access code have not yet been configured in Render.'},origin);return
        try:
            count=int(self.headers.get('Content-Length','0'))
            if count<2 or count>4096: raise ValueError('Invalid request size')
            req=json.loads(self.rfile.read(count))
            pin=str(req.get('pin') or '')
            if not hmac.compare_digest(pin,os.environ['SCANNER_ACCESS_PIN']):
                self.reply(401,{'ok':False,'error':'Incorrect scanner access code.'},origin);return
            day=req.get('day','today')
            if day not in ('today','tomorrow'):
                self.reply(400,{'ok':False,'error':'Invalid day.'},origin);return
            self.reply(200,cards(day),origin)
        except HTTPError as exc:
            msg='Racing API rejected the login or free-plan access.' if exc.code in (401,403) else 'Racing API temporarily unavailable.'
            self.reply(502,{'ok':False,'error':msg},origin)
        except (URLError,TimeoutError):
            self.reply(502,{'ok':False,'error':'Racing API timed out. Try again.'},origin)
        except (ValueError,TypeError,KeyError,json.JSONDecodeError):
            self.reply(400,{'ok':False,'error':'Unexpected request or racecard response.'},origin)

if __name__=='__main__':
    ThreadingHTTPServer(('0.0.0.0',int(os.getenv('PORT','10000'))),Handler).serve_forever()
