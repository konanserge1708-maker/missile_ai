import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from './dist/battle-engine.js';
import {createInvasion} from './dist/invasion-engine.js';
const players=n=>Array.from({length:n},(_,i)=>({id:String(i),name:'Nation '+i,lat:-35+i*5,lon:-150+i*21,profile:['aggressive','defensive','opportunist'][i%3],doctrine:'salvo',squad:i%2}));
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};

test('both engines accept fifteen distinct nations and reject sixteen or duplicates',()=>{
 for(const create of [createBattle,createInvasion]){
  const g=create();g.start({players:players(15),mode:'ffa'});assert.equal(g.state.fighters.length,15);assert.equal(g.state.satellites.length,15);assert.equal(g.state.fleet.length,15);
  assert.throws(()=>g.start({players:players(16)}));assert.throws(()=>g.start({players:[...players(14),players(1)[0]]}));
  g.reset();assert.equal(g.state.fighters.length,15);assert.equal(g.state.time,0);
 }
});

test('fifteen-nation free-for-all matches finish with valid resources, pause and reset',()=>{
 for(let seed=1;seed<=12;seed++){
  const g=createBattle(rng(seed));g.start({mode:'ffa',players:players(15),specialArsenal:true,naval:true,satellites:true});let count=0;
  while(g.state.status==='running'&&count++<5000){
   g.step(.1);for(const f of g.state.fighters)assert.ok(f.hp>=0&&f.hp<=100&&f.energy>=0&&f.energy<=100&&f.shield>=-1e-6&&f.shield<=40+1e-6);
   if(count===30){g.pause();const frozen=structuredClone(g.state);g.step(5);assert.deepEqual(g.state,frozen);g.pause();}
  }
  assert.equal(g.state.status,'finished','seed '+seed);assert.equal(g.state.winners.length,1);assert.equal(g.state.flights.length,0);g.reset();assert.equal(g.state.fighters.length,15);
 }
});

test('fifteen-nation invasions scale the enemy and finish without invalid targets',()=>{
 for(let seed=1;seed<=4;seed++){
  const g=createInvasion(rng(seed));g.start({players:players(15),planetShield:true,research:true,technology:seed%2?'convergence':'barrage',satellites:true,naval:true});
  assert.equal(g.state.tech.centers.length,15);assert.equal(g.state.planetShield.maxHp,825);assert.equal(g.state.ship.interruptThreshold,450);
  let count=0;while(g.state.status==='running'&&count++<6000){g.step(.1);assert.ok(Number.isFinite(g.state.ship.hp)&&g.state.ship.hp>=0);assert.ok(g.state.fighters.every(f=>f.hp>=0&&f.hp<=100&&f.energy>=0&&f.energy<=100));}
  assert.equal(g.state.status,'finished','seed '+seed);assert.equal(g.state.fighters.length,15);
 }
});

test('world bombardment includes every one of fifteen participating nations',()=>{
 const g=createInvasion(()=>.99);g.start({players:players(15),research:true,technology:'barrage',satellites:false,naval:false});g.state.fighters.forEach(f=>f.next=Infinity);g.state.ship.nextAttack=g.state.nextDroneAt=Infinity;
 g.state.tech.phase='ready';g.state.tech.readyAt=-20;g.step(.05);assert.equal(new Set(g.state.tech.projectiles.map(s=>s.from)).size,15);
});
