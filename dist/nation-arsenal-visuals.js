import * as THREE from './vendor/three.module.js';
export function arsenalArc(a,b,u){
 const na=a.clone().normalize(),nb=b.clone().normalize(),angle=Math.acos(THREE.MathUtils.clamp(na.dot(nb),-1,1)),tangent=nb.clone().addScaledVector(na,-na.dot(nb));
 if(tangent.lengthSq()<1e-8)tangent.crossVectors(na,Math.abs(na.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0));tangent.normalize();
 return na.multiplyScalar(Math.cos(angle*u)).addScaledVector(tangent,Math.sin(angle*u)).normalize().multiplyScalar(a.length()+(b.length()-a.length())*u+Math.sin(Math.PI*u)*.9);
}
export function createNationArsenalVisuals({scene,spherical}){
 const root=new THREE.Group();scene.add(root);let nodes=[],identity='';const reflected=new Map();
 const line=color=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(65*3),3));const m=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending}));root.add(m);return m;};
 function clear(){root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});root.clear();nodes=[];identity='';reflected.clear();}
 function event(e,time){if(e.type==='mirrorReflect')reflected.set(e.from,{to:e.to,time});}
 function configure(fighters){clear();identity=fighters.map(f=>f.id).join('/');nodes=fighters.map(()=>{
  const mines=Array.from({length:5},()=>{const g=new THREE.Group(),ball=new THREE.Mesh(new THREE.OctahedronGeometry(.035),new THREE.MeshBasicMaterial({color:0xffab72})),ring=new THREE.Mesh(new THREE.TorusGeometry(.053,.004,5,16),new THREE.MeshBasicMaterial({color:0xff6478}));g.add(ball,ring);root.add(g);return g;});
  const disable=new THREE.Mesh(new THREE.TorusGeometry(.095,.009,6,32),new THREE.MeshBasicMaterial({color:0xa797ff,transparent:true,opacity:.8}));root.add(disable);
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),new THREE.MeshBasicMaterial({color:0xb3fff5}));root.add(marker);
  return {mines,disable,marker,siphon:line(0xb383ff),network:line(0x75fff0),mirror:line(0xe4f4ff)};
 });}
 function draw(m,a,b,time){const attr=m.geometry.attributes.position;for(let j=0;j<=64;j++){const p=arsenalArc(a,b,j/64);attr.setXYZ(j,p.x,p.y,p.z);}attr.needsUpdate=true;m.geometry.computeBoundingSphere();m.material.opacity=.55+Math.sin(time*7)*.12;}
 function point(f,r=2.22){const p=f.zones[0].point;return spherical(f.lat??p.lat,f.lon??p.lon,r);}
 function update(state){
  if(!state.specialArsenal){root.visible=false;return;}if(identity!==state.fighters.map(f=>f.id).join('/'))configure(state.fighters);
  root.visible=state.status!=='finished';
  state.fighters.forEach((f,i)=>{
   const v=nodes[i],a=f.arsenal,active=f.hp>0&&a,center=point(f,2.43),normal=center.clone().normalize(),east=new THREE.Vector3(normal.z,0,-normal.x);if(east.lengthSq()<.01)east.set(1,0,0);east.normalize();const side=new THREE.Vector3().crossVectors(normal,east);
   v.mines.forEach((m,k)=>{m.visible=Boolean(active&&k<a.mines);if(!m.visible)return;const angle=k/5*Math.PI*2+state.time*.25;m.position.copy(center).addScaledVector(east,Math.cos(angle)*.22).addScaledVector(side,Math.sin(angle)*.22);m.rotation.set(state.time*.4,k,state.time*.3);});
   v.disable.visible=Boolean(active&&a.disabledUntil>state.time);if(v.disable.visible){const zone=f.zones.find(z=>z.type==='silo');v.disable.position.copy(spherical(zone.point.lat,zone.point.lon,2.12));v.disable.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),v.disable.position.clone().normalize());v.disable.scale.setScalar(1+Math.sin(state.time*8)*.12);}
   v.siphon.visible=Boolean(active&&a.siphon);if(v.siphon.visible)draw(v.siphon,point(f),point(state.fighters[a.siphon.to]),state.time);
   const link=state.arsenalLinks.find(l=>l.from===i);v.network.visible=v.marker.visible=Boolean(active&&link);
   if(v.network.visible){const start=point(f),end=point(state.fighters[link.to]);draw(v.network,start,end,state.time);v.marker.position.copy(arsenalArc(start,end,state.time*.45%1));}
   const reflection=reflected.get(i);v.mirror.visible=Boolean(active&&reflection&&state.time-reflection.time<.5&&state.time>=reflection.time);
   if(v.mirror.visible)draw(v.mirror,point(f),point(state.fighters[reflection.to]),state.time);
  });
 }
 return {update,event,clear};
}
