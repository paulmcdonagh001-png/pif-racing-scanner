'use strict';
// Live cards add-on. No Racing API credentials ever reach this browser.
const FEED_URL='https://pif-racing-paper.onrender.com/racecards';
let liveBusy=false,liveMessage='',meetingFilter='auto';
let speedTrialData=null;
const oldRenderRaces=renderRaces;
function todayUK(){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o={};for(const x of parts)o[x.type]=x.value;return o.year+'-'+o.month+'-'+o.day}
function ukClock(){return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())}
function pickUpcoming(rows){const today=todayUK(),clock=ukClock();const sorted=[...rows].sort((a,b)=>String(a.date+' '+a.time).localeCompare(String(b.date+' '+b.time)));return sorted.find(r=>r.date>today||r.date===today&&String(r.time)>=clock)||sorted[sorted.length-1]||null}
// V0.5: explicit FACTUAL screening only. This is an unvalidated research
// watchlist, not the retired historical win-probability model or a bet tip.
// Keep the criteria visible in the UI and exclude all non-runners.
let watchExpanded=false;
let watchOthersExpanded=false;
function researchEvidence(h){
 if(!h||h.is_non_runner)return {watch:false,signals:[],count:0};
 const form=h.recent_form||{},shown=Number(form.shown)||0,wins=Number(form.wins)||0,places=Number(form.places)||0;
 const signals=[];
 const formPass=shown>=4&&((wins>=1&&places>=2)||places>=3);
 if(formPass)signals.push('Form: '+wins+' wins and '+places+' top-three finishes from '+shown+' recent results');
 const tw=Number(h.trainer14_wins),tr=Number(h.trainer14_runs);
 if(Number.isFinite(tw)&&Number.isFinite(tr)&&tr>=10&&tw>=2&&tw/tr>=0.18)
    signals.push('Trainer last 14 days: '+tw+' wins from '+tr);
 const days=Number(h.days);
 if(h.days!==''&&Number.isFinite(days)&&days>=7&&days<=60)
    signals.push('Last raced '+days+' days ago');
 const flags=Array.isArray(h.past_results_flags)?h.past_results_flags.map(x=>String(x).toUpperCase()):[];
 if(flags.some(x=>x==='C'||x==='D'||x==='CD'||x==='DC'))
    signals.push(flags.includes('CD')||flags.includes('DC')?'Previous course-and-distance win flag':
      flags.includes('C')?'Previous course-win flag':'Previous distance-win flag');
 return {watch:formPass&&signals.length>=3,signals,count:signals.length};
}
function ratedNumber(value){
 const s=String(value===undefined||value===null?'':value).trim();
 if(!/^[0-9]+(?:\.[0-9]+)?$/.test(s))return null;
 const n=Number(s);return Number.isFinite(n)&&n>0&&n<=250?n:null;
}
function researchProfile(r,h){
 const basis=researchEvidence(h);
 const active=(r.runners||[]).filter(x=>!x.is_non_runner);
 const rated=active.map(x=>ratedNumber(x.performance_rating)).filter(x=>x!==null);
 const own=ratedNumber(h.performance_rating);
 const sufficientlyRated=active.length>=4&&rated.length>=Math.ceil(active.length*.75);
 const rank=sufficientlyRated&&own!==null?1+rated.filter(v=>v>own).length:null;
 const best=rated.length?Math.max(...rated):null;
 const price=h.market_betfair||h.market_bet365||'';
 const topThird=rank!==null&&rank<=Math.max(2,Math.ceil(rated.length/3));
 const priority=basis.watch&&topThird&&Boolean(price);
 const issues=[];
 if(rank===null)issues.push('Too few comparable performance ratings');
 else if(!topThird)issues.push('Only #'+rank+' of '+rated.length+' on supplied performance ratings');
 const form=h.recent_form||{};
 if(Number(form.wins)===0)issues.push('No win in the last '+(Number(form.shown)||5)+' form figures');
 if(Number(h.days)>45)issues.push('Last raced '+String(h.days)+' days ago');
 if(/[PFU]/i.test(String(h.form||'').replace(/[^\w]/g,'')))
     issues.push('Form includes a non-completion code');
 const positives=[...basis.signals];
 if(rank!==null)positives.unshift('Performance rating '+own+': #'+rank+'/'+rated.length+
        ' in this field (best '+best+')');
 return {...basis,priority,rank,fieldCount:rated.length,positives,issues,price};
}
function researchWatches(){
 const today=todayUK(),clock=ukClock(),rows=[];
 for(const r of state.races){
   if(!String(r.id).startsWith('api_')||r.date!==today||String(r.time||'')<=clock)continue;
   if(/abandon|cancel/i.test(String(r.status||'')))continue;
   for(const h of r.runners||[]){
      const check=researchProfile(r,h);
      if(check.watch)rows.push({race:r,runner:h,...check});
   }
 }
 return rows.sort((a,b)=>Number(b.priority)-Number(a.priority)
   ||(a.priority&&b.priority?(a.rank/a.fieldCount)-(b.rank/b.fieldCount):0)
   ||b.count-a.count
   ||String(a.race.time).localeCompare(String(b.race.time))
   ||String(a.runner.name).localeCompare(String(b.runner.name)));
}
function openWatchRace(encodedRace,encodedRunner){
 const id=decodeURIComponent(encodedRace),runnerId=decodeURIComponent(encodedRunner);
 const r=state.races.find(x=>x.id===id);
 if(!r)return;
 meetingFilter=r.date+'|'+r.course;
 currentRaceId=id;render();
 setTimeout(()=>{
   const element=document.getElementById('pifrunner-'+runnerId);
   if(element)element.scrollIntoView({behavior:'smooth',block:'center'});
 },50);
}
function toggleWatchlist(){watchExpanded=!watchExpanded;render()}
function toggleOtherMatches(){watchOthersExpanded=!watchOthersExpanded;render()}
function renderWatchRow(x,compact){
 const r=x.race,h=x.runner;
 const quote=h.market_betfair?'Betfair '+h.market_betfair:
   h.market_bet365?'Bet365 '+h.market_bet365:'No quote';
 const evidence=compact?x.positives.slice(0,2):x.positives;
 const issues=x.issues.length?x.issues.join(' · '):
    'No obvious form warning; ground, pace and race history still need verification';
 return '<div class="headrow" style="padding:12px 0;border-top:1px solid #294357;align-items:flex-start">'+
  '<div style="min-width:0;flex:1"><strong style="color:'+
   (x.priority?'#80e0bb':'#d4e2ed')+'">'+e(h.name)+'</strong> '+
  '<span class="tag">'+(x.priority?'RATING-CHECKED':'PRELIMINARY')+'</span>'+
  '<div class="small">'+e(r.time)+' · '+e(r.course)+' · '+e(r.distance||'')+
   ' · '+e(quote)+' indicative</div>'+
  '<div class="fine" style="margin-top:5px"><strong>Evidence:</strong> '+e(evidence.join(' · '))+'</div>'+
  '<div class="fine" style="margin-top:4px;color:#ffcf83"><strong>Reservations:</strong> '+e(issues)+'</div>'+
  '</div><button class="btn" type="button" style="flex-shrink:0" onclick="openWatchRace(\''+
    encodeURIComponent(r.id)+'\',\''+encodeURIComponent(h.id)+'\')">View race</button></div>';
}
function renderWatchlist(){
 const watches=researchWatches(),priority=watches.filter(x=>x.priority),others=watches.filter(x=>!x.priority);
 const todayCards=state.races.filter(r=>String(r.id).startsWith('api_')&&r.date===todayUK()).length;
 const shown=watchExpanded?priority:priority.slice(0,5);
 const intro='<section class="card" id="research-watchlist" style="margin-top:10px;border-color:#317d6b">'+
  '<div class="headrow"><div><h2 style="margin:0">PIF Research Shortlist</h2>'+
  '<div class="small">All upcoming UK &amp; Ireland races checked · '+
  e(String(priority.length))+' rating-checked candidates</div></div>'+
  '<span class="tag">UNVALIDATED</span></div>'+
  '<div class="fine" style="margin-top:8px">First screens for recent form, trainer activity and fitness/course-distance flags; '+
  'then checks each horse against the published performance ratings of today’s field. '+
  'Only horses with a published rating in roughly the top third of rated runners appear here, where at least 75% of the field has a rating. '+
  '<strong>This is not a calibrated prediction, verified value, or advice to bet.</strong></div>';
 let result=intro;
 if(todayCards===0)result+='<div class="small" style="padding:16px 0">Load today to run the shortlist.</div>';
 else if(!priority.length)result+='<div class="small" style="padding:16px 0">No upcoming horses meet both the form screen and field-strength check. No selections forced.</div>';
 else result+=shown.map(x=>renderWatchRow(x,false)).join('');
 if(priority.length>5)result+='<div class="actions" style="margin:8px 0"><button class="btn" onclick="toggleWatchlist()">'+
    (watchExpanded?'Show first five':'Show all '+priority.length+' rating-checked candidates')+'</button></div>';
 if(others.length) {
   result+='<div style="border-top:1px solid #294357;padding-top:12px;margin-top:10px" class="fine">'+
       e(String(others.length))+' other horses met the basic form screen but failed or lacked field-strength evidence. '+
       '<button type="button" class="btn" onclick="toggleOtherMatches()">'+
       (watchOthersExpanded?'Hide preliminary matches':'Show preliminary matches')+'</button></div>';
   if(watchOthersExpanded)result+=others.map(x=>renderWatchRow(x,true)).join('');
 }
 return result+'</section>';
}
function logSpeedPaper(raceId){
 const v=(speedTrialData?.candidates||[]).find(x=>x.race_id===raceId);
 if(!v)return;
 const r=state.races.find(x=>x.id==='api_'+raceId);
 if(r){meetingFilter=r.date+'|'+r.course;currentRaceId=r.id;render()}
 openJournal(null,{name:v.horse,odds:v.quote?.indicative_decimal||''});
}
function renderSpeedTrial(){
 const data=speedTrialData,items=Array.isArray(data?.candidates)?data.candidates:[];
 const status=data?.status||'';
 const dateText=items.length?new Date(items[0].off_time).toLocaleDateString('en-GB',{timeZone:'Europe/London'}):'';
 let html='<section class="card" style="margin-top:12px;border-color:#348d8e">'+
  '<div class="headrow"><div><h2 style="margin:0">PIF Speed Trial</h2>'+
  '<div class="small">Original Andy-inspired race-time model · handicap hurdles only</div></div>'+
  '<span class="tag">EXPERIMENTAL</span></div>'+
  '<div class="fine" style="margin:8px 0">Only actual historical race times and beaten distances create these candidates. '+
  'Previous time standards and horse runs are required; no generic form/trainer picks. '+
  'These are <strong>not validated value bets</strong>. Final-circuit/sectional data are unavailable.</div>';
 if(!data){
  html+='<div class="small">Loading private timing history with racecards…</div>';
 }else if(status==='FEED_OFFLINE'){
  html+='<div class="small" style="color:#ffd190"><strong>Live feed unavailable.</strong> No speed selections have been verified for this session. Old racecards may be cached. Retry loading the racecards.</div>';
 }else if(status==='TIMING_HISTORY_LOADING'||status==='NOT_READY'){
  html+='<div class="small">Timing database is loading. No race-time selection can be verified yet.</div>';
 }else if(!items.length){
  html+='<div class="small">No horses currently qualify under the frozen speed pilot. Nothing is forced. '+ 
    'Some history may still be importing.</div>';
 }else{
  html+='<div class="small">'+items.length+' provisional speed candidate'+(items.length===1?'':'s')+
   ' · Timing standards derived: '+e(data.standards_derived??'—')+'</div>';
  html+=items.map(v=>{
   const off=new Date(v.off_time).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'});
   const quote=v.quote?'Indicative '+e(v.quote.bookmaker)+' '+e(v.quote.indicative_decimal)+
     ' (quoted '+e(v.quote.minutes_old)+' min ago)':'No recent verified price';
   const evidence=(v.timed_evidence||[]).map(x=>
     e(x.date)+' · finished '+e(x.finish_position)+
     (Number(x.beaten_lengths)>0?' ('+e(x.beaten_lengths)+'L behind)':'')+
     ' · individual speed '+e(x.speed_pts)+' · race strength '+e(x.race_strength_pts)+
     ' · '+e(x.going)+' · '+e(x.yards)+' yards · '+e(x.standard_sample)+' earlier comparable races'
    ).join(' | ');
   const risk=(v.warnings||[]).join(' · ')||'No automatic warning; jumping, pace and competition still unverified';
   return '<div style="border-top:1px solid #294357;padding:12px 0">'+
    '<div class="headrow"><div><strong>'+e(v.horse)+'</strong>'+
    '<div class="small">'+e(off)+' · '+e(v.course)+' · '+e(v.distance)+' · '+quote+'</div>'+
    '<div class="fine">Pilot individual speed: '+e(v.speed_pts)+' points; lead: '+e(v.speed_lead_pts)+
    ' points over next eligible runner ('+e(v.comparable_runners)+' runners had sufficient timing records).</div>'+
    '</div><button type="button" class="btn" onclick="openWatchRace(\''+
       encodeURIComponent('api_'+v.race_id)+'\',\''+
       encodeURIComponent('api_'+v.horse_id)+'\')">View race</button>'+
    (v.quote?'<button type="button" class="btn" onclick="logSpeedPaper(\''+e(v.race_id)+'\')">Paper track</button>':'')+'</div>'+
    '<div class="fine" style="margin-top:6px"><strong>Actual prior timed races:</strong> '+evidence+'</div>'+
    '<div class="fine" style="margin-top:4px"><strong>Reservations:</strong> '+e(risk)+'</div></div>';
  }).join('');
 }
 return html+'</section>';
}
function selectMeeting(key){meetingFilter=key;currentRaceId=null;render()}
renderRaces=function(){
 const today=todayUK();
 const groups=[...new Set(state.races.map(r=>r.date+'|'+r.course))].sort((a,b)=>{
   const da=a.split('|')[0],db=b.split('|')[0],pa=da===today?0:da>today?1:2,pb=db===today?0:db>today?1:2;
   return pa-pb||(pa===2?db.localeCompare(da):a.localeCompare(b));
 });
 const selected=meetingFilter!=='auto'&&groups.includes(meetingFilter)?meetingFilter:groups.find(g=>g.startsWith(today+'|'))||groups[0];
 const visible=selected?state.races.filter(r=>r.date+'|'+r.course===selected).sort((a,b)=>String(a.time).localeCompare(String(b.time))):[];
 if(visible.length&&!visible.some(r=>r.id===currentRaceId))currentRaceId=(pickUpcoming(visible)||visible[0]).id;
 const all=state.races;let inner='';
 try{state.races=visible;inner=oldRenderRaces()}finally{state.races=all}
 const options=groups.map(g=>'<option value="'+attr(g)+'" '+(g===selected?'selected':'')+'>'+e(g.replace('|',' · '))+(g.startsWith(today+'|')?' · TODAY':'')+'</option>').join('');
 const chooser=groups.length?'<div class="field" style="margin:12px 0 0"><label>Meeting</label><select onchange="selectMeeting(this.value)">'+options+'</select></div>':'';
 const ui='<section class="card" style="margin-top:10px"><div class="headrow"><div><strong>UK & Ireland racecards</strong><div class="fine">Standard racecards · private access</div></div><span class="tag">STANDARD API</span></div><div class="actions" style="margin-top:12px"><button class="btn primary" '+(liveBusy?'disabled':'')+' onclick="loadLiveCards(\'today\')">'+(liveBusy?'Loading…':'Load today')+'</button><button class="btn" '+(liveBusy?'disabled':'')+' onclick="loadLiveCards(\'tomorrow\')">Tomorrow</button></div><div class="fine">'+e(liveMessage||'Enter your private scanner code to load Standard racecards. No API password is needed on your phone.')+'</div></section>';
 const firstEnd=inner.indexOf('</section>');
 const watch=renderSpeedTrial()+'<details style="margin-top:10px"><summary>Legacy form-only research (not the PIF speed formula)</summary>'+renderWatchlist()+'</details>';
 return firstEnd<0?watch+ui+chooser+inner:
   inner.slice(0,firstEnd+10)+watch+ui+chooser+inner.slice(firstEnd+10);
};
function showLivePin(day){
 modal('<div class="headrow"><h2>Racing feed access</h2><button class="close" onclick="closeModal()">✕</button></div><div class="small">Enter your private scanner access code set in Render. <strong>Not</strong> your Racing API password. The code is kept only for this browser session.</div><form onsubmit="submitLivePin(event,\''+day+'\')"><div class="field"><label>Scanner access code</label><input name="pin" type="password" autocomplete="off" minlength="12" required></div><div class="actions"><button class="btn primary" type="submit">Load racecards</button></div></form>');
}
function submitLivePin(ev,day){ev.preventDefault();const pin=new FormData(ev.target).get('pin');closeModal();fetchLiveCards(day,String(pin))}
function loadLiveCards(day){if(liveBusy)return;let pin='';try{pin=sessionStorage.getItem('pif-racing-pin')||''}catch(_){}if(pin)fetchLiveCards(day,pin);else showLivePin(day)}
// The private API checks the Origin and PIN itself. Sending JSON with a
// text/plain content type avoids a fragile cross-origin OPTIONS preflight
// during free-tier wakeups. Backend still decodes JSON from the request body.
async function requestPrivateRacecards(day,pin,timeoutMs){
 const ac=new AbortController();
 const timeout=setTimeout(()=>ac.abort(),timeoutMs);
 try{
  const response=await fetch(FEED_URL,{
   method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},
   body:JSON.stringify({day,pin}),signal:ac.signal,
   cache:'no-store',referrerPolicy:'no-referrer'
  });
  let data;
  try{data=await response.json()}
  catch(_){
   const err=Error('Unexpected response from data service');
   err.httpStatus=response.status;throw err;
  }
  if(!response.ok||!data||!data.ok){
   const err=Error(data?.error||'Unable to fetch racecards');
   err.httpStatus=response.status;throw err;
  }
  return data;
 }finally{clearTimeout(timeout)}
}
async function fetchLiveCards(day,pin){
 if(liveBusy)return;
 liveBusy=true;
 liveMessage='Connecting to the private racing feed…';
 render();
 try{
  let data;
  for(let attempt=0;attempt<2;attempt++){
   if(attempt){
    liveMessage='The first connection failed. Retrying the private racing feed… (2 of 2)';
    render();
    await new Promise(resolve=>setTimeout(resolve,2500));
   }
   try{
    data=await requestPrivateRacecards(day,pin,attempt===0?45000:75000);
    break;
   }catch(err){
    const canRetry=err.name==='AbortError'||err.name==='TypeError'
      ||(Number(err.httpStatus)>=500&&Number(err.httpStatus)<600);
    if(!canRetry||attempt===1)throw err;
   }
  }
  const n=mergeLiveCards(data);
  try{sessionStorage.setItem('pif-racing-pin',pin)}catch(_){}
  liveMessage=n+' racecards refreshed '+new Date().toLocaleTimeString('en-GB',
   {hour:'2-digit',minute:'2-digit'})+
   ' · Live speed trial checked. Prices indicative; no proven value.';
 }catch(err){
  if(/incorrect[_ ]code/i.test(err.message))
   try{sessionStorage.removeItem('pif-racing-pin')}catch(_){}
  // Never imply offline or previously loaded cards are fresh selections.
  speedTrialData={status:'FEED_OFFLINE',candidate_count:0,candidates:[]};
  const detail=err.name==='AbortError'
   ?'The data service took too long to respond.'
   :err.message==='scanner_not_configured'
    ?'The private racing backend code has not been configured.'
    :err.message==='incorrect_code'
     ?'Incorrect scanner code.'
     :err.name==='TypeError'
      ?'The private data service could not be reached.'
      :'The private feed returned '+String(err.message||'an error')+'.';
  liveMessage=detail+' Previously loaded racecards may be out of date.'+
    ' Please use Load today or Tomorrow to retry.';
 }finally{liveBusy=false;render()}
}
function mergeLiveCards(data){
 if(!Array.isArray(data.races))throw Error('Unexpected feed response');
 speedTrialData=data.speed_trial&&typeof data.speed_trial==='object'?data.speed_trial:null;
 let n=0,first=null;
 for(const x of data.races){
  if(!x.feed_id||!x.date||!x.course||!Array.isArray(x.runners))continue;
  const id='api_'+String(x.feed_id);let old=state.races.find(r=>r.id===id);
  if(!old){old={id,runners:[],source:'The Racing API Standard'};state.races.push(old)}
  const changed=old.going&&old.going!==x.going||old.distance&&old.distance!==x.distance;
  for(const k of ['date','time','course','title','going','type','distance'])old[k]=String(x[k]||'');
  old.source='The Racing API Standard · fetched '+String(data.fetched_at||'');
  const runners=[];
  for(const h of x.runners){if(!h.name)continue;
   const runnerId='api_'+(h.horse_id||('name_'+String(h.name).toLowerCase()));
   const prev=old.runners.find(r=>r.id===runnerId)||{};
   runners.push({id:runnerId,name:String(h.name),age:h.age,or:h.or,weight:h.weight,form:h.form,days:h.days,trainer:h.trainer,jockey:h.jockey,draw:h.draw,headgear:h.headgear,
    recent_form:h.recent_form&&typeof h.recent_form==='object'?h.recent_form:null,
    private_history:h.private_history&&typeof h.private_history==='object'?h.private_history:null,
    trainer14_wins:h.trainer14_wins||'',trainer14_runs:h.trainer14_runs||'',
    trainer14_pct:h.trainer14_pct||'',market_betfair:h.market_betfair||'',
    market_bet365:h.market_bet365||'',performance_rating:h.performance_rating||'',
    past_results_flags:Array.isArray(h.past_results_flags)?h.past_results_flags:[],
    is_non_runner:h.is_non_runner===true,
    notes:prev.notes||'',odds:prev.odds||'',factors:changed?{}:(prev.factors||{})});
  }
  old.runners=runners;
  if(changed)old.source+=' · conditions changed, reassess factors';
  if(!first)first=old;
  n++;
 }
 if(first){const newCards=state.races.filter(r=>r.id.startsWith('api_')&&data.races.some(x=>'api_'+String(x.feed_id)===r.id));const pick=pickUpcoming(newCards)||first;currentRaceId=pick.id;meetingFilter=pick.date+'|'+pick.course}
 save();return n
}

// Refresh today's cards automatically on returning to a browser session that already
// has a private PIN. Never put that PIN in persistent localStorage or a URL.
render();
try{
 const rememberedPin=sessionStorage.getItem('pif-racing-pin');
 if(rememberedPin&&rememberedPin.length>=12){
    setTimeout(()=>{if(!liveBusy)fetchLiveCards('today',rememberedPin)},250);
 }
}catch(_){} 
