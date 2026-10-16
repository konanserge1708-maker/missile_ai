import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from './dist/vendor/three.module.js';
import {createInvasion,PLANET_SHIELD} from './dist/invasion-engine.js';

function isolated(){
 const g=createInvasion(()=>.99);g.start({players:['A','B','C'].map((id,i)=>({id,lat:20+i*10,lon:i*40})),planetShield:true,satellites:false,naval:false});
 g.state.fighters.forEach(f=>f.next=Infinity);g.state.ship.nextAttack=Infinity;g.state.nextDroneAt=Infinity;return g;
}
function hit(g,damage,kind='ray'){
 const s=g.state;s.ship.phase=kind;s.ship.attack={id:1,kind,to:0,zone:'radar',point:{lat:20,lon:0},start:s.time,visibleAt:s.time,fireAt:s.time+.05,damage,announced:true,disruption:0};return g.step(.05);
}

test('planetary shield absorbs before national defenses and absorbs ion energy disruption',()=>{
 const g=isolated(),field=g.state.planetShield;assert.equal(field.maxHp,3*PLANET_SHIELD.capacityPerNation);
 let events=hit(g,100);const impact=events.find(e=>e.type==='invasionHit');
 assert.equal(impact.planetAbsorbed,100);assert.equal(impact.planetBlocked,true);assert.equal(impact.damage,0);assert.equal(g.state.fighters[0].hp,100);assert.equal(g.state.fighters[0].shield,40);assert.equal(field.hp,65);assert.equal(field.absorbed,100);
 events=hit(g,22,'ion');assert.equal(events.find(e=>e.type==='invasionHit').energyDrained,0);
 const f=g.state.fighters[0],ammo=f.interceptors;hit(g,10,'bombard');assert.equal(f.interceptors,ammo);
});

test('overflow penetrates the planetary shield and breaks it exactly once',()=>{
 const g=isolated();g.state.planetShield.hp=20;g.state.planetShield.hitAt=0;
 const events=hit(g,100),impact=events.find(e=>e.type==='invasionHit');
 assert.equal(impact.planetAbsorbed,20);assert.equal(impact.planetBlocked,false);assert.equal(impact.absorbed,40);assert.equal(impact.damage,40);assert.equal(g.state.fighters[0].hp,60);assert.equal(g.state.planetShield.hp,0);assert.equal(events.filter(e=>e.type==='planetShieldBroken').length,1);
 assert.equal(hit(g,1,'drone').filter(e=>e.type==='planetShieldBroken').length,0);
});

test('switching the shield preserves its reserve, pauses freeze it and reset restores it',()=>{
 const g=isolated();g.state.planetShield.hp=77;assert.equal(g.togglePlanetShield(),false);
 const impact=hit(g,100).find(e=>e.type==='invasionHit');assert.equal(impact.planetAbsorbed,0);assert.equal(impact.damage,60);assert.equal(g.state.planetShield.hp,77);
 assert.equal(g.togglePlanetShield(),true);assert.equal(g.state.planetShield.hp,77);g.pause();const before=structuredClone(g.state);assert.deepEqual(g.step(30),[]);assert.deepEqual(g.state,before);
 g.reset();assert.equal(g.state.planetShield.active,true);assert.equal(g.state.planetShield.hp,g.state.planetShield.maxHp);assert.equal(g.state.planetShield.absorbed,0);
});

test('recharge waits ten seconds and spends only available collective energy',()=>{
 const g=isolated(),field=g.state.planetShield;field.hp=100;field.hitAt=0;g.state.fighters.forEach(f=>f.energy=0);
 g.step(9.9);assert.equal(field.hp,100);const before=g.state.fighters.reduce((n,f)=>n+f.energy,0);g.step(.2);
 assert.ok(Math.abs(field.hp-100.5)<1e-6);const after=g.state.fighters.reduce((n,f)=>n+f.energy,0);assert.ok(Math.abs(before+3*.2*8-after-.5)<1e-6);
 g.togglePlanetShield();g.step(2);assert.ok(Math.abs(field.hp-100.5)<1e-6);
});

test('enabled planetary shield remains bounded in complete three- and eight-nation invasions',()=>{
 for(const count of [3,8])for(let seed=0;seed<4;seed++){
  let value=seed;const g=createInvasion(()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;});
  g.start({planetShield:true,players:Array.from({length:count},(_,i)=>({id:String(i),lat:-30+i*10,lon:-100+i*35,profile:['aggressive','defensive','opportunist'][i%3]}))});let finishes=0;
  while(g.state.status==='running'&&g.state.time<400){
   for(const e of g.step(.2))if(e.type==='finish')finishes++;
   const field=g.state.planetShield;assert.ok(Number.isFinite(field.hp)&&field.hp>=0&&field.hp<=field.maxHp+1e-6);
   for(const f of g.state.fighters)assert.ok(f.energy>=-1e-6&&f.energy<=100&&f.hp>=0&&f.hp<=100);
  }
  assert.equal(g.state.status,'finished');assert.equal(finishes,1);assert.ok(g.state.planetShield.absorbed>0);
 }
});

const source=(await readFile(new URL('./dist/planet-shield.js',import.meta.url),'utf8')).replace("from 'three'",`from '${new URL('./dist/vendor/three.module.js',import.meta.url).href}'`);
const {createPlanetShield}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('geodesic net is a full volumetric envelope outside Earth and visible only in Invasion',()=>{
 const field=createPlanetShield({radius:PLANET_SHIELD.radius,reduced:true}),position=new THREE.Vector3(),matrix=new THREE.Matrix4();let fibres=0;
 field.model.traverse(o=>{
  if(o.geometry)for(const attr of Object.values(o.geometry.attributes))assert.ok(attr.array.every(Number.isFinite));
  if(o.isInstancedMesh){fibres+=o.count;for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);assert.ok(position.length()>2.04);assert.ok(matrix.elements.every(Number.isFinite));}}
 });assert.ok(fibres>1000);
 field.update({mode:'invasion',time:0,planetShield:{active:true,hp:165,maxHp:165,hitAt:-Infinity}});assert.equal(field.model.visible,true);
 const box=new THREE.Box3().setFromObject(field.model);for(const axis of ['x','y','z']){assert.ok(box.min[axis]<-2.2);assert.ok(box.max[axis]>2.2);}
 field.event({type:'planetShieldHit',time:0,point:{lat:20,lon:0}});
 field.update({mode:'ffa',time:0,planetShield:{active:true,hp:165,maxHp:165}});assert.equal(field.model.visible,false);
 field.clear();assert.equal(field.model.visible,false);
});
