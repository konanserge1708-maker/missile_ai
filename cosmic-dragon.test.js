import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './dist/vendor/three.module.js';
import {createCosmicDragon} from './dist/cosmic-dragon.js';

test('dragon has an opaque, sealed skin and finite animated geometry',()=>{
 const d=createCosmicDragon();
 assert.equal(d.body.material.transparent,false);
 for(const time of [0,1.5,4,8,11]){
  d.update(time,{charge:.7});
  d.model.traverse(o=>{if(o.geometry)for(const a of Object.values(o.geometry.attributes))assert.ok(a.array.every(Number.isFinite));});
  const p=d.body.geometry.attributes.position,point=i=>new THREE.Vector3().fromBufferAttribute(p,i);
  for(let i=0;i<=96;i++)assert.ok(point(i*33).distanceTo(point(i*33+32))<1e-6);
  for(const i of [0,96])for(let j=1;j<=32;j++)assert.ok(point(i*33).distanceTo(point(i*33+j))<1e-6);
  const normal=new THREE.Vector3().fromBufferAttribute(d.body.geometry.attributes.normal,48*33);
  assert.ok(normal.y>.5,'dorsal normals face outward');
 }
});

test('serpentine motion deforms the skin and carries its armor; same time freezes motion',()=>{
 const d=createCosmicDragon(),p=d.body.geometry.attributes.position,plate=d.model.children.find(o=>o.isGroup&&o!==d.head);
 d.update(0);const skin=Array.from(p.array),pose=plate.position.clone();
 d.update(1.2);assert.notDeepEqual(Array.from(p.array),skin);assert.ok(plate.position.distanceTo(pose)>.05);
 const frozen=Array.from(p.array);d.update(1.2);assert.deepEqual(Array.from(p.array),frozen);
 const box=new THREE.Box3().setFromObject(d.model),size=box.getSize(new THREE.Vector3());
 assert.ok(size.x>5&&size.y>1&&size.z>.6);
});

test('mouth anchor follows scaled and rotated model, and charge opens jaw',()=>{
 const d=createCosmicDragon();d.update(2);const local=d.mouth.getWorldPosition(new THREE.Vector3()),jaw=d.head.children.find(o=>o.isGroup);
 const idle=jaw.rotation.z;d.update(2,{charge:1});assert.ok(jaw.rotation.z<idle);
 d.model.position.set(3,8,-4);d.model.scale.setScalar(.5);d.model.rotation.y=.8;d.update(2);
 const expected=local.applyMatrix4(d.model.matrixWorld),actual=d.mouth.getWorldPosition(new THREE.Vector3());
 assert.ok(actual.distanceTo(expected)<1e-6);
});

test('reduced motion keeps skin and attachments fixed',()=>{
 const d=createCosmicDragon({reduced:true});d.update(0);const p=Array.from(d.body.geometry.attributes.position.array),matrix=d.head.matrixWorld.toArray();
 d.update(8);assert.deepEqual(Array.from(d.body.geometry.attributes.position.array),p);assert.deepEqual(d.head.matrixWorld.toArray(),matrix);
});
