import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,createTournament,isCinematicMissile,DEFENSE,SHIELD} from './dist/battle-engine.js';
function seeded(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
const players=n=>Array.from({length:n},(_,i)=>({id:String(i),profile:['aggressive','defensive','opportunist'][i%3],squad:i%2}));
test('300 matches finish in duel, free-for-all and teams with valid resources',()=>{
 for(const mode of ['duel','ffa','teams'])for(let seed=0;seed<100;seed++){
  const game=createBattle(seeded(seed));game.start({mode,players:players(mode==='duel'?2:6).map(p=>({...p,doctrine:seed%2?'salvo':'balanced'}))});let results=0;
  for(let i=0;i<4000&&game.state.status==='running';i++){
   const events=game.step(.1);results+=events.filter(e=>e.type==='finish').length;
   assert.ok(game.state.fighters.every(f=>f.hp>=0&&f.hp<=100&&f.energy>=0&&f.energy<=100&&f.shield>=0&&f.interceptors>=0&&f.interceptors<=DEFENSE.capacity));
   if(mode==='teams')for(const e of events.filter(e=>e.type==='launch'))assert.notEqual(game.state.fighters[e.flight.from].squad,game.state.fighters[e.flight.to].squad);
  }
  assert.equal(game.state.status,'finished',mode+' '+seed);assert.equal(results,1);assert.equal(game.state.flights.length,0);assert.ok(game.state.time<400);assert.deepEqual(game.step(100),[]);
 }
});
test('pause, resume and restart reset every state component',()=>{
 const g=createBattle(seeded(4));g.start({mode:'ffa',players:players(4)});g.step(2);g.pause();const before=structuredClone(g.state);assert.deepEqual(g.step(30),[]);assert.deepEqual(g.state,before);g.pause();g.step(1);assert.ok(g.state.time>before.time);g.reset();assert.equal(g.state.status,'idle');assert.ok(g.state.fighters.every(f=>f.hp===100&&f.energy===65&&f.shots===0));assert.equal(g.state.alliances.length,0);g.start();assert.equal(g.state.status,'running');assert.equal(g.state.time,0);
});
test('cinematic camera accepts heavy high-damage missiles exclusively',()=>{
 assert.equal(isCinematicMissile({kind:'light',damage:90}),false);assert.equal(isCinematicMissile({kind:'salvo',damage:60}),false);assert.equal(isCinematicMissile({kind:'heavy',damage:29}),false);assert.equal(isCinematicMissile({kind:'heavy',damage:38}),true);
});
test('defenses, repairs, three weapons, adaptation, alliances and last stands occur',()=>{
 const types=new Set(),weapons=new Set(),strategies=new Set();
 for(let seed=0;seed<25;seed++){
  const g=createBattle(seeded(seed));g.start({mode:'ffa',players:players(6)});
  for(let i=0;i<2500&&g.state.status==='running';i++){
   for(const e of g.step(.1)){types.add(e.type);if(e.type==='launch'){weapons.add(e.flight.kind);const p=g.state.alliances.find(p=>p.until>g.state.time&&p.members.includes(e.flight.from)&&p.members.includes(e.flight.to));assert.equal(p,undefined,'Do not target an active ally');}}
   g.state.fighters.forEach(f=>strategies.add(f.strategy));
  }
 }
 for(const t of ['shield','repair','defend','intercept','impact','alliance','allianceEnd','lastStand','eliminated'])assert.ok(types.has(t),t);
 assert.deepEqual([...weapons].sort(),['heavy','light','salvo']);assert.ok(strategies.has('Sature les défenses · Essaim 4 × 5'));
});
test('a shield absorbs damage and interception consumes energy, damage is applied once',()=>{
 const g=createBattle(()=>.99);g.start({players:players(2),mode:'duel'});g.step(1);const flight=g.state.flights[0];g.state.fighters[1].shield=32;g.state.fighters[1].next=100;g.state.fighters[0].next=100;
 const first=g.step(flight.duration+.1).find(e=>e.type==='impact');assert.ok(first);assert.ok(first.absorbed>0);assert.equal(g.state.fighters[1].hp,100-first.damage);const hp=g.state.fighters[1].hp;g.step(1);assert.equal(g.state.fighters[1].hp,hp);
});
test('tournament advances two semifinals then final and rejects invalid winners',()=>{
 const p=players(4),t=createTournament(p);assert.equal(t.current.label,'Demi-finale 1');assert.throws(()=>t.record({id:'unknown'}));t.record(p[1]);assert.equal(t.current.label,'Demi-finale 2');t.record(p[2]);assert.deepEqual(t.current.players.map(p=>p.id),['1','2']);t.record(p[2]);assert.equal(t.complete,true);assert.equal(t.champion.id,'2');assert.equal(t.matches.length,3);
});
test('duplicate nations and unsupported roster sizes are rejected',()=>{
 const g=createBattle();assert.throws(()=>g.start({players:[{id:'A'},{id:'A'}]}));assert.throws(()=>g.start({players:players(7)}));
});

test('salvo schedules twenty unique targets and launches four simultaneous groups of five',()=>{
 const points=Array.from({length:48},(_,i)=>({lat:i,lon:i+.5}));
 const g=createBattle(()=>0);g.start({mode:'duel',players:players(2).map(p=>({...p,targets:points}))});
 const events=[...g.step(1)];g.state.fighters.forEach(f=>f.next=Infinity);
 const salvo=g.state.flights.filter(f=>f.from===0);assert.equal(salvo.length,20);assert.equal(salvo.filter(f=>f.launched).length,5);assert.equal(new Set(salvo.map(f=>JSON.stringify(f.targetPoint))).size,20);
 for(let i=0;i<3;i++)events.push(...g.step(.85));
 const launches=events.filter(e=>e.type==='launch'&&e.flight.from===0);assert.equal(launches.length,20);assert.equal(g.state.fighters[0].shots,20);
 for(let group=0;group<4;group++){const wave=launches.filter(e=>e.flight.group===group);assert.equal(wave.length,5);assert.equal(new Set(wave.map(e=>e.flight.start)).size,1);assert.equal(new Set(wave.map(e=>e.flight.bend)).size,5);}
 assert.equal(new Set(salvo.map(f=>f.start)).size,4);
});
test('interceptors have a finite magazine, firing cooldown, timed reload and pause',()=>{
 const g=createBattle(()=>0);g.start({mode:'duel',players:players(2)});g.state.fighters.forEach(f=>f.next=Infinity);const target=g.state.fighters[1];target.energy=100;
 let id=0;
 function incoming(){g.state.flights.push({id:++id,from:0,to:1,kind:'light',start:g.state.time-3,duration:4,damage:1,launched:true,defenseAt:.72,defenseChecked:false,intercepted:false});}
 incoming();incoming();const first=g.step(.01);assert.equal(first.filter(e=>e.type==='defend').length,1);assert.equal(target.interceptors,5);
 for(let i=0;i<5;i++){g.step(.5);incoming();assert.equal(g.step(.01).filter(e=>e.type==='defend').length,1);}
 assert.equal(target.interceptors,0);g.step(.5);incoming();assert.equal(g.step(.01).filter(e=>e.type==='defend').length,0);
 const reloadAt=target.reloadAt;g.pause();g.step(50);assert.equal(target.reloadAt,reloadAt);assert.equal(target.interceptors,0);g.pause();g.step(reloadAt-g.state.time+.001);assert.equal(target.interceptors,1);
 g.reset();assert.equal(g.state.fighters[1].interceptors,DEFENSE.capacity);assert.equal(g.state.fighters[1].reloadAt,null);
});
test('unlaunched waves are cancelled when their launching nation is eliminated',()=>{
 const g=createBattle(()=>0);g.start({mode:'duel',players:players(3)});g.step(1);g.state.fighters.forEach(f=>f.next=Infinity);g.state.fighters[0].hp=0;const events=g.step(1);assert.ok(events.some(e=>e.type==='cancel'&&e.flight.from===0));assert.ok(!g.state.flights.some(f=>f.from===0&&!f.launched));
});
test('distributed impact points remain within the target country including islands and holes',async()=>{
 const {readFile}=await import('node:fs/promises');const {territoryTargets,inTerritory}=await import('./dist/territory.js');const world=JSON.parse(await readFile(new URL('./dist/data/world.geo.json',import.meta.url)));
 for(const id of ['FRA','BRA','USA','CHN','RUS','JPN','NZL','NOR','CHE','IDN']){const feature=world.features.find(f=>f.id===id),points=territoryTargets(feature);assert.equal(points.length,48);assert.equal(new Set(points.map(p=>JSON.stringify(p))).size,48);assert.ok(points.every(p=>inTerritory(p.lon,p.lat,feature)),id);}
 const donut={geometry:{type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]}};assert.equal(inTerritory(5,5,donut),false);assert.ok(territoryTargets(donut).every(p=>inTerritory(p.lon,p.lat,donut)));
});

