'use strict';
// PIF Racing V1: one public interface, private API and timing model remain server-side.
// Experimental research only. No bets or transactions are placed by this software.
const API='https://pif-racing-paper.onrender.com';
const PIN_KEY='pif-racing-pin';
const PAPER_KEY='pif-racing-v1-paper';
const $=id=>document.getElementById(id);
const e=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pin='',view='today',dayData={today:null,tomorrow:null},dayReceived={today:0,tomorrow:0},
    requests=0,busy=false,results=null,paper={},errorMessage='',lastActive='today',analysisMode='shortlist';
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
 $('race-display-modes').hidden=tab==='results';
 $('main-heading').textContent=tab==='today'?'Today’s PIF Racing':
   tab==='tomorrow'?'Tomorrow’s PIF Racing':'My trial & results';
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
  status('Live racecards verified. Combined PIF qualifier research is experimental.','good');
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
function showMode(mode){
 analysisMode=mode==='all'?'all':'shortlist';
 const active=view==='tomorrow'?'tomorrow':'today';
 $('analysis-all').classList.toggle('selected',analysisMode==='all');
 $('analysis-qualifiers').classList.toggle('selected',analysisMode==='shortlist');
 if(view!=='results')showRaceDay(active);
}
function cleanNumber(x){const n=Number(x);return Number.isFinite(n)?String(n):'—';}
function evidenceFact(label,contents){
 return '<div class="formula-fact"><strong>'+e(label)+'</strong><span>'+e(contents)+'</span></div>';
}
function researchWatchCandidates(data){
 const races=data.all_races?.races||[];
 return races.filter(r=>{
  const v=r.leader||{};
  const history=v.evidence||{};
  return !r.qualified && v.preoff===true && Number(v.history_runs)>=3
   && Number(v.model_gap)>=0.03
   && Math.max(Number(history.distance_runs)||0,Number(history.going_runs)||0)>=1;
 }).sort((a,b)=>Number(b.leader.model_gap)-Number(a.leader.model_gap));
}
function watchRaceCard(r){
 const v=r.leader,ev=v.evidence||{},q=v.quote||null;
 const validPrice=q?.decimal&&q.source?e(q.source)+' '+e(nfmt(q.decimal,2))+' indicative':'No verified early odds';
 const key=paperKey(r.race_id,v.horse_id);
 const expl='<div class="formula-grid">'+
   evidenceFact('Prior horse runs',ev.prior_races??v.history_runs)+
   evidenceFact('Comparable distance runs',ev.distance_runs??'—')+
   evidenceFact('Comparable going runs',ev.going_runs??'—')+
   evidenceFact('Racecourse runs',ev.course_runs??'—')+
   evidenceFact('Trainer last 30 days',String(ev.trainer30_wins??'—')+' wins / '+String(ev.trainer30_runs??'—')+' runs')+
   evidenceFact('Prior timed performances',ev.raw_speed_evidence_count??'—')+
   evidenceFact('Handicap mark',ev.horse_official_rating??'—')+
   evidenceFact('Weight (lb)',ev.horse_weight_lbs??'—')+'</div>';
 return '<details class="qual-row watch-row">'+
  '<summary class="qual-summary"><span class="qual-main">'+
   '<span class="race-label">'+e(r.time)+' · '+e(r.course)+'</span>'+
   '<span class="qual-horse">'+e(v.horse)+'</span>'+
   '<span class="qual-meta">'+e(r.type)+' · '+e(r.distance)+' · '+e(r.going)+'</span></span>'+
  '<span class="qual-right"><span class="watch-badge">RESEARCH WATCH</span>'+
   '<span class="qual-price">'+validPrice+'</span></span></summary>'+
  '<div class="qual-expanded"><p class="hint">'+e(r.name)+'</p>'+
   '<p class="qual-explanation">Model leader with substantial previous history and a ranking gap of '+
    e(nfmt(v.model_gap,3))+'. This is not an estimated win probability.</p>'+
   expl+
   '<p class="hint">Does not pass the existing handicap-hurdle-only qualifying rule. No independently proven early-price advantage. '+
   'Additional history and race conditions remain uncertain.</p>'+
   '<p class="hint">All other runners can be checked under All races.</p></div></details>';
}
function renderResearchShortlist(data,target){
 const full=data.all_races||{};
 const scan=data.combined_research||{};
 if(full.status!=='READY'){
  target.innerHTML='<div class="empty error"><strong>Race-by-race evidence unavailable.</strong>'+
   '<p>No research watchlist can be verified. Refresh the races when the backend recovers.</p>'+
   '<button class="button" data-retry="'+e(view==='tomorrow'?'tomorrow':'today')+'">Retry</button></div>';return;
 }
 if(!['FROZEN_PREOFF','NO_UPCOMING_RACES','WAITING_FIRST_SCAN'].includes(scan.status)){
  target.innerHTML='<div class="empty error"><strong>Qualifier decision could not be checked.</strong>'+
   '<p>We will not substitute research leaders for actual qualifiers.</p></div>';return;
 }
 const qual=Array.isArray(scan.leaders)?scan.leaders:[];
 const candidates=researchWatchCandidates(data).slice(0,15);
 const allCount=full.total||full.races?.length||0;
 let head='<div class="quick-totals"><span><strong>'+e(qual.length)+
  '</strong> trial qualifiers</span><span><strong>'+e(candidates.length)+
  '</strong> research watch</span><span><strong>'+e(allCount)+
  '</strong> races analysed</span></div>';
 const real=qual.length?
  '<section class="brief-section"><h3>PIF research qualifiers — all race types</h3>'+
  '<div class="qualifier-list">'+qual.map(x=>combinedCard(x,true)).join('')+'</div></section>':
  '<p class="status-brief">No horses met the all-race-type historical evidence gate today. The lower-evidence watchlist is below.</p>';
 const watch=candidates.length?
   '<section class="brief-section"><div class="section-head"><h3>Research watchlist</h3>'+
   '<span class="muted-text">Not qualifying bets</span></div>'+
   '<div class="qualifier-list">'+candidates.map(watchRaceCard).join('')+'</div></section>':
   '<div class="empty"><strong>No additional research-watch horses.</strong>'+
   '<p>No saved leader passed the exploratory history and relative-ranking screen.</p></div>';
 const details='<details class="methodology compact-method"><summary>Why these horses are on the shortlist</summary>'+
  '<p>All race types use the frozen 61-factor model. Experimental qualifiers need at least '+
  'five earlier runs, STRONG historical evidence, two comparable distance or going starts, '+
  'and a model ranking gap of at least 0.06.</p>'+
  '<p>Research watch horses have 3+ earlier runs, at least one comparable conditions run, '+
  'and a ranking gap of at least 0.03. These watch thresholds are exploratory only.</p>'+
  '<p class="hint">Historical tests show that the same filter does not consistently '+
  'beat the eventual starting-price favourite across Flat, all-weather or chase races. '+
  'None of these figures proves value at early odds.</p></details>';
 target.innerHTML=head+real+watch+details+
  '<p class="hint">To examine every runner and the model evidence, choose All races above.</p>';
}

