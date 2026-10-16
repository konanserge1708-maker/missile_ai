import {ORBITAL,orbitBasis} from './orbital.js';
import {NAVAL,createFleet,stepFleet} from './naval.js?v=1.6.0';
export const PROFILES = {
 aggressive:{name:'Agressive',pace:2.4,defense:.2},
 defensive:{name:'Défensive',pace:3.2,defense:.7},
 opportunist:{name:'Opportuniste',pace:2.8,defense:.4}
};
export const WEAPONS = {
 light:{name:'Éclair',cost:22,damage:12,duration:2.7,count:1},
 heavy:{name:'Titan',cost:62,damage:38,duration:5.8,count:1},
 salvo:{name:'Essaim',cost:55,damage:2,duration:4.2,count:20,groupSize:5,groupDelay:.85}
};
export const ZONES={reactor:{name:'Centrale',hp:32},radar:{name:'Radar',hp:28},silo:{name:'Base de missiles',hp:36}};
export const SHIELD = {capacity:40,rechargeDelay:6,rechargePerSecond:2.5};
export const DEFENSE = {capacity:6,reloadSeconds:8,fireCooldown:.45,energyCost:8};
export const isCinematicMissile = f => f.kind==='heavy' && f.damage>=30;
export function createBattle(random=Math.random) {
 let config={players:[{id:'A'},{id:'B'}],mode:'duel'},state;
 function reset(options){
  if(options){if(!Array.isArray(options.players)||options.players.length<2||options.players.length>8)throw Error('Choisir de 2 à 8 nations.');if(new Set(options.players.map(p=>p.id)).size!==options.players.length)throw Error('Les nations doivent être différentes.');config=structuredClone(options);}
  const fighters=config.players.map((p,i)=>({...p,profile:PROFILES[p.profile]?p.profile:['aggressive','defensive','opportunist'][i%3],squad:config.mode==='teams'?(p.squad??i%2):i,hp:100,energy:65,shield:SHIELD.capacity,shieldHitAt:-Infinity,laserDamage:0,laserSeconds:0,laserStrikes:0,jamUntil:0,jamReady:0,decoyUntil:0,decoyReady:0,zones:Object.entries(ZONES).map(([type,zone],j)=>({type,hp:zone.hp,maxHp:zone.hp,point:p.targets?.[Math.floor(j*(p.targets.length/3))]||{lat:p.lat??i*20,lon:p.lon??i*60}})),interceptors:DEFENSE.capacity,reloadAt:null,defenseReady:0,interceptorsFired:0,shots:0,hits:0,blocked:0,damage:0,taken:0,repaired:0,streak:0,bestStreak:0,lastStand:false,strategy:'Analyse du terrain',next:1+i*.45,eliminatedAt:null,used:{light:0,heavy:0,salvo:0}}));
  const satellites=fighters.map((f,i)=>{const origin={lat:f.lat??f.targets?.[0]?.lat??i*20,lon:f.lon??f.targets?.[0]?.lon??i*60};return {owner:i,phase:'idle',origin,destination:{...origin},target:null,elapsed:0,travel:0,returnTime:0,damage:0};});
  state={satellites,orbitalEnabled:config.satellites!==false,navalEnabled:config.naval!==false,fleet:createFleet(fighters),status:'idle',time:0,mode:config.mode||'duel',fighters,flights:[],alliances:[],winner:null,winners:[],sequence:0,decisive:null,nextDiplomacy:8,overtime:false};return state;
 }
 reset();
 const alive=()=>state.fighters.map((f,i)=>f.hp>0?i:-1).filter(i=>i>=0);
 const enemies=(a,b)=>a!==b&&(state.mode!=='teams'||state.fighters[a].squad!==state.fighters[b].squad);
 const pact=(a,b)=>state.alliances.find(p=>p.until>state.time&&p.members.includes(a)&&p.members.includes(b));
 function victory(events){
  const living=alive(),squads=new Set(living.map(i=>state.fighters[i].squad));
  if(living.length>1&&(state.mode!=='teams'||squads.size>1))return false;
  state.status='finished';state.winners=state.mode==='teams'&&living.length?state.fighters.map((f,i)=>f.squad===state.fighters[living[0]].squad?i:-1).filter(i=>i>=0):living;state.winner=living[0]??null;state.flights=[];state.alliances=[];state.satellites.forEach(s=>s.phase='idle');events.push({type:'finish',winner:state.winner,winners:[...state.winners]});return true;
 }
 function decision(from,events){
  const f=state.fighters[from],profile=PROFILES[f.profile];let targets=alive().filter(i=>enemies(from,i));if(!targets.length)return;
  let available=targets.filter(i=>!pact(from,i));
  if(!available.length){for(const p of state.alliances)if(p.members.includes(from))p.until=state.time;available=targets;events.push({type:'betrayal',from,to:targets[0]});}
  if(f.profile==='opportunist'&&f.hp<35&&random()<.25){const ally=targets.find(i=>pact(from,i));if(ally!==undefined){pact(from,ally).until=state.time;available=[ally];events.push({type:'betrayal',from,to:ally});}}
  let to=available[Math.floor(random()*available.length)%available.length];
  if(f.profile==='opportunist')to=available.reduce((best,i)=>(state.fighters[i].hp+state.fighters[i].energy*.3)<(state.fighters[best].hp+state.fighters[best].energy*.3)?i:best,available[0]);
  const target=state.fighters[to];
  const satellite=state.satellites[from];if(state.orbitalEnabled&&satellite.phase==='charging'&&f.energy<40){f.strategy='Économise pour le laser (40 énergie)';return;}
  const threat=state.orbitalEnabled&&state.satellites.some(s=>s.target===from&&(s.phase==='charging'||s.phase==='transit'&&s.travel-s.elapsed<3));
  if(threat&&f.energy>=22&&state.time>=f.jamReady&&f.zones.find(z=>z.type==='radar').hp>0&&random()<(f.profile==='defensive'?.7:.25)){f.energy-=22;f.jamUntil=state.time+7;f.jamReady=state.time+22;f.strategy='Brouille le verrouillage orbital';events.push({type:'jam',from});return;}
  if(threat&&f.energy>=18&&state.time>=f.decoyReady&&random()<(f.profile==='opportunist'?.65:.2)){f.energy-=18;f.decoyUntil=state.time+9;f.decoyReady=state.time+24;f.strategy='Déploie un leurre orbital';events.push({type:'decoy',from});return;}
  if(f.hp<=30&&!f.lastStand){f.lastStand=true;f.energy=Math.min(100,f.energy+35);f.strategy='Dernière offensive';events.push({type:'lastStand',from});}
  const incoming=state.flights.filter(s=>s.to===from&&s.launched).length;
  if(!state.overtime&&f.energy>=28&&f.shield<8&&incoming&&random()<profile.defense){f.energy-=28;f.shield=Math.min(SHIELD.capacity,f.shield+32);f.strategy='Renforce son bouclier';events.push({type:'shield',from});return;}
  if(!state.overtime&&(f.hp<60||f.zones.some(z=>z.hp<z.maxHp*.4))&&f.energy>=35&&random()<(f.profile==='defensive'?.55:.16)){const amount=Math.min(14,100-f.hp);f.energy-=35;f.hp+=amount;f.repaired+=amount;const zone=f.zones.reduce((a,b)=>a.hp/a.maxHp<b.hp/b.maxHp?a:b);zone.hp=Math.min(zone.maxHp,zone.hp+12);f.strategy='Répare ses défenses';events.push({type:'repair',from,amount});return;}
  let kind='light';
  const interceptionRate=target.blocked/Math.max(1,state.fighters.reduce((s,x)=>s+x.shots,0)/(state.fighters.length-1));
  if(f.energy>=WEAPONS.salvo.cost&&(f.doctrine==='salvo'||interceptionRate>.18||target.shield>10||target.interceptors<=2||random()<.3)){kind='salvo';f.strategy='Sature les défenses · Essaim 4 × 5';}
  else if(f.zones.find(z=>z.type==='silo').hp>0&&f.energy>=62&&(f.lastStand||target.energy<32||f.profile==='aggressive'||random()<.45)){kind='heavy';f.strategy='Prépare une frappe Titan';}
  else f.strategy=f.energy<22?'Recharge son énergie':'Harcèlement · Éclair';
  const weapon=WEAPONS[kind];if(f.energy<weapon.cost)return;
  f.energy-=weapon.cost;f.used[kind]++;
  if(f.lastStand&&kind==='heavy')f.hp=Math.max(1,f.hp-5);
  const priority=f.profile==='aggressive'?'silo':f.profile==='defensive'?'radar':'reactor',aim=target.zones.find(z=>z.type===priority&&z.hp>0)||target.zones.find(z=>z.hp>0)||target.zones[0];
  const dispersed=(target.targets||[]).filter(p=>!target.zones.some(z=>z.point.lat===p.lat&&z.point.lon===p.lon));
  const batch=state.sequence+1,targetOffset=Math.floor(random()*100),sourceOffset=Math.floor(random()*100);
  for(let k=0;k<weapon.count;k++){
   const group=kind==='salvo'?Math.floor(k/weapon.groupSize):0;
   const flight={id:++state.sequence,batch,index:k,group,from,to,kind,start:state.time+group*(weapon.groupDelay||0),duration:weapon.duration+random()*.8+(k%5)*.06,damage:Math.max(1,Math.round(weapon.damage*(.9+random()*.2)+(state.overtime?(state.time-75)*.3*(kind==='salvo'?.1:1):0)+(f.lastStand?(kind==='salvo'?.3:3):0))),targetZone:kind==='salvo'?(k<3?target.zones[k].type:null):aim.type,targetPoint:kind==='salvo'?(k<3?target.zones[k].point:dispersed[(targetOffset+k-3)%dispersed.length]??null):aim.point,sourcePoint:f.targets?.[(sourceOffset+k%5)%f.targets.length]??null,bend:kind==='salvo'?(k%5-2)*.085:(random()-.5)*.18,loft:random()*.18+group*.04,launched:group===0,defenseAt:.72,intercepted:false,defenseChecked:false};
   state.flights.push(flight);if(flight.launched){f.shots++;events.push({type:'launch',flight});}
  }
 }
 function applyDamage(from,to,amount,events,kind,zoneType=null){
  const target=state.fighters[to],source=state.fighters[from];const absorbed=Math.min(target.shield,amount);target.shield-=absorbed;target.shieldHitAt=state.time;
  const damage=Math.min(target.hp,amount-absorbed);target.hp=Math.max(0,target.hp-damage);target.taken+=damage;source.damage+=damage;
  const zone=target.zones.find(z=>z.type===zoneType);if(zone&&zone.hp>0&&damage>0){zone.hp=Math.max(0,zone.hp-damage);if(zone.hp===0)events.push({type:'zoneDestroyed',from:to,zone:zone.type});}
  if(!state.decisive||damage>state.decisive.damage)state.decisive={from,to,damage,time:state.time,kind};
  if(target.hp===0&&target.eliminatedAt===null){target.eliminatedAt=state.time;events.push({type:'eliminated',from:to});}
  return {damage,absorbed,hp:target.hp};
 }
 function returnSatellite(sat,events){if(sat.phase==='firing')events.push({type:'laserEnd',from:sat.owner,to:sat.target});sat.phase='return';sat.elapsed=0;}
 function stepSatellites(dt,events){
  if(!state.orbitalEnabled)return;
  for(const sat of state.satellites){
   const owner=state.fighters[sat.owner];if(owner.hp<=0){if(sat.phase==='firing')events.push({type:'laserEnd',from:sat.owner,to:sat.target});sat.phase='offline';continue;}
   let remaining=dt;
   for(let guard=0;guard<5&&remaining>1e-9;guard++){
    if(sat.phase==='idle'){
     const targets=alive().filter(i=>enemies(sat.owner,i)&&!pact(sat.owner,i));if(!targets.length)break;
     const to=targets.reduce((best,i)=>state.fighters[i].hp<state.fighters[best].hp?i:best,targets[sat.owner%targets.length]);
     const target=state.fighters[to];sat.target=to;sat.destination=target.targets?.[(sat.owner*7)%target.targets.length]||{lat:target.lat??to*20,lon:target.lon??to*60};const basis=orbitBasis(sat.origin,sat.destination);
     sat.travel=Math.max(4,basis.angle/ORBITAL.speed);sat.returnTime=Math.max(5,(2*Math.PI-basis.angle)/ORBITAL.speed);sat.elapsed=0;sat.phase='transit';sat.zone=(target.zones.find(z=>z.type==='reactor'&&z.hp>0)||target.zones.find(z=>z.hp>0)||target.zones[0]).type;sat.destination=target.zones.find(z=>z.type===sat.zone).point;const adjusted=orbitBasis(sat.origin,sat.destination);sat.travel=Math.max(4,adjusted.angle/ORBITAL.speed);sat.returnTime=Math.max(5,(2*Math.PI-adjusted.angle)/ORBITAL.speed);events.push({type:'satelliteLaunch',from:sat.owner,to});
    }
    if(sat.phase==='transit'){
     const step=Math.min(remaining,sat.travel-sat.elapsed);sat.elapsed+=step;remaining-=step;
     if(sat.elapsed+1e-9>=sat.travel){if(state.fighters[sat.target].hp<=0||pact(sat.owner,sat.target)){returnSatellite(sat,events);continue;}sat.elapsed=0;sat.phase='charging';}else break;
    }else if(sat.phase==='charging'){
     const target=state.fighters[sat.target];if(target.hp<=0||pact(sat.owner,sat.target)){returnSatellite(sat,events);continue;}
     if(target.jamUntil>state.time||owner.energy<40)break;
     owner.energy-=40;sat.decoy=target.decoyUntil>state.time;sat.elapsed=0;sat.phase='firing';owner.strategy='Laser orbital engagé (40 énergie)';owner.laserStrikes++;events.push({type:'laserStart',from:sat.owner,to:sat.target,decoy:sat.decoy});
    }else if(sat.phase==='firing'){
     if(state.fighters[sat.target].hp<=0||pact(sat.owner,sat.target)){returnSatellite(sat,events);continue;}
     const step=Math.min(remaining,ORBITAL.laserDuration-sat.elapsed);const hit=sat.decoy?{damage:0}:applyDamage(sat.owner,sat.target,ORBITAL.damagePerSecond*step,events,'laser',sat.zone);owner.laserDamage+=hit.damage;owner.laserSeconds+=step;sat.elapsed+=step;sat.damage+=hit.damage;remaining-=step;
     if(sat.elapsed+1e-9>=ORBITAL.laserDuration||state.fighters[sat.target].hp<=0)returnSatellite(sat,events);else break;
    }else if(sat.phase==='return'){
     const step=Math.min(remaining,sat.returnTime-sat.elapsed);sat.elapsed+=step;remaining-=step;if(sat.elapsed+1e-9>=sat.returnTime){sat.phase='idle';sat.elapsed=0;}else break;
    }else break;
   }
  }
 }
 return {
  get state(){return state;},reset,
  start(options){reset(options);state.status='running';},
  pause(){if(state.status==='running')state.status='paused';else if(state.status==='paused')state.status='running';},
  step(dt){
   const events=[];if(state.status!=='running'||!Number.isFinite(dt)||dt<=0)return events;const previousTime=state.time;state.time+=dt;
   if(state.time>=75&&!state.overtime){state.overtime=true;events.push({type:'overtime'});}
   for(const f of state.fighters)if(f.hp>0){f.energy=Math.min(100,f.energy+dt*(state.overtime?11:8)*(f.zones.find(z=>z.type==='reactor').hp>0?1:.5));if(f.shield<SHIELD.capacity){const rechargeTime=Math.max(0,state.time-Math.max(previousTime,f.shieldHitAt+SHIELD.rechargeDelay));const charge=Math.min(SHIELD.capacity-f.shield,rechargeTime*SHIELD.rechargePerSecond*(state.overtime?.3:1),f.energy);f.shield+=charge;f.energy-=charge;}while(f.reloadAt!==null&&state.time>=f.reloadAt){f.interceptors=Math.min(DEFENSE.capacity,f.interceptors+1);f.reloadAt=f.interceptors<DEFENSE.capacity?f.reloadAt+DEFENSE.reloadSeconds:null;events.push({type:'reload',from:state.fighters.indexOf(f)});}}
   for(const p of state.alliances)if(!p.expired&&p.until<=state.time){p.expired=true;events.push({type:'allianceEnd',members:p.members});}
   if(state.mode==='ffa'&&alive().length>2&&state.time>=state.nextDiplomacy){state.nextDiplomacy=state.time+18;const eligible=alive().filter(i=>!state.alliances.some(p=>p.until>state.time&&p.members.includes(i)));if(eligible.length>=2){const a=eligible[Math.floor(random()*eligible.length)%eligible.length],others=eligible.filter(i=>i!==a),b=others[Math.floor(random()*others.length)%others.length];const alliance={members:[a,b],until:state.time+12,expired:false};state.alliances.push(alliance);events.push({type:'alliance',...alliance});}state.alliances=state.alliances.filter(p=>p.until>state.time);}
   for(const flight of [...state.flights]){
    const target=state.fighters[flight.to],source=state.fighters[flight.from];
    if(target.hp<=0||(!flight.launched&&(source.hp<=0||pact(flight.from,flight.to)))){state.flights.splice(state.flights.indexOf(flight),1);events.push({type:'cancel',flight});continue;}
    if(!flight.launched){if(state.time+1e-8<flight.start)continue;flight.launched=true;source.shots++;events.push({type:'launch',flight});}
    const progress=(state.time-flight.start)/flight.duration;
    if(progress>=flight.defenseAt&&!flight.defenseChecked){
     flight.defenseChecked=true;
     const chance=state.overtime?.14:(flight.kind==='salvo'?.45:.6)+(target.profile==='defensive'?.15:0)+(target.shield>0?.1:0);
     if(target.zones.find(z=>z.type==='radar').hp>0&&target.energy>=DEFENSE.energyCost&&target.interceptors>0&&state.time>=target.defenseReady){target.energy-=DEFENSE.energyCost;target.interceptors--;target.interceptorsFired++;target.defenseReady=state.time+DEFENSE.fireCooldown;if(target.reloadAt===null)target.reloadAt=state.time+DEFENSE.reloadSeconds;flight.intercepted=random()<chance;flight.interceptAt=.9;events.push({type:'defend',flight});}
    }
    if(progress<(flight.intercepted?.9:1))continue;
    state.flights.splice(state.flights.indexOf(flight),1);
    if(flight.intercepted){target.blocked++;source.streak=0;events.push({type:'intercept',flight});}
    else{const hit=applyDamage(flight.from,flight.to,flight.damage,events,flight.kind,flight.targetZone);source.hits++;source.streak++;source.bestStreak=Math.max(source.bestStreak,source.streak);events.push({type:'impact',flight,...hit});}

   }
   stepSatellites(dt,events);
   if(victory(events))return events;
   stepFleet(state,(ship,sourcePoint)=>{
    const from=ship.owner,targets=alive().filter(to=>enemies(from,to)&&!pact(from,to));if(!targets.length)return false;
    const to=targets[(ship.owner+ship.shots)%targets.length],target=state.fighters[to],zone=target.zones.find(z=>z.hp>0)||target.zones[0],id=++state.sequence;
    const flight={id,batch:id,index:0,group:0,from,to,kind:'light',naval:true,start:state.time,duration:NAVAL.travel,damage:NAVAL.damage*(state.overtime?1.5:1),sourcePoint,targetPoint:{...zone.point},targetZone:zone.type,bend:.03,loft:.1,launched:true,defenseAt:.72,defenseChecked:false,intercepted:false};
    state.flights.push(flight);state.fighters[from].shots++;events.push({type:'launch',flight});return true;
   });
   for(let from=0;from<state.fighters.length;from++){const f=state.fighters[from];if(f.hp>0&&state.time>=f.next){decision(from,events);f.next=state.time+(PROFILES[f.profile].pace+random()*.9)*(f.zones.find(z=>z.type==='silo').hp>0?1:1.7);}}
   return events;
  }
 };
}
export function createTournament(players){
 if(players.length!==4||new Set(players.map(p=>p.id)).size!==4)throw Error('Le tournoi nécessite quatre nations différentes.');
 const matches=[{label:'Demi-finale 1',players:[players[0],players[1]],winner:null},{label:'Demi-finale 2',players:[players[2],players[3]],winner:null}];let index=0;
 return {matches,get index(){return index;},get current(){return matches[index];},get complete(){return index===3;},get champion(){return matches[2]?.winner??null;},record(winner){const current=matches[index];if(!current||!current.players.some(p=>p.id===winner.id))throw Error('Vainqueur du tournoi invalide.');current.winner=winner;index++;if(index===2)matches.push({label:'Finale',players:[matches[0].winner,matches[1].winner],winner:null});return matches[index]??null;}};
}