test('territorial shield starts full, absorbs hits and recharges after six quiet seconds',()=>{
 const g=createBattle(()=>.99);g.start({mode:'duel',satellites:false,players:players(2)});g.state.fighters.forEach(f=>f.next=Infinity);const target=g.state.fighters[1];assert.equal(target.shield,SHIELD.capacity);
 g.state.flights.push({id:1,from:0,to:1,kind:'light',start:-5,duration:4,damage:18,launched:true,defenseAt:.72,defenseChecked:true,intercepted:false});g.step(.1);assert.equal(target.hp,100);assert.equal(target.shield,22);g.step(5.9);assert.equal(target.shield,22);g.step(1.1);assert.ok(Math.abs(target.shield-24.5)<1e-8);g.step(30);assert.equal(target.shield,SHIELD.capacity);g.reset();assert.equal(g.state.fighters[1].shield,SHIELD.capacity);
});
test('orbital laser deals gradual damage for exactly five seconds and freezes on pause',()=>{
 for(const dt of [.05,.2]){const g=createBattle(()=>.99);g.start({mode:'duel',players:players(2)});g.state.fighters.forEach(f=>f.next=Infinity);const target=g.state.fighters[1];target.shield=0;target.shieldHitAt=0;g.state.satellites[1].phase='offline';const sat=g.state.satellites[0];sat.phase='firing';sat.target=1;sat.elapsed=0;g.step(dt);assert.ok(target.hp<100&&target.hp>99);g.pause();const frozen=structuredClone(g.state);g.step(20);assert.deepEqual(g.state,frozen);g.pause();for(let t=dt;t<5-1e-8;t+=dt)g.step(dt);assert.ok(Math.abs(target.hp-80)<1e-7);assert.ok(Math.abs(g.state.fighters[0].laserSeconds-5)<1e-7);assert.equal(sat.phase,'return');const hp=target.hp;g.step(.2);assert.equal(target.hp,hp);}
});
test('satellites orbit above the globe and do not fire at teammates or active allies',async()=>{
 const {orbitalPosition,ORBITAL,unitAt}=await import('./dist/orbital.js');const g=createBattle(()=>.99);g.start({mode:'teams',players:players(4)});g.state.fighters.forEach(f=>f.next=Infinity);const starts=[];
 for(let k=0;k<300;k++){for(const e of g.step(.1))if(e.type==='laserStart'){starts.push(e);assert.notEqual(g.state.fighters[e.from].squad,g.state.fighters[e.to].squad);}for(const sat of g.state.satellites)assert.ok(Math.abs(Math.hypot(...orbitalPosition(sat))-ORBITAL.radius)<1e-7);}
 assert.ok(starts.length);const sat=g.state.satellites[0];sat.phase='firing';sat.elapsed=0;const pos=orbitalPosition(sat),target=unitAt(sat.destination);assert.ok(pos.every((v,i)=>Math.abs(v/ORBITAL.radius-target[i])<1e-7));
 const duel=createBattle();duel.start({mode:'ffa',players:players(3)});duel.state.fighters.forEach(f=>f.next=Infinity);duel.state.satellites.forEach(s=>s.phase='offline');duel.state.satellites[0].phase='firing';duel.state.satellites[0].target=1;duel.state.satellites[0].returnTime=8;duel.state.alliances=[{members:[0,1],until:20}];const shield=duel.state.fighters[1].shield;duel.step(.1);assert.equal(duel.state.fighters[1].shield,shield);assert.equal(duel.state.satellites[0].phase,'return');
});
test('country shield shell is raised, follows polygon holes and curves over large countries',async()=>{
 const {territoryShell,SHIELD_RADIUS}=await import('./dist/shield-geometry.js');const {readFile}=await import('node:fs/promises');const world=JSON.parse(await readFile(new URL('./dist/data/world.geo.json',import.meta.url)));
 for(const id of ['FRA','USA','RUS','JPN']){const mesh=territoryShell(world.features.find(f=>f.id===id));assert.ok(mesh.top.length>0&&mesh.border.length>0&&mesh.walls.length>0);for(let i=0;i<mesh.top.length;i+=3)assert.ok(Math.abs(Math.hypot(...mesh.top.slice(i,i+3))-SHIELD_RADIUS)<1e-6);assert.ok(SHIELD_RADIUS>2.15);}
 const donut={geometry:{type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]}};const mesh=territoryShell(donut);for(let i=0;i<mesh.top.length;i+=9){const p=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++)p[k]+=mesh.top[i+j*3+k]/3;const lon=Math.atan2(p[0],p[2])*180/Math.PI,lat=Math.asin(p[1]/Math.hypot(...p))*180/Math.PI;assert.ok(!(lon>4&&lon<6&&lat>4&&lat<6),'Shield must leave the hole open');}
});

