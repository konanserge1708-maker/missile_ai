import * as THREE from 'three';
import {NAVAL,navalPoint} from './naval.js?v=1.6.0';

export function createNavalVisuals({scene,spherical}){
 const root=new THREE.Group();root.name='Flottes navales';scene.add(root);
 const units=Array.from({length:8},()=>{
  const group=new THREE.Group(),heading=new THREE.Group();group.add(heading);root.add(group);group.visible=false;
  const hullMaterial=new THREE.MeshBasicMaterial({color:0x94b8c9});
  const hull=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),hullMaterial);hull.scale.set(.055,.025,.17);heading.add(hull);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(.065,.035,.15),new THREE.MeshBasicMaterial({color:0xb8c9ce}));deck.position.y=.025;heading.add(deck);
  const bridge=new THREE.Mesh(new THREE.BoxGeometry(.045,.055,.055),new THREE.MeshBasicMaterial({color:0x304c60}));bridge.position.set(0,.06,-.02);heading.add(bridge);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.11,5),new THREE.MeshBasicMaterial({color:0xb4e7e3}));mast.position.y=.12;heading.add(mast);
  const gun=new THREE.Mesh(new THREE.CylinderGeometry(.009,.012,.07,6),new THREE.MeshBasicMaterial({color:0xe7f5ff}));gun.rotation.x=Math.PI/2;gun.position.set(0,.045,.09);heading.add(gun);
  const wake=new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(36),3)),new THREE.LineBasicMaterial({color:0x9ac6d1,transparent:true,opacity:.4}));root.add(wake);
  return {group,heading,hullMaterial,wake};
 });
 function update(state,colors){
  root.visible=state.navalEnabled;
  units.forEach((unit,i)=>{
   const ship=state.fleet[i],active=Boolean(state.navalEnabled&&ship&&state.fighters[ship.owner].hp>0);unit.group.visible=unit.wake.visible=active;if(!active)return;
   const point=navalPoint(ship,state.time),next=navalPoint(ship,state.time+.2),p=spherical(point.lat,point.lon,NAVAL.radius),up=p.clone().normalize(),forward=spherical(next.lat,next.lon,NAVAL.radius).sub(p).normalize(),right=new THREE.Vector3().crossVectors(up,forward).normalize();forward.crossVectors(right,up).normalize();
   unit.group.position.copy(p);unit.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));unit.hullMaterial.color.set(colors[ship.owner]);
   const attr=unit.wake.geometry.attributes.position;for(let j=0;j<12;j++){const w=navalPoint(ship,Math.max(0,state.time-(11-j)*.12));attr.setXYZ(j,...spherical(w.lat,w.lon,NAVAL.radius-.008).toArray());}attr.needsUpdate=true;unit.wake.geometry.computeBoundingSphere();
  });
 }
 return {update};
}
