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
context.testData={checked_scored_races:15,checked_races:18,candidate_count:12,
 all_priced_longshot_count:13,known_shorter_price_count:35,
 candidates:Array.from({length:12},(_,i)=>h(i)),
 other_longshots:[{...h(20),model_rank:9,screen_reason:'MODEL_NOT_HIGHLY_RANKED',win_decimal:201}],
 price_checks:[{...h(13),win_decimal:null}]};
vm.runInContext('longshotData=testData;renderLongshotPanel()',context);
assert(elements['longshot-body'].innerHTML.includes('12 flagged'),'Must never cap longshot count');
assert(elements['longshot-body'].innerHTML.includes('Longshot 11'),'Must render all 12');
assert(elements['longshot-body'].innerHTML.includes('1 well-ranked horses with no reliable reference price'));
assert(!elements['longshot-body'].innerHTML.includes('Extra place ·'),'Cannot invent extra-place offer');
assert(elements['longshot-body'].innerHTML.includes('13 horses priced 20/1+'),
  'All priced 20/1+ runners must be counted, including lower-ranked ones');
assert(elements['longshot-body'].innerHTML.includes('1 other priced 20/1+ runners'),
  'Do not silently discard lower-ranked outsiders');
context.testData.candidates[0].reference_market_rank=11;
context.testData.candidates[0].market_rank_gap=9;
vm.runInContext('renderLongshotPanel()',context);
assert(elements['longshot-body'].innerHTML.includes('reference price order #11'),
  'Show model versus indicative market order when fully priced');
context.testData.candidates[0].price_provisional=true;
vm.runInContext('renderLongshotPanel()',context);
assert(elements['longshot-body'].innerHTML.includes('Runner-only reference · race field partly unmatched'),
 'A partially mismatched race must never be displayed as a full-field quote');
const key='2026-11-23|race-13|horse-13';
store['pif-racing-longshot-bet365-owner-v1']=JSON.stringify({
 [key]:{price:26,places:5,standard_places:4,fraction:.2,result:'placed'}
});
vm.runInContext('renderLongshotPanel()',context);
assert(elements['longshot-body'].innerHTML.includes('13 flagged'),'Manual Bet365 25/1 horse joins the list');
assert(elements['longshot-body'].innerHTML.includes('Extra place · 4 → 5'),'Flag requires documented place comparison');
assert(elements['longshot-body'].innerHTML.includes('place-only net +£4.00'),'Place-only profit must account for £2 total EW stake');
assert(elements['longshot-body'].innerHTML.includes('1 settled'),'Paper results tracked');
console.log('CatBoost longshot scanner and extra-place paper tracking checks passed');
