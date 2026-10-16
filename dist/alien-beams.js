import * as THREE from 'three';

// Great-circle arcs stay outside Earth, including targets on the far hemisphere.
export function alienArcPoints(start,end,lane=0,segments=48){
 const a=start.clone().normalize(),b=end.clone().normalize(),dot=THREE.MathUtils.clamp(a.dot(b),-1,1),angle=Math.acos(dot);
 const tangent=b.clone().addScaledVector(a,-dot);
 if(tangent.lengthSq()<1e-10)tangent.crossVectors(Math.abs(a.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),a);
 tangent.normalize();const side=new THREE.Vector3().crossVectors(a,tangent).normalize(),points=[];
 for(let i=0;i<=segments;i++){
  const t=i/segments,wave=Math.sin(Math.PI*t),direction=a.clone().multiplyScalar(Math.cos(angle*t)).addScaledVector(tangent,Math.sin(angle*t)).addScaledVector(side,wave*(lane%2?1:-1)*(.12+.025*lane)).normalize();
  points.push(direction.multiplyScalar(THREE.MathUtils.lerp(start.length(),end.length(),t)+wave*(.65+.06*lane)));
 }
 points[0].copy(start);points[segments].copy(end);return points;
}

export function createAlienArc(parent){
 const group=new THREE.Group();parent.add(group);group.visible=false;
 const segments=48,sides=6,layers=[];
 for(const [radius,color,opacity] of [[.018,0xeecaff,.95],[.055,0x9a42ff,.32]]){
  const geometry=new THREE.BufferGeometry(),vertices=new Float32Array((segments+1)*(sides+1)*3),indices=[];
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
  geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
  const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  group.add(new THREE.Mesh(geometry,material));layers.push({geometry,material,radius,opacity});
 }
 const tangent=new THREE.Vector3(),normal=new THREE.Vector3(),binormal=new THREE.Vector3(),axis=new THREE.Vector3();
 function update(start,end,lane,fade){
  const points=alienArcPoints(start,end,lane,segments);
  for(const layer of layers){
   const attribute=layer.geometry.attributes.position;
   for(let i=0;i<=segments;i++){
    tangent.copy(points[Math.min(segments,i+1)]).sub(points[Math.max(0,i-1)]).normalize();axis.set(0,1,0);if(Math.abs(tangent.y)>.95)axis.set(1,0,0);
    normal.crossVectors(tangent,axis).normalize();binormal.crossVectors(tangent,normal).normalize();
    for(let j=0;j<=sides;j++){
     const angle=j/sides*Math.PI*2,c=Math.cos(angle)*layer.radius,s=Math.sin(angle)*layer.radius,p=points[i];
     attribute.setXYZ(i*(sides+1)+j,p.x+normal.x*c+binormal.x*s,p.y+normal.y*c+binormal.y*s,p.z+normal.z*c+binormal.z*s);
    }
   }
   attribute.needsUpdate=true;layer.geometry.computeBoundingSphere();layer.material.opacity=layer.opacity*fade;
  }
 }
 return {group,update};
}