test('strategic zones disable energy production, interception radar and heavy missiles',()=>{
 const g=createBattle(()=>.99);g.start({mode:'duel',satellites:false,players:players(2)});g.state.fighters.forEach(f=>f.next=Infinity);const target=g.state.fighters[1];target.shield=0;target.shieldHitAt=0;
 g.state.flights.push({id:1,from:0,to:1,kind:'heavy',targetZone:'radar',start:-10,duration:4,damage:30,launched:true,defenseAt:.72,defenseChecked:true});const events=g.step(.1);assert.equal(target.zones.find(z=>z.type==='radar').hp,0);assert.ok(events.some(e=>e.type==='zoneDestroyed'&&e.zone==='radar'));
 target.energy=100;g.state.flights.push({id:2,from:0,to:1,kind:'light',start:g.state.time-3,duration:4,damage:1,launched:true,defenseAt:.72,defenseChecked:false});assert.equal(g.step(.1).filter(e=>e.type==='defend').length,0);
 target.zones.find(z=>z.type==='reactor').hp=0;target.energy=10;g.step(1);assert.equal(target.energy,14);
 const launcher=g.state.fighters[0];launcher.zones.find(z=>z.type==='silo').hp=0;launcher.energy=100;launcher.next=g.state.time;const shots=g.step(.1).filter(e=>e.type==='launch');assert.ok(shots.length);assert.ok(shots.every(e=>e.flight.kind!=='heavy'));assert.ok(launcher.next-g.state.time>=2.4*1.7);
});
test('laser waits for 40 shared energy; decoys waste the beam without damage',()=>{
 const g=createBattle(()=>.99);g.start({mode:'duel',players:players(2)});g.state.fighters.forEach(f=>f.next=Infinity);g.state.satellites[1].phase='offline';const sat=g.state.satellites[0],f=g.state.fighters[0],target=g.state.fighters[1];sat.phase='charging';sat.target=1;sat.returnTime=10;f.energy=39;g.step(.01);assert.equal(sat.phase,'charging');const events=g.step(.2);assert.equal(sat.phase,'firing');assert.ok(events.some(e=>e.type==='laserStart'));assert.ok(f.energy<2);
 g.reset();g.start();g.state.fighters.forEach(f=>f.next=Infinity);g.state.satellites[1].phase='offline';const decoySat=g.state.satellites[0],decoyTarget=g.state.fighters[1];decoySat.phase='charging';decoySat.target=1;decoySat.returnTime=10;g.state.fighters[0].energy=100;decoyTarget.decoyUntil=20;g.step(.1);assert.equal(decoySat.decoy,true);for(let i=0;i<50;i++)g.step(.1);assert.equal(decoyTarget.hp,100);assert.equal(decoyTarget.shield,40);assert.equal(g.state.fighters[0].laserDamage,0);
});
test('AI countermeasures cost energy, have cooldowns and block new laser locks',()=>{
 for(const [profile,random,type,cost] of [['defensive',()=>0,'jam',22],['opportunist',()=>.5,'decoy',18]]){
  const g=createBattle(random);g.start({mode:'duel',players:[{id:'A'},{id:'B',profile}]});g.state.fighters[0].next=Infinity;g.state.fighters[0].energy=0;g.state.fighters[1].next=1;g.state.fighters[1].energy=100;g.state.satellites[1].phase='offline';Object.assign(g.state.satellites[0],{phase:'charging',target:1,returnTime:10});const events=g.step(1);assert.ok(events.some(e=>e.type===type));assert.equal(g.state.fighters[1].energy,100-cost);assert.ok(g.state.fighters[1][type+'Ready']>g.state.time);if(type==='jam'){g.state.fighters.forEach(f=>f.next=Infinity);g.state.fighters[0].energy=100;g.step(.1);assert.equal(g.state.satellites[0].phase,'charging');}
 }
});
test('shield recharge spends the shared energy pool and repairs restore a damaged zone',()=>{
 const g=createBattle(()=>.5);g.start({mode:'duel',satellites:false,players:players(2)});g.state.fighters.forEach(f=>f.next=Infinity);const f=g.state.fighters[1];f.energy=10;f.shield=20;f.shieldHitAt=-10;g.step(1);assert.equal(f.shield,22.5);assert.equal(f.energy,15.5);
 f.shield=40;f.energy=100;f.zones[0].hp=0;f.next=g.state.time;const events=g.step(.1);assert.ok(events.some(e=>e.type==='repair'));assert.equal(f.zones[0].hp,12);
});
