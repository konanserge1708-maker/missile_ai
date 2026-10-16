import {createBattle,PROFILES,WEAPONS,SHIELD,DEFENSE} from './battle-engine.js?v=1.6.0';
import {NAVAL,stepFleet} from './naval.js?v=1.6.0';
import {orbitBasis} from './orbital.js';

export const INVASION={radius:4.8,shield:180,rayCharge:10,interruptDamage:90,laserCost:40,laserDuration:5,droneLimit:10};
export const PLANET_SHIELD={radius:2.25,capacityPerNation:55,rechargeDelay:10,rechargePerSecond:5};
export const SHIP_PARTS={weapons:{name:'Canon',hp:160},engines:{name:'Moteurs',hp:130},reactor:{name:'Réacteur',hp:230}};
export const ALIEN_WEAPONS={bombard:{name:'Bombardement',charge:4,color:0xff5068},ray:{name:'Rayon lourd',charge:10,color:0xff345e},plasma:{name:'Salve plasma',charge:5,color:0xffad52},ion:{name:'Impulsion ionique',charge:6,color:0x78bcff},sweep:{name:'Faisceaux multiples',charge:7,color:0xd58aff}};
ALIEN_WEAPONS.drone={name:'Canons de chasseur',charge:0,color:0xbc9aff};
const attackCycle=['sweep','ray','plasma','ion','bombard','ray'];

// Shared with the renderer: the ship moves along the globe, never through it.
export function mothershipPoint(ship,time){
 let t=ship.phase==='approach'?Math.max(0,Math.min(1,(time-ship.phaseAt)/ship.travel)):1;
 t=t*t*(3-2*t);
 const {a,tangent,angle}=orbitBasis(ship.origin,ship.destination);
 const p=a.map((v,i)=>v*Math.cos(angle*t)+tangent[i]*Math.sin(angle*t));
 let lat=Math.asin(Math.max(-1,Math.min(1,p[1])))*180/Math.PI,lon=Math.atan2(p[0],p[2])*180/Math.PI;
 // Patrol loops return to their anchor before the next phase.
 if(['scanning','cooldown'].includes(ship.phase)&&Number.isFinite(ship.nextAttack)){
  const duration=ship.nextAttack-ship.phaseAt,u=Math.max(0,Math.min(1,(time-ship.phaseAt)/Math.max(.01,duration))),power=ship.parts.engines.hp>0?1:.25;
  lat+=Math.sin(u*Math.PI)**2*5*power;lon+=Math.sin(u*Math.PI*2)*7*power;
 }
 return {lat:Math.max(-89.9,Math.min(89.9,lat)),lon:((lon+540)%360)-180};
}

export function mothershipMotion(ship,time,{reduced=false}={}){
 if(reduced||ship.hp<=0)return {altitude:0,yaw:0,pitch:0,roll:0};
 const power=ship.parts.engines.hp>0?1:.2,cruise=ship.phase==='approach'?1:.45;
 return {altitude:Math.sin(time*.65)*.18*power,yaw:Math.sin(time*.42)*.2*power,pitch:Math.sin(time*.9)*.085*power,roll:Math.sin(time*.7)*.16*cruise*power};
}

export function dronePoint(drone,time){
 const u=Math.max(0,Math.min(1,(time-drone.start)/drone.travel)),t=u*u*(3-2*u),{a,tangent,angle}=orbitBasis(drone.origin,drone.destination);
 const p=a.map((v,i)=>v*Math.cos(angle*t)+tangent[i]*Math.sin(angle*t));
 let lat=Math.asin(Math.max(-1,Math.min(1,p[1])))*180/Math.PI,lon=Math.atan2(p[0],p[2])*180/Math.PI;
 const orbit=Math.max(0,time-drone.start-drone.travel);
 lat+=Math.sin(orbit*1.1)*2;lon+=(1-Math.cos(orbit*.9))*2;
 return {lat:Math.max(-89,Math.min(89,lat)),lon:((lon+540)%360)-180};
}

