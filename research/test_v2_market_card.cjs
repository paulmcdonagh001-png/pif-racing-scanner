'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const doc=fs.readFileSync('v2.html','utf8');
const script=doc.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert(script,'V2 HTML script missing');
const begin=script.indexOf('const marketInputState=');
const end=script.indexOf('function marketRefresh(',begin);
assert(begin>=0&&end>begin,'Missing market calculator');
const context={
 escapeHtml:value=>String(value??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 }[ch])),
 raceKey:r=>String(r.race_id),
};
vm.createContext(context);
vm.runInContext(script.slice(begin,end),context);
const calc=(kind,rank,stake,decimal,places=3,fraction=.2,payouts={})=>
 vm.runInContext('marketOutcome('+JSON.stringify(kind)+', '+rank+', '+stake+', '+(decimal===null?'null':decimal)+', '+places+', '+fraction+', '+JSON.stringify(payouts)+')',context);
assert.equal(calc('win',1,5,5),20);
assert.equal(calc('win',2,5,5),-5);
assert.equal(calc('top_finishes',3,5,2.5),7.5);
assert.equal(calc('top_finishes',4,5,2.5),-5);
assert.equal(calc('money_back',1,5,5),20);
assert.equal(calc('money_back',2,5,5),0);
assert.equal(calc('money_back',3,5,5),0);
assert.equal(calc('money_back',4,5,5),-5);
assert.equal(calc('each_way_extra',1,10,11,3,.2),60);
assert.equal(calc('each_way_extra',2,10,11,3,.2),5);
assert.equal(calc('each_way_extra',4,10,11,3,.2),-10);
assert.equal(calc('position_payout',1,5,null,3,.2,{1:20,2:8,3:5}),15);
assert.equal(calc('position_payout',2,5,null,3,.2,{1:20,2:8,3:5}),3);
assert.equal(calc('position_payout',4,5,null,3,.2,{1:20,2:8,3:5}),-5);
assert.equal(vm.runInContext("marketNumber('7/2')",context),4.5);
assert.equal(vm.runInContext("marketNumber('4.5')",context),4.5);
assert.equal(vm.runInContext("marketNumber('7/0')",context),null);
assert.equal(vm.runInContext("marketStake('-5')",context),null);
assert.equal(vm.runInContext("marketMoney(-5)",context),'-£5.00');
assert.equal(vm.runInContext("marketMoney(20)",context),'+£20.00');
const horses=[
 {horse:'Kaleidoscope Eyes',horse_id:'a',display_rank:1,quote:{decimal:8.5}},
 {horse:'Equion',horse_id:'b',display_rank:2,quote:{decimal:4.5}},
 {horse:'Thiscouldbefun',horse_id:'c',display_rank:3,quote:{decimal:13}}
];
const race={race_id:'test-Bath',top_three:horses};
context.race=race;
const panel=vm.runInContext('marketPanel(race)',context);
for(const x of ['Which horse and which bet?','Kaleidoscope Eyes','Equion','Thiscouldbefun',
 'Win quote 8.50','top three','No verified best bet yet','Compare £5 bets and bookmaker markets']){
 assert(panel.toLowerCase().includes(x.toLowerCase()),'Panel missing '+x);
}
assert(!panel.includes('best strategy is'), 'Never assert validated bet');
assert.equal(vm.runInContext('marketQuote(race,marketState(race))',context),'8.5');
assert(vm.runInContext("marketResults(race,marketState(race))",context).includes('+£37.50'),
 'Win-market comparison must correctly use indicative current quote');
const sparse={race_id:'no-price',top_three:[{horse:'<script>x</script>',display_rank:1}]};
context.sparse=sparse;
assert(!vm.runInContext('marketPanel(sparse)',context).includes('<script>'),'Horse name injection');
assert(vm.runInContext("marketResults(sparse,marketState(sparse))",context).includes('Enter the bookmaker'),'Never fabricate missing odds');
assert(doc.includes('marketPanel(r)+'),'Racecard must contain embedded panel');
assert(!doc.includes('research_share_pct'),'Do not leak uncalibrated model shares');

const rowStart=script.indexOf('function row(h,raceType){');
const rowEnd=script.indexOf('async function updateForwardRecord(){',rowStart);
assert(rowStart>=0&&rowEnd>rowStart);
vm.runInContext(script.slice(rowStart,rowEnd),context);
const firstTimeHurdler={
 horse:'Forthfactor',display_rank:2,prior_runs_recorded:0,runner_age:5,
 other_code_runs_recorded:4,other_code_run_types:{'NH Flat':4},
 evidence_facts:{last_five_finishes:[]},
 jump_research:{previous_discipline:'NH Flat',previous_discipline_starts:4,
  previous_discipline_wins:3,previous_discipline_top3:3},
 quote:{decimal:1.15,source:'Betfair Exchange'}
};
context.firstTimeHurdler=firstTimeHurdler;
const newcomerHtml=vm.runInContext("row(firstTimeHurdler,'Hurdle')",context);
assert(newcomerHtml.includes('NH Flat: 4 previous runs · 3 wins'));
assert(newcomerHtml.includes('Limited comparable history: 0 recorded Hurdle runs'));
assert(newcomerHtml.includes('not scored as Hurdle results'));
const mismatchStart=script.indexOf('function marketDisagreement(r){');
const mismatchEnd=script.indexOf('function render(){',mismatchStart);
assert(mismatchStart>=0&&mismatchEnd>mismatchStart);
vm.runInContext(script.slice(mismatchStart,mismatchEnd),context);
const raceMismatch={
 display_race_code:'Hurdle',display_status:'PROVISIONAL_SPECIALIST_RANKING',
 all_runners:[
  {horse:'Emerald Tir',horse_id:'a',display_rank:1,quote:{decimal:34}},
  {...firstTimeHurdler,horse_id:'b'},
  {horse:'Chocks Away',horse_id:'c',display_rank:3,quote:{decimal:85}}
 ]
};
context.raceMismatch=raceMismatch;
const warning=vm.runInContext('marketDisagreement(raceMismatch)',context);
assert(warning.includes('Forthfactor'));
assert(warning.includes('PIF rank 2'));
assert(warning.includes('3 wins from 4 recorded runs'));
assert(warning.includes('too little relevant form'));

console.log('PIF Racing V2 market cards: payout calculations, rank integrity and no-price checks passed');
