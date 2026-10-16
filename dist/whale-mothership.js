import * as THREE from 'three';

// Continuous whale skin, with luminous fibres conforming to its curved surface.
export function createWhaleMothership(texture,{reduced=false}={}){
 const model=new THREE.Group();model.name='Léviathan — coque biomécanique';
 const parts={weapons:new THREE.Group(),engines:new THREE.Group(),reactor:new THREE.Group()};
 for(const [key,group] of Object.entries(parts)){group.name=key;model.add(group);}
 const hull=new THREE.MeshStandardMaterial({color:0x183d51,metalness:.48,roughness:.36});
 const armor=new THREE.MeshStandardMaterial({color:0x235366,metalness:.5,roughness:.33,side:THREE.DoubleSide});
 const dark=new THREE.MeshStandardMaterial({color:0x091b2a,metalness:.65,roughness:.3});
 const cyan=new THREE.MeshStandardMaterial({color:0x73e6dc,emissive:0x29bcb8,emissiveIntensity:1.4});
 const violet=new THREE.MeshStandardMaterial({color:0xb4a0ff,emissive:0x7555dd,emissiveIntensity:1.6});
 const red=new THREE.MeshStandardMaterial({color:0xff718f,emissive:0xff254f,emissiveIntensity:1.4});
 function mesh(parent,geometry,material,position=[0,0,0],scale=[1,1,1]){
  const o=new THREE.Mesh(geometry,material);o.position.set(...position);o.scale.set(...scale);parent.add(o);return o;
 }
 function tube(parent,points,radius,material=cyan){
  return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(24,points.length*2),radius,5,false),material);
 }
 // Broad rounded head and shoulders taper into a slender tail. Both poles close.
 const profile=new THREE.CatmullRomCurve3([
  [-3.12,0,0],[-3.02,.28,.34],[-2.7,.49,.58],[-2.12,.65,.76],
  [-1.3,.76,.83],[-.45,.73,.76],[.45,.57,.59],[1.25,.36,.37],
  [1.95,.18,.19],[2.48,.09,.12],[2.7,0,0]
 ].map(p=>new THREE.Vector3(...p)));
 function skin(t,a,lift=0){
  const p=profile.getPoint(t);
  return new THREE.Vector3(p.x,.06+.1*Math.sin(t*Math.PI)+(Math.max(0,p.y)+lift)*Math.cos(a),(Math.max(0,p.z)+lift)*Math.sin(a));
 }
 const positions=[],normals=[],indices=[],uCount=112,vCount=64;
 for(let i=0;i<=uCount;i++)for(let j=0;j<=vCount;j++){
  const t=i/uCount,a=j/vCount*Math.PI*2;positions.push(...skin(t,a).toArray());
  const tangent=skin(Math.min(.99999,t+.0001),a).sub(skin(Math.max(.00001,t-.0001),a));
  const at=Math.max(.00001,Math.min(.99999,t)),around=skin(at,a+.0001).sub(skin(at,a-.0001));
  const normal=new THREE.Vector3().crossVectors(around,tangent).normalize();
  if(i===0)normal.set(-1,0,0);if(i===uCount)normal.set(1,0,0);normals.push(...normal.toArray());
 }
 for(let i=0;i<uCount;i++)for(let j=0;j<vCount;j++){const a=i*(vCount+1)+j,b=a+vCount+1;indices.push(a,a+1,b,b,a+1,b+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setIndex(indices);
 mesh(parts.reactor,geometry,hull).name='Coque pleine et continue';
 const lattice=new THREE.LineBasicMaterial({color:0x4ca8b5,transparent:true,opacity:.24});
 function line(points){parts.reactor.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),lattice));}
 for(let j=0;j<32;j++){
  const points=[];for(let i=0;i<=80;i++){const t=.025+i/80*.94;points.push(skin(t,j/32*Math.PI*2+.075*Math.sin(t*Math.PI*3+j*.45),.007));}
  line(points);if(j%4===1)tube(parts.reactor,points,.006);
 }
 for(let i=1;i<29;i++){const points=[];for(let j=0;j<=96;j++)points.push(skin(i/30,j/96*Math.PI*2,.006));line(points);}
 for(const sign of [-1,1]){
  const mouth=[];for(let i=0;i<=40;i++)mouth.push(skin(.035+i/40*.36,sign*1.98,.013));
  tube(parts.weapons,mouth,.018,dark);tube(parts.weapons,mouth,.005);
  const eye=skin(.23,sign*1.43,.018);
  mesh(parts.weapons,new THREE.SphereGeometry(1,24,12),dark,eye.toArray(),[.15,.075,.035]);
  mesh(parts.weapons,new THREE.SphereGeometry(1,24,12),cyan,eye.clone().add(new THREE.Vector3(0,0,sign*.024)).toArray(),[.092,.025,.024]);
  for(let i=0;i<10;i++)mesh(parts.reactor,new THREE.SphereGeometry(1,8,6),i%3===0?violet:cyan,skin(.31+i*.035,sign*1.28,.012).toArray(),[.018,.012,.012]);
 }
 // Closed lenticular fins: two convex skins meet along a shared perimeter.
 function fin(parent,outline,thickness){
  const curve=new THREE.CatmullRomCurve3(outline.map(p=>new THREE.Vector3(...p)),true),center=new THREE.Vector3();
  outline.forEach(p=>center.add(new THREE.Vector3(...p)));center.multiplyScalar(1/outline.length);
  const pos=[],idx=[],n=64,rings=8;
  for(const sign of [1,-1])for(let r=0;r<=rings;r++)for(let j=0;j<=n;j++){
   const f=r/rings,p=center.clone().lerp(curve.getPoint(j/n),f);p.y+=sign*thickness*Math.sqrt(Math.max(0,1-f*f));pos.push(...p.toArray());
  }
  const offset=(rings+1)*(n+1);
  for(let side=0;side<2;side++)for(let r=0;r<rings;r++)for(let j=0;j<n;j++){
   const a=side*offset+r*(n+1)+j,b=a+n+1;
   if(side===0)idx.push(a,b,a+1,b,b+1,a+1);else idx.push(a,a+1,b,b,a+1,b+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();mesh(parent,g,armor);
  const edge=[];for(let j=0;j<=64;j++)edge.push(curve.getPoint(j/64));tube(parent,edge,.009);
  for(let j=0;j<7;j++){
   const end=curve.getPoint(.12+j*.1),points=[];
   for(let r=0;r<=16;r++){const f=.12+r/16*.85,p=center.clone().lerp(end,f);p.y+=thickness*Math.sqrt(1-f*f)+.008;points.push(p);}
   tube(parent,points,.005);
  }
 }
 const fins=[];
 for(const sign of [-1,1]){
  const group=new THREE.Group();group.position.set(-.85,-.22,sign*.58);parts.reactor.add(group);fins.push({group,sign});
  fin(group,[[-.32,0,0],[-.16,-.05,sign*.4],[.63,-.24,sign*1.24],[.96,-.24,sign*1.31],[.79,-.15,sign*.78],[.33,.04,0]],.08);
 }
 const tail=new THREE.Group();tail.position.set(2.25,.08,0);parts.engines.add(tail);
 fin(tail,[[-.2,0,0],[.12,.03,-.51],[.65,.05,-1.18],[.88,.03,-1.28],[.76,0,-.58],[.52,0,0],[.76,0,.58],[.88,.03,1.28],[.65,.05,1.18],[.12,.03,.51]],.075);
 const dorsal=new THREE.Group();dorsal.position.set(.65,.56,0);dorsal.rotation.x=Math.PI/2;parts.reactor.add(dorsal);
 fin(dorsal,[[-.3,0,0],[.1,0,-.35],[.45,0,-.5],[.38,0,-.08],[.55,0,0]],.045);
 const core=mesh(parts.reactor,new THREE.SphereGeometry(1,32,16),violet,[-.2,.86,0],[.22,.055,.16]);
 for(const sign of [-1,1]){const nozzle=mesh(parts.engines,new THREE.TorusGeometry(.075,.018,8,24),cyan,[2.43,.09,sign*.13]);nozzle.rotation.y=Math.PI/2;}
 // Forward aperture: recessed collar and concentric energy rings face along -X.
 const collar=mesh(parts.weapons,new THREE.CylinderGeometry(.16,.23,.2,32),dark,[-3.07,0,0]);collar.rotation.z=Math.PI/2;
 const emitter=mesh(parts.weapons,new THREE.TorusGeometry(.145,.025,12,48),red,[-3.19,0,0]);emitter.rotation.y=Math.PI/2;
 const inner=mesh(parts.weapons,new THREE.TorusGeometry(.095,.014,10,40),cyan,[-3.205,0,0]);inner.rotation.y=Math.PI/2;
 const turrets=[];
 for(const sign of [-1,1]){
  const turret=new THREE.Group();turret.position.set(-.6,-.25,sign*.72);parts.weapons.add(turret);turrets.push(turret);
  mesh(turret,new THREE.SphereGeometry(1,16,10),dark,[0,0,0],[.28,.13,.15]);
  const barrel=mesh(turret,new THREE.CylinderGeometry(.045,.07,.24,12),armor,[0,-.12,sign*.02]);barrel.rotation.z=-.35;
  const muzzle=mesh(turret,new THREE.TorusGeometry(.055,.014,8,20),cyan,[-.04,-.23,sign*.02]);muzzle.rotation.x=Math.PI/2;
 }
 const ionHalo=mesh(parts.reactor,new THREE.TorusGeometry(.29,.014,8,48),violet,[-.2,.86,0]);ionHalo.rotation.x=Math.PI/2;
 const exhausts=[];
 for(const sign of [-1,1]){
  const exhaust=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0x6beedc,blending:THREE.AdditiveBlending,depthWrite:false}));
  exhaust.position.set(2.62,.09,sign*.14);parts.engines.add(exhaust);exhausts.push(exhaust);
 }
 const charge=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0xff628e,blending:THREE.AdditiveBlending,depthWrite:false}));charge.position.set(-3.24,0,0);parts.weapons.add(charge);
 const shield=new THREE.Group();model.add(shield);
 const shieldMaterial=new THREE.LineBasicMaterial({color:0x8acddd,transparent:true,opacity:.06,depthWrite:false,blending:THREE.AdditiveBlending});
 for(let i=0;i<3;i++){
  const points=[];for(let j=0;j<=96;j++){const t=j/96*Math.PI*2,a=i*Math.PI/3;points.push(new THREE.Vector3(Math.cos(t)*3.38,Math.sin(t)*1.04*Math.cos(a),Math.sin(t)*1.96*Math.sin(a)));}
  shield.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),shieldMaterial));
 }
 const partMaterials={};
 for(const [key,group] of Object.entries(parts)){
  const replacements=new Map();group.traverse(o=>{if(!o.material)return;const original=o.material;if(!replacements.has(original))replacements.set(original,original.clone());o.material=replacements.get(original);});
  partMaterials[key]=[...replacements.values()].map(material=>({material,color:material.color.clone(),emissive:material.emissive?.clone()}));
 }
 const lastHealth={},damageColor=new THREE.Color(0x14202b);
 function update(time,ship){
  for(const [key,part] of Object.entries(ship.parts)){
   const ratio=part.hp/part.maxHp;if(lastHealth[key]===ratio)continue;lastHealth[key]=ratio;
   for(const {material,color,emissive} of partMaterials[key]){material.color.copy(color).lerp(damageColor,(1-ratio)*.8);if(emissive)material.emissive.copy(emissive).multiplyScalar(ratio);}
  }
  const cruising=ship.phase==='approach',motion=reduced?0:Math.sin(time*(cruising?1.8:1.1))*(cruising?.17:.1);
  tail.rotation.z=ship.parts.engines.hp>0?motion:0;
  for(const {group,sign} of fins){group.rotation.x=motion*sign;group.rotation.z=motion*.35;}
  exhausts.forEach(e=>{e.visible=ship.parts.engines.hp>0;e.scale.set(cruising?.65:.28,.17,1);});
  for(const turret of turrets)turret.rotation.y=reduced?0:Math.sin(time*.6)*.1;
  const ionCharging=['ion','sweep'].includes(ship.attack?.kind);
  ionHalo.scale.setScalar(ionCharging?1.35:1);ionHalo.visible=ship.parts.reactor.hp>0;
  core.scale.y=.055*(reduced?1:1+.08*Math.sin(time*1.5));
  shield.visible=ship.shield>0;shieldMaterial.opacity=.015+.045*ship.shield/ship.maxShield;
  charge.visible=ship.parts.weapons.hp>0;
  const progress=ship.attack?.kind==='ray'?THREE.MathUtils.clamp((time-ship.attack.start)/10,0,1):0;charge.scale.setScalar(.18+progress*1.1);
 }
 return {model,update,parts,charge,
  anchors:{weapons:new THREE.Vector3(-3.24,0,0),reactor:new THREE.Vector3(-.2,.86,0),engines:new THREE.Vector3(2.62,.08,0),plasmaLeft:new THREE.Vector3(-.64,-.48,-.74),plasmaRight:new THREE.Vector3(-.64,-.48,.74)},
  bounds:new THREE.Box3(new THREE.Vector3(-3.45,-1.05,-2.05),new THREE.Vector3(3.45,1.15,2.05))};
}
