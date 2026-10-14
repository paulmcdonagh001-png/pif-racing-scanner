'use strict';
// PIF Racing V1: one public interface, private API and timing model remain server-side.
// Experimental research only. No bets or transactions are placed by this software.
const API='https://pif-racing-paper.onrender.com';
const PIN_KEY='pif-racing-pin';
const PAPER_KEY='pif-racing-v1-paper';
const $=id=>document.getElementById(id);
const e=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pin='',view='today',dayData={today:null,tomorrow:null},dayReceived={today:0,tomorrow:0},
    requests=0,busy=false,results=null,paper={},errorMessage='',lastActive='today';
try{pin=sessionStorage.getItem(PIN_KEY)||'';}catch(_){}
try{paper=JSON.parse(localStorage.getItem(PAPER_KEY)||'{}')||{};}catch(_){paper={};}

function ukDate(offset){
  const d=new Date(Date.now()+Number(offset||0)*86400000);
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const obj={};for(const x of parts)obj[x.type]=x.value;
  return obj.year+'-'+obj.month+'-'+obj.day;
}
function ukOff(raw){
 try{return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',
   day:'numeric',month:'short'}).format(new Date(raw));}catch(_){return 'Time unavailable';}
}
function nfmt(n,dp=1){const v=Number(n);return Number.isFinite(v)?v.toFixed(dp):'—';}
function paperKey(r,h){return String(r)+'|'+String(h);}
function savePaper(){try{localStorage.setItem(PAPER_KEY,JSON.stringify(paper));}catch(_){}}
function status(message,tone){
 const x=$('connection-status');x.textContent=message;
 x.className='connection '+(tone||'muted');
}
function setView(tab){
 view=tab;
 $('main-heading').textContent=tab==='today'?'Today’s PIF research shortlist':
   tab==='tomorrow'?'Tomorrow’s PIF research shortlist':'My trial & results';
 for(const btn of document.querySelectorAll('[data-view]')){
   const active=btn.getAttribute('data-view')===tab;
   btn.classList.toggle('selected',active);btn.setAttribute('aria-current',active?'page':'false');
 }
 $('trial-view').hidden=tab==='results';
 $('results-view').hidden=tab!=='results';
 if(tab==='results'){showResults();if(pin&&!results)fetchResults();}
 else {lastActive=tab;showRaceDay(tab);if(pin&&(!dayData[tab]||Date.now()-dayReceived[tab]>5*60000))loadDay(tab);}
}
function showSignIn(){
 $('access-panel').hidden=!!pin;
 $('app-panel').hidden=!pin;
 if(!pin){
   $('access-error').textContent='';
   status('Private racing data requires your scanner code.','muted');
 }else{
   status('Ready to check live races.','muted');
 }
}
function signIn(ev){
 ev.preventDefault();
 const input=$('access-code');
 const entered=String(input.value||'').trim();
 if(entered.length<8){$('access-error').textContent='Enter your private PIF Racing scanner code.';return;}
 pin=entered;
 try{sessionStorage.setItem(PIN_KEY,pin)}catch(_){}
 input.value='';
 showSignIn();
 setView(lastActive);
}
function signOut(){
 pin='';results=null;dayData={today:null,tomorrow:null};dayReceived={today:0,tomorrow:0};
 try{sessionStorage.removeItem(PIN_KEY)}catch(_){}
 showSignIn();
}
async function privateCall(path,body){
 let lastError=null;
 for(let attempt=0;attempt<2;attempt++){
  if(attempt) await new Promise(resolve=>setTimeout(resolve,2200));
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),attempt?70000:40000);
  try{
    // text/plain makes this a simple cross-origin request: avoids Render cold-start
    // OPTIONS preflight. Server verifies exact Origin and private code.
    const res=await fetch(API+path,{
      method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify({pin,...body}),signal:controller.signal,
      cache:'no-store',referrerPolicy:'no-referrer'
    });
    let data;try{data=await res.json()}catch(_){throw Error('The data service returned an invalid response.');}
    if(!res.ok||!data.ok){
      const err=Error(data.error==='incorrect_code'?'Incorrect scanner code.':
        data.error==='racecard_unavailable'?'Racecard provider unavailable.':
        data.error||'Backend returned HTTP '+res.status);
      err.status=res.status;throw err;
    }
    return data;
  }catch(err){
    lastError=err;
    if(err.status===401||err.status===403||err.status===400)break;
    if(attempt===0)status('Connection slow or unavailable. Retrying once…','warn');
  }finally{clearTimeout(timeout);}
 }
 throw lastError||Error('Connection unavailable.');
}
async function loadDay(day){
 if(!pin)return;
 const seq=++requests;
 busy=true;errorMessage='';
 status('Fetching '+(day==='today'?'today’s':'tomorrow’s')+' live speed analysis…','muted');
 $('day-content').innerHTML='<div class="empty">Checking the racing feed and genuine historical times. Render may take up to a minute to wake.</div>';
 try{
  const data=await privateCall('/racecards',{day});
  dayData[day]=data;dayReceived[day]=Date.now();
  if(seq!==requests || view!==day)return;
  $('as-of').textContent='Racing API Standard · verified '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  status('Live racecards verified. Speed research is experimental.','good');
  showRaceDay(day);
 }catch(err){
  const detail=String(err.message||'Could not reach the racing service.');
  if(/incorrect scanner code/i.test(detail)){signOut();$('access-error').textContent=detail;return;}
  errorMessage=detail;
  // A failed refresh invalidates that day's verification. Never reuse a cached
  // horse as a current qualifier if the live service is unavailable.
  dayData[day]=null;dayReceived[day]=0;
  status('Live data unavailable — no selections are being shown from an old cache.','bad');
  if(seq===requests&&view===day)showRaceDay(day);
 }finally{busy=false;}
}
function showRaceDay(day){
 const el=$('day-content');
 if(!pin){el.innerHTML='';return;}
 const data=dayData[day];
 if(errorMessage&&!data){
  el.innerHTML='<div class="empty error"><strong>Could not complete a live scan.</strong><p>'+
   e(errorMessage)+'</p><p>No cached runners are being presented as fresh research selections.</p>'+
   '<button class="button" data-retry="'+e(day)+'">Retry connection</button></div>';
  return;
 }
 if(!data){el.innerHTML='<div class="empty">Waiting for live racecards and the combined historical model.</div>';return;}
 const scan=data.combined_research||{};
 if(scan.status==='MODEL_NOT_READY'||scan.status==='MODEL_UNAVAILABLE'||!scan.status){
  el.innerHTML='<div class="empty error"><strong>Combined formula temporarily unavailable.</strong>'+
   '<p>Racecards loaded, but the combined horse, jockey, trainer, course and performance model could not be verified. No substitute speed-only selections are shown.</p>'+
   '<button class="button" data-retry="'+e(day)+'">Retry</button></div>';return;
 }
 const total=(data.races||[]).length;
 const candidates=Array.isArray(scan.leaders)?scan.leaders:[];
 const header='<div class="scan-meta">'+e(ukDate(day==='today'?0:1))+
  ' · '+e(total)+' racecards · '+e(scan.screened_races||0)+' eligible races checked · '+
   e(scan.eligible_races||0)+' research leaders with history'+
   (scan.failed_to_score?' · '+e(scan.failed_to_score)+' model errors':'')+'</div>';
 if(!candidates.length){
  el.innerHTML=header+'<div class="empty"><strong>No research leaders with adequate history.</strong>'+
   '<p>The full combined model found no upcoming runners meeting the minimum prior-history coverage. No arbitrary pick is forced.</p>'+
   '<p>This is a forward research trial, not a validated profitable betting system.</p></div>';return;
 }
 const shown=candidates.slice(0,20);
 const note='<p class="hint" style="margin:8px 0 14px">Showing '+e(shown.length)+
  ' highest-separated research leaders, ranked against their current opposition. '+
  'These are not validated value bets. Quoted prices are indicative, not guaranteed.</p>';
 el.innerHTML=header+note+'<div class="cards">'+shown.map(combinedCard).join('')+'</div>';
}
function combinedCard(v){
 const ev=v.evidence||{};
 const key=paperKey(v.race_id,v.horse_id);
 const saved=!!paper[key];
 const q=v.quote;
 const price=q&&q.decimal?'Indicative '+e(q.source)+' '+e(nfmt(q.decimal,2))+
   ' · feed updated '+e(q.feed_updated||'unknown'):'No verified available quote';
 const factors=[
  'Prior horse runs '+e(ev.prior_races??'—'),
  'At course '+e(ev.course_runs??'—')+' runs / '+e(ev.course_wins??'—')+' wins',
  'Trip '+e(ev.distance_runs??'—')+' runs / '+e(ev.distance_places??'—')+' places',
  'Going '+e(ev.going_runs??'—')+' runs / '+e(ev.going_places??'—')+' places',
  'Trainer, last 30 days '+e(ev.trainer30_wins??'—')+'/'+e(ev.trainer30_runs??'—')+' wins',
  'History-derived speed runs '+e(ev.raw_speed_evidence_count??'—')
 ];
 const conditions=[
  ev.horse_official_rating?'Official mark '+ev.horse_official_rating:null,
  ev.horse_weight_lbs?'Weight '+ev.horse_weight_lbs+' lb':null,
  ev.days_since_last_history!=null?'Last historic start '+ev.days_since_last_history+' days ago':null,
  ev.horse_age?'Age '+ev.horse_age:null
 ].filter(Boolean);
 return '<article class="horse-card">'+
  '<div class="horse-head"><div><div class="race-label">'+e(ukOff(v.off_utc))+' · '+e(v.course)+
  '</div><h3>'+e(v.horse)+'</h3><div class="muted-text">'+e(v.distance)+' · '+e(v.going)+
  ' · '+e(v.race_name)+'</div></div><div class="lead-figure">'+
  e(nfmt(Number(v.model_gap)*100,1))+
  '<span>model ranking gap</span></div></div>'+
  '<p class="price">'+price+'</p>'+
  '<div class="metrics"><span>'+e(v.coverage)+' historical evidence</span>'+
   '<span>'+e(v.field_size)+' runners compared</span>'+
   '<span>'+e(v.version.includes("hcap")?'Hurdle-specific model':'Combined model')+'</span></div>'+
  '<div class="context"><strong>Today’s conditions:</strong> '+conditions.map(e).join(' · ')+'</div>'+
  '<div class="evidence"><strong>Why PIF is examining this horse</strong>'+
   factors.map(x=>'<div class="past-run">'+x+'</div>').join('')+'</div>'+
  '<div class="cautions"><strong>Limitations:</strong> This is an uncalibrated research ranking. '+
   'The live service has approximately 12 months of API history, shorter than the original training archive. '+
   'No verified sectional times, market edge or executable odds. A model leader is not automatically a bet.</div>'+
  '<div class="horse-actions"><button class="button" data-track="'+encodeURIComponent(key)+'">'+
    (saved?'Saved to paper list':'Save to paper list')+'</button>'+
    '<span class="hint">Frozen before the off for independent forward results testing.</span></div>'+
  '</article>';
}
async function fetchResults(){
 if(!pin)return;
 $('results-content').innerHTML='<div class="empty">Loading recorded trial selections and outcomes…</div>';
 try{
  const data=await privateCall('/combined-results',{});
  results={summary:data,items:data.rows||[],at:Date.now()};
  status('Live trial results verified.','good');
  showResults();
 }catch(err){
  if(/incorrect scanner code/i.test(String(err.message))){signOut();return;}
  $('results-content').innerHTML='<div class="empty error"><strong>Results unavailable.</strong>'+
   '<p>'+e(err.message)+'</p><button class="button" data-refresh-results="1">Retry results</button></div>';
  status('Trial results service could not be reached.','bad');
 }
}
function showResults(){
 if(view!=='results')return;
 const out=$('results-content');
 const local=Object.values(paper).sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')));
 const remote=results?.items||[];
 const summary=results?.summary||null;
 let html='<section><h2>Automatically recorded forward trial</h2>';
 if(!summary){
  html+='<div class="empty">Live result records have not loaded. <button class="button" data-refresh-results="1">Refresh results</button></div>';
 }else{
  html+='<div class="metrics summary-metrics"><span>'+e(summary.saved||0)+' horses frozen pre-race</span>'+
    '<span>'+e(summary.settled||0)+' results settled</span><span>'+e(summary.wins||0)+' winners</span></div>'+
   '<p class="hint">Performance rates stay hidden until at least 100 genuine forward observations. '+
   'Indicative odds are not evidence of achievable returns.</p>';
  if(remote.length){
   html+='<div class="result-table"><div class="result-row result-head"><span>Race / horse</span><span>Pre-race price</span><span>Result</span></div>'+
    remote.slice(0,80).map(x=>'<div class="result-row"><span><strong>'+e(x.horse)+'</strong><small>'+
      e(x.course)+' · '+e(ukOff(x.off_utc))+'</small></span>'+
      '<span>'+e(x.first_quote?nfmt(x.first_quote,2):'No fresh quote')+'</span>'+
      '<span>'+e(x.status==='SETTLED'?(x.won?'Won':'Lost'):
       x.status==='NON_RUNNER'?'Non-runner':'Pending')+'</span></div>').join('')+'</div>';
  }else html+='<div class="empty">No combined-model research leaders have been frozen by the server yet. The system will not invent selections.</div>';
 }
 html+='</section><section><div class="section-head"><h2>My paper list — on this device</h2>'+
   '<span class="muted-text">'+e(local.length)+' saved</span></div>'+
   '<p class="hint">These are personal notes stored in this browser, not audited server selections. '+
   'You can record the actual accepted odds yourself. The site never places a bet.</p>';
 if(!local.length)html+='<div class="empty">Your paper list is empty. Save a horse from a live combined research shortlist to follow it.</div>';
 else html+=local.map(x=>{
  const savedResult=remote.find(z=>paperKey(z.race_id,z.horse_id)===x.key);
  let state=savedResult?(savedResult.status==='SETTLED'?(savedResult.won?'Won':'Lost'):
        savedResult.status==='VOID_NONRUNNER'?'Non-runner':'Pending'):'Awaiting verified result';
  return '<div class="paper-entry"><div><strong>'+e(x.horse)+'</strong><small>'+e(x.course)+
    ' · '+e(ukOff(x.off))+'</small><small>'+e(state)+'</small>'+
    '<small>Recorded actual odds: '+e(x.actualOdds?nfmt(x.actualOdds,2):'Not entered')+
    '</small></div><div class="actions"><button class="button secondary" data-odds="'+encodeURIComponent(x.key)+'">Enter odds</button>'+
    '<button class="button secondary" data-remove="'+encodeURIComponent(x.key)+'">Remove</button></div></div>';
 }).join('');
 html+='</section>';
 out.innerHTML=html;
}
function track(encoded){
 const key=decodeURIComponent(encoded);
 if(paper[key]){setView('results');return;}
 let candidate=null;
 for(const d of Object.values(dayData)){
  const x=(d?.combined_research?.leaders||[]).find(v=>paperKey(v.race_id,v.horse_id)===key);
  if(x){candidate=x;break;}
 }
 if(!candidate)return;
 paper[key]={key,horse:candidate.horse,course:candidate.course,
   off:candidate.off_utc,race_id:candidate.race_id,horse_id:candidate.horse_id,
   indicativeOdds:candidate.quote?.decimal||null,
   savedAt:new Date().toISOString(),actualOdds:null};
 savePaper();showRaceDay(view);
}
function recordOdds(encoded){
 const key=decodeURIComponent(encoded),p=paper[key];if(!p)return;
 const raw=prompt('Enter the decimal odds you actually obtained for '+p.horse+
   '. Leave blank to keep unchanged.',p.actualOdds||'');
 if(raw===null||!String(raw).trim())return;
 const odds=Number(raw);
 if(!Number.isFinite(odds)||odds<1.01||odds>1000){alert('Enter valid decimal odds, for example 3.50.');return;}
 p.actualOdds=odds;p.oddsRecordedAt=new Date().toISOString();
 savePaper();showResults();
}
function removePaper(encoded){
 const key=decodeURIComponent(encoded);if(!paper[key])return;
 if(!confirm('Remove this horse from your browser paper list?'))return;
 delete paper[key];savePaper();showResults();
}
document.addEventListener('click',ev=>{
 const b=ev.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-view')){setView(b.getAttribute('data-view'));return;}
 if(b.hasAttribute('data-retry')){loadDay(b.getAttribute('data-retry'));return;}
 if(b.hasAttribute('data-track')){track(b.getAttribute('data-track'));return;}
 if(b.hasAttribute('data-odds')){recordOdds(b.getAttribute('data-odds'));return;}
 if(b.hasAttribute('data-remove')){removePaper(b.getAttribute('data-remove'));return;}
 if(b.hasAttribute('data-refresh-results')){fetchResults();return;}
});
window.addEventListener('DOMContentLoaded',()=>{
 $('access-form').addEventListener('submit',signIn);
 $('signout').addEventListener('click',signOut);
 $('reload-day').addEventListener('click',()=>loadDay(lastActive));
 showSignIn();
 setView('today');
});