function renderAllRaces(data,target){
 const full=data.all_races||{};
 const racecards=Array.isArray(full.races)?full.races:(data.races||[]);
 const sourceOK=full.status==='READY';
 const summary='<div class="scan-meta"><strong>'+e(racecards.length)+
  ' races shown</strong> · '+e(full.model_scored||0)+' with a saved model leader · '+
  e(full.full_runner_scored||0)+' with a complete frozen runner ranking · '+
  e(full.qualified_races||0)+' research qualifiers</div>';
 const sourceNote=sourceOK?'':
  '<div class="empty error"><strong>Detailed evidence temporarily unavailable.</strong>'+
  '<p>These are current racecard facts; individual model scores cannot be verified on this load.</p></div>';
 const formula=full.formula||{};
 const method='<details class="methodology"><summary>How the PIF racing formula works</summary>'+
  '<p>The model uses 61 linked historical inputs to rank runners against the actual field. '+
  'The learned combination is complex, not a simple total of arbitrary points. '+
  'Scores are <strong>not</strong> calibrated winning percentages.</p>'+
  '<ol>'+((formula.stages||[
   'Build horse, trainer, jockey and racecourse histories from previous results',
   'Compare distance, going, class, handicap, previous speed evidence and opposition',
   'Rank all available runners and separately apply the narrower qualification gate'
  ]).map(x=>'<li>'+e(x)+'</li>').join(''))+'</ol>'+
  '<p class="hint">'+e(formula.limitations||'Model not yet validated for profitable betting.')+'</p></details>';
 if(!racecards.length){
  target.innerHTML=summary+'<div class="empty">No racecards available for this day.</div>'+method;return;
 }
 const groups=racecards.map(fullRace).join('');
 target.innerHTML=summary+sourceNote+
  '<div class="all-races-list">'+groups+'</div>'+method+
  '<p class="hint">All races are displayed whether or not a horse qualifies. '+
  'An absent pre-off score is NOT evidence that the horse is weak; it means a verified model snapshot is unavailable.</p>';
}
function fullRace(r){
 const leader=r.leader||null;
 const hasLeader=leader&&leader.preoff;
 const title=r.name||'Unnamed race';
 const reason=r.qualified?'<span class="qual-badge">RESEARCH QUALIFIER</span>':
  hasLeader?'<span class="watch-badge">RESEARCH ONLY</span>':
  '<span class="watch-badge">NO FROZEN MODEL</span>';
 const summary='<span class="race-audit-title"><strong>'+e(r.time)+' · '+e(r.course)+'</strong>'+
  '<span>'+e(title)+'</span><small>'+e(r.type)+' · '+e(r.distance)+' · '+
  e(r.going)+' · '+e(r.runner_count)+' runners</small></span>';
 const leadline=hasLeader?'<strong>'+e(leader.horse)+'</strong>'+
  '<small>Model leader · gap '+e(nfmt(leader.model_gap,3))+'</small>':
  '<span class="muted-text">No verified pre-off leader</span>';
 const evidence=hasLeader?modelEvidence(leader):
  '<div class="empty"><strong>No saved pre-race model prediction for this race.</strong>'+
   '<p>Runner and racecard facts remain available below. We never calculate a historical “prediction” after a race has started.</p></div>';
 const runnerTable=(r.runners||[]).map(h=>{
   const scored=h.scored;
   const cell=scored?
    'Rank '+e(scored.rank)+' · relative share '+e(nfmt(scored.share,3))+
     ' <span class="hint">(not a win chance)</span>':
    '<span class="muted-text">Full model rank not captured</span>';
   const p=h.private_history||{};
   const hist=p.last12mo_recorded_runs===undefined?
       'Recorded history unavailable':
       e(p.last12mo_recorded_runs)+' recorded starts · '+
       e(p.similar_distance_runs??'—')+' similar-distance · '+
       e(p.same_going_runs??'—')+' same going';
   const trainer=h.trainer14_runs? ' · trainer last 14d '+e(h.trainer14_wins)+'/'+e(h.trainer14_runs):'';
   const detail=scored?'<div class="model-extra">'+
     evidenceFact('Earlier horse runs',scored.evidence?.prior_races??'—')+
     evidenceFact('Course record',String(scored.evidence?.course_wins??'—')+' wins / '+String(scored.evidence?.course_runs??'—')+' starts')+
     evidenceFact('Trip record',String(scored.evidence?.distance_places??'—')+' places / '+String(scored.evidence?.distance_runs??'—')+' starts')+
     evidenceFact('Going record',String(scored.evidence?.going_places??'—')+' places / '+String(scored.evidence?.going_runs??'—')+' starts')+
     evidenceFact('History speed coverage',scored.evidence?.relevant_timed_runs??'—')+
     evidenceFact('Trainer (30 days)',String(scored.evidence?.trainer30_wins??'—')+' wins / '+String(scored.evidence?.trainer30_runs??'—')+' runs')+
     evidenceFact('Jockey (30 days)',scored.evidence?.jockey30_runs==null?'Not yet available':
       String(scored.evidence.jockey30_runs)+' rides · '+nfmt(Number(scored.evidence.jockey30_win_rate)*100,1)+'% historical wins')+
     evidenceFact('Trainer & jockey together',scored.evidence?.trainer_jockey_runs??'Not yet available')+
     evidenceFact('Jockey at course',scored.evidence?.jockey_course_runs??'Not yet available')+
     '</div>':'';
   return '<details class="runner-review"><summary>'+
     '<span class="runner-line"><strong>'+e(h.name)+'</strong>'+
     (h.is_frozen_leader?' <span class="qual-badge">Model #1</span>':'')+
     (h.is_non_runner?' <span class="watch-badge">NR</span>':'')+
     '<small>'+e(h.jockey||'Jockey unknown')+' · '+e(h.trainer||'Trainer unknown')+
     '</small></span><span class="runner-rank">'+cell+'</span></summary>'+
     '<div class="runner-facts">Age '+e(h.age||'—')+' · OR '+e(h.or||'—')+
     ' · weight '+e(h.weight||'—')+' lb · '+hist+' · form '+e(h.form||'—')+
     trainer+
     (h.market_bet365?' · Bet365 indicative '+e(h.market_bet365):'')+'</div>'+
     (detail||'<p class="hint">The pre-race 61-factor runner ranking is not yet saved. Available racecard and previous-result evidence is shown above.</p>')+
     '</details>';
 }).join('');
 return '<details class="race-audit"><summary>'+summary+'<span class="race-audit-leader">'+
  reason+leadline+'</span></summary>'+
  '<div class="race-audit-inner"><p class="hint">Model winner is only the top-ranked runner; it is not a bet recommendation.</p>'+
  evidence+'<h4>All runners and their evidence</h4>'+
  runnerTable+'</div></details>';
}
function modelEvidence(v){
 const x=v.evidence||{};
 const gate=v.gate_checks||{};
 const checks=Object.entries(gate).map(([name,ok])=>
   '<span class="gate-check '+(ok?'pass':'fail')+'">'+(ok?'✓ ':'× ')+
   e(name.replaceAll('_',' '))+'</span>').join('');
 const cells=[
  ['Prior runs',x.prior_races],['Historical coverage',v.coverage],
  ['Course runs / wins',String(x.course_runs??'—')+' / '+String(x.course_wins??'—')],
  ['Comparable distance runs / places',String(x.distance_runs??'—')+' / '+String(x.distance_places??'—')],
  ['Comparable going runs / places',String(x.going_runs??'—')+' / '+String(x.going_places??'—')],
  ['Trainer last 30 days',String(x.trainer30_wins??'—')+' wins / '+String(x.trainer30_runs??'—')+' runs'],
  ['Available timing runs',x.raw_speed_evidence_count],['Official mark',x.horse_official_rating],
  ['Weight (lb)',x.horse_weight_lbs],
  ['Opposition',String(v.field_size||'—')+' runners · next '+String(x.opponent_horse||'unknown')],
  ['Model ranking gap',nfmt(v.model_gap,3)]
 ].map(([k,value])=>evidenceFact(k,value??'—')).join('');
 return '<div class="race-evidence"><strong>Frozen combined model assessment</strong>'+
  '<p class="hint">Recorded '+e(v.frozen_at||'unknown time')+
  '. Rating lead and model share are relative scores, not fair odds.</p>'+
  '<div class="formula-grid">'+cells+'</div>'+
  (checks?'<p class="hint">Why it did or did not qualify:</p><div class="gate-checks">'+checks+'</div>':
   '<p class="hint">No saved qualification decision found for this race.</p>')+
  (v.gate_explanation?'<p class="hint">'+e(v.gate_explanation)+'</p>':'')+
  '<p class="hint">These figures describe inputs to the formula, not individually proven causal contributions or model explanations.</p></div>';
}

