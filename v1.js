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
     e(errorMessage)+'</p><p>The scanner will not display stale horses as current qualifiers.</p>'+
     '<button class="button" data-retry="'+e(day)+'">Retry connection</button></div>';
   return;
 }
 if(!data){
   el.innerHTML='<div class="empty">Waiting for the live racing feed. No verified speed selections yet.</div>';return;
 }
 const scan=data.speed_trial||{};
 if(scan.status==='TIMING_HISTORY_LOADING'||scan.status==='NOT_READY'){
   el.innerHTML='<div class="empty"><strong>Timing calculations are temporarily unavailable.</strong>'+
     '<p>Racecards loaded, but no timed selections can be verified. Please retry later.</p></div>';return;
 }
 const candidates=Array.isArray(scan.candidates)?scan.candidates:[];
 const total=(data.races||[]).length;
 const header='<div class="scan-meta">'+e(ukDate(day==='today'?0:1))+' · '+e(total)+
   ' racecards available · '+e(scan.standards_derived??'—')+' race-time standards built</div>';
 if(!candidates.length){
  el.innerHTML=header+'<div class="empty"><strong>No qualifying speed horses.</strong>'+
    '<p>The locked Andy-inspired rules found no sufficiently strong timed selection for this scan. '+
    'We will not force a pick or replace the formula with form and trainer tips.</p>'+
    '<p>Only upcoming handicap hurdles with enough prior timing evidence are considered.</p></div>';return;
 }
 el.innerHTML=header+'<div class="cards">'+candidates.map(speedCard).join('')+'</div>';
}
function speedCard(v){
 const proof=Array.isArray(v.timed_evidence)?v.timed_evidence:[];
 const context=v.race_context||{};
 const key=paperKey(v.race_id,v.horse_id);
 const saved=!!paper[key];
 const odds=v.quote&&v.quote.indicative_decimal?
   e(v.quote.bookmaker)+' indicative '+e(nfmt(v.quote.indicative_decimal,2))+
     ' · '+e(v.quote.minutes_old)+' min old':'No fresh market quote available';
 const contextBits=[
   context.race_class&&'Class '+context.race_class,
   context.horse_weight_lbs&&'Weight '+context.horse_weight_lbs+' lb',
   context.horse_official_rating&&'Official rating '+context.horse_official_rating,
   context.days_since_run&&'Last raced '+context.days_since_run+' days ago'
 ].filter(Boolean);
 const warn=(v.warnings||[]).slice();
 if(!context.horse_official_rating)warn.push('Current handicap mark not confirmed');
 if(!context.horse_weight_lbs)warn.push('Carried weight not confirmed');
 const evidence=proof.map(p=>'<div class="past-run"><div><strong>'+e(p.date)+
   '</strong> · '+e(p.course_name||p.course_id||'Course unconfirmed')+
   ' · '+e(p.yards)+' yards · going: '+e(p.going)+'</div>'+
   '<div>Finished '+e(p.finish_position)+(p.beaten_lengths?' · beaten '+e(p.beaten_lengths)+' lengths':'')+
   ' · adjusted speed '+e(nfmt(p.speed_pts))+' · race strength '+e(nfmt(p.race_strength_pts))+'</div>'+
   '<div class="muted-text">Actual winning time '+e(nfmt(p.winning_seconds,2))+
   's · adjusted standard '+e(nfmt(p.adjusted_standard_seconds,2))+
   's · '+e(p.standard_sample)+' prior comparable races</div></div>').join('');
 return '<article class="horse-card"><div class="horse-head">'+
  '<div><div class="race-label">'+e(ukOff(v.off_time))+' · '+e(v.course)+
  '</div><h3>'+e(v.horse)+'</h3><div class="muted-text">'+e(v.distance)+' · '+e(v.going)+'</div></div>'+
  '<div class="lead-figure">'+e(nfmt(v.speed_lead_pts))+'<span>speed lead</span></div></div>'+
  '<p class="price">'+odds+'</p>'+
  '<div class="metrics"><span>Speed figure: '+e(nfmt(v.speed_pts))+'</span>'+
  '<span>Eligible timed opponents: '+e(v.comparable_runners)+'</span>'+
  '<span>Comparable timed runs: '+e(v.prior_timed_runs)+'</span></div>'+
  (contextBits.length?'<div class="context"><strong>Today’s racecard:</strong> '+contextBits.map(e).join(' · ')+'</div>':'')+
  '<div class="evidence"><strong>Why it qualifies — previous timed performances</strong>'+evidence+'</div>'+
  '<div class="cautions"><strong>What might be wrong:</strong> '+e(warn.length?warn.join(' · '):
   'Jumping, race pace and opposition still require caution')+'</div>'+
  '<div class="horse-actions"><button class="button" data-track="'+encodeURIComponent(key)+'">'+
  (saved?'Saved to paper list':'Save to my paper list')+'</button>'+
  '<span class="hint">Experimental speed research — no proven betting advantage</span></div></article>';
}
async function fetchResults(){
 if(!pin)return;
 $('results-content').innerHTML='<div class="empty">Loading recorded trial selections and outcomes…</div>';
 try{
  const [statusData,detail]=await Promise.all([
    privateCall('/forward-status',{}),privateCall('/trial-results',{})
  ]);
  results={summary:statusData.speed_trial||{},items:detail.items||[],at:Date.now()};
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
      '<span>'+e(x.observed_decimal_odds?nfmt(x.observed_decimal_odds,2):'No fresh quote')+'</span>'+
      '<span>'+e(x.status==='SETTLED'?(x.won?'Won':'Lost'):
       x.status==='VOID_NONRUNNER'?'Non-runner':'Pending')+'</span></div>').join('')+'</div>';
  }else html+='<div class="empty">No speed-qualified horses have been frozen by the server yet. The system will not invent selections.</div>';
 }
 html+='</section><section><div class="section-head"><h2>My paper list — on this device</h2>'+
   '<span class="muted-text">'+e(local.length)+' saved</span></div>'+
   '<p class="hint">These are personal notes stored in this browser, not audited server selections. '+
   'You can record the actual accepted odds yourself. The site never places a bet.</p>';
 if(!local.length)html+='<div class="empty">Your paper list is empty. Save a horse from a live speed shortlist to follow it.</div>';
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
  const x=(d?.speed_trial?.candidates||[]).find(v=>paperKey(v.race_id,v.horse_id)===key);
  if(x){candidate=x;break;}
 }
 if(!candidate)return;
 paper[key]={key,horse:candidate.horse,course:candidate.course,
   off:candidate.off_time,race_id:candidate.race_id,horse_id:candidate.horse_id,
   indicativeOdds:candidate.quote?.indicative_decimal||null,
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
