import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBattle} from './dist/battle-engine.js';
import {createInvasion} from './dist/invasion-engine.js';
import {NAVAL,SEA_ROUTES,navalPoint} from './dist/naval.js';
import {inTerritory} from './dist/territory.js';

const players=()=>['FRA','BRA','USA','CHN','ZAF','AUS','IND','CAN'].map((id,i)=>({id,name:id,lat:[48,-15,38,40,-25,-35,28,45][i],lon:[2,-47,-77,116,28,149,77,-75][i],profile:['aggressive','defensive','opportunist'][i%3],squad:i%2}));
function seeded(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

test('all shipping lanes stay at sea for their entire spherical route',async()=>{
 const {features}=JSON.parse(await readFile(new URL('./dist/data/world.geo.json',import.meta.url),'utf8'));
 const bounds=features.map(f=>{const p=f.geometry.coordinates.flat(f.geometry.type==='Polygon'?1:2);return {f,minX:Math.min(...p.map(p=>p[0])),maxX:Math.max(...p.map(p=>p[0])),minY:Math.min(...p.map(p=>p[1])),maxY:Math.max(...p.map(p=>p[1]))};});
 for(let routeIndex=0;routeIndex<SEA_ROUTES.length;routeIndex++)for(let i=0;i<=720;i++){
  const p=navalPoint({routeIndex,waypoint:0,offset:0},i/10);assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  const land=bounds.find(b=>p.lon>=b.minX&&p.lon<=b.maxX&&p.lat>=b.minY&&p.lat<=b.maxY&&inTerritory(p.lon,p.lat,b.f));
  assert.equal(land,undefined,SEA_ROUTES[routeIndex].name+' '+JSON.stringify(p)+' '+land?.f.id);
 }
});

test('fleets fire periodically, respect teams and truce targets, and freeze on pause',()=>{
 for(const mode of ['duel','teams','ffa']){
  const g=createBattle(seeded(3));g.start({mode,players:players().slice(0,mode==='duel'?2:4),naval:true,satellites:false});
  g.state.fighters.forEach(f=>f.next=Infinity);g.state.nextDiplomacy=Infinity;
  if(mode==='ffa')g.state.alliances.push({members:[0,1],until:80});
  const times=new Map();let launches=0;
  while(g.state.time<40&&g.state.status==='running')for(const e of g.step(.1))if(e.type==='launch'&&e.flight.naval){
   const f=e.flight;launches++;assert.notEqual(f.from,f.to);assert.ok(f.sourcePoint&&f.damage>0);
   if(mode==='teams')assert.notEqual(g.state.fighters[f.from].squad,g.state.fighters[f.to].squad);
   if(mode==='ffa')assert.ok(!([0,1].includes(f.from)&&[0,1].includes(f.to)));
   if(times.has(f.from))assert.ok(g.state.time-times.get(f.from)>=NAVAL.cooldown-1e-6);times.set(f.from,g.state.time);
  }
  assert.ok(launches>0);g.pause();const frozen=structuredClone(g.state);assert.deepEqual(g.step(10),[]);assert.deepEqual(g.state,frozen);g.reset();assert.ok(g.state.fleet.every(s=>s.shots===0));
 }
 const off=createBattle();off.start({players:players().slice(0,2),naval:false});off.state.fighters.forEach(f=>f.next=Infinity);
 for(let i=0;i<300;i++)assert.equal(off.step(.1).filter(e=>e.type==='launch'&&e.flight.naval).length,0);
});

test('eight-nation invasion shares radar, scales the boss, and naval missiles target only the mothership',()=>{
 const g=createInvasion(seeded(5));g.start({players:players(),naval:true,satellites:false});
 assert.equal(g.state.fighters.length,8);assert.equal(g.state.fleet.length,8);assert.ok(g.state.ship.maxHp>520);assert.equal(g.state.ship.interruptThreshold,240);
 g.state.fighters.forEach(f=>f.next=Infinity);g.state.ship.nextAttack=Infinity;g.state.nextDroneAt=Infinity;
 const owners=new Set();let impacts=0;
 for(const e of g.step(21)){
  if(e.type==='launch'&&e.flight.naval){assert.equal(e.flight.to,'ship');owners.add(e.flight.from);}
  if(e.type==='shipImpact'&&e.flight.naval)impacts++;
 }
 assert.equal(owners.size,8);assert.ok(impacts>=8);
 g.state.ship.phase='approach';g.state.ship.phaseAt=g.state.time;g.state.ship.travel=0;g.state.ship.target=0;g.state.ship.attackCount=0;
 const warning=g.step(.1).find(e=>e.type==='invasionWarning');assert.equal(warning.attack.targets.length,16);
 assert.equal(new Set(warning.attack.targets.map(t=>t.to)).size,8);
});

test('eight-nation free-for-all and invasion matches finish with valid resources',()=>{
 for(const mode of ['ffa','invasion'])for(let seed=0;seed<12;seed++){
  const g=mode==='ffa'?createBattle(seeded(seed)):createInvasion(seeded(seed));g.start({mode,players:players(),naval:seed%2===0});
  let finishes=0;
  while(g.state.status==='running'&&g.state.time<400){
   for(const e of g.step(.2)){if(e.type==='finish')finishes++;if(e.type==='launch'){if(mode==='invasion')assert.equal(e.flight.to,'ship');else assert.notEqual(e.flight.from,e.flight.to);}}
   for(const f of g.state.fighters)for(const key of ['hp','energy','shield'])assert.ok(Number.isFinite(f[key])&&f[key]>=-1e-6&&f[key]<=100+1e-6);
  }
  assert.equal(g.state.status,'finished',mode+' '+seed);assert.equal(finishes,1);assert.equal(g.state.flights.length,0);
 }
});
