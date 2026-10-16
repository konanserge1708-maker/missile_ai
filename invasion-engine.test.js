import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInvasion,INVASION,mothershipPoint,mothershipMotion,dronePoint,ALIEN_WEAPONS} from './dist/invasion-engine.js';

const players=()=>['FRA','BRA','USA'].map((id,i)=>({id,name:id,lat:[48,-15,38][i],lon:[2,-47,-77][i],profile:['aggressive','defensive','opportunist'][i],doctrine:'salvo'}));
function isolated(){const g=createInvasion(()=>.99);g.start({players:players(),satellites:false,naval:false});g.state.fighters.forEach(f=>f.next=Infinity);g.state.ship.nextAttack=Infinity;return g;}
function ray(g){const s=g.state;Object.assign(s.ship,{phase:'ray',phaseAt:s.time,attack:{id:1,kind:'ray',to:0,zone:'radar',point:{lat:48,lon:2},start:s.time,fireAt:s.time+10,visibleAt:s.time,announced:false,disruption:0,damage:100}});}
function missile(g,damage,part='weapons'){g.state.ship.hitAt=g.state.time;g.state.flights.push({id:++g.state.sequence,from:0,to:'ship',invasion:true,kind:'light',targetPart:part,start:g.state.time-4,duration:2,damage,launched:true});}

