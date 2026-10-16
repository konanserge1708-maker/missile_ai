import * as THREE from './vendor/three.module.js';

// The same deterministic manoeuvre is used for the ship and its launch positions.
export function destroyerPose(target,time,{reduced=false}={}){
 const t=reduced?0:time,normal=target.clone().normalize(),east=new THREE.Vector3(normal.z,0,-normal.x);
 if(east.lengthSq()<.001)east.set(1,0,0);east.normalize();
 const side=new THREE.Vector3().crossVectors(normal,east).normalize(),angle=t*.18;
 const distance=6.6+.35*Math.sin(t*.6),position=target.clone().addScaledVector(east,Math.cos(angle)*distance).addScaledVector(side,Math.sin(angle)*distance).addScaledVector(normal,1.25+.3*Math.sin(t*.43));
 const forward=target.clone().sub(position).normalize(),right=new THREE.Vector3().crossVectors(forward,normal).normalize(),up=new THREE.Vector3().crossVectors(right,forward).normalize();
 const quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward,up,right));
 quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.sin(t*.6)*.09));
 return {position,quaternion};
}

export function createDestroyer(texture,{reduced=false}={}){
 const model=new THREE.Group();model.name='Destroyer terrestre — Aegis';
 const hull=new THREE.MeshStandardMaterial({color:0x2b465c,metalness:.7,roughness:.32});
 const armor=new THREE.MeshStandardMaterial({color:0x66879b,metalness:.64,roughness:.3});
 const dark=new THREE.MeshStandardMaterial({color:0x0a1929,metalness:.65,roughness:.38});
 const cyan=new THREE.MeshStandardMaterial({color:0x8feeff,emissive:0x32bfdc,emissiveIntensity:1.5});
 const brass=new THREE.MeshStandardMaterial({color:0xc8b784,metalness:.7,roughness:.36});
 const add=(parent,geometry,material,p=[0,0,0])=>{const m=new THREE.Mesh(geometry,material);m.position.set(...p);parent.add(m);return m;};
 function prism(parent,points,depth,material,p=[0,0,0]){
  const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y))),g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.035});g.translate(0,0,-depth/2);return add(parent,g,material,p);
 }
 // Closed faceted hull, tapering from the armoured stern to a split spear bow.
 const stations=[[-2.35,0,0],[-2.2,.24,.49],[-1.7,.35,.65],[-.45,.39,.69],[.85,.3,.57],[1.85,.19,.35],[2.6,0,0]],vertices=[],index=[],n=12;
 for(const [x,y,z] of stations)for(let j=0;j<=n;j++){const a=j/n*Math.PI*2;vertices.push(x,Math.cos(a)*y,Math.sin(a)*z);}
 for(let i=0;i<stations.length-1;i++)for(let j=0;j<n;j++){const a=i*(n+1)+j,b=a+n+1;index.push(a,a+1,b,b,a+1,b+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(index);geometry.computeVertexNormals();
 const body=add(model,geometry,hull);body.name='Coque blindée';
 for(const sign of [-1,1]){
  prism(model,[[-1.9,-.04],[-1.7,.18],[.6,.18],[1.6,.02],[.65,-.2],[-1.6,-.22]],.13,armor,[0,0,sign*.65]);
  prism(model,[[-1.95,-.1],[-1.5,.1],[.4,.08],[1.05,-.06],[-.4,-.16]],.025,cyan,[0,0,sign*.735]);
  prism(model,[[-1.9,0],[-1.4,.22],[-.1,.18],[.65,-.06],[-.8,-.24]],.4,hull,[-.1,-.17,sign*1]);
  // Engine nacelles with layered collars, recessed nozzles and bright exhaust.
  const nacelle=add(model,new THREE.CylinderGeometry(.24,.32,1.6,16),armor,[-1.35,-.09,sign*1.02]);nacelle.rotation.z=-Math.PI/2;
  for(const x of [-1.95,-1.7,-.9]){const ring=add(model,new THREE.TorusGeometry(.27,.035,8,24),dark,[x,-.09,sign*1.02]);ring.rotation.y=Math.PI/2;}
  const nozzle=add(model,new THREE.CylinderGeometry(.205,.23,.12,20),dark,[-2.19,-.09,sign*1.02]);nozzle.rotation.z=Math.PI/2;
  const exhaust=add(model,new THREE.CircleGeometry(.18,24),cyan,[-2.26,-.09,sign*1.02]);exhaust.rotation.y=-Math.PI/2;
  prism(model,[[-1.4,.25],[-1.8,.85],[-1.1,.68],[-.65,.24]],.11,armor,[0,0,sign*.93]);
 }
 // Layered command tower, illuminated visor and central power spine.
 prism(model,[[-1.35,.24],[-1.1,.73],[-.5,.83],[.12,.38]],.69,dark);
 prism(model,[[-1.18,.43],[-1.02,.71],[-.5,.76],[-.02,.41]],.73,armor);
 prism(model,[[-1.05,.61],[-1,.68],[-.52,.72],[-.29,.6]],.765,cyan);
 for(let i=0;i<7;i++)prism(model,[[-.28+i*.24,.3],[-.22+i*.24,.4],[-.06+i*.24,.38],[i*.24,.28]],.43,armor);
 const spine=add(model,new THREE.CylinderGeometry(.06,.06,1.7,10),cyan,[-.2,.42,0]);spine.rotation.z=Math.PI/2;
 // Six vertical launch cells: actual missile origins sit at these mouths.
 const ports=[];
 for(let i=0;i<6;i++){
  const x=.15+Math.floor(i/2)*.38,z=(i%2?1:-1)*.46;
  const socket=add(model,new THREE.CylinderGeometry(.11,.14,.14,10),dark,[x,.32,z]);
  const rim=add(model,new THREE.TorusGeometry(.105,.016,6,16),brass,[x,.4,z]);rim.rotation.x=Math.PI/2;
  const anchor=new THREE.Object3D();anchor.position.set(x,.43,z);model.add(anchor);ports.push(anchor);socket.name='Cellule de lancement';
 }
 const turrets=[];
 for(const x of [-1.45,1.55]){
  const turret=new THREE.Group();turret.position.set(x,.31,0);model.add(turret);
  const dome=add(turret,new THREE.SphereGeometry(.22,16,8),armor);dome.scale.set(1,.65,1);
  for(const sign of [-1,1]){const barrel=add(turret,new THREE.CylinderGeometry(.026,.04,.48,8),dark,[.28,.08,sign*.08]);barrel.rotation.z=-Math.PI/2;add(turret,new THREE.SphereGeometry(.03,8,6),cyan,[.53,.08,sign*.08]);}turrets.push(turret);
 }
 const exhausts=[];
 if(texture)for(const sign of [-1,1]){const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0x58cfff,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));glow.position.set(-2.42,-.09,sign*1.02);model.add(glow);exhausts.push(glow);}
 function update(time,hp=1){
  const t=reduced?0:time;exhausts.forEach(g=>g.scale.setScalar(.65+Math.sin(t*9)*.045));
  hull.color.set(hp<.3?0x27303d:0x2b465c);cyan.emissiveIntensity=hp>0?1.5:0;
  turrets.forEach((g,i)=>g.rotation.y=Math.sin(t*.8+i)*.12);
 }
 update(0);return {model,ports,body,update};
}

export function destroyerMissilePoint(start,target,u,lane){
 const normal=target.clone().normalize(),cross=new THREE.Vector3().crossVectors(target,start).normalize();
 return start.clone().lerp(target,u).addScaledVector(normal,Math.sin(Math.PI*u)*(.75+Math.abs(lane)*.18)).addScaledVector(cross,Math.sin(Math.PI*u)*lane*.34);
}
