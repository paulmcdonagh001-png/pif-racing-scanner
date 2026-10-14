'use strict';
// Live cards add-on. No Racing API credentials ever reach this browser.
const FEED_URL='https://pif-racing-paper.onrender.com/racecards';
let liveBusy=false,liveMessage='',meetingFilter='auto';
const oldRenderRaces=renderRaces;
function todayUK(){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o={};for(const x of parts)o[x.type]=x.value;return o.year+'-'+o.month+'-'+o.day}
function ukClock(){return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())}
function pickUpcoming(rows){const today=todayUK(),clock=ukClock();const sorted=[...rows].sort((a,b)=>String(a.date+' '+a.time).localeCompare(String(b.date+' '+b.time)));return sorted.find(r=>r.date>today||r.date===today&&String(r.time)>=clock)||sorted[sorted.length-1]||null}
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
 return firstEnd<0?ui+chooser+inner:inner.slice(0,firstEnd+10)+ui+chooser+inner.slice(firstEnd+10);
};
function showLivePin(day){
 modal('<div class="headrow"><h2>Racing feed access</h2><button class="close" onclick="closeModal()">✕</button></div><div class="small">Enter your private scanner access code set in Render. <strong>Not</strong> your Racing API password. The code is kept only for this browser session.</div><form onsubmit="submitLivePin(event,\''+day+'\')"><div class="field"><label>Scanner access code</label><input name="pin" type="password" autocomplete="off" minlength="12" required></div><div class="actions"><button class="btn primary" type="submit">Load racecards</button></div></form>');
}
function submitLivePin(ev,day){ev.preventDefault();const pin=new FormData(ev.target).get('pin');closeModal();fetchLiveCards(day,String(pin))}
function loadLiveCards(day){if(liveBusy)return;let pin='';try{pin=sessionStorage.getItem('pif-racing-pin')||''}catch(_){}if(pin)fetchLiveCards(day,pin);else showLivePin(day)}
async function fetchLiveCards(day,pin){
 if(liveBusy)return;
 liveBusy=true;liveMessage='Connecting to PIF Racing data. Render may need about a minute to wake up…';render();
 try{
  const ac=new AbortController(),timeout=setTimeout(()=>ac.abort(),115000);
  let reply;try{reply=await fetch(FEED_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({day,pin}),signal:ac.signal,cache:'no-store',referrerPolicy:'no-referrer'})}finally{clearTimeout(timeout)}
  const data=await reply.json();
  if(!reply.ok||!data.ok)throw Error(data.error||'Unable to fetch racecards');
  const n=mergeLiveCards(data);
  try{sessionStorage.setItem('pif-racing-pin',pin)}catch(_){}
  liveMessage=n+' racecards loaded at '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+' · Standard form, trainer stats and indicative odds. No calibrated winning probabilities yet.';
 }catch(err){
  if(/incorrect[_ ]code/i.test(err.message))try{sessionStorage.removeItem('pif-racing-pin')}catch(_){}
  const detail=err.name==='AbortError'?'Connection timed out. Try again.':err.message==='scanner_not_configured'?'Private scanner code has not yet been saved in the PIF Racing backend.':err.message==='incorrect_code'?'Incorrect private scanner code.':err.message;
  liveMessage='Could not load racecards: '+detail;
 }finally{liveBusy=false;render()}
}
function mergeLiveCards(data){
 if(!Array.isArray(data.races))throw Error('Unexpected feed response');
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
    trainer14_wins:h.trainer14_wins||'',trainer14_runs:h.trainer14_runs||'',
    trainer14_pct:h.trainer14_pct||'',market_betfair:h.market_betfair||'',
    market_bet365:h.market_bet365||'',performance_rating:h.performance_rating||'',
    past_results_flags:Array.isArray(h.past_results_flags)?h.past_results_flags:[],
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
