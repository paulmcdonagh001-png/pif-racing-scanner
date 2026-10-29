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
console.log('PIF Racing V2 market cards: payout calculations, rank integrity and no-price checks passed');
