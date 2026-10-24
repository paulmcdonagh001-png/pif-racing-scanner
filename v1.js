'use strict';
// PIF Racing browser UI: always verify model identity against the protected backend.
// Experimental research only. No bets or transactions are placed by this software.
const API='https://pif-racing-paper.onrender.com';
const SESSION_KEY='pif-racing-remembered-v1';
const OLD_PIN_KEY='pif-racing-pin';
const PAPER_KEY='pif-racing-v1-paper';
const $=id=>document.getElementById(id);
const e=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sessionToken='',view='today',dayData={today:null,tomorrow:null},dayReceived={today:0,tomorrow:0},
    requests=0,busy=false,results=null,paper={},errorMessage='',lastActive='today',analysisMode='shortlist';
// Only a revocable random session token is persisted, never the scanner PIN.
try{
 const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
 const expiry=Date.parse(saved?.expires_at||'');
 if(saved&&typeof saved.session_token==='string'&&Number.isFinite(expiry)&&expiry>Date.now()+30000)
  sessionToken=saved.session_token;
 else localStorage.removeItem(SESSION_KEY);
}catch(_){sessionToken='';}
try{sessionStorage.removeItem(OLD_PIN_KEY);}catch(_){}
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
// Verify the protected server's active model and gate before showing research.
const CURRENT_RESEARCH_FILTER='pif-combined61-return-evidence-v9-20261021';
function hasVerifiedModel(data){
 const formula=data?.all_races?.formula||{};
 return data?.all_races?.status==='READY'&&
        formula.model_family==='Original 61-factor CatBoost'&&
        formula.qualifier_version===CURRENT_RESEARCH_FILTER&&
        data?.combined_research?.filter_version===CURRENT_RESEARCH_FILTER;
}
function updateModelIdentity(data){
 const el=$('model-family-label');if(!el)return;
 el.textContent=hasVerifiedModel(data)?
   '61-FACTOR MODEL · V9 RESEARCH FILTER':'MODEL VERSION NOT VERIFIED';
}
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
 if(tab==='results'){showResults();if(sessionToken&&!results)fetchResults();}
 else {lastActive=tab;showRaceDay(tab);if(sessionToken&&(!dayData[tab]||Date.now()-dayReceived[tab]>5*60000))loadDay(tab);}
}
function showSignIn(){
 $('access-panel').hidden=!!sessionToken;
 $('app-panel').hidden=!sessionToken;
 if(!sessionToken){
   $('access-error').textContent='';
   status('Enter your private code to activate 30-day remembered login.','muted');
 }else{
   status('Ready to check live races.','muted');
 }
}
function clearLogin(){
 sessionToken='';results=null;dayData={today:null,tomorrow:null};
 dayReceived={today:0,tomorrow:0};errorMessage='';requests++;
 try{localStorage.removeItem(SESSION_KEY);}catch(_){}
 try{sessionStorage.removeItem(OLD_PIN_KEY);}catch(_){}
 showSignIn();
}
function lostSession(){
 clearLogin();
 $('access-error').textContent='Your remembered login has expired. Enter your code again.';
}
async function signIn(ev){
 ev.preventDefault();
 const input=$('access-code');
 const entered=String(input.value||'').trim();
 if(entered.length<8){
  $('access-error').textContent='Enter your private PIF Racing scanner code.';return;
 }
 const button=$('access-form').querySelector('button[type="submit"]');
 button.disabled=true;
 $('access-error').textContent='';
 status('Signing in securely…','muted');
 try{
  const data=await apiCall('/session',{pin:entered});
  if(typeof data.session_token!=='string'||!Number.isFinite(Date.parse(data.expires_at)))
   throw Error('The login service returned an invalid session.');
  sessionToken=data.session_token;
  let remembered=true;
  try{
   localStorage.setItem(SESSION_KEY,JSON.stringify({
    session_token:sessionToken,expires_at:data.expires_at
   }));
  }catch(_){remembered=false;}
  input.value='';
  showSignIn();
  setView(lastActive);
  if(!remembered)status('Browser storage is blocked: this login will not be remembered.','warn');
 }catch(err){
  $('access-error').textContent=String(err.message||'Could not sign in.');
  status('Sign-in unsuccessful.','bad');
 }finally{button.disabled=false;}
}
function signOut(){
 const old=sessionToken;
 clearLogin();
 if(old){
  // Revoke this browser's token at the backend. Never retain or resend the PIN.
  apiCall('/session/logout',{session_token:old}).catch(()=>{});
 }
}
async function apiCall(path,body){
 let lastError=null;
 for(let attempt=0;attempt<2;attempt++){
  if(attempt) await new Promise(resolve=>setTimeout(resolve,2200));
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),attempt?70000:40000);
  try{
    // Plain-text POST avoids preflight; the backend still validates exact Origin.
    const res=await fetch(API+path,{
      method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify(body),signal:controller.signal,
      cache:'no-store',referrerPolicy:'no-referrer'
    });
    let data;try{data=await res.json()}catch(_){throw Error('The data service returned an invalid response.');}
    if(!res.ok||!data.ok){
      const err=Error(data.error==='incorrect_code'?'Incorrect scanner code.':
        data.error==='session_expired'?'Your remembered login expired.':
        data.error==='racecard_unavailable'?'Racecard provider unavailable.':
        data.error||'Backend returned HTTP '+res.status);
      err.status=res.status;
      err.code=data.error;throw err;
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
function privateCall(path,body){
 if(!sessionToken)return Promise.reject(Error('Sign in to open the scanner.'));
 return apiCall(path,{...body,session_token:sessionToken});
}
async function loadDay(day){
 if(!sessionToken)return;
 const seq=++requests;
 busy=true;errorMessage='';
 status('Fetching '+(day==='today'?'today’s':'tomorrow’s')+' live speed analysis…','muted');
 $('day-content').innerHTML='<div class="empty">Loading racecards and the latest historical performance analysis…</div>';
 try{
  const data=await privateCall('/racecards',{day});
  if(seq!==requests || !sessionToken)return;
  dayData[day]=data;dayReceived[day]=Date.now();
  if(view!==day)return;
  updateModelIdentity(data);
  $('as-of').textContent='Racing API Standard · verified '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  status(hasVerifiedModel(data)?
    'Live racecards verified. Original 61-factor V9 research gate active.':
    'Racecards received, but the current model version could not be verified.',
    hasVerifiedModel(data)?'good':'warn');
  showRaceDay(day);
 }catch(err){
  const detail=String(err.message||'Could not reach the racing service.');
  if(err.code==='session_expired'){lostSession();return;}
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
// Counts are past-only observations from available imported results, not career totals.
// Top-three finishes are NOT bookmaker each-way paid places.
function jockeyCourseEvidence(ev){
 const raw=ev?.jockey_course_runs;
 if(raw==null)return 'Not yet available';
 const rides=Number(raw);
 if(!Number.isInteger(rides)||rides<0)return 'Not yet available';
 if(ev?.jockey_course_stats_available===false)return 'Jockey or course identity unavailable';
 if(ev?.jockey_course_wins==null||ev?.jockey_course_top_three==null)
  return rides+' recorded earlier rides · results breakdown unavailable for this saved snapshot';
 const wins=Number(ev.jockey_course_wins),top3=Number(ev.jockey_course_top_three);
 if(!Number.isInteger(wins)||!Number.isInteger(top3)||wins<0||wins>top3||top3>rides)
  return rides+' recorded earlier rides · result breakdown unavailable';
 if(!rides)return 'No recorded earlier rides at this course';
 return rides+' recorded earlier rides · '+wins+' wins ('+nfmt(wins*100/rides,1)+'%) · '+
  top3+' top-three finishes ('+nfmt(top3*100/rides,1)+'%)'+
  (rides<10?' · small sample':'');
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
function watchRaceCard(r,marketMap,probabilityByHorse){
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
 return '<details class="qual-row watch-row" data-browse-row data-course="'+e(String(r.course||'').trim())+
   '" data-minute="'+raceMinutes(r)+'" data-qualified="0">'+
  '<summary class="qual-summary"><span class="qual-main">'+
   '<span class="race-label">'+e(r.time)+' · '+e(r.course)+'</span>'+
   '<span class="qual-horse">'+e(v.horse)+'</span>'+
   '<span class="qual-meta">'+e(r.type)+' · '+e(r.distance)+' · '+e(r.going)+'</span></span>'+
  '<span class="qual-right"><span class="watch-badge">RESEARCH WATCH</span>'+
   '<span class="qual-price">'+validPrice+'</span></span>'+modelPriceHeadline(r.value_review)+showProbabilityWithBenchmark({...v,probability:usableResearchProbability(v.probability)||probabilityByHorse.get(key)||v.probability},marketMap.get(key))+'</summary>'+
  '<div class="qual-expanded"><p class="hint">'+e(r.name)+'</p>'+
   '<p class="qual-explanation">Model leader with substantial previous history and a ranking gap of '+
    e(nfmt(v.model_gap,3))+'. This is not an estimated win probability.</p>'+
   expl+priceResearchBox(r.value_review)+
   '<p class="hint">Does not pass the existing handicap-hurdle-only qualifying rule. No independently proven early-price advantage. '+
   'Additional history and race conditions remain uncertain.</p>'+
   '<p class="hint">All other runners can be checked under All races.</p></div></details>';
}

/* Read-only three-horse research treble. Uses only the private backend's
   already-frozen qualifiers: it never changes ranking or qualification logic.
   Do not imply independent value evidence or calibrated accumulator chances. */
function racingDailyTreble(data,day){
 const title=day==='tomorrow'?'Tomorrow’s research treble preview':'Today’s research treble';
 const scan=data?.combined_research||{},all=data?.all_races||{};
 const expected=ukDate(day==='tomorrow'?1:0);
 const fmtDay=new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'
 });
 const raceDay=raw=>{
  const parts=fmtDay.formatToParts(new Date(raw)),found={};
  for(const x of parts)found[x.type]=x.value;
  return found.year+'-'+found.month+'-'+found.day;
 };
 let legs=[];
 if(all.status==='READY'&&scan.status==='FROZEN_PREOFF'){
  const raceMap=new Map((all.races||[]).map(r=>[String(r.race_id),r]));
  const used=new Set();
  for(const horse of Array.isArray(scan.leaders)?scan.leaders:[]){
   // Frozen scan leaders are already backend-qualified; some do not carry a per-runner preoff flag.
   // Reject an explicitly invalid snapshot, not an absent optional field.
   if(horse?.preoff===false||!horse.horse||!horse.horse_id||!horse.race_id||!horse.off_utc)continue;
   const off=Date.parse(horse.off_utc);
   if(!Number.isFinite(off)||off<=Date.now()+60000||raceDay(horse.off_utc)!==expected)continue;
   const id=String(horse.race_id);
   if(used.has(id))continue;
   const race=raceMap.get(id);
   if(race&&Array.isArray(race.runners)){
    const runner=race.runners.find(h=>String(h.horse_id)===String(horse.horse_id));
    if(runner?.is_non_runner)continue;
   }
   used.add(id);legs.push(horse);
   if(legs.length===3)break;
  }
 }
 const header='<div class="treble-title"><strong>'+e(title)+'</strong>'+
  '<span class="watch-badge">WIN TREBLE · RESEARCH</span></div>';
 const opening='<section class="racing-treble" aria-label="'+e(title)+'">'+header;
 if(all.status!=='READY'||scan.status!=='FROZEN_PREOFF')
  return opening+'<p class="hint">Not available until today’s pre-race qualifier scan has been verified. No substitute selections.</p></section>';
 if(legs.length!==3)
  return opening+'<p class="hint">No three-horse treble available: '+e(legs.length)+
   ' upcoming qualifiers from different races. We do not fill gaps with lower-confidence watchlist horses.</p></section>';
 let combined=1,allPriced=true;
 const rows=legs.map((horse,i)=>{
  const quote=horse.quote,price=Number(quote?.decimal);
  const priced=Boolean(quote?.source&&Number.isFinite(price)&&price>1.01&&price<=1000);
  if(priced)combined*=price;else allPriced=false;
  return '<li><span class="treble-leg-number">'+(i+1)+'</span>'+
   '<span class="treble-leg-info"><strong>'+e(horse.horse)+'</strong>'+
   '<small>'+e(ukOff(horse.off_utc))+' · '+e(horse.course)+'</small></span>'+
   '<span class="treble-leg-odds">'+(priced?e(nfmt(price,2)):'—')+'</span></li>';
 }).join('');
 const total=allPriced&&Number.isFinite(combined)?
  'Indicative combined decimal odds: <strong>'+e(nfmt(combined,2))+'</strong>':
  'Combined odds unavailable until all three have sourced win prices.';
 return opening+'<ol class="treble-legs">'+rows+'</ol>'+
  '<p class="treble-total">'+total+'</p>'+
  '<p class="hint">Three existing pre-race research qualifiers, one per race, in scanner order. '+
  'Prices are indicative and may change. This is a live preview, not a locked daily ticket or proven-value bet. '+
  'All three must win; there is no validated treble win percentage.</p></section>';
}

function renderResearchShortlist(data,target){
 const full=data.all_races||{};
 const scan=data.combined_research||{};
 if(!hasVerifiedModel(data)){
  target.innerHTML='<div class="empty error"><strong>Current 61-factor model not verified.</strong>'+
    '<p>Old research qualifiers are hidden rather than presented as V9. Refresh after the backend update.</p>'+
    '<button class="button" data-retry="'+e(view==='tomorrow'?'tomorrow':'today')+'">Retry</button></div>';
  return;
 }
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
 const marketMap=buildMarketBenchmarks(data);
 const probabilityByHorse=new Map();
 for(const v of [...(Array.isArray(scan.leaders)?scan.leaders:[]),
                  ...(Array.isArray(scan.research_leaders)?scan.research_leaders:[])]){
  if(v?.race_id!=null&&v?.horse_id!=null&&usableResearchProbability(v.probability))
   probabilityByHorse.set(paperKey(v.race_id,v.horse_id),v.probability);
 }
 let head='<div class="quick-totals"><span><strong>0</strong> verified value picks</span>'+
  '<span><strong>'+e(qual.length)+
  '</strong> research qualifiers</span><span><strong>'+e(candidates.length)+
  '</strong> research watch</span><span><strong>'+e(allCount)+
  '</strong> races analysed</span></div>';
 const real=qual.length?
  '<section class="brief-section" data-browse-section><h3>PIF research qualifiers — all race types</h3>'+
  '<div class="qualifier-list" data-browse-list>'+qual.map(x=>combinedCard(x,true,marketMap)).join('')+'</div></section>':
  '<p class="status-brief">No horses met the all-race-type historical evidence gate today. The lower-evidence watchlist is below.</p>';
 const watch=candidates.length?
   '<section class="brief-section" data-browse-section><div class="section-head"><h3>Research watchlist</h3>'+
   '<span class="muted-text">Not qualifying bets</span></div>'+
   '<div class="qualifier-list" data-browse-list>'+candidates.map(x=>watchRaceCard(x,marketMap,probabilityByHorse)).join('')+'</div></section>':
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
 const valueNotice='<div class="empty"><strong>No independently verified value picks</strong>'+
   '<p>The 61-factor model still ranks horses, but research qualifiers do not prove good odds. The price review now separately compares available bookmaker terms with provisional model estimates. No daily accumulator is being forced from unverified selections.</p></div>';
 target.innerHTML=head+valueNotice+browseFilters(full.races||[])+
   '<p class="hint">The price verdict on each horse uses indicative odds and an unvalidated model estimate. A possible model advantage is NOT a verified profitable bet.</p>'+
    '<p id="shortlist-visible-count" class="browse-count"></p>'+
   real+watch+
   '<div id="browse-filter-empty" class="empty" hidden>No shortlisted horses match these course and time filters. Try another course or time.</div>'+
   details+'<p class="hint">To examine every runner and the model evidence, choose All races above.</p>';
 applyBrowseFilters();
}


/* Course/time controls operate on the already loaded verified racecards.
   Never make another API call when the user changes a filter. */
let browseCourse='all',browseTime='all',browseOrder='early';

function raceMinutes(r){
 const raw=String(r?.off_utc||'').trim();
 if(raw){
  const instant=new Date(raw);
  if(Number.isFinite(instant.getTime())){
   const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',
     hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);
   const hh=Number(parts.find(p=>p.type==='hour')?.value);
   const mm=Number(parts.find(p=>p.type==='minute')?.value);
   if(Number.isInteger(hh)&&Number.isInteger(mm))return hh*60+mm;
  }
 }
 const hit=String(r?.time||'').match(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
 return hit?Number(hit[1])*60+Number(hit[2]):-1;
}

function browseFilters(dayRaces){
 const courses=[...new Set((dayRaces||[]).map(r=>String(r.course||'').trim()).filter(Boolean))]
   .sort((a,b)=>a.localeCompare(b,'en-GB',{sensitivity:'base'}));
 if(browseCourse!=='all'&&!courses.includes(browseCourse))browseCourse='all';
 const opts=courses.map(course=>'<option value="'+e(course)+'"'+
    (course===browseCourse?' selected':'')+'>'+e(course)+'</option>').join('');
 const options=(values,current)=>values.map(([value,label])=>
  '<option value="'+e(value)+'"'+(value===current?' selected':'')+'>'+e(label)+'</option>').join('');
 return '<div class="browse-filters" aria-label="Racecourse and time filters">'+
   '<label class="browse-field browse-course">Course<select data-browse-course aria-label="Choose racecourse">'+
     '<option value="all">All courses</option>'+opts+'</select></label>'+
   '<label class="browse-field">Race time<select data-browse-time aria-label="Filter race time">'+
     options([['all','Any time'],['before12','Before 12:00'],['12to15','12:00–15:00'],
       ['15to18','15:00–18:00'],['after18','After 18:00']],browseTime)+'</select></label>'+
   '<label class="browse-field">Sort by<select data-browse-order aria-label="Sort races">'+
     options([['early','Earliest first'],['late','Latest first'],['course','Course A–Z']],browseOrder)+
   '</select></label></div>';
}

function applyBrowseFilters(){
 const main=$('day-content');
 const rows=[...main.querySelectorAll('[data-browse-row]')];
 for(const row of rows){
  const time=Number(row.dataset.minute);
  const allowedTime=browseTime==='all' ||
   (Number.isFinite(time)&&time>=0&&(
     (browseTime==='before12'&&time<720) ||
     (browseTime==='12to15'&&time>=720&&time<900) ||
     (browseTime==='15to18'&&time>=900&&time<1080) ||
     (browseTime==='after18'&&time>=1080)));
  row.hidden=!(allowedTime&&(browseCourse==='all'||row.dataset.course===browseCourse)&&
    (analysisMode!=='all'||raceFilter==='all'||row.dataset.qualified==='1'));
 }
 for(const list of main.querySelectorAll('[data-browse-list]')){
  const items=[...list.children].filter(el=>el.hasAttribute('data-browse-row'));
  items.sort((a,b)=>{
    const am=Number(a.dataset.minute),bm=Number(b.dataset.minute);
    const av=am>=0?am:2000,bv=bm>=0?bm:2000;
    if(browseOrder==='course')return a.dataset.course.localeCompare(
      b.dataset.course,'en-GB',{sensitivity:'base'})||av-bv;
    return browseOrder==='late'?(bv-av):(av-bv);
  });
  for(const item of items)list.appendChild(item);
 }
 const shown=rows.filter(row=>!row.hidden).length;
 const count=$('race-visible-count');
 if(count)count.textContent='Showing '+shown+' of '+rows.length+' races';
 const shortCount=$('shortlist-visible-count');
 if(shortCount)shortCount.textContent='Showing '+shown+' of '+rows.length+' horses';
 const empty=$('browse-filter-empty');
 if(empty)empty.hidden=shown!==0;
 for(const section of main.querySelectorAll('[data-browse-section]')){
  section.hidden=![...section.querySelectorAll('[data-browse-row]')].some(el=>!el.hidden);
 }
}

// Detailed audit view: compact overview first, original evidence on demand.
let raceFilter='all';
function setRaceFilter(mode){
 raceFilter=mode==='qualifiers'?'qualifiers':'all';
 document.querySelectorAll('#day-content [data-race-filter]').forEach(btn=>{
  const active=btn.getAttribute('data-race-filter')===raceFilter;
  btn.classList.toggle('selected',active);
  btn.setAttribute('aria-pressed',String(active));
 });
 applyBrowseFilters();
}
function renderAllRaces(data,target){
 const full=data.all_races||{};
 if(!hasVerifiedModel(data)){
  target.innerHTML='<div class="empty error"><strong>Current model version not verified.</strong>'+
     '<p>Old V7 all-race scores and qualifiers are hidden to avoid mixing them with V9. Retry when the updated backend responds.</p>'+
     '<button class="button" data-retry="'+e(view==='tomorrow'?'tomorrow':'today')+'">Retry</button></div>';
  return;
 }
 const racecards=Array.isArray(full.races)?full.races:(data.races||[]);
 const sourceOK=full.status==='READY';
 const qualified=Number(full.qualified_races??racecards.filter(r=>r.qualified).length);
 const saved=Number(full.model_scored??racecards.filter(r=>r.leader?.preoff).length);
 const complete=Number(full.full_runner_scored??0);
 const summary='<div class="race-dashboard" aria-label="Race research totals">'+
  '<div><strong>'+e(qualified)+'</strong><span>Research qualifiers (not value)</span></div>'+
  '<div><strong>'+e(racecards.length)+'</strong><span>Total races</span></div>'+
  '<div><strong>'+e(saved)+'</strong><span>Leaders saved</span></div>'+
  '<div><strong>'+e(complete)+'</strong><span>Full rankings</span></div></div>'+
  '<p class="audit-overview-note"><strong>Price verdicts are now on every race card.</strong> POSSIBLE MODEL VALUE is a provisional price comparison, not proven value. POOR MODEL VALUE means the quoted odds are shorter than the model’s estimated fair odds. A missing or incompatible price is labelled unavailable.</p>'+
   '<p class="audit-overview-note">The 61-factor model ranks each field; the separately tested Win and Top 2/3/4 estimates describe the <strong>first-ranked horse</strong>. Neither proves profitable betting value. Choose a race to inspect its runners.</p>';
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
  target.innerHTML=summary+sourceNote+'<div class="empty">No racecards available for this day.</div>'+method;return;
 }
 const filters='<div class="race-filter-bar"><div class="race-filter-controls" role="group" aria-label="Filter race research">'+
  '<button class="race-filter-btn" type="button" data-race-filter="all">All races</button>'+
  '<button class="race-filter-btn" type="button" data-race-filter="qualifiers">Qualifiers only ('+e(qualified)+')</button>'+
  '</div><span id="race-visible-count" class="race-visible-count"></span></div>';
 const probabilityByHorse=new Map();
 const combined=data.combined_research||{};
 for(const v of [...(Array.isArray(combined.leaders)?combined.leaders:[]),
                  ...(Array.isArray(combined.research_leaders)?combined.research_leaders:[])]){
  if(v&&v.race_id!=null&&v.horse_id!=null&&usableResearchProbability(v.probability))
   probabilityByHorse.set(paperKey(v.race_id,v.horse_id),v.probability);
 }
 const quoteByHorse=new Map();
 for(const v of [...(Array.isArray(combined.leaders)?combined.leaders:[]),
                  ...(Array.isArray(combined.research_leaders)?combined.research_leaders:[])]){
  if(v&&v.race_id!=null&&v.horse_id!=null&&v.quote?.decimal&&v.quote?.source)
   quoteByHorse.set(paperKey(v.race_id,v.horse_id),v.quote);
 }
 const marketMap=buildMarketBenchmarks(data);
 const groups=racecards.map(r=>fullRace(r,probabilityByHorse,quoteByHorse,marketMap)).join('');
 target.innerHTML=summary+sourceNote+filters+browseFilters(racecards)+
  '<div class="all-races-list" data-browse-list>'+groups+'</div>'+
  '<div id="browse-filter-empty" class="empty" hidden>No races match these course, time and qualification filters. Change a filter above to see more.</div>'+
  method+'<p class="hint">If a pre-race score is missing, that means no verified snapshot was available; it does not mean the horse is weak.</p>';
 setRaceFilter(raceFilter);
}
function indicativeRunnerOdds(q,h){
 const quoted=Number(q?.decimal);
 if(q?.source&&Number.isFinite(quoted)&&quoted>1)
  return e(q.source)+' · '+e(nfmt(quoted,2))+' (indicative)';
 for(const [source,raw] of [['Bet365',h?.market_bet365],['Betfair',h?.market_betfair]]){
  const price=Number(raw);
  if(raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(price)&&price>1)
   return source+' · '+e(nfmt(price,2))+' (indicative)';
 }
 return '';
}
function fullRace(r,probabilityByHorse,quoteByHorse,marketMap){
 const leader=r.leader||null;
 const hasLeader=Boolean(leader&&leader.preoff);
 const fromRace=usableResearchProbability(leader?.probability);
 const fromScan=hasLeader&&r.race_id!=null&&leader.horse_id!=null?
  usableResearchProbability(probabilityByHorse.get(paperKey(r.race_id,leader.horse_id))):null;
 const leaderProbability=hasLeader?(fromRace||fromScan):null;
 const displayProbability=leaderProbability||
  (String(leader?.version||'').includes('-speedfirst50-')?{status:'SPEEDFIRST_UNCALIBRATED'}:null);
 const market=hasLeader?marketMap.get(paperKey(r.race_id,leader.horse_id)):null;
 const chances=hasLeader&&(displayProbability||r.qualified||market)?
  '<span class="race-audit-chances">'+
    showProbabilityWithBenchmark({probability:displayProbability},market)+'</span>':'';
 const title=r.name||'Unnamed race';
 const reason=r.qualified?'<span class="qual-badge">RESEARCH QUALIFIER</span>':'';
 const summary='<span class="race-audit-title"><span class="race-audit-identity">'+
  '<strong class="race-off">'+e(r.time)+'</strong><strong class="race-course">'+e(r.course)+'</strong></span>'+
  '<span class="race-title">'+e(title)+'</span><small class="race-conditions">'+
  e(r.type)+' · '+e(r.distance)+' · '+e(r.going)+' · '+e(r.runner_count)+' runners</small></span>';
 const leaderRunner=hasLeader?(Array.isArray(r.runners)?r.runners:[]).find(h=>
  (h.horse_id!=null&&leader.horse_id!=null&&String(h.horse_id)===String(leader.horse_id))||
  (h.name&&leader.horse&&h.name.trim().toLowerCase()===leader.horse.trim().toLowerCase())):null;
 const leaderQuote=hasLeader&&r.race_id!=null&&leader.horse_id!=null?
  quoteByHorse.get(paperKey(r.race_id,leader.horse_id)):null;
 const leaderOdds=hasLeader?indicativeRunnerOdds(leaderQuote||leader.quote,leaderRunner):'';
 const leadline=hasLeader?'<strong class="race-leader-horse">'+e(leader.horse)+'</strong>'+
  '<small>Model #1 · gap '+e(nfmt(leader.model_gap,3))+'</small>'+ 
  (leaderOdds?'<span class="qual-price">'+leaderOdds+'</span>':''):
  '<span class="muted-text">No pre-race model leader</span>';
 const quick=hasLeader?'<div class="audit-quickfacts">'+[
   ['Prior runs',leader.evidence?.prior_races??'—'],
   ['Going runs / places',String(leader.evidence?.going_runs??'—')+' / '+String(leader.evidence?.going_places??'—')],
   ['Trainer last 30d',String(leader.evidence?.trainer30_wins??'—')+' / '+String(leader.evidence?.trainer30_runs??'—')+' wins / runs'],
   ['Ranking gap',nfmt(leader.model_gap,3)]
  ].map(([k,value])=>'<div><small>'+e(k)+'</small><strong>'+e(value)+'</strong></div>').join('')+
  '</div>':
  '<p class="audit-no-score">No saved pre-race model prediction. Racecard and runner details can still be inspected below.</p>';
 const runners=Array.isArray(r.runners)?r.runners.slice():[];
 runners.sort((a,b)=>{
  const rank=h=>h.is_non_runner?Number.POSITIVE_INFINITY:
    h.scored&&Number.isFinite(Number(h.scored.rank))?Number(h.scored.rank):Number.POSITIVE_INFINITY;
  return rank(a)-rank(b);
 });
 const runnerTable=runners.map(h=>{
  const scored=h.scored;
  const runnerProbability=usableResearchProbability(h.probability||scored?.probability)||
   (r.race_id!=null&&h.horse_id!=null?
    usableResearchProbability(probabilityByHorse.get(paperKey(r.race_id,h.horse_id))):null);
  const cell=scored?'<strong>Rank '+e(scored.rank)+'</strong><small>Model share '+e(nfmt(scored.share,3))+'</small>'+
   (runnerProbability?'<small class="runner-chance">'+(runnerProbability.status==='PROVISIONAL_TRANSFER'?'Provisional':'Experimental')+' · Win '+e((100*runnerProbability.win).toFixed(1))+'% · Top 3 '+e((100*runnerProbability.top3).toFixed(1))+'%</small>':''):
   '<span class="muted-text">No saved rank</span>';
  const p=h.private_history||{};
  const hist=p.last12mo_recorded_runs===undefined?'Recorded history unavailable':
   e(p.last12mo_recorded_runs)+' recorded starts · '+
   e(p.similar_distance_runs??'—')+' similar-distance · '+
   e(p.same_going_runs??'—')+' same going';
  const trainer=h.trainer14_runs?' · trainer last 14d '+e(h.trainer14_wins)+'/'+e(h.trainer14_runs):'';
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
   evidenceFact('Jockey at course · recorded history',jockeyCourseEvidence(scored.evidence))+
   '</div>':'';
  return '<details class="runner-review'+(h.is_frozen_leader?' is-leader':'')+'"><summary>'+
   '<span class="runner-line"><strong>'+e(h.name)+'</strong>'+
   (h.is_frozen_leader?' <span class="qual-badge">MODEL #1</span>':'')+
   (h.is_non_runner?' <span class="watch-badge">NR</span>':'')+
   '<small>'+e(h.jockey||'Jockey unknown')+' · '+e(h.trainer||'Trainer unknown')+
   '</small>'+(indicativeRunnerOdds(h.quote,h)?'<span class="qual-price">'+indicativeRunnerOdds(h.quote,h)+'</span>':'')+'</span><span class="runner-rank">'+cell+'</span></summary>'+
   '<div class="runner-facts">Age '+e(h.age??'—')+' · OR '+e(h.or??'—')+
   ' · weight '+e(h.weight??'—')+' lb · '+hist+' · form '+e(h.form||'—')+
   trainer+(h.market_bet365?' · Bet365 indicative '+e(h.market_bet365):'')+
   (scored?' · Model share '+e(nfmt(scored.share,3))+' is not a win probability':'')+'</div>'+
   (detail||'<p class="hint">The pre-race runner ranking is not saved. Available racecard and previous-result evidence is shown above.</p>')+
   '</details>';
 }).join('');
 const evidence=hasLeader?modelEvidence(leader):'';
 return '<details class="race-audit'+(r.qualified?' is-qualified':'')+'" data-browse-row data-course="'+e(String(r.course||'').trim())+
   '" data-minute="'+raceMinutes(r)+'" data-qualified="'+(r.qualified?'1':'0')+'">'+
  '<summary>'+summary+'<span class="race-audit-leader">'+reason+leadline+'</span>'+modelPriceHeadline(r.value_review)+chances+'</summary>'+
  '<div class="race-audit-inner">'+priceResearchBox(r.value_review)+quick+
  '<div class="runner-section-head"><h4>Runners <small>'+e(runners.length)+' in this race · model ranking first</small></h4>'+
  '<p>Open any runner for form, history and ratings.</p></div>'+
  (runnerTable||'<p class="hint">Runner details are not available.</p>')+evidence+
  '</div></details>';
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
  ['Opposition',String(v.field_size??'—')+' runners · next '+String(x.opponent_horse||'unknown')],
  ['Model ranking gap',nfmt(v.model_gap,3)]
 ].map(([k,value])=>evidenceFact(k,value??'—')).join('');
 return '<details class="race-evidence"><summary><strong>Full frozen model evidence</strong>'+
  '<small>Historical conditions, 61-factor inputs and qualification checks</small></summary>'+
  '<div class="race-evidence-body"><p class="hint">Frozen '+e(v.frozen_at?ukOff(v.frozen_at):'time unavailable')+
  '. Ranking lead and model share are relative scores, not fair odds.</p>'+
  '<div class="formula-grid">'+cells+'</div>'+
  (checks?'<p class="hint">Qualification checks</p><div class="gate-checks">'+checks+'</div>':
   '<p class="hint">No saved qualification decision found for this race.</p>')+
  (v.gate_explanation?'<p class="hint">'+e(v.gate_explanation)+'</p>':'')+
  '<p class="hint">These inputs are not individually proven causal explanations.</p></div></details>';
}

function showRaceDay(day){
 const target=$('day-content');
 if(!sessionToken){target.innerHTML='';return;}
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
// Read-only market benchmark for studying the unchanged Speed-First V5 ranking.
// Uses same-bookmaker win prices for every non-runner-excluded horse in the field.
// These are not PIF predictions, bookmaker place offers or betting-value signals.
function marketTopFour(prices,idx){
 const n=prices.length;
 if(n<4||n>40||idx<0||idx>=n)return null;
 const weights=prices.map(v=>1/v),total=weights.reduce((a,b)=>a+b,0);
 if(!Number.isFinite(total)||total<=0)return null;
 let levels=[0,0,0,0],seen=new Set([idx]);
 function recurse(depth,remaining,branch){
  levels[depth]+=branch*weights[idx]/remaining;
  if(depth>=3)return;
  for(let i=0;i<n;i++)if(!seen.has(i)){
   seen.add(i);
   recurse(depth+1,remaining-weights[i],branch*weights[i]/remaining);
   seen.delete(i);
  }
 }
 recurse(0,total,1);
 let cumulative=0;
 levels=levels.map((p,i)=>{cumulative+=p;return Math.max(0,Math.min(1,cumulative));});
 if(levels.some((v,i)=>!Number.isFinite(v)||(i>0&&v+1e-8<levels[i-1])))return null;
 return {win:levels[0],top2:levels[1],top3:levels[2],top4:levels[3]};
}
function buildMarketBenchmarks(data){
 const found=new Map();
 const updated=Date.parse(data?.fetched_at||'');
 if(!Number.isFinite(updated)||Date.now()-updated>30*60000||updated>Date.now()+60000)return found;
 const races=Array.isArray(data?.all_races?.races)?data.all_races.races:[];
 for(const race of races){
  const leader=race.leader;
  if(!leader?.preoff||!leader.horse_id||!race.race_id||
     !(Date.parse(leader.off_utc)>Date.now()))continue;
  const active=(race.runners||[]).filter(h=>!h.is_non_runner);
  const ids=active.map(h=>String(h.horse_id||''));
  if(active.length<4||active.length>40||ids.some(id=>!id)||
     new Set(ids).size!==ids.length)continue;
  const prices=active.map(h=>h.market_bet365===null||
     h.market_bet365===undefined||h.market_bet365===''?NaN:Number(h.market_bet365));
  if(prices.some(v=>!Number.isFinite(v)||v<=1.01||v>1000))continue;
  const index=ids.indexOf(String(leader.horse_id));
  const p=marketTopFour(prices,index);
  if(p)found.set(paperKey(race.race_id,leader.horse_id),{...p,odds:prices[index]});
 }
 return found;
}
function marketStrip(value){
 if(!value)return '';
 const cols=[['WIN',value.win],['TOP 2',value.top2],
             ['TOP 3',value.top3],['TOP 4',value.top4]];
 return '<span class="top-probabilities market-reference">'+
  cols.map(([label,p])=>'<span class="top-probability"><strong>'+
   e((100*p).toFixed(1))+'%</strong><span>'+e(label)+'</span></span>').join('')+
  '<span class="top-prob-note">MARKET-BASED ESTIMATES · Bet365 indicative odds '+
   e(nfmt(value.odds,2))+'. Normalised win odds; mathematical place estimates. '+
   'NOT PIF model predictions or bookmaker place quotes.</span></span>';
}
function showProbabilityWithBenchmark(v,market){
 if(!market)return probabilityStrip(v);
 const modelEstimate=usableResearchProbability(v.probability);
 return (modelEstimate?probabilityStrip(v):
  '<span class="pif-prob-status">PIF Win/Place % unavailable for this model</span>')+
  marketStrip(market);
}

function usableResearchProbability(p){
 if(!p||!['EXPERIMENTAL','PROVISIONAL_TRANSFER'].includes(p.status))return null;
 const values=[p.win,p.top2,p.top3,p.top4];
 if(values.some(x=>x===null||x===undefined||x===''||
   !Number.isFinite(Number(x))||Number(x)<0||Number(x)>1))return null;
 if(values.some((x,i)=>i>0&&Number(x)<Number(values[i-1])))return null;
 return p;
}
function probabilityStrip(v){
 const p=usableResearchProbability(v.probability);
 if(!p){
  const reason=v.probability?.status==='SPEEDFIRST_UNCALIBRATED'?
   'Win / place % pending: the current Speed-First rankings do not have a tested probability calibration. Model share is not a win chance.':
   v.probability?.status==='UNKNOWN_MODEL_VERSION'?
   'Win / place % unavailable: this model version has no matching probability calibration.':
   'PIF win and place estimates unavailable for this race.';
  return '<span class="top-probabilities unavailable"><span class="prob-unavailable">'+e(reason)+'</span></span>';
 }
 const entries=[['WIN',p.win],['TOP 2',p.top2],['TOP 3',p.top3],['TOP 4',p.top4]];
 return '<span class="top-probabilities">'+
  entries.map(([label,val])=>'<span class="top-probability"><strong>'+
    e((100*val).toFixed(1))+'%</strong><span>'+e(label)+'</span></span>').join('')+
  '<span class="top-prob-note">'+(p.status==='PROVISIONAL_TRANSFER'?'PIF ESTIMATED % · Restored 61-factor model. Earlier calibration checked on 2,731 leader results; 70 recent SFF-backed leader results also checked. Estimates, not guarantees.':(p.specialist_hurdle?'Handicap-hurdle-specific model · experimental percentages':'PIF research estimates · still being tested'))+'</span></span>';
}

/* Every race headline needs a visible price verdict. This comparison is
   provisional research, NOT an independently verified betting edge. */
function modelPriceHeadline(review){
 const q=review?.quote||null;
 const price=Number(q?.decimal), fair=Number(review?.provisional_fair_odds),
       edge=Number(review?.provisional_win_roi_pct);
 const present=review?.provisional_fair_odds!=null&&
  review?.provisional_win_roi_pct!=null&&
  q&&Number.isFinite(price)&&price>1.1&&
  Number.isFinite(fair)&&fair>1&&Number.isFinite(edge);
 let label='PRICE CHECK UNAVAILABLE',state='unavailable';
 if(present){
  if(edge>0.5){label='POSSIBLE MODEL VALUE';state='positive';}
  else if(edge< -0.5){label='POOR MODEL VALUE';state='negative';}
  else{label='NEAR MODEL FAIR PRICE';state='neutral';}
 }
 const source=q?.bookmaker||'Bookmaker';
 const details=present?
  e(source)+' '+e(nfmt(price,2))+' · PIF fair '+e(nfmt(fair,2))+
   ' · estimated '+(edge>0?'+':'')+e(nfmt(edge,1))+'% return':
  'No comparable odds and provisional calibrated estimate';
 return '<span class="price-check-summary price-check-'+state+'">'+
  '<strong>'+e(label)+'</strong>'+
  '<span>'+details+'</span>'+
  '<small>PROVISIONAL model calculation · not verified profit/value</small>'+
  '</span>';
}
function priceResearchBox(review){
 if(!review)return '<div class="bet-model-not-ready"><strong>Value not verified</strong><p>No independently validated fair-odds comparison is available.</p></div>';
 const q=review.quote||null, price=Number(q?.decimal);
 const hasPrice=q&&Number.isFinite(price)&&price>1.1;
 const rank=review.market_rank===1?'Market favourite':
  Number.isInteger(review.market_rank)?'Market rank '+review.market_rank:
  'Market rank unconfirmed (incomplete prices)';
 const fair=review.provisional_fair_odds==null?'Unavailable':nfmt(review.provisional_fair_odds,2);
 const terms=q?.ew_places&&q?.ew_fraction?
  'Recorded bookmaker terms: '+q.ew_places+' paid places at 1/'+Math.round(1/q.ew_fraction)+' odds.':
  'No supported bookmaker each-way terms recorded.';
 const ew=review.provisional_eachway_roi_pct==null?
  'Each-way theoretical comparison unavailable.':
  'Theoretical each-way model return: '+nfmt(review.provisional_eachway_roi_pct,1)+'% (unvalidated).';
 return '<div class="bet-model-not-ready"><strong>Betting value: NOT VERIFIED</strong>'+
  '<p><strong>'+e(rank)+'</strong> · '+(hasPrice?e(q.bookmaker)+' indicative '+e(nfmt(price,2)):'No usable quoted odds')+'</p>'+
  '<p>Provisional model fair win price: <strong>'+e(fair)+'</strong>. '+
  'Theoretical win model return: '+(review.provisional_win_roi_pct==null?'unavailable':e(nfmt(review.provisional_win_roi_pct,1))+'%')+'.</p>'+
  '<p>'+e(terms)+' '+e(ew)+'</p>'+
  '<p class="bet-safety">Research scenarios only: the restored probability model is not independently validated for profitability. Indicative prices may be stale or unavailable. Neither a win bet nor an each-way bet is recommended.</p></div>';
}

function winEachWayPanel(v){
 return priceResearchBox(v.value_review);
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

function combinedCard(v,qualified,marketMap){
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
 return '<details class="qual-row" data-browse-row data-course="'+e(String(v.course||'').trim())+
   '" data-minute="'+raceMinutes(v)+'" data-qualified="'+(qualified?'1':'0')+'">'+
   '<summary class="qual-summary"><span class="qual-main"><span class="race-label">'+
    e(ukOff(v.off_utc))+' · '+e(v.course)+'</span>'+
    '<span class="qual-horse">'+e(v.horse)+'</span>'+
    '<span class="qual-meta">'+e(v.distance)+' · '+e(v.going)+' · '+e(v.field_size)+' runners</span></span>'+
   '<span class="qual-right">'+badge+'<span class="qual-price">'+odds+'</span></span>'+
    modelPriceHeadline(v.value_review)+showProbabilityWithBenchmark(v,marketMap.get(key))+'</summary>'+
   '<div class="qual-expanded"><p class="muted-text">'+e(v.race_name)+'</p>'+
    '<p class="qual-explanation">'+e(gate)+'.</p>'+
    '<div class="evidence"><strong>History, course, trainer, jockey and race conditions</strong>'+
    detail.map(x=>'<div class="past-run">'+x+'</div>').join('')+'</div>'+
    winEachWayPanel(v)+
    '<p class="hint">Research only: calculated fair odds are provisional scenarios, not validated betting prices. Historical coverage remains incomplete.</p>'+
    (qualified?'<button class="button" data-track="'+encodeURIComponent(key)+'">'+
      (saved?'Saved in my paper list':'Add to paper trial')+'</button>':'')+
    '</div></details>';
}
async function fetchResults(){
 if(!sessionToken)return;
 $('results-content').innerHTML='<div class="empty">Loading recorded trial selections and outcomes…</div>';
 try{
  const data=await privateCall('/combined-results',{});
  results={summary:data,items:data.rows||[],at:Date.now()};
  status('Live trial results verified.','good');
  showResults();
 }catch(err){
  if(err.code==='session_expired'){lostSession();return;}
  $('results-content').innerHTML='<div class="empty error"><strong>Results unavailable.</strong>'+
   '<p>'+e(err.message)+'</p><button class="button" data-refresh-results="1">Retry results</button></div>';
  status('Trial results service could not be reached.','bad');
 }
}
let placeScenario='estimated';
function pifPnl(x){
 if(x.status!=='SETTLED')return null;
 const odds=Number(x.first_quote);
 if(x.first_quote==null||!Number.isFinite(odds)||odds<=1)return null;
 const win=x.won===true?(odds-1)*0.98:-1;
 const field=Number(x.field_size),pos=x.won===true?1:Number(x.finish_position);
 let places=field>=16?4:field>=8?3:field>=5?2:0;
 let fraction=field>=16?.25:field>=8?.20:field>=5?.25:0;
 if(placeScenario!=='estimated'){
  const pair=placeScenario.split(':');places=Number(pair[0]);fraction=Number(pair[1]);
 }
 const ew=places&&Number.isInteger(pos)&&pos>=1?
   win+(pos<=places?(odds-1)*fraction*.98:-1):null;
 return {win,ew};
}
function pifMoney(v){
 return v==null?'—':(v<0?'−':'+')+'£'+Math.abs(v).toFixed(2);
}
function pifPnlSummary(rows){
 let nw=0,ne=0,w=0,ew=0,unpriced=0;
 for(const x of rows){
  if(x.status!=='SETTLED')continue;
  const p=pifPnl(x);
  if(!p){unpriced++;continue;}
  nw++;w+=p.win;
  if(p.ew!=null){ne++;ew+=p.ew;}
 }
 const choices=[['estimated','Estimated from field size'],['2:0.25','¼ odds, 2 places'],
  ['3:0.20','⅕ odds, 3 places'],['3:0.25','¼ odds, 3 places'],['4:0.25','¼ odds, 4 places']];
 return '<div class="metrics summary-metrics">'+
 '<span>£1 Win: '+e(nw)+' settled · £'+e(nw)+' staked · <strong>'+e(nw?pifMoney(w):'—')+' net</strong></span>'+
 '<span>£1 Each-way (£2 total): '+e(ne)+' settled · £'+e(ne*2)+' staked · <strong>'+e(ne?pifMoney(ew):'—')+' net</strong></span></div>'+
 '<div class="sim-settings"><label for="place-terms">Illustrative each-way terms: </label>'+
 '<select id="place-terms" data-place-terms>'+choices.map(([v,label])=>
 '<option value="'+v+'"'+(v===placeScenario?' selected':'')+'>'+e(label)+'</option>').join('')+
 '</select></div><p class="hint">Paper returns only: 2% deducted from positive winnings on each leg; no actual wagers. '+
 'Estimated terms: 5–7 runners ¼ odds/2 places; 8–15 runners ⅕/3 places; 16+ runners ¼/4 places. '+
 'The feed does not confirm the bookmaker’s each-way terms. Missing odds ('+e(unpriced)+
 ') and unsettled races are excluded. Totals cover the displayed rows only.</p>';
}
function pifPnlLine(x){
 const p=pifPnl(x);
 if(!p)return '';
 return '<small>£1 Win '+e(pifMoney(p.win))+' · £1 EW '+e(pifMoney(p.ew))+'</small>';
}
function racingOutcomeLabel(x,includePlace){
 const st=String(x?.status||'');
 if(st==='NON_RUNNER')return 'Non-runner · void';
 if(st==='ABANDONED')return 'Abandoned · void';
 if(st==='SETTLED')return x.won?'Won':(includePlace&&x.top3?'Top 3 ('+x.finish_position+')':'Lost');
 const off=Date.parse(x?.off_utc||'');
 return st==='UPCOMING'||(Number.isFinite(off)&&off>Date.now())?'Upcoming':'Awaiting official result';
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
  const settled=Number(gate.settled)||0;
  const winners=Number(gate.wins)||0;
  const versionMatch=String(gate.version||'').match(/-v([0-9]+)-/);
  const versionLabel=versionMatch?'V'+versionMatch[1]:'current';
  const strikeLabel=settled>0?nfmt(100*winners/settled,1)+'%':'—';
  html+='<div class="metrics summary-metrics"><span>'+e(gate.qualified||0)+' unique pre-race qualifiers</span>'+
   '<span>'+e(settled)+' settled</span>'+
   '<span>'+e(winners)+' winners</span>'+
   '<span><strong>'+e(strikeLabel)+'</strong> '+e(versionLabel)+' win strike rate · provisional</span></div>'+
   '<p class="hint"><strong>Qualifier model '+e(versionLabel)+'</strong> · Testing began '+
   e(gate.started_at?ukOff(gate.started_at):'date unavailable')+'. '+
   'Current qualifying version only; each horse/race counts once despite later model refreshes. '+
   'The percentage is an early observation, not a validated betting edge. Assess accuracy against the market with a much larger settled sample. '+
   'Non-runners and abandoned races are excluded from losses and strike rates. Earlier unfiltered research records ('+e(overall.saved||0)+') are excluded.</p>'+pifPnlSummary(actual);
  if(actual.length){
   html+='<div class="result-table"><div class="result-row result-head"><span>Qualified horse</span><span>Early quote</span><span>Result</span></div>'+
   actual.slice(0,70).map(x=>'<div class="result-row"><span><strong>'+e(x.horse)+'</strong>'+
    '<small>'+e(x.course)+' · '+e(ukOff(x.off_utc))+'</small>'+pifPnlLine(x)+'</span>'+
    '<span>'+e(x.first_quote?nfmt(x.first_quote,2):'Unavailable')+'</span>'+
    '<span>'+e(racingOutcomeLabel(x,false))+'</span></div>').join('')+'</div>';
  }else html+='<div class="empty">The filter has not yet recorded any prospective qualifying horses. It will not backdate predictions.</div>';
 }
 html+='</section>';
 const rankOne=overall?.rank_one_trial||null;
 html+='<section><h2>All races — Model #1 record</h2>';
 if(rankOne){
  const n=Number(rankOne.settled)||0, wins=Number(rankOne.wins)||0, top3=Number(rankOne.top3)||0;
  const winPct=n?100*wins/n:0, placePct=n?100*top3/n:0;
  html+='<p class="hint"><strong>'+e(rankOne.model_family||rankOne.model_version||'Current model')+
   '</strong> · Started '+e(rankOne.started_at?ukOff(rankOne.started_at):'date unavailable')+
   '. First frozen pre-race #1 horse in every scored race, regardless of qualification.</p>'+
   '<div class="metrics summary-metrics">'+
   '<span>'+e(rankOne.races||0)+' unique races</span>'+
   '<span>'+e(n)+' settled</span>'+
   '<span>'+e(wins)+' wins · <strong>'+e(n?winPct.toFixed(1)+'%':'—')+'</strong></span>'+
   '<span>'+e(top3)+' top 3 · <strong>'+e(n?placePct.toFixed(1)+'%':'—')+'</strong></span>'+
   '<span>'+e(rankOne.non_runners||0)+' non-runners</span>'+
    '<span>'+e(rankOne.abandoned||0)+' abandoned</span>'+
    '<span>'+e(rankOne.upcoming||0)+' upcoming</span>'+
    '<span>'+e(rankOne.awaiting_results||0)+' awaiting results</span></div>'+
   '<p class="hint">Top 3 includes winners. Non-runners are excluded from strike rates. '+
   'Refreshes cannot duplicate races. Research rankings are not betting qualifiers.</p>'+pifPnlSummary(rankOne.results||[]);
  if(rankOne.by_race_type?.length){
   html+='<details class="methodology"><summary>Performance by race type</summary>'+
     rankOne.by_race_type.map(x=>'<p class="hint"><strong>'+e(x.race_type)+'</strong>: '+
      e(x.races)+' races · '+e(x.settled)+' settled · '+e(x.wins)+' won · '+
      e(x.top3)+' top 3</p>').join('')+'</details>';
  }
  const topRows=Array.isArray(rankOne.results)?rankOne.results:[];
  if(topRows.length){
   html+='<details class="methodology"><summary>View recent number-one horses ('+
    e(topRows.length)+')</summary><div class="result-table"><div class="result-row result-head">'+
    '<span>Model #1 horse</span><span>Early quote</span><span>Result</span></div>'+
    topRows.map(x=>'<div class="result-row"><span><strong>'+e(x.horse)+'</strong>'+
     '<small>'+e(x.course)+' · '+e(ukOff(x.off_utc))+'</small>'+
     '<small>'+e(x.race_type)+' · '+(x.qualified_at_first_snapshot?'Qualified':'Ranking only')+
     '</small>'+pifPnlLine(x)+'</span><span>'+e(x.first_quote?nfmt(x.first_quote,2):'Unavailable')+'</span>'+
     '<span>'+e(racingOutcomeLabel(x,true))+'</span></div>').join('')+
    '</div></details>';
  }else html+='<p class="hint">No pre-race rankings recorded for the current model yet.</p>';
 }else html+='<p class="hint">Awaiting the separate all-races research report from the racing service.</p>';
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
document.addEventListener('change',ev=>{
 const target=ev.target;
 if(target.matches('[data-place-terms]')){placeScenario=target.value;showResults();return;}
 if(target.matches('[data-browse-course]'))browseCourse=target.value;
 else if(target.matches('[data-browse-time]'))browseTime=target.value;
 else if(target.matches('[data-browse-order]'))browseOrder=target.value;
 else return;
 applyBrowseFilters();
});
document.addEventListener('click',ev=>{
 const b=ev.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-view')){setView(b.getAttribute('data-view'));return;}
 if(b.hasAttribute('data-analysis-mode')){showMode(b.getAttribute('data-analysis-mode'));return;}
 if(b.hasAttribute('data-race-filter')){setRaceFilter(b.getAttribute('data-race-filter'));return;}
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
