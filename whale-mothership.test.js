import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from './dist/vendor/three.module.js';

// Resolve the browser import-map entry without installing a second Three runtime.
const source=(await readFile(new URL('./dist/whale-mothership.js',import.meta.url),'utf8'))
 .replace("from 'three'",`from '${new URL('./dist/vendor/three.module.js',import.meta.url).href}'`);
const {createWhaleMothership}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const frameSource=(await readFile(new URL('./dist/mothership-frame.js',import.meta.url),'utf8')).replace("from 'three'",`from '${new URL('./dist/vendor/three.module.js',import.meta.url).href}'`);
const {aimMothership}=await import('data:text/javascript;base64,'+Buffer.from(frameSource).toString('base64'));
const arcSource=(await readFile(new URL('./dist/alien-beams.js',import.meta.url),'utf8')).replace("from 'three'",`from '${new URL('./dist/vendor/three.module.js',import.meta.url).href}'`);
const {alienArcPoints,createAlienArc}=await import('data:text/javascript;base64,'+Buffer.from(arcSource).toString('base64'));
const ship=()=>({shield:180,maxShield:180,parts:Object.fromEntries(['weapons','engines','reactor'].map(key=>[key,{hp:100,maxHp:100}])),attack:null});

test('whale is volumetric, finite, and its opaque hull closes at both poles and seam',()=>{
 const whale=createWhaleMothership(new THREE.Texture());
 whale.model.traverse(o=>{if(o.geometry)for(const attribute of Object.values(o.geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));});
 const hull=whale.model.getObjectByName('Coque pleine et continue');
 assert.equal(hull.material.transparent,false);assert.equal(hull.material.side,THREE.FrontSide);
 const p=hull.geometry.attributes.position,n=hull.geometry.attributes.normal;
 const point=i=>new THREE.Vector3().fromBufferAttribute(p,i);
 for(let row=0;row<=112;row++)assert.ok(point(row*65).distanceTo(point(row*65+64))<1e-6);
 for(const row of [0,112])for(let j=1;j<=64;j++)assert.ok(point(row*65).distanceTo(point(row*65+j))<1e-6);
 for(let i=0;i<n.count;i++)assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(n,i).length()-1)<1e-5);
 // Every nondegenerate triangle must agree with the outward vertex normals.
 const index=hull.geometry.index.array;
 for(let i=0;i<index.length;i+=3){
  const a=point(index[i]),b=point(index[i+1]),c=point(index[i+2]);
  const face=b.sub(a).cross(c.sub(a));if(face.lengthSq()<1e-12)continue;
  assert.ok(face.dot(new THREE.Vector3().fromBufferAttribute(n,index[i]))>0);
 }
 whale.model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(hull),size=box.getSize(new THREE.Vector3());
 assert.ok(size.x>5.5&&size.y>1.4&&size.z>1.5);
});

test('damage disables cannon glow and darkens systems without removing the closed hull',()=>{
 const whale=createWhaleMothership(new THREE.Texture()),state=ship();whale.update(0,state);
 state.parts.weapons.hp=0;state.parts.reactor.hp=0;state.shield=0;whale.update(12,state);
 assert.equal(whale.charge.visible,false);
 const hull=whale.model.getObjectByName('Coque pleine et continue');assert.equal(hull.visible,true);assert.equal(hull.material.opacity,1);
 state.parts.weapons.hp=100;whale.update(0,state);assert.equal(whale.charge.visible,true);
});

test('reduced motion keeps all whale transforms fixed across simulation time',()=>{
 const whale=createWhaleMothership(new THREE.Texture(),{reduced:true}),state=ship();
 function matrices(time){whale.update(time,state);whale.model.updateMatrixWorld(true);const result=[];whale.model.traverse(o=>result.push(o.matrixWorld.toArray()));return result;}
 assert.deepEqual(matrices(0),matrices(18));
});

test('forward cannon aims at the ground target and the pitching hull stays above Earth',()=>{
 const whale=createWhaleMothership(new THREE.Texture()),points=[];
 whale.model.updateMatrixWorld(true);
 whale.model.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));}});
 for(const normal of [new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,2,3).normalize()]){
  const center=normal.clone().multiplyScalar(4.8),target=normal.clone().multiplyScalar(2.04);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
  const idle=aimMothership(center,q,target,0);assert.ok(idle.center.distanceTo(center)<1e-10);assert.ok(idle.quaternion.angleTo(q)<1e-7);
  for(const weight of [0,.2,.4,.6,.8,1]){
   const frame=aimMothership(center,q,target,weight);
   for(const p of points)assert.ok(p.clone().applyQuaternion(frame.quaternion).add(frame.center).length()>2.04);
   assert.ok(frame.quaternion.toArray().every(Number.isFinite));
  }
  const aimed=aimMothership(center,q,target,1),muzzle=whale.anchors.weapons.clone().applyQuaternion(aimed.quaternion).add(aimed.center);
  const forward=new THREE.Vector3(-1,0,0).applyQuaternion(aimed.quaternion),direction=target.clone().sub(muzzle).normalize();
  assert.ok(forward.dot(direction)>.999999);assert.ok(muzzle.length()>3.5);
 }
});

test('curved beams connect their endpoints without crossing Earth, including opposite-side targets',()=>{
 const start=new THREE.Vector3(0,0,4.8);
 for(const end of [new THREE.Vector3(0,0,2.065),new THREE.Vector3(0,0,-2.065),new THREE.Vector3(2.065,0,0)]){
  const points=alienArcPoints(start,end,2);assert.deepEqual(points[0],start);assert.deepEqual(points.at(-1),end);
  for(const p of points){assert.ok(p.toArray().every(Number.isFinite));assert.ok(p.length()>=2.0649);}
  assert.ok(points[24].distanceTo(start.clone().lerp(end,.5))>.5);
  const arc=createAlienArc(new THREE.Group());arc.update(start,end,2,1);arc.group.traverse(o=>{if(o.geometry)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});
 }
});
