import * as THREE from 'three';
import {INVASION,PLANET_SHIELD,ALIEN_WEAPONS,mothershipPoint,mothershipMotion,dronePoint} from './invasion-engine.js?v=1.8.0';
import {createPlanetShield} from './planet-shield.js?v=1.8.0';
import {createAlienArc} from './alien-beams.js?v=1.5.0';
import {createWhaleMothership} from './whale-mothership.js?v=1.4.1';
import {aimMothership} from './mothership-frame.js?v=1.4.1';

export function createInvasionVisuals({scene,camera,spherical,glowTexture}){
 const root=new THREE.Group(),ship=new THREE.Group(),satellites=[],texture=glowTexture();root.add(ship);scene.add(root);root.visible=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,whale=createWhaleMothership(texture,{reduced});ship.add(whale.model);
 const planetShield=createPlanetShield({radius:PLANET_SHIELD.radius,reduced});root.add(planetShield.model);
 const solid=(geometry,color)=>new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color}));
 const ambient=new THREE.HemisphereLight(0xc8e5ff,0x464266,2);root.add(ambient);
 const lightTarget=new THREE.Object3D(),key=new THREE.DirectionalLight(0xf4fbff,3),rim=new THREE.DirectionalLight(0x9382ff,2);
 key.position.set(-4,6,7);rim.position.set(3,2,-6);key.target=lightTarget;rim.target=lightTarget;ship.add(lightTarget,key,rim);
 const targets=Array.from({length:16},()=>{
  const group=new THREE.Group();root.add(group);group.visible=false;
  const area=new THREE.Mesh(new THREE.CircleGeometry(.19,40),new THREE.MeshBasicMaterial({color:0xff314f,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));
  const ring=new THREE.Mesh(new THREE.RingGeometry(.19,.205,48),new THREE.MeshBasicMaterial({color:0xff5068,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));group.add(area,ring);return {group,area,ring};
 });
 function beam(color,radius){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,1,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));mesh.visible=false;root.add(mesh);return mesh;}
 const rays=Array.from({length:3},()=>beam(0xff385d,.035)),warnings=targets.map(()=>beam(0xff6484,.003));
 const arcs=Array.from({length:16},()=>createAlienArc(root));
 const droneModels=Array.from({length:INVASION.droneLimit},()=>{
  const group=new THREE.Group();root.add(group);group.visible=false;
  group.add(solid(new THREE.SphereGeometry(.09,12,8),0x716a9f));
  for(const sign of [-1,1]){const wing=solid(new THREE.ConeGeometry(.12,.28,3),0x9f8fd0);wing.rotation.z=sign*Math.PI/2;wing.position.set(sign*.14,0,0);wing.scale.z=.25;group.add(wing);}
  const eye=solid(new THREE.SphereGeometry(.035,8,6),0xe7bbff);eye.position.z=.1;group.add(eye);return group;
 });
 const droneBolts=Array.from({length:24},()=>{
  const dot=solid(new THREE.SphereGeometry(.023,8,6),0xe9bdff);root.add(dot);dot.visible=false;return {dot,trail:beam(0xc188ff,.008)};
 });
 // Several concentric, additive volumes give the heavy ray a bright core and
 // a broad soft envelope without a fullscreen flash or postprocessing pass.
 const heavyRay=new THREE.Group();root.add(heavyRay);heavyRay.visible=false;
 const heavyLayers=[[.075,0xfff5e5,.98],[.16,0xff839e,.7],[.25,0xff315f,.24],[.36,0xff315f,.07]].map(([radius,color,opacity])=>{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,1,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));heavyRay.add(m);return {mesh:m,opacity};
 });
 function flare(color){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));root.add(s);s.visible=false;return s;}
 const muzzleFlash=flare(0xffced9),impactGlow=flare(0xff537a);
 const impactRing=new THREE.Mesh(new THREE.RingGeometry(.19,.24,64),new THREE.MeshBasicMaterial({color:0xff769a,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));root.add(impactRing);impactRing.visible=false;
 const plasma=Array.from({length:4},()=>{
  const group=new THREE.Group();root.add(group);group.visible=false;
  group.add(solid(new THREE.SphereGeometry(.045,12,8),0xffd192));
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0xff8d32,blending:THREE.AdditiveBlending,depthWrite:false}));glow.scale.setScalar(.23);group.add(glow);
  return {group,trail:beam(0xffa34b,.009)};
 });
 function connect(mesh,a,b){const d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());mesh.scale.y=d.length();}
 for(let i=0;i<8;i++){
  const model=new THREE.Group(),body=solid(new THREE.BoxGeometry(.06,.06,.09),0xe7edff);model.add(body);
  for(const sign of [-1,1]){const panel=solid(new THREE.BoxGeometry(.13,.008,.11),0x5394c8);panel.position.x=sign*.11;model.add(panel);}
  root.add(model);satellites.push({model,beam:beam(0x77f4ff,.007)});
 }
 const label=document.createElement('div');label.className='mothership-label';label.hidden=true;document.getElementById('globe').append(label);
 let fire=null,recovery=null,lastRay=null;
 const smooth=t=>{const x=THREE.MathUtils.clamp(t,0,1);return x*x*(3-2*x);};
 function impactRadius(target){return fire?.blockedTargets.get(target.to+':'+target.zone)||2.045;}
 function clear(){planetShield.clear();fire=null;recovery=null;lastRay=null;heavyRay.visible=muzzleFlash.visible=impactGlow.visible=impactRing.visible=false;arcs.forEach(a=>a.group.visible=false);droneModels.forEach(d=>d.visible=false);droneBolts.forEach(b=>{b.dot.visible=b.trail.visible=false;});rays.forEach(r=>r.visible=false);targets.forEach(t=>t.group.visible=false);warnings.forEach(w=>w.visible=false);plasma.forEach(p=>{p.group.visible=false;p.trail.visible=false;});label.hidden=true;}
 function event(e){
 planetShield.event(e);
 if(e.type==='invasionHit'&&fire&&e.id===fire.id&&e.planetBlocked)fire.blockedTargets.set(e.to+':'+e.zone,e.techRadius||PLANET_SHIELD.radius);
 if(['rayInterrupted','alienAttackCancelled'].includes(e.type)&&lastRay){recovery={point:lastRay.point,start:e.time,weight:smooth((e.time-lastRay.visibleAt)/2.8)};lastRay=null;}
 if(e.type==='invasionFire'){
  const ports=e.attack.kind==='ion'?['reactor']:e.attack.kind==='sweep'?['plasmaLeft','reactor','plasmaRight']:['weapons'];
  const frame=pose({point:e.origin,motion:reduced?{altitude:0,yaw:0,pitch:0,roll:0}:e.motion});
  fire={...e.attack,at:e.time,blockedTargets:new Map(),sources:ports.map(port=>whale.anchors[port].clone().applyQuaternion(frame.quaternion).add(frame.center))};
  if(e.attack.kind==='ray'){lastRay=null;recovery=null;}
 }}
 function pose(state){
  const p=state.point||mothershipPoint(state.ship,state.time),motion=state.motion||mothershipMotion(state.ship,state.time,{reduced}),normal=spherical(p.lat,p.lon,1),east=new THREE.Vector3(Math.cos(p.lon*Math.PI/180),0,-Math.sin(p.lon*Math.PI/180)),south=new THREE.Vector3().crossVectors(east,normal);
  const quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east,normal,south));
  quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(motion.roll,motion.yaw,motion.pitch)));
  let center=normal.clone().multiplyScalar(INVASION.radius+motion.altitude);
  if(state.ship){
   let target=null,weight=0;const attack=state.ship.attack;
   if(attack?.kind==='ray'&&state.time>=attack.visibleAt){target=attack.point;weight=reduced?1:smooth((state.time-attack.visibleAt)/2.8);}
   else if(fire?.kind==='ray'&&state.time>=fire.at&&state.time-fire.at<5.6){target=fire.point;weight=reduced?(state.time-fire.at<2.6?1:0):1-smooth((state.time-fire.at-2.6)/3);}
   else if(recovery&&state.time>=recovery.start){target=recovery.point;weight=reduced?0:recovery.weight*(1-smooth((state.time-recovery.start)/2.4));}
   if(target&&weight>0){const aimed=aimMothership(center,quaternion,spherical(target.lat,target.lon,2.04),weight);center=aimed.center;quaternion.copy(aimed.quaternion);}
  }
  return {center,normal,east,south,quaternion};
 }
 function position(state,part){const frame=pose(state);return part&&whale.anchors[part]?whale.anchors[part].clone().applyQuaternion(frame.quaternion).add(frame.center):frame.center;}
 function framing(state){
  const frame=pose(state);
  const axes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(v=>v.applyQuaternion(frame.quaternion));
  const far=frame.center.length()+Math.abs(axes[0].dot(frame.normal))*3.65+Math.abs(axes[1].dot(frame.normal))*1.35+Math.abs(axes[2].dot(frame.normal))*2.15;
  const target=frame.normal.clone().multiplyScalar((far-2.18)/2);
  const direction=frame.normal.clone().multiplyScalar(.48).addScaledVector(frame.south,.86).addScaledVector(frame.east,.16).normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction);
  if(right.length()<.01)right.copy(frame.east);right.normalize();
  const up=new THREE.Vector3().crossVectors(direction,right).normalize();
  const tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanX=tanY*camera.aspect;
  let distance=9;
  // Fit corners of both the globe and whale, leaving room for the HUD label.
  for(const kind of ['earth','whale'])for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
   const p=kind==='earth'?new THREE.Vector3(x*2.18,y*2.18,z*2.18):new THREE.Vector3(x*3.65,y*1.35,z*2.15).applyQuaternion(frame.quaternion).add(frame.center);
   const offset=p.sub(target),depth=offset.dot(direction);
   distance=Math.max(distance,depth+Math.abs(offset.dot(right))/tanX*1.15,depth+Math.abs(offset.dot(up))/tanY*1.18);
  }
  return {target,position:target.clone().addScaledVector(direction,distance)};
 }
 function update(state,colors){
  const enabled=state.mode==='invasion';root.visible=enabled;if(!enabled){label.hidden=true;return;}
  const s=state.ship,frame=pose(state),p=frame.center;ship.position.copy(p);ship.quaternion.copy(frame.quaternion);planetShield.update(state);
  ship.visible=s.hp>0;whale.update(state.time,s);
  const a=s.attack,announced=a&&state.time>=a.visibleAt&&state.status!=='finished';
  if(a?.kind==='ray')lastRay={point:{...a.point},visibleAt:a.visibleAt};
  const aimed=announced?(a.targets||[a]):[];
  targets.forEach((v,i)=>{
   const t=aimed[i],w=warnings[i];v.group.visible=w.visible=Boolean(t);
   if(!t)return;const end=spherical(t.point.lat,t.point.lon,2.045),color=ALIEN_WEAPONS[a.kind].color;
   v.group.position.copy(end);v.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),end.clone().normalize());
   v.ring.scale.setScalar(reduced?1:1+.08*Math.sin(state.time*4));v.ring.material.color.setHex(color);v.area.material.color.setHex(color);
   v.area.material.opacity=.12+.12*(1-(a.fireAt-state.time)/ALIEN_WEAPONS[a.kind].charge);w.material.color.setHex(color);
   connect(w,position(state,a.kind==='ion'?'reactor':['plasma','sweep'].includes(a.kind)?(i%2?'plasmaRight':'plasmaLeft'):'weapons'),end);
  });
  rays.forEach((ray,i)=>{
   const t=fire&&(fire.targets||[fire])[i];ray.visible=Boolean(t&&!['plasma','ray','sweep'].includes(fire.kind)&&state.time-fire.at<1.1&&state.status!=='idle');
   if(ray.visible){connect(ray,fire.sources[i%fire.sources.length],spherical(t.point.lat,t.point.lon,impactRadius(t)));ray.material.color.setHex(ALIEN_WEAPONS[fire.kind].color);ray.material.opacity=Math.max(0,1-(state.time-fire.at)/1.1);}
  });
  const sweepAge=fire?.kind==='sweep'?state.time-fire.at:Infinity;
  arcs.forEach((arc,i)=>{
   const t=fire?.targets?.[i];arc.group.visible=Boolean(t&&sweepAge>=0&&sweepAge<3.2&&s.hp>0&&state.status!=='idle');
   if(arc.group.visible){const ports=['plasmaLeft','reactor','plasmaRight'];arc.update(position(state,ports[i%3]),spherical(t.point.lat,t.point.lon,Math.max(2.065,impactRadius(t))),i,Math.max(.35,Math.min(1,sweepAge/.1))*Math.min(1,(3.2-sweepAge)/.5));}
  });
  droneModels.forEach((group,i)=>{
   const drone=state.drones[i];group.visible=Boolean(drone);if(!drone)return;
   const point=dronePoint(drone,state.time),u=THREE.MathUtils.clamp((state.time-drone.start)/drone.travel,0,1),end=spherical(point.lat,point.lon,3.08);
   if(!drone.relocated&&u<1){const spawn=pose({point:drone.origin,motion:drone.spawnMotion}),offset=new THREE.Vector3(1.3,-.4,(drone.id%2?1:-1)*.35).applyQuaternion(spawn.quaternion);group.position.copy(spherical(point.lat,point.lon,THREE.MathUtils.lerp(spawn.center.length(),3.08,u*u*(3-2*u)))).addScaledVector(offset,1-u);}
   else group.position.copy(end);
   const next=dronePoint(drone,state.time+.15);group.lookAt(spherical(next.lat,next.lon,3.08));
  });
  droneBolts.forEach((v,i)=>{
   const shot=state.droneShots[i];v.dot.visible=v.trail.visible=Boolean(shot);if(!shot)return;
   const start=spherical(shot.origin.lat,shot.origin.lon,3.08),end=spherical(shot.point.lat,shot.point.lon,state.planetShield.active&&state.planetShield.hp>0?PLANET_SHIELD.radius:2.05),u=THREE.MathUtils.clamp((state.time-shot.start)/(shot.impactAt-shot.start),0,1);
   v.dot.position.copy(start).lerp(end,u);connect(v.trail,start.clone().lerp(end,Math.max(0,u-.3)),v.dot.position);
  });
  const rayAge=fire?.kind==='ray'?state.time-fire.at:Infinity;
  heavyRay.visible=muzzleFlash.visible=impactGlow.visible=impactRing.visible=Boolean(rayAge>=0&&rayAge<2.6&&s.hp>0&&state.status!=='idle');
  if(heavyRay.visible){
   const start=position(state,'weapons'),end=spherical(fire.point.lat,fire.point.lon,impactRadius(fire)),fade=Math.max(.35,Math.min(1,rayAge/.12))*Math.min(1,(2.6-rayAge)/.45),pulse=reduced?1:1+.035*Math.sin(rayAge*18);
   connect(heavyRay,start,end);heavyRay.scale.x=heavyRay.scale.z=pulse;
   for(const layer of heavyLayers)layer.mesh.material.opacity=layer.opacity*fade;
   muzzleFlash.position.copy(start);muzzleFlash.scale.setScalar(1.1);muzzleFlash.material.opacity=fade;
   impactGlow.position.copy(end);impactGlow.scale.setScalar(1.7);impactGlow.material.opacity=.85*fade;
   impactRing.position.copy(end);impactRing.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),end.clone().normalize());impactRing.scale.setScalar(reduced?1:1+rayAge*.7);impactRing.material.opacity=.7*fade;
  }
  plasma.forEach((v,i)=>{
   const shot=s.projectiles[i];v.group.visible=v.trail.visible=Boolean(shot?.launched&&state.time>=shot.start);if(!v.group.visible)return;
   const originFrame=pose({ship:s,time:state.time,point:shot.origin,motion:reduced?mothershipMotion(s,0,{reduced:true}):shot.motion});
   const start=whale.anchors[shot.port].clone().applyQuaternion(originFrame.quaternion).add(originFrame.center),end=spherical(shot.point.lat,shot.point.lon,state.planetShield.active&&state.planetShield.hp>0?PLANET_SHIELD.radius:2.04),u=THREE.MathUtils.clamp((state.time-shot.start)/shot.duration,0,1);
   const path=t=>start.clone().lerp(end,t).addScaledVector(start.clone().normalize(),Math.sin(t*Math.PI)*.35);
   v.group.position.copy(path(u));connect(v.trail,path(Math.max(0,u-.12)),v.group.position);
  });
  satellites.forEach((v,i)=>{
   v.model.visible=Boolean(state.orbitalEnabled&&state.fighters[i]?.hp>0&&s.hp>0);
   const angle=state.time*.2+i*Math.PI*2/state.fighters.length;
   const offset=new THREE.Vector3(Math.cos(angle)*3.65,.28,Math.sin(angle)*2.12).applyQuaternion(ship.quaternion);
   v.model.position.copy(p).add(offset);v.model.quaternion.copy(ship.quaternion);
   v.beam.visible=v.model.visible&&state.satellites[i].phase==='firing'&&['running','paused'].includes(state.status);
   if(v.beam.visible){v.beam.material.color.set(colors[i]);connect(v.beam,v.model.position,position(state,'reactor'));}
  });
  const projected=p.clone().project(camera),host=document.getElementById('globe'),rect=host.getBoundingClientRect();
  // Ray/sphere occlusion for a high-orbit object (the surface hemisphere test would hide it too early).
  const direction=p.clone().sub(camera.position),length=direction.length();direction.normalize();
  const nearest=-camera.position.dot(direction),distance=camera.position.clone().addScaledVector(direction,Math.max(0,Math.min(length,nearest))).length();
  label.hidden=!ship.visible||projected.z>=1||Math.abs(projected.x)>.9||Math.abs(projected.y)>.9||distance<2;
  if(!label.hidden){label.textContent='LÉVIATHAN · '+Math.ceil(s.hp)+' PV';label.style.left=(projected.x*.5+.5)*rect.width+'px';label.style.top=Math.max(28,(-projected.y*.5+.5)*rect.height-65)+'px';}
 }
 return {update,event,clear,position,framing};
}

