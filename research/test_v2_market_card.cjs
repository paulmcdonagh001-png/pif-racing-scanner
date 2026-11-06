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
for(const x of ['Choose any horse','Kaleidoscope Eyes','Equion','Thiscouldbefun',
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

const rowStart=script.indexOf('function row(h,raceType,race){');
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
const mismatchEnd=script.indexOf('const marketInputState=',mismatchStart);
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


const fullField={race_id:'all-eight',all_runners:[
 ...horses,
 {horse:'Runner Four',horse_id:'d',display_rank:4,quote:{decimal:19}},
 {horse:'Runner Five',horse_id:'e',display_rank:5,quote:{decimal:31}},
 {horse:'Runner Six',horse_id:'f',display_rank:6,quote:{decimal:5}},
 {horse:'Runner Seven',horse_id:'g',display_rank:7,quote:{decimal:42},conditions_supported:false},
 {horse:'Runner Eight',horse_id:'h',display_rank:8,quote:{decimal:63}}
],top_three:horses};
context.fullField=fullField;
const fullPanel=vm.runInContext('marketPanel(fullField)',context);
for(const h of fullField.all_runners){
 assert(fullPanel.includes(h.horse),'Every runner must be selectable: '+h.horse);
}
vm.runInContext("marketState(fullField).horse='7'",context);
assert.equal(vm.runInContext('marketQuote(fullField,marketState(fullField))',context),'63');
const formCard=vm.runInContext("row({horse:'Sample Runner',horse_id:'d',display_rank:4,jockey_name:'Jockey',trainer_name:'Trainer',evidence_facts:{official_rating:98,course_wins:1,course_starts:3,trainer_60d:{wins:7,runs:30},jockey_60d:{wins:4,runs:26},similar_trip_top_three:2,similar_trip_starts:4,similar_going_top_three:1,similar_going_starts:5}},'Flat',{race_id:'test',all_runners:[{horse_id:'d',evidence_facts:{official_rating:98}},{horse_id:'z',evidence_facts:{official_rating:100}}]})",context);
for(const bar of ['Ability','Course','Distance','Going']){
 assert(formCard.includes('>'+bar+'</span>'),'Missing evidence bar: '+bar);
}
for(const label of ['Trainer · 60d','Jockey · 60d']){
 assert(formCard.includes('>'+label+'</span>'),'Missing 60-day evidence bar: '+label);
}
assert(!formCard.includes('Trainer · 30d'),'New card must prefer full 60-day form');
assert(formCard.includes('Choose this runner for comparison'));
assert(doc.includes('(r.all_runners||r.top_three||[]).map(h=>row(h,r.type,r))'),'Full-field must render without a hidden ranks 4+ expander');
assert(!doc.includes("'<details class=\"other-runners\""),'Old runner expander must not be rendered');

const signalHorse=(id,or,wins,runs,courseWins,courseRuns,distancePlaces,distanceRuns)=>({
 horse:id,horse_id:id,display_rank:1,
 evidence_facts:{
  official_rating:or,
  trainer_30d:{wins,runs},jockey_30d:{wins,runs},
  course_wins:courseWins,course_starts:courseRuns,
  similar_trip_top_three:distancePlaces,similar_trip_starts:distanceRuns,
  similar_going_top_three:1,similar_going_starts:3
 }
});
const evidenceRace={race_id:'signal-test',all_runners:[
 signalHorse('a',80,6,30,0,3,0,2),
 signalHorse('b',70,1,30,0,3,1,2),
 signalHorse('c',90,2,30,1,3,2,2)
]};
context.evidenceRace=evidenceRace;
const relative=vm.runInContext("row(evidenceRace.all_runners[0],'Flat',evidenceRace)",context);
assert.equal((relative.match(/class="evidence-factor"/g)||[]).length,6,
 'All six comparative factors must be visible');
assert(relative.includes('evidence-fill strong'),
 '6 wins / 30 should have strong field-relative standing, not a 20% bar');
assert(relative.includes('evidence-fill low'),
 'A weak relative record should still show a non-zero rating, not an empty bar');
assert(!relative.includes('class="evidence-fill low" style="width:0%'),
 'Low but known historical ability must not produce a zero-width bar');
const unrated=signalHorse('unrated',null,0,0,0,0,0,0);
unrated.evidence_facts.similar_going_starts=0;
context.unrated=unrated;
context.evidenceRace.all_runners.push(unrated);
const missingHtml=vm.runInContext("row(unrated,'Flat',evidenceRace)",context);
// Saved snapshots keep genuine 30-day records visible with honest labels,
// without pretending they represent 60 days or altering previous rankings.
const oldFieldsRace={race_id:'legacy',all_runners:[
 {horse:'Old Horse',horse_id:'old',display_rank:1,evidence_facts:{
  trainer_30d:{wins:8,runs:12},jockey_30d:{wins:7,runs:12}}},
 {horse:'Other',horse_id:'other',display_rank:2,evidence_facts:{
  trainer_30d:{wins:1,runs:12},jockey_30d:{wins:1,runs:12}}}
]};
context.oldFieldsRace=oldFieldsRace;
const legacyHtml=vm.runInContext("row(oldFieldsRace.all_runners[0],'Flat',oldFieldsRace)",context);
assert(legacyHtml.includes('Trainer · 30d</span><small>High</small>'));
assert(legacyHtml.includes('Jockey · 30d</span><small>High</small>'));
assert(legacyHtml.includes('saved historical scan'));
const newFieldsRace={race_id:'sixty',all_runners:[
 {horse:'Sixty',horse_id:'a',display_rank:1,evidence_facts:{
  trainer_60d:{wins:12,runs:60},jockey_60d:{wins:8,runs:48}}},
 {horse:'Other',horse_id:'b',display_rank:2,evidence_facts:{
  trainer_60d:{wins:2,runs:50},jockey_60d:{wins:1,runs:45}}}
]};
context.newFieldsRace=newFieldsRace;
const sixtyHtml=vm.runInContext("row(newFieldsRace.all_runners[0],'Flat',newFieldsRace)",context);
assert(sixtyHtml.includes('Trainer · 60d</span><small>High</small>'));
assert(sixtyHtml.includes('Jockey · 60d</span><small>High</small>'));
// Never compare 30-day samples with 60-day samples in a mixed saved field.
const mixedRace={race_id:'mixed',all_runners:[
 oldFieldsRace.all_runners[0],newFieldsRace.all_runners[1]]};
context.mixedRace=mixedRace;
const mixedHtml=vm.runInContext("row(mixedRace.all_runners[0],'Flat',mixedRace)",context);
assert(mixedHtml.includes('Trainer · 30d</span><small>N/R</small>'));
assert(mixedHtml.includes('Jockey · 30d</span><small>N/R</small>'));

assert(missingHtml.includes('evidence-fill unrated'),
 'Insufficient records should show unrated grey, not a low performance');
assert(!doc.includes('winning probability') || doc.includes('not a win'),
 'No fabricated winning chances');


console.log('PIF Racing V2 market cards: payout calculations, rank integrity and no-price checks passed');
