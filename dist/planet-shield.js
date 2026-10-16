import * as THREE from 'three';

// Truncate the 12 vertices of an icosahedron: 12 pentagons, 20 hexagons, 90 shared edges.
export function footballPanels(radius){
 const base=new THREE.IcosahedronGeometry(1,0),attr=base.attributes.position,vertices=[],faces=[],lookup=new Map(),neighbors=new Map();
 for(let i=0;i<attr.count;i+=3){const face=[];for(let j=0;j<3;j++){const p=new THREE.Vector3().fromBufferAttribute(attr,i+j),key=p.toArray().map(x=>x.toFixed(6)).join('/');if(!lookup.has(key)){lookup.set(key,vertices.length);vertices.push(p);}face.push(lookup.get(key));}faces.push(face);for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3];if(!neighbors.has(a))neighbors.set(a,new Set());if(!neighbors.has(b))neighbors.set(b,new Set());neighbors.get(a).add(b);neighbors.get(b).add(a);}}base.dispose();
 const points=[],directed=new Map();for(const [a,others] of neighbors)for(const b of others){directed.set(a+':'+b,points.length);points.push(vertices[a].clone().multiplyScalar(2).add(vertices[b]).normalize().multiplyScalar(radius));}
 const cells=faces.map(([a,b,c])=>[directed.get(a+':'+b),directed.get(b+':'+a),directed.get(b+':'+c),directed.get(c+':'+b),directed.get(c+':'+a),directed.get(a+':'+c)]);
 for(const [a,others] of neighbors){const normal=vertices[a].clone().normalize(),ids=[...others].map(b=>directed.get(a+':'+b)),axis=points[ids[0]].clone().projectOnPlane(normal).normalize(),second=new THREE.Vector3().crossVectors(normal,axis);ids.sort((i,j)=>Math.atan2(points[i].dot(second),points[i].dot(axis))-Math.atan2(points[j].dot(second),points[j].dot(axis)));cells.push(ids);}
 const uniqueEdges=new Map();for(const cell of cells)for(let i=0;i<cell.length;i++){const a=cell[i],b=cell[(i+1)%cell.length],key=Math.min(a,b)+':'+Math.max(a,b);if(!uniqueEdges.has(key))uniqueEdges.set(key,[a,b]);}
 return {points,cells,edges:[...uniqueEdges.values()]};
}
export function createPlanetShield({radius=2.6,reduced=false}={}){
 const model=new THREE.Group();model.name='Bouclier planétaire — pentagones et hexagones bleus';model.visible=false;
 const panels=footballPanels(radius);model.userData.cells=panels.cells;model.userData.edgeCount=panels.edges.length;
 const segments=[];for(const [a,b] of panels.edges){for(let k=0;k<12;k++){segments.push([panels.points[a].clone().lerp(panels.points[b],k/12).normalize().multiplyScalar(radius),panels.points[a].clone().lerp(panels.points[b],(k+1)/12).normalize().multiplyScalar(radius)]);}}
 const fine=new THREE.LineBasicMaterial({color:0x448cff,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending});
 const linePoints=segments.flatMap(([a,b])=>[...a.toArray(),...b.toArray()]);
 const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(linePoints,3));
 const fibres=new THREE.LineSegments(lineGeometry,fine);fibres.name='Contours fins bleus des 32 cellules';model.add(fibres);

 const uniforms={clock:{value:0},strength:{value:1},reduced:{value:reduced?1:0},hits:{value:Array.from({length:6},()=>new THREE.Vector3(0,1,0))},hitTimes:{value:Array(6).fill(-1000)}};
 const membrane=new THREE.Mesh(new THREE.IcosahedronGeometry(radius,5),new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.NormalBlending,
  vertexShader:'varying vec3 vPoint;varying vec3 vEye;void main(){vec4 world=modelMatrix*vec4(position,1.);vPoint=normalize(world.xyz);vEye=cameraPosition-world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',
  fragmentShader:'uniform float clock;uniform float strength;uniform float reduced;uniform vec3 hits[6];uniform float hitTimes[6];varying vec3 vPoint;varying vec3 vEye;void main(){vec3 n=normalize(vPoint);float wave=0.;for(int i=0;i<6;i++){float age=clock-hitTimes[i];if(age>=0.&&age<1.8){float d=acos(clamp(dot(n,hits[i]),-1.,1.));float ring=exp(-pow((d-age*.85*(1.-reduced))*15.,2.));float local=exp(-d*d*50.);wave+=max(ring*.7,local*.8)*pow(1.-age/1.8,2.);}}float glow=min(wave,.6);float rim=pow(1.-abs(dot(n,normalize(vEye))),2.);float alpha=(.24+rim*.12)*strength+glow*.3;gl_FragColor=vec4(mix(vec3(.08,.3,.95),vec3(.55,.75,1.),glow),min(alpha,.65));}'
 }));membrane.name='Surfaces bleues translucides et ondes aux impacts';model.add(membrane);
 let hitIndex=0;
 function clear(){hitIndex=0;uniforms.hitTimes.value.fill(-1000);model.visible=false;}
 function event(e){if(e.type!=='planetShieldHit')return;const lat=e.point.lat*Math.PI/180,lon=e.point.lon*Math.PI/180;uniforms.hits.value[hitIndex].set(Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon));uniforms.hitTimes.value[hitIndex]=e.time;hitIndex=(hitIndex+1)%6;}
 function update(state){
  const field=state.planetShield,age=state.time-(field?.hitAt??-Infinity),ratio=field?THREE.MathUtils.clamp(field.hp/field.maxHp,0,1):0;
  model.visible=Boolean(state.mode==='invasion'&&field?.active&&(ratio>0||age<1.8));if(!model.visible)return;
  uniforms.clock.value=state.time;uniforms.strength.value=ratio;fine.opacity=.85*(ratio>0?.55+.45*ratio:Math.max(0,1-age/1.8)*.2);
 }
 return {model,event,update,clear};
}
