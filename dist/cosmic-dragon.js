import * as THREE from './vendor/three.module.js';

// All attachments use the same travelling spine as the closed, deforming skin.
export function createCosmicDragon({reduced=false}={}) {
 const model=new THREE.Group();model.name='Dragon biomécanique';
 const hull=new THREE.MeshStandardMaterial({color:0x183d51,metalness:.48,roughness:.36});
 const armor=new THREE.MeshStandardMaterial({color:0x235366,metalness:.5,roughness:.33});
 const dark=new THREE.MeshStandardMaterial({color:0x091b2a,metalness:.65,roughness:.3});
 const cyan=new THREE.MeshStandardMaterial({color:0x73e6dc,emissive:0x29bcb8,emissiveIntensity:1.4,metalness:.35,roughness:.28});
 const violet=new THREE.MeshStandardMaterial({color:0xb4a0ff,emissive:0x7555dd,emissiveIntensity:1.6});
 const fiberMat=new THREE.LineBasicMaterial({color:0x4ca8b5,transparent:true,opacity:.52});
 const unitSphere=new THREE.SphereGeometry(1,24,16),attachments=[];
 const add=(parent,geometry,material,position=[0,0,0],scale=[1,1,1])=>{const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.scale.set(...scale);parent.add(m);return m;};
 const ellipsoid=(parent,material,p,s)=>add(parent,unitSphere,material,p,s);
 const yAxis=new THREE.Vector3(0,1,0);
 const center=new THREE.Vector3(),tangent=new THREE.Vector3(),up=new THREE.Vector3(),lateral=new THREE.Vector3(),basis=new THREE.Matrix4();
 function spine(u,time,out) {
  const freedom=Math.max(0,1-u)**1.2,phase=time*2.35-u*9;
  return out.set(-4.3+4.85*u,.16*Math.sin(u*6)+freedom*.25*Math.sin(phase+.7),freedom*.72*Math.sin(phase));
 }
 const before=new THREE.Vector3(),after=new THREE.Vector3();
 function frame(u,time) {
  spine(u,time,center);spine(u-.0001,time,before);spine(u+.0001,time,after);
  tangent.subVectors(after,before).normalize();lateral.crossVectors(tangent,yAxis).normalize();up.crossVectors(lateral,tangent).normalize();
  basis.makeBasis(tangent,up,lateral);
 }
 const radius=u=>.018+.34*Math.sin(Math.PI*u*.84)**.85;
 const rings=96,sides=32,positions=new Float32Array((rings+1)*(sides+1)*3),indices=[];
 for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}
 // Degenerate end rings seal the tail and the neck; the skull overlaps the neck.
 const skin=new THREE.BufferGeometry();skin.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));skin.setIndex(indices);
 const body=new THREE.Mesh(skin,hull);body.name='Peau continue articulée';model.add(body);
 const fibers=Array.from({length:12},(_,k)=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((rings+1)*3),3).setUsage(THREE.DynamicDrawUsage));const line=new THREE.Line(geometry,fiberMat);model.add(line);return {line,angle:k/12*Math.PI*2};});
 function attach(u){const g=new THREE.Group();model.add(g);attachments.push({g,u});return g;}
 // Convex, closed fins: two sculpted surfaces, rather than flat wing triangles.
 function fin(parent,outline,depth,material) {
  const points=[],idx=[],cx=outline.reduce((v,p)=>v+p[0],0)/outline.length,cy=outline.reduce((v,p)=>v+p[1],0)/outline.length;
  points.push(cx,cy,depth,cx,cy,-depth);outline.forEach(p=>points.push(p[0],p[1],0));
  const area=outline.reduce((sum,p,i)=>{const q=outline[(i+1)%outline.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
  for(let i=0;i<outline.length;i++){const a=i+2,b=(i+1)%outline.length+2;idx.push(...(area>0?[0,a,b,1,b,a]:[0,b,a,1,a,b]));}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(idx);g.computeVertexNormals();return add(parent,g,material);
 }
 // Overlapping dorsal plates, joint collars and luminous ventral ribs.
 for(let i=0;i<23;i++) {
  const u=.12+i*.036,g=attach(u),r=radius(u);
  const plate=ellipsoid(g,armor,[-.035,r*.6,0],[.20,r*.65,r*.97]);plate.rotation.z=-.18;
  const crest=fin(g,[[-.24,r*.65],[-.18,r+ .12],[-.32,r+.39*(.35+u)],[.12,r+.08],[.16,r*.65]],.035,armor);
  const light=fin(g,[[-.2,r+.05],[-.29,r+.31*(.35+u)],[-.23,r+.12],[-.02,r+.04]],.009,cyan);light.position.z=.037;
  for(const sign of [-1,1]){const rib=ellipsoid(g,cyan,[.035,-r*.25,sign*r*.94],[.015,r*.38,.014]);rib.rotation.x=sign*-.22;}
  crest.name='Crête blindée';
 }
 const head=attach(1);head.name='Tête du dragon';
 ellipsoid(head,hull,[.10,.04,0],[.57,.34,.33]);
 for(const sign of [-1,1]) {
  const cheek=ellipsoid(head,armor,[.05,-.02,sign*.25],[.37,.23,.16]);cheek.rotation.y=sign*.25;
  const brow=ellipsoid(head,armor,[.30,.20,sign*.23],[.30,.11,.13]);brow.rotation.z=.2;
  ellipsoid(head,violet,[.34,.15,sign*.322],[.125,.048,.023]);
  ellipsoid(head,cyan,[.37,.15,sign*.341],[.014,.045,.009]);
  const hornCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.12,.23,sign*.23),new THREE.Vector3(-.35,.60,sign*.34),new THREE.Vector3(-.8,.79,sign*.38),new THREE.Vector3(-1.05,.9,sign*.3)]);
  // Tapered horns, with a bright tip and dark armored root.
  const hornGeo=new THREE.TubeGeometry(hornCurve,28,.09,10,false),p=hornGeo.attributes.position;
  for(let i=0;i<=28;i++){const c=hornCurve.getPointAt(i/28),taper=1-i/28*.96;for(let j=0;j<=10;j++){const n=i*11+j;p.setXYZ(n,c.x+(p.getX(n)-c.x)*taper,c.y+(p.getY(n)-c.y)*taper,c.z+(p.getZ(n)-c.z)*taper);}}
  hornGeo.computeVertexNormals();add(head,hornGeo,armor);
  ellipsoid(head,cyan,[-1.03,.89,sign*.30],[.05,.035,.035]);
 }
 ellipsoid(head,armor,[.59,.025,0],[.46,.17,.23]);
 ellipsoid(head,dark,[.85,-.06,0],[.20,.08,.19]);
 const jaw=new THREE.Group();jaw.position.set(.1,-.15,0);head.add(jaw);
 ellipsoid(jaw,armor,[.43,-.02,0],[.49,.12,.22]);ellipsoid(jaw,cyan,[.58,.08,0],[.27,.012,.13]);
 for(const sign of [-1,1])for(let k=0;k<5;k++)add(head,new THREE.ConeGeometry(.025,.09,7),armor,[.35+k*.12,-.14,sign*.17],[1,-1,1]);
 const mouth=new THREE.Object3D();mouth.position.set(1.08,-.08,0);head.add(mouth);
 const core=ellipsoid(head,violet,[.08,.30,0],[.17,.06,.13]);
 const temp=new THREE.Vector3();
 function update(time,{charge=0,firing=false}={}) {
  const clock=reduced?0:time;
  for(let i=0;i<=rings;i++) {
   const u=i/rings;frame(u,clock);const r=i===0||i===rings?0:radius(u);
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;temp.copy(center).addScaledVector(up,Math.cos(a)*r*.94).addScaledVector(lateral,Math.sin(a)*r);skin.attributes.position.setXYZ(i*(sides+1)+j,temp.x,temp.y,temp.z);}
   for(const fiber of fibers){const a=fiber.angle+.18*Math.sin(u*15);temp.copy(center).addScaledVector(up,Math.cos(a)*(r+.005)*.94).addScaledVector(lateral,Math.sin(a)*(r+.005));fiber.line.geometry.attributes.position.setXYZ(i,temp.x,temp.y,temp.z);}
  }
  skin.attributes.position.needsUpdate=true;skin.computeVertexNormals();skin.computeBoundingSphere();
  for(const f of fibers){f.line.geometry.attributes.position.needsUpdate=true;f.line.geometry.computeBoundingSphere();}
  for(const {g,u} of attachments){frame(u,clock);g.position.copy(center);g.quaternion.setFromRotationMatrix(basis);}
  jaw.rotation.z=-.12-.34*Math.min(1,charge)-(firing?.12:0);
  cyan.emissiveIntensity=1.4+charge*.7;violet.emissiveIntensity=1.6+charge*2;core.scale.y=.06*(1+charge*.4);
  model.updateMatrixWorld(true);
 }
 update(0);
 return {model,update,mouth,body,head,bounds:new THREE.Box3(new THREE.Vector3(-5,-1.2,-1.5),new THREE.Vector3(1.8,1.6,1.5))};
}