export function createInvasion(random=Math.random){
 let config={players:[{id:'A'},{id:'B'},{id:'C'}]},state;
 function reset(options){
  const next=options||config;
  if(!Array.isArray(next.players)||next.players.length<3||next.players.length>8||new Set(next.players.map(p=>p.id)).size!==next.players.length)throw Error('L’invasion nécessite de 3 à 8 nations différentes.');
  config=structuredClone(next);
  state=createBattle(random).reset({...config,mode:'teams',players:config.players.map(p=>({...p,squad:0}))});
  state.mode='invasion';state.outcome=null;state.shieldDamage=0;state.interruptions=0;state.drones=[];state.droneShots=[];state.nextDroneAt=7;state.droneSequence=0;
  const capacity=PLANET_SHIELD.capacityPerNation*state.fighters.length;
  state.planetShield={active:config.planetShield===true,hp:capacity,maxHp:capacity,absorbed:0,hitAt:-Infinity};
  const origin={lat:state.fighters[0].lat??30,lon:state.fighters[0].lon??0};
  const coalitionScale=state.fighters.length/3,parts=Object.fromEntries(Object.entries(SHIP_PARTS).map(([key,p])=>[key,{hp:Math.round(p.hp*coalitionScale),maxHp:Math.round(p.hp*coalitionScale)}])),maxHp=Object.values(parts).reduce((n,p)=>n+p.hp,0),shield=Math.round(INVASION.shield*coalitionScale);
  state.ship={hp:maxHp,maxHp,shield,maxShield:shield,interruptThreshold:Math.round(INVASION.interruptDamage*coalitionScale),hitAt:-Infinity,parts,
   phase:'scanning',phaseAt:0,nextAttack:5,attackCount:0,target:null,attack:null,projectiles:[],origin,destination:{...origin},travel:4};
  state.fighters.forEach(f=>{f.shieldDamage=0;f.support=0;f.strategy='Coordination de la coalition';});
  state.satellites.forEach((s,i)=>{s.phase='idle';s.readyAt=8+i*1.2;s.until=0;});
  return state;
 }
 reset();
 const living=()=>state.fighters.map((f,i)=>f.hp>0?i:-1).filter(i=>i>=0);
 const radarOnline=()=>state.fighters.some(f=>f.hp>0&&f.zones.find(z=>z.type==='radar').hp>0);
 const emit=(events,type,data={})=>events.push({type,time:state.time,...data});
 function finish(events){
  if(state.ship.hp>0&&living().length)return false;
  state.outcome=state.ship.hp<=0?'victory':'defeat';state.status='finished';
  state.winners=state.outcome==='victory'?state.fighters.map((_,i)=>i):[];state.winner=state.winners[0]??null;
  state.ship.phase=state.outcome==='victory'?'destroyed':'victorious';state.ship.attack=null;state.ship.projectiles=[];state.flights=[];state.drones=[];state.droneShots=[];
  state.satellites.forEach(s=>{s.phase='idle';s.until=0;});
  emit(events,'finish',{outcome:state.outcome,winners:[...state.winners],winner:state.winner});return true;
 }
 function interrupt(events){
  const ship=state.ship;if(ship.attack?.kind!=='ray')return;
  ship.attack=null;ship.phase='stunned';ship.phaseAt=state.time;ship.nextAttack=state.time+7;state.interruptions++;
  emit(events,'rayInterrupted');
 }
 function hitShip(from,amount,part,events,kind){
  const ship=state.ship,f=state.fighters[from],absorbed=Math.min(ship.shield,amount);
  ship.shield-=absorbed;ship.hitAt=state.time;f.shieldDamage+=absorbed;state.shieldDamage+=absorbed;
  let remaining=Math.min(ship.hp,amount-absorbed),damage=remaining;
  const order=[part,...Object.keys(SHIP_PARTS).filter(p=>p!==part)];
  for(const key of order){const component=ship.parts[key];if(!component)continue;
   const hit=Math.min(component.hp,remaining);component.hp-=hit;remaining-=hit;
   if(key==='weapons'&&ship.attack?.kind==='ray')ship.attack.disruption+=hit;
   if(hit>0&&component.hp===0)emit(events,'partDestroyed',{part:key});
   if(remaining<=0)break;
  }
  ship.hp=Object.values(ship.parts).reduce((sum,p)=>sum+p.hp,0);f.damage+=damage;
  if(ship.attack?.kind==='ray'&&(ship.parts.weapons.hp===0||ship.attack.disruption>=ship.interruptThreshold))interrupt(events);
  const pending=ship.attack;
  if(pending&&((ship.parts.weapons.hp===0&&pending.kind!=='bombard')||(ship.parts.reactor.hp===0&&['ion','sweep'].includes(pending.kind)))){
   ship.attack=null;ship.phase='cooldown';ship.phaseAt=state.time;ship.nextAttack=state.time+5;
   emit(events,'alienAttackCancelled',{kind:pending.kind});
  }
  if(damage>0&&(!state.decisive||damage>state.decisive.damage))state.decisive={from,to:'ship',damage,time:state.time,kind};
  return {damage,absorbed};
 }
 function hitNation(attack,events){
  const f=state.fighters[attack.to];if(f.hp<=0)return;
  let amount=attack.damage;
  const covered=state.planetShield.active&&state.planetShield.hp>=amount;
  if(!covered&&['bombard','plasma'].includes(attack.kind)&&f.zones.find(z=>z.type==='radar').hp>0&&f.interceptors>0&&f.energy>=DEFENSE.energyCost){
   f.interceptors--;f.energy-=DEFENSE.energyCost;f.interceptorsFired++;if(f.reloadAt===null)f.reloadAt=state.time+DEFENSE.reloadSeconds;
   const success=random()<.65;if(success){amount*=.4;f.blocked++;}
   emit(events,'invasionIntercept',{to:attack.to,point:attack.point,success});
  }
  const field=state.planetShield,planetAbsorbed=field.active?Math.min(field.hp,amount):0;
  if(planetAbsorbed>0){
   field.hp=Math.max(0,field.hp-planetAbsorbed);field.absorbed+=planetAbsorbed;field.hitAt=state.time;amount-=planetAbsorbed;
   emit(events,'planetShieldHit',{point:{...attack.point},absorbed:planetAbsorbed,kind:attack.kind});
   if(field.hp===0)emit(events,'planetShieldBroken');
  }
  const planetBlocked=planetAbsorbed>0&&amount<=1e-8;
  const absorbed=Math.min(f.shield,amount);f.shield-=absorbed;if(amount>0)f.shieldHitAt=state.time;
  const damage=Math.min(f.hp,amount-absorbed);f.hp-=damage;f.taken+=damage;
  const energyDrained=attack.kind==='ion'&&!planetBlocked?Math.min(f.energy,30):0;f.energy-=energyDrained;
  const zone=f.zones.find(z=>z.type===attack.zone);
  if(zone&&zone.hp>0&&damage>0){zone.hp=Math.max(0,zone.hp-damage);if(zone.hp===0)emit(events,'zoneDestroyed',{from:attack.to,zone:zone.type});}
  emit(events,'invasionHit',{...attack,damage,absorbed,energyDrained,planetAbsorbed,planetBlocked});
  if(f.hp===0){f.eliminatedAt=state.time;emit(events,'eliminated',{from:attack.to});}
 }
 function resources(dt,previous){
  for(const f of state.fighters){if(f.hp<=0)continue;
   f.energy=Math.min(100,f.energy+dt*8*(f.zones.find(z=>z.type==='reactor').hp>0?1:.5));
   const quiet=Math.max(0,state.time-Math.max(previous,f.shieldHitAt+SHIELD.rechargeDelay));
   const charge=Math.min(SHIELD.capacity-f.shield,quiet*SHIELD.rechargePerSecond,f.energy);f.shield+=charge;f.energy-=charge;
   while(f.reloadAt!==null&&state.time>=f.reloadAt){f.interceptors=Math.min(DEFENSE.capacity,f.interceptors+1);f.reloadAt=f.interceptors<DEFENSE.capacity?f.reloadAt+DEFENSE.reloadSeconds:null;}
  }
  const ship=state.ship;
  if(ship.parts.reactor.hp>0){const quiet=Math.max(0,state.time-Math.max(previous,ship.hitAt+8));ship.shield=Math.min(ship.maxShield,ship.shield+quiet*5);}
  const field=state.planetShield;
  if(field.active&&field.hp<field.maxHp){
   const allies=state.fighters.filter(f=>f.hp>0),energy=allies.reduce((n,f)=>n+f.energy,0),quiet=Math.max(0,state.time-Math.max(previous,field.hitAt+PLANET_SHIELD.rechargeDelay));
   const amount=Math.min(field.maxHp-field.hp,quiet*PLANET_SHIELD.rechargePerSecond,energy);
   if(amount>0){for(const f of allies)f.energy=Math.max(0,f.energy-amount*f.energy/energy);field.hp+=amount;}
  }
 }
 function satellites(dt,events){
  if(!state.orbitalEnabled)return;
  state.satellites.forEach((s,i)=>{const f=state.fighters[i];if(f.hp<=0){s.phase='offline';return;}
   if(s.phase==='firing'){
    const slice=Math.max(0,Math.min(dt,s.until-(state.time-dt)));
    // Ion lasers strip shields; once depleted they heat the reactor at half strength.
    const hit=hitShip(i,(state.ship.shield>0?12:3)*slice,'reactor',events,'laser');
    f.laserSeconds+=slice;f.laserDamage+=hit.damage;s.elapsed+=slice;
    if(state.time>=s.until-1e-8){s.phase='idle';s.readyAt=state.time+13;emit(events,'invasionLaserEnd',{from:i});}
   }else if(state.time>=s.readyAt){
    s.phase='charging';
    if(f.energy>=INVASION.laserCost){f.energy-=INVASION.laserCost;s.phase='firing';s.elapsed=0;s.until=state.time+INVASION.laserDuration;f.laserStrikes++;emit(events,'invasionLaserStart',{from:i});}
   }
  });
 }
 function decision(from,events){
  const f=state.fighters[from],ship=state.ship,a=ship.attack,known=a&&state.time>=a.visibleAt&&state.fighters[a.to].hp>0;
  if(known){
   const threatened=a.targets?.find(t=>t.to===from)||a;
   const target=state.fighters[threatened.to],protect=f.profile==='defensive'||(threatened.to===from&&f.hp<45);
   if(protect&&target.shield<SHIELD.capacity-8&&f.energy>=28){
    const amount=Math.min(32,SHIELD.capacity-target.shield);f.energy-=28;target.shield+=amount;f.support+=amount;
    f.strategy='Renforce le bouclier de '+target.name;emit(events,'support',{from,to:threatened.to,amount});return;
   }
  }
  if(f.profile==='defensive'&&(f.hp<58||f.zones.some(z=>z.hp===0))&&f.energy>=35){
   const amount=Math.min(14,100-f.hp);f.hp+=amount;f.repaired+=amount;f.energy-=35;
   const zone=f.zones.reduce((x,y)=>x.hp/x.maxHp<y.hp/y.maxHp?x:y);zone.hp=Math.min(zone.maxHp,zone.hp+12);
   f.strategy='Répare les défenses de la coalition';emit(events,'repair',{from,amount});return;
  }
  if(state.orbitalEnabled&&state.satellites[from].phase==='charging'&&ship.shield>0){f.strategy='Réserve 40 énergie pour le laser ionique';return;}
  let part=known&&a.kind==='ray'?'weapons':f.profile==='aggressive'?'weapons':f.profile==='opportunist'?'reactor':'engines';
  if(ship.parts[part].hp===0)part=Object.keys(SHIP_PARTS).find(p=>ship.parts[p].hp>0);
  if(!part)return;
  let kind=f.doctrine==='salvo'&&f.energy>=55&&ship.shield>0?'salvo':f.energy>=62&&f.zones.find(z=>z.type==='silo').hp>0?'heavy':'light';
  if(known&&a.kind==='ray'&&a.fireAt-state.time<6)kind='light';
  const weapon=WEAPONS[kind];if(f.energy<weapon.cost){f.strategy='Recharge · cible '+SHIP_PARTS[part].name;return;}
  f.energy-=weapon.cost;f.used[kind]++;f.strategy=(known&&a.kind==='ray'?'Interrompt le rayon · ':'Vise le vaisseau · ')+SHIP_PARTS[part].name;
  const batch=state.sequence+1;
  for(let k=0;k<weapon.count;k++){
   const group=kind==='salvo'?Math.floor(k/5):0;
   const flight={id:++state.sequence,batch,index:k,group,from,to:'ship',invasion:true,kind,targetPart:part,
    sourcePoint:f.targets?.[k%f.targets.length]||{lat:f.lat??0,lon:f.lon??from*40},
    start:state.time+group*.85,duration:kind==='heavy'?4.5:kind==='salvo'?3.1:2.2,
    damage:weapon.damage*(.9+random()*.2),bend:(k%5-2)*.035,launched:group===0};
   state.flights.push(flight);if(flight.launched){f.shots++;emit(events,'launch',{flight});}
  }
 }
 function enemy(events){
  const ship=state.ship;
  if(ship.phase==='approach'&&state.time>=ship.phaseAt+ship.travel){
   const f=state.fighters[ship.target];if(f.hp<=0){ship.phase='cooldown';ship.nextAttack=state.time+1;return;}
   let kind=attackCycle[ship.attackCount%attackCycle.length];ship.attackCount++;
   if(ship.parts.weapons.hp<=0)kind='bombard';
   if(ship.parts.reactor.hp<=0&&['ion','sweep'].includes(kind))kind='plasma';
   const zone=f.zones.find(z=>z.type===ship.attackZone)||f.zones[0];
   const duration=ALIEN_WEAPONS[kind].charge,radar=radarOnline();
   ship.phase=kind;ship.phaseAt=state.time;
   ship.attack={id:ship.attackCount,kind,to:ship.target,zone:zone.type,point:{...zone.point},start:state.time,fireAt:state.time+duration,
    visibleAt:state.time+(radar?0:duration-(kind==='ray'?3:1.5)),announced:false,disruption:0,
    damage:(kind==='ray'?100:kind==='plasma'?14:kind==='ion'?22:kind==='sweep'?13.5:ship.parts.weapons.hp>0?42:26)*(1+state.time/200)};
   const a=ship.attack;
   a.targets=kind==='sweep'?living().flatMap(to=>{const zones=state.fighters[to].zones.filter(z=>z.hp>0);return (zones.length?zones:state.fighters[to].zones).slice(0,2).map(z=>({to,zone:z.type,point:{...z.point}}));}):
    kind==='plasma'?Array.from({length:4},(_,i)=>{const z=f.zones[i%f.zones.length];return {to:ship.target,zone:z.type,point:{...z.point}};}):[{to:a.to,zone:a.zone,point:{...a.point}}];
  }
  const attack=ship.attack;
  if(attack){
   if(state.fighters[attack.to].hp<=0){ship.attack=null;ship.phase='cooldown';ship.nextAttack=state.time+2;return;}
   if(!attack.announced&&state.time>=attack.visibleAt){attack.announced=true;emit(events,'invasionWarning',{attack:{...attack},radar:radarOnline()});}
   if(state.time+1e-8>=attack.fireAt){
    emit(events,'invasionFire',{attack:structuredClone(attack),origin:{...mothershipPoint(ship,state.time)},motion:mothershipMotion(ship,state.time)});
    (attack.targets||[{to:attack.to,zone:attack.zone,point:attack.point}]).forEach((target,i)=>{
     const shot={...attack,...target,targets:undefined};
     if(attack.kind==='plasma')ship.projectiles.push({...shot,id:attack.id+'-'+i,start:state.time+i*.24,duration:1.8+i*.12,impactAt:state.time+1.8+i*.36,port:i%2?'plasmaRight':'plasmaLeft',launched:i===0,origin:{...mothershipPoint(ship,state.time)},motion:mothershipMotion(ship,state.time)});
     else hitNation(shot,events);
    });
    ship.attack=null;ship.phase='cooldown';ship.phaseAt=state.time;ship.nextAttack=state.time+(ship.parts.engines.hp>0?5:9);
   }
  }else if(ship.phase!=='approach'&&state.time>=ship.nextAttack){
   const alive=living();if(!alive.length)return;
   // Alternates concentrated strikes and pursuit of the most damaged nation.
   const to=ship.attackCount%2===0?alive[ship.attackCount%alive.length]:alive.reduce((a,b)=>state.fighters[a].hp<state.fighters[b].hp?a:b);
   ship.origin=mothershipPoint(ship,state.time);const f=state.fighters[to],zone=f.zones.filter(z=>z.hp>0).sort((a,b)=>a.hp-b.hp)[0]||f.zones[0];ship.destination={...zone.point};ship.attackZone=zone.type;
   ship.target=to;ship.phase='approach';ship.phaseAt=state.time;ship.travel=ship.parts.engines.hp>0?4:7;
  }
 }
 function drones(events){
  const alive=living();if(!alive.length||state.ship.hp<=0)return;
  if(state.drones.length<INVASION.droneLimit&&state.time>=state.nextDroneAt){
   const id=++state.droneSequence,to=alive[(id-1)%alive.length],origin=mothershipPoint(state.ship,state.time);
   const drone={id,hp:24,maxHp:24,to,origin,destination:{lat:state.fighters[to].lat??0,lon:state.fighters[to].lon??0},spawnMotion:mothershipMotion(state.ship,state.time),start:state.time,travel:6,phase:'travel',nextShot:state.time+6,defenseAt:state.time+8,relocateAt:state.time+15};
   state.drones.push(drone);state.nextDroneAt=state.time+(id<INVASION.droneLimit?2:24);emit(events,'droneLaunch',{id,to});
  }
  for(const shot of [...state.droneShots])if(state.time+1e-8>=shot.impactAt){state.droneShots.splice(state.droneShots.indexOf(shot),1);hitNation(shot,events);}
  for(const drone of [...state.drones]){
   const f=state.fighters[drone.to];
   if(f.hp<=0||state.time>=drone.relocateAt){
    const candidates=alive.filter(i=>i!==drone.to),to=candidates.length?candidates[(drone.id+Math.floor(state.time/15))%candidates.length]:alive[0];
    drone.origin=dronePoint(drone,state.time);drone.to=to;drone.destination={lat:state.fighters[to].lat??0,lon:state.fighters[to].lon??0};drone.start=state.time;drone.travel=4;drone.phase='travel';drone.nextShot=state.time+4;drone.defenseAt=state.time+6;drone.relocateAt=state.time+13;drone.relocated=true;continue;
   }
   if(state.time<drone.start+drone.travel)continue;drone.phase='strafe';
   if(state.time>=drone.defenseAt){
    drone.defenseAt=state.time+7;
    if(f.zones.find(z=>z.type==='radar').hp>0&&f.interceptors>0&&f.energy>=DEFENSE.energyCost){
     f.interceptors--;f.energy-=DEFENSE.energyCost;f.interceptorsFired++;if(f.reloadAt===null)f.reloadAt=state.time+DEFENSE.reloadSeconds;
     drone.hp=Math.max(0,drone.hp-12);emit(events,'droneDefended',{id:drone.id,to:drone.to,point:dronePoint(drone,state.time),destroyed:drone.hp===0});
     if(drone.hp===0){f.blocked++;state.drones.splice(state.drones.indexOf(drone),1);continue;}
    }
   }
   if(state.time>=drone.nextShot){
    const zones=f.zones.filter(z=>z.hp>0),zone=(zones.length?zones:f.zones)[(drone.id+Math.floor(state.time))%(zones.length||f.zones.length)];
    const shot={id:++state.sequence,droneId:drone.id,kind:'drone',to:drone.to,zone:zone.type,point:{...zone.point},origin:dronePoint(drone,state.time),start:state.time,impactAt:state.time+.5,damage:1.8*(1+state.time/200)};
    state.droneShots.push(shot);drone.nextShot=state.time+.55;
   }
  }
 }
 function advance(dt,events){
  const previous=state.time;state.time+=dt;if(finish(events))return;
  resources(dt,previous);satellites(dt,events);drones(events);
  for(const shot of [...state.ship.projectiles]){
   if(!shot.launched&&state.time+1e-8>=shot.start){shot.launched=true;shot.origin={...mothershipPoint(state.ship,state.time)};shot.motion=mothershipMotion(state.ship,state.time);}
   if(state.time+1e-8>=shot.impactAt){state.ship.projectiles.splice(state.ship.projectiles.indexOf(shot),1);hitNation(shot,events);}
  }
  for(const flight of [...state.flights]){
   const f=state.fighters[flight.from];
   if(!flight.launched&&f.hp<=0){state.flights.splice(state.flights.indexOf(flight),1);emit(events,'cancel',{flight});continue;}
   if(!flight.launched&&state.time+1e-8>=flight.start){flight.launched=true;f.shots++;emit(events,'launch',{flight});}
   if(flight.launched&&state.time+1e-8>=flight.start+flight.duration){
    const hit=hitShip(flight.from,flight.damage,flight.targetPart,events,flight.kind);f.hits++;f.streak++;f.bestStreak=Math.max(f.bestStreak,f.streak);
    state.flights.splice(state.flights.indexOf(flight),1);emit(events,'shipImpact',{flight,...hit});
   }
  }
  if(finish(events))return;enemy(events);if(finish(events))return;
  stepFleet(state,(ship,sourcePoint)=>{
   const from=ship.owner,preferred=['engines','reactor','weapons'][from%3],targetPart=state.ship.parts[preferred].hp>0?preferred:Object.keys(SHIP_PARTS).find(p=>state.ship.parts[p].hp>0);if(!targetPart)return false;
   const id=++state.sequence,flight={id,batch:id,index:0,group:0,from,to:'ship',kind:'light',invasion:true,naval:true,targetPart,sourcePoint,start:state.time,duration:NAVAL.travel,damage:NAVAL.damage*.5,bend:.025,launched:true};
   state.flights.push(flight);state.fighters[from].shots++;emit(events,'launch',{flight});return true;
  });
  state.fighters.forEach((f,i)=>{if(f.hp>0&&state.time>=f.next){decision(i,events);f.next=state.time+(PROFILES[f.profile].pace+random()*.4)*(f.zones.find(z=>z.type==='silo').hp>0?1:1.7);}});
 }
 return {get state(){return state;},reset,start(options){reset(options);state.status='running';},
  togglePlanetShield(){if(!['running','paused'].includes(state.status))return false;state.planetShield.active=!state.planetShield.active;return state.planetShield.active;},
  pause(){if(state.status==='running')state.status='paused';else if(state.status==='paused')state.status='running';},
  step(dt){const events=[];if(state.status!=='running'||!Number.isFinite(dt)||dt<=0)return events;
   // Fixed upper step keeps warnings, interrupts and laser durations reliable at ×4.
   let remaining=dt;while(remaining>1e-8&&state.status==='running'){const slice=Math.min(.05,remaining);advance(slice,events);remaining-=slice;}return events;
  }};
}
