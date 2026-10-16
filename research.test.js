import {test} from 'node:test';import assert from 'node:assert/strict';
import {createInvasion} from './dist/invasion-engine.js';
import {TECHNOLOGIES,createResearchSystem,initializeResearch,absorbTechnology} from './dist/research.js';
const players=Array.from({length:3},(_,i)=>({id:String(i),lat:i*20,lon:i*80,profile:['aggressive','defensive','opportunist'][i]}));
function isolated(id){const g=createInvasion(()=>.99);g.start({research:true,technology:id,planetShield:true,naval:false,satellites:false,players});g.state.fighters.forEach(f=>f.next=Infinity);g.state.ship.nextAttack=Infinity;g.state.nextDroneAt=Infinity;return g;}
function ready(g){g.state.tech.phase='ready';g.state.tech.readyAt=g.state.time-15;g.state.tech.progress=g.state.tech.required;}
test('all seven projects spend energy, freeze on pause and reset completely',()=>{
 for(const id of Object.keys(TECHNOLOGIES)){const g=isolated(id);g.state.fighters.forEach(f=>f.energy=20);g.step(1);assert.ok(g.state.tech.progress>0&&g.state.tech.progress<=1.01);assert.ok(g.state.tech.energySpent>0);assert.ok(g.state.fighters.every(f=>f.energy<28));g.pause();const before=structuredClone(g.state);g.step(99);assert.deepEqual(g.state,before);g.reset();assert.equal(g.state.tech.id,id);assert.equal(g.state.tech.used,false);assert.equal(g.state.tech.progress,0);assert.equal(g.state.tech.centers.length,3);}
});
test('funding accelerates research at higher energy cost; lost centers slow it without resetting progress',()=>{
 const eco=isolated('dragon'),priority=isolated('dragon');eco.state.tech.funding='eco';priority.state.tech.funding='priority';eco.step(1);priority.step(1);assert.ok(priority.state.tech.progress>eco.state.tech.progress);assert.ok(priority.state.tech.energySpent>eco.state.tech.energySpent);const progress=priority.state.tech.progress;priority.state.tech.centers.forEach(c=>c.hp=0);priority.step(1);assert.ok(priority.state.tech.progress>progress&&priority.state.tech.progress-progress<.3);
});
test('offensive technologies actually damage the ship and cannot reactivate after completion',()=>{
 for(const id of ['destroyer','dragon','convergence','barrage','sun']){const g=isolated(id);ready(g);g.state.ship.shield=0;g.state.ship.parts.reactor.hp=10000;g.state.ship.parts.reactor.maxHp=10000;g.state.ship.hp=10290;g.state.ship.maxHp=10290;
  let uses=0;for(let i=0;i<1100;i++)for(const e of g.step(.05))if(e.type==='technologyActivated')uses++;assert.equal(uses,1,id);assert.equal(g.state.tech.uses,1);assert.equal(g.state.tech.phase,'spent');assert.ok(g.state.tech.damage>0,id);assert.ok(g.state.ship.hp<10290,id);assert.equal(g.state.tech.projectiles.length,0);
 }
});
test('triple shield absorbs through three finite layers in order without changing the base shield',()=>{
 const g=isolated('triple');ready(g);g.step(.05);const t=g.state.tech;assert.deepEqual(t.layers,[75,75,75]);const events=[];const hit=absorbTechnology(g.state,170,(type,data)=>events.push({type,...data}));assert.equal(hit.absorbed,170);assert.deepEqual(t.layers,[55,0,0]);assert.equal(events.length,2);assert.equal(g.state.planetShield.hp,g.state.planetShield.maxHp);assert.equal(absorbTechnology(g.state,100,()=>{}).remaining,45);g.step(36);assert.equal(t.phase,'spent');assert.equal(t.layers.length,0);
});
test('Destroyer has health and diverts part of an enemy attack until destroyed',()=>{
 const g=createInvasion(()=>0);g.start({research:true,technology:'destroyer',planetShield:false,satellites:false,naval:false,players});g.state.fighters.forEach(f=>f.next=Infinity);g.state.ship.nextAttack=Infinity;g.state.nextDroneAt=Infinity;ready(g);g.step(.05);const hp=g.state.tech.destroyerHp;g.state.ship.phase='ray';g.state.ship.attack={id:1,kind:'ray',to:0,zone:'radar',point:{lat:0,lon:0},start:g.state.time,visibleAt:g.state.time,fireAt:g.state.time+.05,damage:100,announced:true,disruption:0};const events=g.step(.05);assert.ok(events.some(e=>e.type==='destroyerHit'));assert.ok(g.state.tech.destroyerHp<hp);
});
test('rewind restores 30 seconds of actual combat state and preserves single use outside snapshots',()=>{
 const g=isolated('rewind');g.state.tech.progress=0;for(let i=0;i<800;i++)g.step(.05);const before=g.state.time;g.state.fighters[0].hp=0;g.state.fighters[0].eliminatedAt=before;g.state.fighters[0].energy=0;g.state.fighters[0].zones[0].hp=0;g.state.tech.centers[0].hp=0;g.state.ship.parts.weapons.hp=1;g.state.ship.hp=361;g.state.flights.push({id:999,from:0,launched:true,start:before+10,duration:99});ready(g);const events=g.step(.05);assert.ok(events.some(e=>e.type==='technologyRewind'));assert.ok(g.state.time<=before-29.9&&g.state.time>=before-30.6);assert.equal(g.state.fighters[0].hp,100);assert.equal(g.state.fighters[0].zones[0].hp,32);assert.ok(g.state.fighters[0].energy>0);assert.ok(g.state.ship.parts.weapons.hp>1);assert.ok(!g.state.flights.some(f=>f.id===999));assert.equal(g.state.tech.uses,1);assert.equal(g.state.tech.centers[0].hp,36);const restoredTime=g.state.time;g.step(1);assert.equal(g.state.time,restoredTime);assert.equal(g.state.tech.phase,'active');g.step(3);assert.equal(g.state.tech.phase,'spent');assert.ok(g.state.time>restoredTime);for(let i=0;i<100;i++)assert.ok(!g.step(.1).some(e=>e.type==='technologyRewind'));
});
test('world bombardment uses every surviving nation and has concurrent, staggered missiles',()=>{
 const g=isolated('barrage');ready(g);g.step(.05);assert.equal(new Set(g.state.tech.projectiles.map(s=>s.from)).size,3);assert.equal(g.state.tech.projectiles.length,6);g.step(.7);assert.ok(g.state.tech.projectiles.length>=12);assert.ok(new Set(g.state.tech.projectiles.map(s=>s.start)).size>=2);
});
test('research centers can be hit and reduce the project rate',()=>{
 const g=isolated('sun');g.state.planetShield.active=false;g.state.fighters[0].shield=0;g.state.ship.phase='ray';g.state.ship.attack={id:1,kind:'ray',to:0,zone:'research',point:{lat:0,lon:0},start:0,visibleAt:0,fireAt:.05,damage:200,announced:true,disruption:0};const events=g.step(.05);assert.equal(g.state.tech.centers[0].hp,0);assert.ok(events.some(e=>e.type==='researchSabotaged'));g.step(.1);assert.ok(g.state.tech.rate<1);
});
test('seeded projects finish for 3 and 8 allies with bounded resources and at most one activation',()=>{
 for(const n of [3,8])for(const id of Object.keys(TECHNOLOGIES)){let seed=9;const g=createInvasion(()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;});g.start({research:true,technology:id,planetShield:true,satellites:true,naval:false,players:Array.from({length:n},(_,i)=>({id:String(i),lat:-25+i*8,lon:-100+i*35,profile:['aggressive','defensive','opportunist'][i%3]}))});let activations=0,frames=0;while(g.state.status==='running'&&frames++<4500){for(const e of g.step(.1))if(e.type==='technologyActivated')activations++;assert.ok(g.state.fighters.every(f=>f.energy>=-1e-6&&f.energy<=100&&f.hp>=0&&f.hp<=100));assert.ok(g.state.ship.hp>=0);assert.ok(g.state.tech.progress<=g.state.tech.required);}assert.equal(g.state.status,'finished',id+' '+n);assert.ok(activations<=1);assert.equal(g.state.tech.uses,activations);}
});

test('global barrage cycles through all 50 world launch sites while crediting coalition missiles',()=>{
 const g=createInvasion(()=>.99),sites=Array.from({length:50},(_,i)=>({lat:-45+i,lon:-150+i*6}));g.start({research:true,technology:'barrage',satellites:false,naval:false,worldLaunchPoints:sites,players});g.state.fighters.forEach(f=>f.next=Infinity);g.state.ship.nextAttack=Infinity;g.state.nextDroneAt=Infinity;ready(g);const origins=new Set();for(let i=0;i<35;i++){g.step(.1);for(const shot of g.state.tech.projectiles)origins.add(JSON.stringify(shot.sourcePoint));}assert.equal(origins.size,50);assert.ok(g.state.fighters.reduce((n,f)=>n+f.shots,0)>50);
});
