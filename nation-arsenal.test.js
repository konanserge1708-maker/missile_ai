import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from './dist/battle-engine.js';
import {selectSpecial,reflectEnergy,reactiveDamage} from './dist/nation-arsenal.js';
const players=n=>Array.from({length:n},(_,i)=>({id:String(i),lat:10+i*8,lon:i*40,squad:i%2,profile:['aggressive','defensive','opportunist'][i%3]}));
function isolated(mode='duel',n=2){const g=createBattle(()=>.99);g.start({specialArsenal:true,mode,naval:false,satellites:false,players:players(n)});g.state.fighters.forEach(f=>{f.next=Infinity;f.shieldHitAt=0;});return g;}
function shot(g,kind='light',to=1){const f={id:++g.state.sequence,from:0,to,kind,start:g.state.time,duration:2,damage:kind==='disarm'?4:12,launched:true,defenseAt:.72,defenseChecked:false,intercepted:false,targetZone:'silo',targetPoint:g.state.fighters[to].zones[2].point};g.state.flights.push(f);g.state.fighters[to].zones[1].hp=0;return f;}

test('loadouts are validated, limited to two unique weapons and disabled in classic games',()=>{
 const g=createBattle();g.start({specialArsenal:true,players:players(2).map(f=>({...f,specials:['bogus','siphon','siphon','mines','disarm'],shieldStyle:'bad'}))});
 assert.deepEqual(g.state.fighters[0].arsenal.weapons,['siphon','mines']);assert.equal(g.state.fighters[0].arsenal.shield,'reactive');
 g.start({players:players(2)});assert.equal(g.state.specialArsenal,false);assert.ok(g.state.fighters.every(f=>f.arsenal===null));
});
test('disarm applies on impact, reduces duration against a charged shield and stops silo launches',()=>{
 const g=isolated();const target=g.state.fighters[1];target.arsenal.shield='network';const f=shot(g,'disarm');g.step(2);assert.ok(target.arsenal.disabledUntil>g.state.time);assert.ok(target.arsenal.disabledUntil-g.state.time<=1.5+.001);
 const before=g.state.flights.length;target.next=0;g.step(.1);assert.equal(g.state.flights.length,before);assert.match(target.strategy,/Silos neutralisés/);
 const h=isolated();h.state.fighters[1].shield=0;shot(h,'disarm');h.step(2);assert.equal(h.state.fighters[1].arsenal.disabledUntil,7);
 assert.equal(f.kind,'disarm');
});
test('siphon steals shield charge without hurting an unshielded nation; pause freezes channels',()=>{
 const g=isolated(),[source,target]=g.state.fighters;source.shield=5;target.arsenal.shield='network';source.arsenal.siphon={to:1,start:0,until:4};g.step(1);
 assert.ok(Math.abs(source.shield-7.7)<1e-6);assert.equal(target.shield,34);assert.equal(target.hp,100);
 g.pause();const frozen=structuredClone(g.state);g.step(4);assert.deepEqual(g.state,frozen);g.pause();target.shield=0;g.step(1);assert.equal(target.hp,100);assert.equal(source.arsenal.siphon,null);
});
test('five mines intercept missiles once, consume no interceptors and can repel a satellite',()=>{
 const g=isolated(),target=g.state.fighters[1];target.arsenal.mines=5;target.arsenal.minesUntil=16;shot(g);const stock=target.interceptors;g.step(1.7);assert.equal(target.arsenal.mines,4);g.step(.2);assert.equal(target.blocked,1);assert.equal(target.interceptors,stock);assert.equal(target.hp,100);assert.equal(target.arsenal.mineKills,1);
 g.state.orbitalEnabled=true;const s=g.state.satellites[0];Object.assign(s,{target:1,phase:'transit',elapsed:3.99,travel:4,returnTime:10});g.state.satellites[1].phase='offline';const events=g.step(.05);assert.ok(events.some(e=>e.type==='mineSatellite'));assert.equal(target.arsenal.mines,2);assert.equal(s.phase,'return');g.step(20);assert.equal(target.arsenal.mines,0);
});
test('network conserves charge and shares only with living teammates or current truce partners',()=>{
 const g=isolated('teams',4),f=g.state.fighters;f.forEach(x=>x.arsenal.shield='mirror');f[0].arsenal.shield='network';f[2].shield=10;f[1].shield=0;const total=f.reduce((s,x)=>s+x.shield,0);g.step(1);
 assert.equal(f[2].shield,17);assert.equal(f[1].shield,0);assert.equal(f.reduce((s,x)=>s+x.shield,0),total);assert.equal(g.state.arsenalLinks[0].to,2);
 const h=isolated('ffa',3);h.state.fighters.forEach(x=>x.arsenal.shield='mirror');h.state.fighters[0].arsenal.shield='network';h.state.fighters[1].shield=0;h.step(1);assert.equal(h.state.arsenalLinks.length,0);h.state.alliances=[{members:[0,1],until:10}];h.step(1);assert.equal(h.state.arsenalLinks[0].to,1);
});
test('reactive armor strengthens one sector while losing resistance elsewhere',()=>{
 const g=isolated(),f=g.state.fighters[0];f.arsenal.shield='reactive';const east={lat:f.lat,lon:f.lon+10},west={lat:f.lat,lon:f.lon-10};
 assert.equal(reactiveDamage(g.state,0,10,east),10);assert.ok(reactiveDamage(g.state,0,10,east)<10);
 for(let i=0;i<8;i++)reactiveDamage(g.state,0,10,east);assert.equal(Math.max(...f.arsenal.facets),.42);
 const sector=f.arsenal.lastSector;reactiveDamage(g.state,0,10,west);assert.ok(f.arsenal.facets[sector]<.42);assert.ok(f.arsenal.facets.every(n=>n>=0&&n<=.42));
});
test('mirror reflects absorbed laser energy, never loops, overheats and recovers',()=>{
 const g=isolated(),f=g.state.fighters[1];f.arsenal.shield='mirror';const events=[],hits=[];
 reflectEnergy(g.state,0,1,10,'laser',events,(...args)=>hits.push(args));assert.equal(hits[0][2],3.5);assert.equal(hits[0][4],'reflection');
 reflectEnergy(g.state,0,1,10,'reflection',events,()=>assert.fail('reflection loop'));
 reflectEnergy(g.state,0,1,10,'siphon',events,(...args)=>hits.push(args));assert.ok(events.some(e=>e.type==='mirrorOverheat'));const count=hits.length;
 reflectEnergy(g.state,0,1,10,'laser',events,()=>assert.fail('overheated mirror'));assert.equal(hits.length,count);
 g.step(7);reflectEnergy(g.state,0,1,1,'laser',events,(...args)=>hits.push(args));assert.equal(hits.length,count+1);
});
test('AI selects all three specials, spends energy once and respects cooldowns',()=>{
 const g=isolated(),f=g.state.fighters[0],a=f.arsenal;a.ready={disarm:0,siphon:0,mines:0};f.energy=100;a.weapons=['disarm'];const e=[];
 assert.equal(selectSpecial(g.state,0,1,e),'disarm');assert.equal(selectSpecial(g.state,0,1,e),null);
 a.weapons=['siphon'];f.shield=0;assert.equal(selectSpecial(g.state,0,1,e),'action');assert.equal(f.energy,75);
 a.weapons=['mines'];f.profile='defensive';assert.equal(selectSpecial(g.state,0,1,e),'action');assert.equal(f.energy,47);assert.equal(a.mines,5);
});
test('seeded advanced battles finish with bounded resources, no friendly launches, and clean resets',()=>{
 for(const mode of ['duel','ffa','teams'])for(let seed=0;seed<20;seed++){
  let r=seed+1;const g=createBattle(()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296;});g.start({specialArsenal:true,mode,players:players(mode==='duel'?2:6),naval:true,satellites:true});
  for(let k=0;k<4000&&g.state.status==='running';k++){
   for(const e of g.step(.1))if(mode==='teams'&&e.type==='launch')assert.notEqual(g.state.fighters[e.flight.from].squad,g.state.fighters[e.flight.to].squad);
   for(const f of g.state.fighters)assert.ok(f.hp>=0&&f.hp<=100&&f.shield>=-1e-6&&f.shield<=40+1e-6&&f.energy>=0&&f.energy<=100);
  }
  assert.equal(g.state.status,'finished',mode+' '+seed);assert.equal(g.state.arsenalLinks.length,0);assert.ok(g.state.fighters.every(f=>!f.arsenal.siphon&&!f.arsenal.mines));
  g.reset();assert.equal(g.state.time,0);assert.ok(g.state.fighters.every(f=>f.arsenal.heat===0&&f.arsenal.disabledUntil===0));
 }
});