function showRaceDay(day){
 const target=$('day-content');
 if(!pin){target.innerHTML='';return;}
 const data=dayData[day];
 if(errorMessage&&!data){
   target.innerHTML='<div class="empty error"><strong>Could not complete a live scan.</strong><p>'+
     e(errorMessage)+'</p><p>Old selections have been hidden. This screen never substitutes cached races for current qualifiers.</p>'+
     '<button class="button" data-retry="'+e(day)+'">Retry connection</button></div>';return;
 }
 if(!data){
  target.innerHTML='<div class="empty">Waiting for the combined historical scanner.</div>';return;
 }
 $('analysis-all').classList.toggle('selected',analysisMode==='all');
 $('analysis-qualifiers').classList.toggle('selected',analysisMode==='shortlist');
 if(analysisMode==='all'){
   renderAllRaces(data,target);return;
 }
 renderResearchShortlist(data,target);return;
 const scan=data.combined_research||{};
 if(!scan.status||['MODEL_NOT_READY','MODEL_UNAVAILABLE','TIMING_HISTORY_LOADING'].includes(scan.status)){
   target.innerHTML='<div class="empty error"><strong>The qualifier formula could not be verified.</strong>'+
    '<p>No substitute tips or old runners are being shown. Retry when the data service is available.</p>'+
    '<button class="button" data-retry="'+e(day)+'">Retry</button></div>';return;
 }
 if(scan.status==='WAITING_FIRST_SCAN'){
  target.innerHTML='<div class="empty"><strong>Awaiting automatic pre-race scan.</strong>'+
   '<p>The backend has not yet frozen this day’s combined model research. No horses are being invented.</p></div>';return;
 }
 const qualified=Array.isArray(scan.leaders)?scan.leaders:[];
 const secondary=Array.isArray(scan.research_leaders)?scan.research_leaders:[];
 const checked=Number(scan.screened_races)||0;
 const fullCount=Number(scan.research_leader_count)||secondary.length;
 const intro='<div class="scan-meta">'+e(ukDate(day==='today'?0:1))+
  ' · '+e((data.races||[]).length)+' racecards · '+e(checked)+' races screened · '+
  '<strong>'+e(qualified.length)+' experimental qualifiers</strong></div>';
 const headline=qualified.length?'<p class="hint">Only handicap hurdles passing the historically researched history, conditions and model-lead tests are shown here. These are NOT proven value bets.</p>':
  '<div class="empty"><strong>No PIF research qualifiers today.</strong>'+
  '<p>None of the current races passed the complete evidence filter. We will not force a selection.</p></div>';
 const watch=secondary.length?'<details class="other-research"><summary>Other model leaders — not qualifiers ('+
   e(fullCount)+')</summary><p class="hint">These horses were ranked first by the model but did not pass the qualification research gate. Shown for investigation only.</p>'+
   '<div class="qualifier-list">'+secondary.map(x=>combinedCard(x,false)).join('')+'</div></details>':'';
 target.innerHTML=intro+headline+
  (qualified.length?'<div class="qualifier-list">'+qualified.map(x=>combinedCard(x,true)).join('')+'</div>':'')+
  watch;
}
function probabilityStrip(v){
 const p=v.probability||{};
 if(p.status!=='EXPERIMENTAL')
  return '<span class="top-probabilities unavailable"><span class="prob-unavailable">PIF win and place estimates unavailable for this race.</span></span>';
 const entries=[['WIN',p.win],['TOP 2',p.top2],['TOP 3',p.top3],['TOP 4',p.top4]];
 return '<span class="top-probabilities">'+
  entries.map(([label,val])=>'<span class="top-probability"><strong>'+
    e((100*val).toFixed(1))+'%</strong><span>'+e(label)+'</span></span>').join('')+
  '<span class="top-prob-note">PIF research estimates · still being tested</span></span>';
}