test('invasion requires three distinct allies and resets every invasion resource',()=>{
 const g=createInvasion();assert.throws(()=>g.start({players:players().slice(0,2)}));assert.throws(()=>g.start({players:[...players().slice(0,2),players()[0]]}));
 g.start({players:players()});g.step(25);g.pause();const frozen=structuredClone(g.state);assert.deepEqual(g.step(10),[]);assert.deepEqual(g.state,frozen);g.pause();g.step(.1);assert.ok(g.state.time>frozen.time);
 g.reset();assert.equal(g.state.status,'idle');assert.equal(g.state.ship.hp,520);assert.equal(g.state.ship.shield,180);assert.equal(g.state.ship.attack,null);assert.equal(g.state.interruptions,0);assert.equal(g.state.time,0);assert.deepEqual(g.state.flights,[]);assert.ok(g.state.fighters.every(f=>f.hp===100&&f.support===0&&f.shieldDamage===0));
});
test('ray charges ten simulation seconds, pauses, and hits exactly once',()=>{
 const g=isolated();ray(g);let events=g.step(9.8);assert.equal(events.filter(e=>e.type==='invasionFire').length,0);assert.equal(g.state.fighters[0].hp,100);
 g.pause();g.step(100);assert.ok(Math.abs(g.state.time-9.8)<1e-7);g.pause();events=g.step(.2);assert.equal(events.filter(e=>e.type==='invasionFire').length,1);assert.equal(g.state.fighters[0].hp,40);assert.equal(g.state.fighters[0].shield,0);assert.equal(g.step(.4).filter(e=>e.type==='invasionFire').length,0);
});
test('shield blocks disruption; a few hits cannot interrupt but 90 real cannon damage can',()=>{
 const g=isolated();ray(g);missile(g,34);let e=g.step(.05);assert.equal(g.state.ship.parts.weapons.hp,160);assert.equal(g.state.ship.attack.disruption,0);assert.equal(e.find(x=>x.type==='shipImpact').absorbed,34);
 g.state.ship.shield=0;missile(g,34);e=g.step(.05);assert.equal(e.some(x=>x.type==='rayInterrupted'),false);assert.equal(g.state.ship.attack.disruption,34);
 missile(g,INVASION.interruptDamage-34);e=g.step(.05);assert.ok(e.some(x=>x.type==='rayInterrupted'));assert.equal(g.state.ship.attack,null);assert.equal(g.state.interruptions,1);assert.equal(g.state.fighters[0].damage,INVASION.interruptDamage);assert.equal(g.state.ship.parts.weapons.hp,160-INVASION.interruptDamage);
 g.state.ship.nextAttack=Infinity;assert.equal(g.step(15).filter(x=>x.type==='invasionFire').length,0);assert.equal(g.state.fighters[0].hp,100);
});
test('destroyed ship systems have permanent tactical consequences',()=>{
 const g=isolated();g.state.ship.shield=0;missile(g,230,'reactor');let e=g.step(.05);assert.ok(e.some(x=>x.type==='partDestroyed'&&x.part==='reactor'));g.step(12);assert.equal(g.state.ship.shield,0);
 missile(g,160,'weapons');missile(g,130,'engines');e=g.step(.05);assert.equal(g.state.ship.hp,0);assert.equal(g.state.outcome,'victory');assert.equal(e.filter(x=>x.type==='finish').length,1);
 const h=isolated();h.state.ship.shield=0;missile(h,130,'engines');missile(h,160,'weapons');h.step(.05);h.state.ship.nextAttack=0;h.state.ship.attackCount=1;h.step(.1);assert.equal(h.state.ship.travel,7);h.step(7.1);assert.equal(h.state.ship.attack.kind,'bombard');
});
test('satellite laser spends shared energy, strips shields and stops after five seconds',()=>{
 const g=isolated();g.state.orbitalEnabled=true;g.state.satellites.forEach(s=>s.readyAt=Infinity);const sat=g.state.satellites[0];sat.readyAt=0;g.state.fighters[0].energy=39;g.step(.05);assert.equal(sat.phase,'charging');g.step(.1);assert.equal(sat.phase,'firing');assert.ok(g.state.fighters[0].energy<1);
 const before=g.state.ship.shield;g.step(5);assert.equal(sat.phase,'idle');assert.ok(Math.abs(before-g.state.ship.shield-60)<1e-6);assert.ok(Math.abs(g.state.fighters[0].laserSeconds-5)<1e-6);assert.equal(g.state.fighters[0].laserDamage,0);
 const shield=g.state.ship.shield;g.step(1);assert.equal(g.state.ship.shield,shield);
});
test('shared radar gives early warnings; no radars means late detection without changing charge time',()=>{
 for(const online of [true,false]){const g=isolated();if(!online)g.state.fighters.forEach(f=>f.zones.find(z=>z.type==='radar').hp=0);
  Object.assign(g.state.ship,{phase:'approach',phaseAt:0,travel:0,target:0,attackCount:1});let e=g.step(.05);const a=g.state.ship.attack;assert.equal(a.fireAt-a.start,10);
  assert.equal(e.some(x=>x.type==='invasionWarning'),online);assert.equal(a.visibleAt-a.start,online?0:7);
  if(!online){assert.equal(g.step(6.9).some(x=>x.type==='invasionWarning'),false);assert.ok(g.step(.2).some(x=>x.type==='invasionWarning'));}
 }
});
test('defensive ally protects the announced target while offensive ally targets the cannon',()=>{
 const g=isolated();ray(g);g.state.fighters[0].shield=0;g.state.fighters.forEach(f=>f.energy=100);g.state.fighters[1].next=0;
 let e=g.step(.05);assert.ok(e.some(x=>x.type==='support'&&x.from===1&&x.to===0));assert.equal(g.state.fighters[1].support,32);assert.equal(g.state.fighters[1].energy,72);
 g.state.fighters[0].next=0;e=g.step(.05);assert.ok(e.some(x=>x.type==='launch'&&x.flight.to==='ship'&&x.flight.targetPart==='weapons'));
});
test('victory belongs to all allies; defeat requires elimination of the last nation',()=>{
 const g=isolated();g.state.fighters[0].hp=0;assert.equal(g.step(.1).some(e=>e.type==='finish'),false);g.state.fighters[1].hp=0;assert.equal(g.step(.1).some(e=>e.type==='finish'),false);g.state.fighters[2].hp=0;assert.equal(g.step(.1).filter(e=>e.type==='finish').length,1);assert.equal(g.state.outcome,'defeat');assert.deepEqual(g.state.winners,[]);assert.deepEqual(g.step(100),[]);
 const h=isolated();h.state.fighters[2].hp=0;h.state.ship.shield=0;missile(h,520);assert.equal(h.step(.05).filter(e=>e.type==='finish').length,1);assert.deepEqual(h.state.winners,[0,1,2]);assert.deepEqual(h.state.flights,[]);assert.equal(h.state.ship.attack,null);
});

function arm(g,kind){
 Object.assign(g.state.ship,{phase:'approach',phaseAt:g.state.time,travel:0,target:0,attackCount:['sweep','ray','plasma','ion','bombard','ray'].indexOf(kind)});
 return g.step(.05);
}

