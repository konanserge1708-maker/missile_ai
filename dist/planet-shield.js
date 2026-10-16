import * as THREE from 'three';

export function createPlanetShield({radius=2.25,reduced=false}={}){
 const model=new THREE.Group();model.name='Bouclier planétaire — filet géodésique 3D';model.visible=false;
 const skin=new THREE.IcosahedronGeometry(radius,5),fineEdges=new THREE.EdgesGeometry(skin,1);
 const fine=new THREE.MeshBasicMaterial({color:0x6ef5e2,transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending});
 const coarse=new THREE.MeshBasicMaterial({color:0x9cddff,transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending});
 function fibres(edges,thickness,material){
  const attr=edges.attributes.position,geometry=new THREE.CylinderGeometry(thickness,thickness,1,5),instances=new THREE.InstancedMesh(geometry,material,attr.count/2),transform=new THREE.Object3D(),a=new THREE.Vector3(),b=new THREE.Vector3(),delta=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  for(let i=0;i<attr.count;i+=2){a.fromBufferAttribute(attr,i);b.fromBufferAttribute(attr,i+1);delta.copy(b).sub(a);transform.position.copy(a).add(b).multiplyScalar(.5);transform.quaternion.setFromUnitVectors(up,delta.clone().normalize());transform.scale.set(1,delta.length(),1);transform.updateMatrix();instances.setMatrixAt(i/2,transform.matrix);}
  instances.instanceMatrix.needsUpdate=true;instances.computeBoundingSphere();model.add(instances);return instances;
 }
 fibres(fineEdges,.0038,fine).name='Fibres fines en mailles triangulaires';
 const coarseGeometry=new THREE.IcosahedronGeometry(radius+.008,2),coarseEdges=new THREE.EdgesGeometry(coarseGeometry,1);
 fibres(coarseEdges,.007,coarse).name='Câbles géodésiques de renfort';coarseGeometry.dispose();coarseEdges.dispose();
 const unique=new Map(),attr=fineEdges.attributes.position;
 for(let i=0;i<attr.count;i++){const p=new THREE.Vector3().fromBufferAttribute(attr,i),key=p.toArray().map(v=>v.toFixed(5)).join('/');if(!unique.has(key))unique.set(key,p);}
 const nodeMaterial=new THREE.MeshBasicMaterial({color:0xc6fff4,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending});
 const nodes=new THREE.InstancedMesh(new THREE.SphereGeometry(.009,7,5),nodeMaterial,unique.size),matrix=new THREE.Matrix4();let index=0;
 for(const p of unique.values()){matrix.makeTranslation(p.x,p.y,p.z);nodes.setMatrixAt(index++,matrix);}nodes.instanceMatrix.needsUpdate=true;nodes.computeBoundingSphere();model.add(nodes);fineEdges.dispose();
 const uniforms={clock:{value:0},strength:{value:1},reduced:{value:reduced?1:0},hits:{value:Array.from({length:6},()=>new THREE.Vector3(0,1,0))},hitTimes:{value:Array(6).fill(-1000)}};
 const membrane=new THREE.Mesh(skin,new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.AdditiveBlending,
  vertexShader:'varying vec3 vPoint;varying vec3 vEye;void main(){vec4 world=modelMatrix*vec4(position,1.);vPoint=normalize(world.xyz);vEye=cameraPosition-world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',
  fragmentShader:'uniform float clock;uniform float strength;uniform float reduced;uniform vec3 hits[6];uniform float hitTimes[6];varying vec3 vPoint;varying vec3 vEye;void main(){vec3 n=normalize(vPoint);float rim=pow(1.-abs(dot(n,normalize(vEye))),2.5);float wave=0.;for(int i=0;i<6;i++){float age=clock-hitTimes[i];if(age>=0.&&age<1.8){float d=acos(clamp(dot(n,hits[i]),-1.,1.));float ring=exp(-pow((d-age*.85*(1.-reduced))*15.,2.));float local=exp(-d*d*50.);wave+=max(ring*.7,local*.8)*pow(1.-age/1.8,2.);}}vec3 tint=mix(vec3(1.,.43,.24),vec3(.25,.95,.85),strength);float alpha=(.014+rim*.12)*strength+min(wave,.65);gl_FragColor=vec4(mix(tint,vec3(.85,1.,1.),min(wave,1.)),alpha);}'
 }));model.add(membrane);
 let hitIndex=0;
 function clear(){hitIndex=0;uniforms.hitTimes.value.fill(-1000);model.visible=false;}
 function event(e){if(e.type!=='planetShieldHit')return;const lat=e.point.lat*Math.PI/180,lon=e.point.lon*Math.PI/180;uniforms.hits.value[hitIndex].set(Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon));uniforms.hitTimes.value[hitIndex]=e.time;hitIndex=(hitIndex+1)%6;}
 const healthy=new THREE.Color(0x6ef5e2),weak=new THREE.Color(0xffa36c);
 function update(state){
  const field=state.planetShield,age=state.time-(field?.hitAt??-Infinity),ratio=field?THREE.MathUtils.clamp(field.hp/field.maxHp,0,1):0;
  model.visible=Boolean(state.mode==='invasion'&&field?.active&&(ratio>0||age<1.8));
  if(!model.visible)return;
  uniforms.clock.value=state.time;uniforms.strength.value=ratio;
  const fade=ratio>0?.3+.7*ratio:Math.max(0,1-age/1.8)*.2;
  fine.opacity=.42*fade;coarse.opacity=.6*fade;nodeMaterial.opacity=.65*fade;fine.color.copy(weak).lerp(healthy,ratio);
 }
 return {model,event,update,clear};
}