function winEachWayPanel(v){
 const p=v.probability||{};
 if(p.status!=='EXPERIMENTAL')
  return '<div class="bet-model-not-ready"><strong>Win / Each-way guidance unavailable</strong>'+
   '<p>The historical probability model does not yet match this horse’s scoring model or racing surface. No bet-type conclusion is justified.</p></div>';
 const key=encodeURIComponent(paperKey(v.race_id,v.horse_id));
 return '<section class="bet-model-section"><h4>Win or each way?</h4>'+

  '<div class="bet-calculator" data-bet-key="'+key+'">'+
   '<label>Bookmaker odds (e.g. 5.30)<input class="bet-odds" type="number" min="1.01" max="1000" step="0.01" placeholder="'+
     e(v.quote?.decimal?nfmt(v.quote.decimal,2):'e.g. 4.50')+'" inputmode="decimal"></label>'+
   '<label>Places paid<select class="bet-places"><option value="">Select actual terms</option>'+
   '<option value="2">First 2 places</option><option value="3">First 3 places</option>'+
   '<option value="4">First 4 places</option><option value="5">First 5 places</option>'+
   '<option value="6">First 6 places</option></select></label>'+
   '<label>Place payout<select class="bet-fraction"><option value="">Select actual terms</option>'+
   '<option value="0.2">1/5 odds</option><option value="0.25">1/4 odds</option></select></label>'+
   '<button class="button secondary" data-compare-bet="'+key+'" type="button">Which looks better?</button>'+
   '<div class="bet-result" aria-live="polite"></div></div>'+
   '<p class="hint">Win pays only for first place. Each-way splits your stake into a win bet and a place bet. '+
    'Check the odds and place terms at the bookmaker. PIF does not place bets.</p></section>';
}
function compareBet(button){
 const panel=button.closest('.bet-calculator');
 if(!panel)return;
 const box=panel.querySelector('.bet-result');
 const price=Number(panel.querySelector('.bet-odds').value);
 const places=Number(panel.querySelector('.bet-places').value);
 const fraction=Number(panel.querySelector('.bet-fraction').value);
 if(!price||price<1.01||price>1000||!places||!fraction){
   box.textContent='Enter the actual offered decimal odds and both each-way terms first.';return;
 }
 const key=decodeURIComponent(panel.getAttribute('data-bet-key'));
 let selected=null;
 for(const entry of Object.values(dayData)){
  selected=(entry?.combined_research?.leaders||[]).find(r=>paperKey(r.race_id,r.horse_id)===key);
  if(selected)break;
 }
 const p=selected?.probability;
 if(!p||p.status!=='EXPERIMENTAL'){
  box.textContent='No matching calibrated model available for this horse. Cannot compare.';return;
 }
 if(places>Number(selected.field_size)){
  box.textContent='The number of paid places exceeds the recorded field size. Check actual bookmaker terms.';return;
 }
 const place=places===2?p.top2:places===3?p.top3:places===4?p.top4:null;
 if(place===null){
  box.textContent='We have not validated top-5 or top-6 place percentages. Each-way comparison unavailable for these terms.';return;
 }
 const winEdge=p.win*price-1;
 const ewPlaceOdds=1+(price-1)*fraction;
 const placeEdge=place*ewPlaceOdds-1;
 const ewEdge=(winEdge+placeEdge)/2;
 // Calculated expected net returns for a unit stake: win £1, EW £2 total.
 // This is research math, not reliable value until prospective calibration
 // and real prices are independently confirmed.
 // Keep all percentages out of the headline: calibration has not
 // established an edge against offered bookmaker prices. This is a comparison
 // of two experimental calculations, not advice to place either bet.
 let headline='NO CLEAR MODEL ADVANTAGE';
 let plain='At these odds, neither win nor each way looks better on the early PIF calculations.';
 if(winEdge>0&&winEdge>=ewEdge){
   headline='MODEL LEANS: WIN';
   plain='At these odds, the model favours backing the horse to win rather than splitting the stake into win and place.';
 }else if(ewEdge>0&&ewEdge>winEdge){
   headline='MODEL LEANS: EACH WAY';
   plain='At these odds and place terms, the model favours splitting the stake between win and place.';
 }
 box.innerHTML='<div class="bet-simple-verdict">'+
   '<strong>'+e(headline)+'</strong>'+
   '<p>'+e(plain)+'</p>'+
   '<p class="bet-safety">Important: This is an experimental comparison, not proof that either bet is good value.</p>'+
   '<details class="bet-why"><summary>What does this mean?</summary>'+
   '<p><strong>Win</strong> pays only if the horse finishes first. '+
   '<strong>Each-way</strong> consists of two equal bets: one to win and one to finish in the bookmaker’s paid places.</p>'+
   '<p>The calculation compares rough historical win and place estimates against the offered odds. '+
   'The model may be wrong, so it cannot reliably predict your profit.</p></details>'+
   '</div>';
}