test('standard coalition allows real heavy-ray shots while retaining successful interruptions',()=>{
 let fired=0,interrupted=0;
 const roster=()=>players().map((p,i)=>({...p,lat:[48.8566,-15.794,38.907][i],lon:[2.3522,-47.883,-77.037][i]}));
 for(let seed=0;seed<40;seed++){
  let value=seed;const g=createInvasion(()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;});g.start({players:roster(),satellites:true,naval:false});
  let didFire=false;
  while(g.state.status==='running'&&g.state.time<200)for(const e of g.step(.1)){
   if(e.type==='invasionFire'&&e.attack.kind==='ray')didFire=true;
   if(e.type==='rayInterrupted')interrupted++;
  }
  assert.equal(g.state.status,'finished');if(didFire)fired++;
 }
 assert.ok(fired>=20,'a majority of standard matches must actually fire the heavy ray');
 assert.ok(interrupted>0,'concentrated attacks must still be able to interrupt');
});

test('plasma warns before four delayed, interceptable impacts; pause and reset clear pending shots',()=>{
 const g=isolated();let e=arm(g,'plasma');const attack=g.state.ship.attack;
 assert.equal(attack.kind,'plasma');assert.equal(attack.fireAt-attack.start,ALIEN_WEAPONS.plasma.charge);
 assert.equal(attack.targets.length,4);assert.ok(new Set(attack.targets.map(t=>t.zone)).size>1);
 assert.ok(e.some(e=>e.type==='invasionWarning'));assert.equal(g.state.ship.projectiles.length,0);
 e=g.step(5);assert.equal(e.filter(e=>e.type==='invasionFire').length,1);assert.equal(e.filter(e=>e.type==='invasionHit').length,0);assert.equal(g.state.ship.projectiles.length,4);
 g.pause();const frozen=structuredClone(g.state);assert.deepEqual(g.step(20),[]);assert.deepEqual(g.state,frozen);g.pause();
 e=g.step(3);assert.equal(e.filter(e=>e.type==='invasionHit').length,4);assert.equal(e.filter(e=>e.type==='invasionIntercept').length,4);assert.equal(g.state.ship.projectiles.length,0);
 arm(g,'plasma');g.step(5);assert.equal(g.state.ship.projectiles.length,4);g.reset();assert.deepEqual(g.state.ship.projectiles,[]);
});

test('ion impulse removes energy through shields and multifire hits each living nation once',()=>{
 const g=isolated();arm(g,'ion');assert.equal(g.state.ship.attack.kind,'ion');
 g.state.fighters[0].energy=100;let e=g.step(6);const hit=e.find(e=>e.type==='invasionHit');
 assert.equal(hit.kind,'ion');assert.equal(hit.energyDrained,30);assert.equal(hit.damage,0);assert.ok(hit.absorbed>0);assert.ok(g.state.fighters[0].energy<=70.00001);
 const h=isolated();h.state.fighters[2].hp=0;arm(h,'sweep');assert.equal(h.state.ship.attack.kind,'sweep');assert.deepEqual(h.state.ship.attack.targets.map(t=>t.to),[0,0,1,1]);
 e=h.step(7);const hits=e.filter(e=>e.type==='invasionHit');assert.deepEqual(hits.map(e=>e.to),[0,0,1,1]);assert.equal(new Set(hits.map(e=>e.time)).size,1);assert.equal(new Set(hits.map(e=>e.to+'-'+e.zone)).size,4);assert.equal(h.step(.5).filter(e=>e.type==='invasionHit').length,0);
});

test('destroying the reactor cancels ion charge and destroying weapons cancels plasma charge',()=>{
 for(const [kind,part,damage] of [['ion','reactor',230],['plasma','weapons',160]]){
  const g=isolated();arm(g,kind);g.state.ship.shield=0;missile(g,damage,part);
  const e=g.step(.05);assert.ok(e.some(e=>e.type==='alienAttackCancelled'));assert.equal(g.state.ship.attack,null);
  g.state.ship.nextAttack=Infinity;assert.equal(g.step(12).filter(e=>e.type==='invasionFire').length,0);
 }
});

