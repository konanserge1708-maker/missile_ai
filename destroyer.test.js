import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './dist/vendor/three.module.js';
import {createDestroyer,destroyerPose,destroyerMissilePoint} from './dist/destroyer.js';
import {createInvasion} from './dist/invasion-engine.js';

test('destroyer is volumetric and closed, with six launch cells',()=>{
 const d=createDestroyer();assert.equal(d.ports.length,6);assert.equal(d.body.material.transparent,false);
 d.model.traverse(o=>{if(o.geometry)for(const a of Object.values(o.geometry.attributes))assert.ok(a.array.every(Number.isFinite));});
 const p=d.body.geometry.attributes.position,point=i=>new THREE.Vector3().fromBufferAttribute(p,i);
 for(let i=0;i<7;i++)assert.ok(point(i*13).distanceTo(point(i*13+12))<1e-6);
 for(const row of [0,6])for(let j=1;j<=12;j++)assert.ok(point(row*13).distanceTo(point(row*13+j))<1e-6);
 const size=new THREE.Box3().setFromObject(d.model).getSize(new THREE.Vector3());assert.ok(size.x>4.9&&size.y>1&&size.z>2.4);
});

test('manoeuvre moves around the enemy, aims at it and stays above Earth',()=>{
 for(const target of [new THREE.Vector3(0,4.8,0),new THREE.Vector3(3,-2,3).normalize().multiplyScalar(4.8)]){
  const poses=[];
  for(let t=0;t<45;t+=.3){const frame=destroyerPose(target,t);poses.push(frame.position);
   assert.ok(frame.position.distanceTo(target)>6);assert.ok(frame.position.length()>6);
   const forward=new THREE.Vector3(1,0,0).applyQuaternion(frame.quaternion),aim=target.clone().sub(frame.position).normalize();assert.ok(forward.dot(aim)>.999);
   assert.ok(frame.quaternion.toArray().every(Number.isFinite));
  }
  assert.ok(poses[0].distanceTo(poses[40])>8);
  assert.deepEqual(destroyerPose(target,2),destroyerPose(target,2));
  assert.deepEqual(destroyerPose(target,2,{reduced:true}),destroyerPose(target,20,{reduced:true}));
 }
});

test('missiles leave their cell, follow distinct curves and reach the target',()=>{
 const a=new THREE.Vector3(6,6,0),b=new THREE.Vector3(0,4.8,0);
 assert.ok(destroyerMissilePoint(a,b,0,2).distanceTo(a)<1e-6);assert.ok(destroyerMissilePoint(a,b,1,2).distanceTo(b)<1e-6);
 assert.ok(destroyerMissilePoint(a,b,.5,-2).distanceTo(destroyerMissilePoint(a,b,.5,2))>1);
 for(let u=0;u<=1;u+=.01)assert.ok(destroyerMissilePoint(a,b,u,2).length()>4.5);
});

function deployed(){
 const g=createInvasion(()=>.99);g.start({research:true,technology:'destroyer',satellites:false,naval:false,players:Array.from({length:3},(_,i)=>({id:String(i),lat:20*i,lon:40*i}))});
 g.state.fighters.forEach(f=>f.next=Infinity);g.state.ship.nextAttack=g.state.nextDroneAt=Infinity;
 g.state.tech.phase='ready';g.state.tech.readyAt=g.state.time-20;g.step(.05);return g;
}

test('destroyer fires staggered salvos; damage occurs at impact and pauses freeze missiles',()=>{
 const g=deployed();g.step(3.1);const t=g.state.tech;
 assert.equal(t.projectiles.length,6);assert.equal(t.damage,0);assert.equal(new Set(t.projectiles.map(s=>s.start)).size,6);assert.equal(new Set(t.projectiles.map(s=>s.part)).size,3);
 assert.equal(g.state.fighters.reduce((n,f)=>n+f.shots,0),6);
 g.pause();const frozen=structuredClone(g.state);g.step(5);assert.deepEqual(g.state,frozen);g.pause();
 const events=g.step(3);assert.equal(t.projectiles.length,0);assert.ok(Math.abs(t.damage-29.4)<1e-6);
 assert.equal(events.filter(e=>e.type==='destroyerMissileImpact').length,6);assert.equal(g.state.fighters.reduce((n,f)=>n+f.hits,0),6);
 g.step(1);assert.ok(t.projectiles.length>0);t.destroyerHp=0;const damage=t.damage;g.step(.05);assert.equal(t.phase,'spent');assert.equal(t.projectiles.length,0);g.step(4);assert.equal(t.damage,damage);
 g.reset();assert.equal(g.state.tech.sequence,0);assert.equal(g.state.tech.projectiles.length,0);
});