function combinedCard(v,qualified){
 const ev=v.evidence||{},q=v.quote||null;
 const key=paperKey(v.race_id,v.horse_id),saved=!!paper[key];
 const odds=q&&q.decimal ? e(q.source)+' · '+e(nfmt(q.decimal,2))+' <span class="hint">(indicative)</span>' :
   '<span class="muted-text">No reliable early price</span>';
 const runCount=ev.prior_races??v.history_runs??'—';
 const comparable=Math.max(Number(ev.distance_runs)||0,Number(ev.going_runs)||0);
 const badge=qualified?'<span class="qual-badge">TRIAL QUALIFIER</span>':
   '<span class="watch-badge">RESEARCH ONLY</span>';
 const gate=qualified?'5+ recorded runs · comparable going/trip · experimental model separation':
  'Did not pass one or more suitability, coverage or model-separation gates';
 const detail=[
  'Horse: '+e(runCount)+' previous recorded starts; '+e(ev.course_runs??0)+' at this track',
  'Distance: '+e(ev.distance_runs??0)+' comparable starts, '+e(ev.distance_places??0)+' places',
  'Going: '+e(ev.going_runs??0)+' comparable starts, '+e(ev.going_places??0)+' places',
  'Trainer: '+e(ev.trainer30_wins??0)+' wins / '+e(ev.trainer30_runs??0)+' runs (last 30 days)',
  'Prior timed performances available: '+e(ev.raw_speed_evidence_count??0),
  'Handicap: mark '+e(ev.horse_official_rating??'—')+', carried '+e(ev.horse_weight_lbs??'—')+' lb',
  'Days since the most recent recorded race: '+e(ev.days_since_last_history??'—'),
  'Model ranking separation: '+e(nfmt(v.model_gap,3))+' (not a win probability)'
 ];
 return '<details class="qual-row">'+
   '<summary class="qual-summary"><span class="qual-main"><span class="race-label">'+
    e(ukOff(v.off_utc))+' · '+e(v.course)+'</span>'+
    '<span class="qual-horse">'+e(v.horse)+'</span>'+
    '<span class="qual-meta">'+e(v.distance)+' · '+e(v.going)+' · '+e(v.field_size)+' runners</span></span>'+
   '<span class="qual-right">'+badge+'<span class="qual-price">'+odds+'</span></span>'+
    probabilityStrip(v)+'</summary>'+
   '<div class="qual-expanded"><p class="muted-text">'+e(v.race_name)+'</p>'+
    '<p class="qual-explanation">'+e(gate)+'.</p>'+
    '<div class="evidence"><strong>History, course, trainer, jockey and race conditions</strong>'+
    detail.map(x=>'<div class="past-run">'+x+'</div>').join('')+'</div>'+
    winEachWayPanel(v)+
    '<p class="hint">Research only. This model has not proved profitable early-odds value; no verified sectional times or fair odds. Historical coverage remains incomplete.</p>'+
    (qualified?'<button class="button" data-track="'+encodeURIComponent(key)+'">'+
      (saved?'Saved in my paper list':'Add to paper trial')+'</button>':'')+
    '</div></details>';
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
 const paperRows=Object.values(paper).sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')));
 const overall=results?.summary||null;
 const gate=overall?.qualification_trial||null;
 const actual=Array.isArray(gate?.results)?gate.results:[];
 let html='<section><h2>Forward-tested PIF qualifiers</h2>';
 if(!gate){
  html+='<div class="empty"><strong>Awaiting verified qualifier results.</strong>'+
   '<p>The combined model results have not loaded, or the filter has not yet been recorded.</p>'+
   '<button class="button" data-refresh-results="1">Refresh results</button></div>';
 }else{
  html+='<div class="metrics summary-metrics"><span>'+e(gate.qualified||0)+' filtered pre-race entries</span>'+
   '<span>'+e(gate.settled||0)+' settled</span>'+
   '<span>'+e(gate.wins||0)+' winners</span></div>'+
   '<p class="hint">The full model has '+e(overall.saved||0)+' earlier unfiltered research records; those are excluded from this trial. '+
   'Win rates remain hidden until 100 genuinely settled filtered selections. Non-runners do not count as settled losses.</p>';
  if(actual.length){
   html+='<div class="result-table"><div class="result-row result-head"><span>Qualified horse</span><span>Early quote</span><span>Result</span></div>'+
   actual.slice(0,70).map(x=>'<div class="result-row"><span><strong>'+e(x.horse)+'</strong>'+
    '<small>'+e(x.course)+' · '+e(ukOff(x.off_utc))+'</small></span>'+
    '<span>'+e(x.first_quote?nfmt(x.first_quote,2):'Unavailable')+'</span>'+
    '<span>'+e(x.status==='SETTLED'?(x.won?'Won':'Lost'):x.status==='NON_RUNNER'?'Non-runner':'Pending')+'</span></div>').join('')+'</div>';
  }else html+='<div class="empty">The filter has not yet recorded any prospective qualifying horses. It will not backdate predictions.</div>';
 }
 html+='</section><section><div class="section-head"><h2>My paper notes — this device</h2>'+
  '<span class="muted-text">'+e(paperRows.length)+' saved</span></div>'+
  '<p class="hint">Your notes and actual odds are stored in this browser, not as audited system predictions. No bets are placed by the app.</p>';
 if(!paperRows.length)html+='<div class="empty">Your paper list is empty. Expand a qualifying horse and select Add to paper trial.</div>';
 else html+=paperRows.map(x=>{
  const logged=actual.find(z=>paperKey(z.race_id,z.horse_id)===x.key);
  const state=logged?(logged.status==='SETTLED'?(logged.won?'Won':'Lost'):
       logged.status==='NON_RUNNER'?'Non-runner':'Pending'):'Awaiting verified settlement';
  return '<div class="paper-entry"><div><strong>'+e(x.horse)+'</strong>'+
   '<small>'+e(x.course)+' · '+e(ukOff(x.off))+'</small><small>'+e(state)+'</small>'+
   '<small>My recorded decimal odds: '+e(x.actualOdds?nfmt(x.actualOdds,2):'Not entered')+'</small></div>'+
   '<div class="actions"><button class="button secondary" data-odds="'+encodeURIComponent(x.key)+'">Enter odds</button>'+
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
 if(b.hasAttribute('data-analysis-mode')){showMode(b.getAttribute('data-analysis-mode'));return;}
 if(b.hasAttribute('data-retry')){loadDay(b.getAttribute('data-retry'));return;}
 if(b.hasAttribute('data-compare-bet')){compareBet(b);return;}
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