export function updateInvasionHUD(state){
 const $=id=>document.getElementById(id),active=state.mode==='invasion';
 document.body.dataset.mode=state.mode;$('invasion-hud').hidden=!active;$('invasion-guide').hidden=!active;
 $('planet-shield-toggle').hidden=!active;
 if(!active)return;
 const field=state.planetShield,button=$('planet-shield-toggle');button.disabled=!['running','paused'].includes(state.status);button.setAttribute('aria-pressed',String(field.active));button.setAttribute('aria-label',(field.active?'Désactiver':'Activer')+' le bouclier planétaire');button.textContent=field.active?`Terre · ${Math.ceil(field.hp)}/${field.maxHp}`:'Activer bouclier Terre';button.title=`Filet planétaire : ${Math.ceil(field.hp)}/${field.maxHp} · ${Math.round(field.absorbed)} dégâts absorbés · recharge après ${PLANET_SHIELD.rechargeDelay} s sans impact (énergie collective)`;
 const ship=state.ship,attack=ship.attack,known=attack&&state.time>=attack.visibleAt;
 const meter=(id,value,max)=>{const el=$(id);el.value=value;el.max=max;};
 $('ship-hp').textContent=Math.ceil(ship.hp)+' / '+ship.maxHp;meter('ship-health',ship.hp,ship.maxHp);
 $('ship-shield').textContent=Math.ceil(ship.shield)+' / '+ship.maxShield;meter('ship-shield-meter',ship.shield,ship.maxShield);
 for(const [key,part] of Object.entries(ship.parts)){meter('ship-'+key,part.hp,part.maxHp);$('ship-'+key+'-value').textContent=part.hp>0?Math.ceil(part.hp)+' PV':'DÉTRUIT';}
 const phases={scanning:'Patrouille · analyse des défenses',approach:'Manœuvre orbitale',bombard:'Bombardement ciblé',ray:'Charge du rayon',plasma:'Chargement des tourelles plasma',ion:'Charge de l’impulsion ionique',sweep:'Verrouillage de plusieurs nations',stunned:'Canon interrompu',cooldown:'Arc de patrouille',destroyed:'Vaisseau détruit',victorious:'Terre submergée'};
 $('ship-phase').textContent=attack&&!known?'Signature hostile · radars indisponibles':phases[ship.phase];
 $('invasion-alert').classList.toggle('danger',Boolean(known));
 $('invasion-alert').textContent=known?`${ALIEN_WEAPONS[attack.kind].name.toUpperCase()} → ${[...new Set((attack.targets||[attack]).map(t=>state.fighters[t.to].name))].join(' / ')} · ${Math.max(0,attack.fireAt-state.time).toFixed(1)} s`:
  ship.phase==='stunned'?'Rayon interrompu · la coalition gagne du temps':state.status==='finished'?(state.outcome==='victory'?'Victoire collective · Terre sauvée':'Défaite collective · toutes les nations éliminées'):'Objectif commun : détruire les trois systèmes du vaisseau';
 $('ray-progress').hidden=!(known&&attack.kind==='ray');
 if(known&&attack.kind==='ray'){meter('ray-charge',state.time-attack.start,INVASION.rayCharge);$('ray-counter').textContent=`Interruption : ${Math.floor(attack.disruption)} / ${ship.interruptThreshold} dégâts au canon`;}else $('ray-counter').textContent=known&&attack.kind==='ion'?'Impulsion : 30 énergie retirés, même sous bouclier':known&&attack.kind==='plasma'?'4 projectiles · plusieurs zones · interception possible':known&&attack.kind==='sweep'?`${attack.targets.length} arcs violets · impacts simultanés · renforcez les boucliers`:'Canon détruit : arsenal réduit · Moteurs : manœuvres ralenties · Réacteur : armes ioniques désactivées';
 $('ship-arsenal').textContent=(ship.parts.weapons.hp<=0?'ARSENAL · bombardement de secours':ship.parts.reactor.hp<=0?'ARSENAL · bombardement / rayon / plasma':'ARSENAL · bombardement / rayon / plasma / ion / multifaisceau')+` · ${state.drones.length}/${INVASION.droneLimit} chasseurs`;
 const radars=state.fighters.filter(f=>f.hp>0&&f.zones.find(z=>z.type==='radar').hp>0).length;
 $('diplomacy').textContent=`COALITION · ${state.fighters.filter(f=>f.hp>0).length}/${state.fighters.length} nations · ${radars}/${state.fighters.length} radars partagés · ${state.interruptions} rayon(s) interrompu(s)`;
 state.fighters.forEach((f,i)=>{
  const sat=state.satellites[i];$('counter-'+i).textContent=f.hp<=0?'Liaison interrompue':f.zones.find(z=>z.type==='radar').hp>0?'RADAR · alerte partagée avec les alliés':'RADAR HS · dépend des alliés';
  $('orbital-'+i).textContent=!state.orbitalEnabled?'SATELLITE · désactivé':f.hp<=0?'SATELLITE · hors ligne':sat.phase==='firing'?'LASER IONIQUE · '+Math.max(0,sat.until-state.time).toFixed(1)+' s':sat.phase==='charging'?'LASER · réserve '+Math.floor(f.energy)+'/40':'SATELLITE · prêt dans '+Math.max(0,Math.ceil(sat.readyAt-state.time))+' s';
  $('strategy-'+i).title=f.strategy;
 });
 if(state.status==='running')$('battle-status').textContent='INVASION · DÉFENSE DE LA TERRE';
 if(state.status==='idle'||state.status==='finished')$('start-battle').textContent='Défendre la Terre ↗';
}
