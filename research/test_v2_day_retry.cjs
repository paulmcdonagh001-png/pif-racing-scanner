'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('v2.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(script, 'V2 embedded script missing');
const begin = script.indexOf('async function reload(){');
const end = script.indexOf('authUi();if(token)reload().then(resumeFreshScanStatus);', begin);
assert(begin >= 0 && end > begin, 'V2 reload handler missing');
const switchBegin = script.indexOf("document.querySelectorAll('[data-day]').forEach(b=>");
const switchEnd = script.indexOf("get('reload').addEventListener('click',reload);", switchBegin);
assert(switchBegin >= 0 && switchEnd > switchBegin, 'Day tab handler missing');
const switchCode = script.slice(switchBegin, switchEnd);
assert(switchCode.includes('reloadSeq++'), 'Day switch must invalidate old fetch');
assert(switchCode.includes('entries=[]'), 'Day switch must not show old-day rankings');
assert(script.slice(begin,end).includes('requestDay!==day'), 'Stale fetch guard absent');
assert(script.slice(begin,end).includes('networkFailures<3'), 'Missing bounded recovery');

const els = {
 reload: {disabled:false}, summary:{textContent:''}, races:{innerHTML:''},
 'loaded-time':{textContent:'',dataset:{}}
};
const pending = [];
const timers = [];
const ctx = {
 token:'test-session', day:'today', entries:[], loading:false,
 reloadSeq:0, networkFailures:0, refreshBusy:false,
 get:id=>els[id],
 request:(path,payload)=>new Promise((resolve,reject)=>pending.push({path,payload,resolve,reject})),
 status:text=>{ctx.lastStatus=text;},
 updateFilters(){}, render(){ctx.lastRendered=ctx.entries.map(r=>r.race_id);},
 updateForwardRecord(){}, showScanProgress(){},
 escapeHtml:x=>String(x),
 setTimeout:fn=>{timers.push(fn);return timers.length;}
};
vm.createContext(ctx);
vm.runInContext(script.slice(begin,end),ctx);

function result(which){
 return {ok:true,status:'RESEARCH_ONLY',version:'pif-v2-independent-test',
   display_ranking_system:'FIVE_CODE_RACE_CONDITIONS_V4',
   races:[{race_id:which}],snapshot_status:'SAVED_DATABASE',
   snapshot_saved_utc:'2026-11-11T21:20:54Z',ledger_status:'FROZEN'};
}
(async()=>{
 const todayCall=vm.runInContext('reload()',ctx);
 assert.equal(pending[0].payload.day,'today');
 // Changing the selected tab invalidates the old network response.
 ctx.day='tomorrow';ctx.reloadSeq++;ctx.entries=[];
 const tomorrowCall=vm.runInContext('reload()',ctx);
 assert.equal(pending[1].payload.day,'tomorrow');
 pending[0].resolve(result('today'));
 await todayCall;
 assert.equal(ctx.entries.length,0,'Old day response polluted Tomorrow tab');
 pending[1].resolve(result('tomorrow'));
 await tomorrowCall;
 assert.equal(ctx.entries[0].race_id,'tomorrow');
 assert.deepEqual(Array.from(ctx.lastRendered),['tomorrow']);

 const failingCall=vm.runInContext('reload()',ctx);
 pending[2].reject(new TypeError('Failed to fetch'));
 await failingCall;
 assert.equal(ctx.networkFailures,1);
 assert.match(ctx.lastStatus,/Reconnecting automatically/);
 assert.equal(ctx.entries[0].race_id,'tomorrow','Transient error erased successful data');
 assert.equal(timers.length,1);
 timers.shift()();
 assert.equal(pending[3].payload.day,'tomorrow','Retry used wrong day');
 pending[3].resolve(result('tomorrow-again'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ctx.entries[0].race_id,'tomorrow-again');
 assert.equal(ctx.networkFailures,0);
 console.log('V2 day switch and transient network recovery checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
