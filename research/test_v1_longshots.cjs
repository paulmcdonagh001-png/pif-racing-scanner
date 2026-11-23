'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const doc=fs.readFileSync('v2.html','utf8');
const script=doc.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert(script,'Scanner embedded JavaScript missing');
const start=script.indexOf('const LONGSHOT_PAPER_KEY=');
const end=script.indexOf('function render(){',start);
assert(start>0&&end>start,'Missing dedicated longshot research module');
const elements={
 'longshot-panel':{addEventListener(){}},
 'longshot-body':{innerHTML:''},
 'longshot-feedback':{textContent:''}
};
const store={};
const context={
 get:id=>elements[id],
 escapeHtml:value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}},
 Date,Number,Math,Array,Object,JSON,FormData:class{},
};
vm.createContext(context);
vm.runInContext(script.slice(start,end),context);
assert.equal(vm.runInContext("longshotDecimal('20/1')",context),21);
assert.equal(vm.runInContext("longshotDecimal('25/1')",context),26);
assert.equal(vm.runInContext("longshotDecimal('20.99')",context),20.99);
assert.equal(vm.runInContext("longshotDecimal('7/0')",context),null);
const h=i=>({
 date:'2026-11-23',race_id:'race-'+i,horse_id:'horse-'+i,
 horse:'Longshot '+i,model_rank:2,field_size:14,prior_runs_recorded:5,
 off_utc:'2026-11-23T15:30:00Z',course:'Ascot',win_decimal:34,
 reference_bookmaker:'skybet'
});
context.testData={checked_scored_races:15,candidate_count:12,
 candidates:Array.from({length:12},(_,i)=>h(i)),
 price_checks:[{...h(13),win_decimal:null}]};
vm.runInContext('longshotData=testData;renderLongshotPanel()',context);
assert(elements['longshot-body'].innerHTML.includes('12 found'),'Must never cap longshot count');
assert(elements['longshot-body'].innerHTML.includes('Longshot 11'),'Must render all 12');
assert(elements['longshot-body'].innerHTML.includes('1 model-rated horses needing a 20/1+ Bet365 price check'));
assert(!elements['longshot-body'].innerHTML.includes('Extra place ·'),'Cannot invent extra-place offer');
const key='2026-11-23|race-13|horse-13';
store['pif-racing-longshot-bet365-owner-v1']=JSON.stringify({
 [key]:{price:26,places:5,standard_places:4,fraction:.2,result:'placed'}
});
vm.runInContext('renderLongshotPanel()',context);
assert(elements['longshot-body'].innerHTML.includes('13 found'),'Manual Bet365 25/1 horse joins the list');
assert(elements['longshot-body'].innerHTML.includes('Extra place · 4 → 5'),'Flag requires documented place comparison');
assert(elements['longshot-body'].innerHTML.includes('+£4.00 net'),'Place-only profit must account for £2 total EW stake');
assert(elements['longshot-body'].innerHTML.includes('1 settled'),'Paper results tracked');
console.log('CatBoost longshot scanner and extra-place paper tracking checks passed');
