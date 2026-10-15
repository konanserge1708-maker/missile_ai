import * as THREE from './vendor/three.module.js';
export const SHIELD_RADIUS=2.18;
function spherical(lon,lat,r){const a=lat*Math.PI/180,b=lon*Math.PI/180;return [r*Math.cos(a)*Math.sin(b),r*Math.sin(a),r*Math.cos(a)*Math.cos(b)];}
function unwrap(ring,reference){const result=[];let previous=reference??ring[0][0];for(const [x,y] of ring){let lon=x;while(lon-previous>180)lon-=360;while(lon-previous< -180)lon+=360;result.push(new THREE.Vector2(lon,y));previous=lon;}if(result.length>1&&result[0].distanceTo(result.at(-1))<1e-8)result.pop();return result;}
// Subdivision is performed in geographic coordinates before projecting onto the raised shell.
export function territoryShell(feature){
 const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
 const top=[],walls=[],border=[];
 function tri(a,b,c,depth=0){const longest=Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a));if(longest>3&&depth<7){const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);tri(a,ab,ca,depth+1);tri(ab,b,bc,depth+1);tri(ca,bc,c,depth+1);tri(ab,bc,ca,depth+1);return;}for(const p of [a,b,c])top.push(...spherical(p.x,p.y,SHIELD_RADIUS));}
 for(const poly of polygons){const outer=unwrap(poly[0]),holes=poly.slice(1).map(r=>unwrap(r,outer[0].x)),points=[...outer,...holes.flat()];for(const face of THREE.ShapeUtils.triangulateShape(outer,holes))tri(...face.map(i=>points[i]));
  for(const ring of [outer,...holes])for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],steps=Math.max(1,Math.ceil(a.distanceTo(b)/1.5));for(let k=0;k<steps;k++){const p=a.clone().lerp(b,k/steps),q=a.clone().lerp(b,(k+1)/steps),at=spherical(p.x,p.y,SHIELD_RADIUS),bt=spherical(q.x,q.y,SHIELD_RADIUS),ab=spherical(p.x,p.y,2.02),bb=spherical(q.x,q.y,2.02);border.push(...at,...bt);walls.push(...ab,...bb,...bt,...ab,...bt,...at);}}
 }
 return {top,walls,border};
}
