import * as THREE from 'three';
import {ZONES} from './battle-engine.js';
const descriptions={reactor:'Centrale : détruite, production d’énergie divisée par deux.',radar:'Radar : détruit, plus aucun intercepteur ne peut décoller.',silo:'Base : détruite, tirs ralentis et Titan indisponible.'};
const icons={reactor:'ϟ',radar:'◎',silo:'▲'};
export function createZoneVisuals({scene,camera,spherical}){
 const root=new THREE.Group();scene.add(root);const host=document.getElementById('globe'),items=[];let identity='';
 function clear(){for(const item of items)item.label.remove();items.length=0;root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});root.clear();}
 function configure(state,teams,colors){clear();identity=teams.map(t=>t.id).join('/')+colors.join('/');state.fighters.forEach((f,i)=>f.zones.forEach((zone,j)=>{
  const group=new THREE.Group(),color=colors[i],point=spherical(zone.point.lat,zone.point.lon,2.045);group.position.copy(point);group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),point.clone().normalize());
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.037,.003,5,20),new THREE.MeshBasicMaterial({color}));ring.rotation.x=Math.PI/2;group.add(ring);
  if(zone.type==='reactor'){const tower=new THREE.Mesh(new THREE.CylinderGeometry(.018,.027,.065,8),new THREE.MeshBasicMaterial({color}));tower.position.y=.032;group.add(tower);}
  if(zone.type==='radar'){const mast=new THREE.Mesh(new THREE.CylinderGeometry(.004,.006,.055,6),new THREE.MeshBasicMaterial({color}));mast.position.y=.025;const dish=new THREE.Mesh(new THREE.TorusGeometry(.023,.005,5,16,Math.PI),new THREE.MeshBasicMaterial({color}));dish.position.y=.06;group.add(mast,dish);}
  if(zone.type==='silo')for(const x of [-.02,0,.02]){const cone=new THREE.Mesh(new THREE.ConeGeometry(.009,.045,5),new THREE.MeshBasicMaterial({color}));cone.position.set(x,.025,0);group.add(cone);}
  root.add(group);const label=document.createElement('button');label.className='zone-label';label.style.setProperty('--zone-color','#'+color.toString(16).padStart(6,'0'));label.dataset.country=teams[i].id;label.dataset.zone=zone.type;label.hidden=true;for(const name of ['pointerdown','pointerup','click'])label.addEventListener(name,e=>e.stopPropagation());host.append(label);items.push({group,label,owner:i,index:j,point});
 }));}
 function update(state,teams,colors){if(identity!==teams.map(t=>t.id).join('/')+colors.join('/'))configure(state,teams,colors);
  const rect=host.getBoundingClientRect(),enabled=['running','paused','finished'].includes(state.status);root.visible=enabled;
  for(const item of items){const f=state.fighters[item.owner],zone=f.zones[item.index],alive=f.hp>0,working=zone.hp>0;item.group.traverse(o=>{if(o.material)o.material.color.set(working&&alive?colors[item.owner]:0x873e46);});const normal=item.point.clone().normalize(),front=normal.dot(camera.position.clone().sub(item.point).normalize())>.04,p=item.point.clone().project(camera);const visible=enabled&&front&&p.z<1&&Math.abs(p.x)<.96&&Math.abs(p.y)<.96;item.label.hidden=!visible;if(!visible)continue;
   item.label.textContent=`${icons[zone.type]} ${ZONES[zone.type].name} ${working?Math.ceil(zone.hp):'HS'}`;item.label.title=teams[item.owner].name+' · '+descriptions[zone.type]+` (${Math.ceil(zone.hp)}/${zone.maxHp})`;item.label.setAttribute('aria-label',item.label.title);item.label.classList.toggle('destroyed',!working||!alive);item.label.style.left=((p.x*.5+.5)*rect.width)+'px';item.label.style.top=((-p.y*.5+.5)*rect.height)+'px';item.label.style.marginTop=(item.index-1)*17+'px';
  }
 }
 return {update,clear};
}