test('patrol returns continuously to its anchor and damaged engines reduce animated motion',()=>{
 const g=isolated(),s=g.state.ship;Object.assign(s,{phase:'cooldown',phaseAt:0,nextAttack:8});
 const start=mothershipPoint(s,0),middle=mothershipPoint(s,2),end=mothershipPoint(s,8);
 assert.ok(Math.abs(middle.lon-start.lon)>1);assert.deepEqual(start,end);
 Object.assign(s,{origin:end,destination:{lat:-20,lon:70},phase:'approach',phaseAt:8,travel:4});
 assert.deepEqual(mothershipPoint(s,8),end);
 const before=mothershipPoint(s,12);s.phase='ray';assert.deepEqual(mothershipPoint(s,12),before);
 const full=mothershipMotion(s,2);s.parts.engines.hp=0;const damaged=mothershipMotion(s,2);
 assert.ok(Math.abs(damaged.altitude)<Math.abs(full.altitude));assert.ok(Math.abs(damaged.yaw)<Math.abs(full.yaw));
 assert.deepEqual(mothershipMotion(s,2,{reduced:true}),{altitude:0,yaw:0,pitch:0,roll:0});
});

test('ten independent fighters deploy progressively, shoot repeatedly, pause and change regions',()=>{
 const g=isolated();g.state.fighters.forEach(f=>{f.interceptors=0;f.reloadAt=null;});
 g.step(11.2);assert.equal(g.state.drones.length,3);assert.deepEqual(g.state.drones.map(d=>d.to),[0,1,2]);
 const before=dronePoint(g.state.drones[1],g.state.time);g.step(.5);assert.notDeepEqual(dronePoint(g.state.drones[1],g.state.time),before);
 const events=g.step(8),hits=events.filter(e=>e.type==='invasionHit'&&e.kind==='drone');
 assert.ok(hits.length>=12);assert.deepEqual([...new Set(hits.map(h=>h.to))].sort(),[0,1,2]);assert.ok(g.state.droneShots.length<=6);
 g.pause();const snapshot=structuredClone(g.state);assert.deepEqual(g.step(20),[]);assert.deepEqual(g.state,snapshot);g.pause();
 g.step(5);assert.ok(g.state.drones.some(d=>d.relocated));assert.notEqual(g.state.drones[0].to,0);g.step(.7);assert.equal(g.state.drones.length,10);assert.equal(g.state.drones.length,INVASION.droneLimit);
 g.reset();assert.deepEqual(g.state.drones,[]);assert.deepEqual(g.state.droneShots,[]);assert.equal(g.state.nextDroneAt,7);
});

test('radar and interceptors can shoot down fighters; victory removes deployed fighters and shots',()=>{
 const g=isolated();g.step(18.1);const first=g.state.drones[0];first.defenseAt=g.state.time;first.hp=12;
 const f=g.state.fighters[first.to];f.energy=100;f.interceptors=6;const events=g.step(.05);
 assert.ok(events.some(e=>e.type==='droneDefended'&&e.destroyed&&e.id===first.id));assert.ok(!g.state.drones.includes(first));
 g.state.ship.shield=0;missile(g,520);g.step(.05);assert.equal(g.state.outcome,'victory');assert.deepEqual(g.state.drones,[]);assert.deepEqual(g.state.droneShots,[]);
});
test('120 seeded invasions finish with finite resources, no friendly fire and valid ship motion',()=>{
 const seen=new Set();for(let seed=0;seed<120;seed++){
  let value=seed;const g=createInvasion(()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;});const p=players();if(seed%3===0)p.forEach(f=>f.profile='defensive');if(seed%3===1)p.forEach(f=>f.profile='aggressive');
  g.start({players:p,satellites:seed%2===0});let finished=0;
  while(g.state.time<400&&g.state.status==='running'){
   for(const e of g.step(.2)){seen.add(e.type);if(e.type==='finish')finished++;if(e.type==='launch')assert.equal(e.flight.to,'ship');}
   for(const f of g.state.fighters)for(const [key,max] of [['hp',100],['shield',40],['energy',100],['interceptors',6]])assert.ok(Number.isFinite(f[key])&&f[key]>=-1e-6&&f[key]<=max+1e-6,key);
   const s=g.state.ship;assert.ok(s.hp>=0&&s.hp<=520&&s.shield>=0&&s.shield<=INVASION.shield);assert.ok(Math.abs(s.hp-Object.values(s.parts).reduce((n,p)=>n+p.hp,0))<1e-6);
   const point=mothershipPoint(s,g.state.time);assert.ok(Number.isFinite(point.lat)&&Number.isFinite(point.lon));
  }
  assert.equal(g.state.status,'finished','seed '+seed);assert.equal(finished,1);assert.equal(g.state.flights.length,0);
 }
 for(const type of ['invasionWarning','invasionFire','invasionHit','shipImpact','invasionLaserStart','rayInterrupted','support','partDestroyed'])assert.ok(seen.has(type),type);
});
