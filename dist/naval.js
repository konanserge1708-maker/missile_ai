import {orbitBasis,unitAt} from './orbital.js';

export const NAVAL={radius:2.04,cost:12,cooldown:14,damage:8,travel:3.4};
// Closed shipping lanes in open ocean; no straight passage through continents.
export const SEA_ROUTES=[
 {name:'Atlantique',points:[{lat:45,lon:-20},{lat:25,lon:-45},{lat:-10,lon:-25},{lat:-35,lon:-25}]},
 {name:'Pacifique',points:[{lat:30,lon:165},{lat:10,lon:-145},{lat:-25,lon:-140},{lat:-25,lon:170}]},
 {name:'Océan Indien',points:[{lat:8,lon:65},{lat:-15,lon:90},{lat:-35,lon:65},{lat:-15,lon:55}]}
];

export function createFleet(fighters){
 return fighters.map((f,owner)=>{
  const origin=unitAt({lat:Math.max(-85,Math.min(85,f.lat??0)),lon:f.lon??owner*45});
  let routeIndex=0,waypoint=0,best=-Infinity;
  SEA_ROUTES.forEach((route,r)=>route.points.forEach((point,i)=>{const p=unitAt(point),dot=p.reduce((n,v,j)=>n+v*origin[j],0);if(dot>best){best=dot;routeIndex=r;waypoint=i;}}));
  return {owner,routeIndex,waypoint,offset:owner*.8,readyAt:12+owner*.6,shots:0,lastShotAt:-Infinity};
 });
}

export function navalPoint(ship,time){
 const route=SEA_ROUTES[ship.routeIndex].points,progress=Math.max(0,time+ship.offset)/18,index=Math.floor(progress),t=progress-index;
 const {a,tangent,angle}=orbitBasis(route[(ship.waypoint+index)%route.length],route[(ship.waypoint+index+1)%route.length]);
 const p=a.map((v,i)=>v*Math.cos(angle*t)+tangent[i]*Math.sin(angle*t));
 return {lat:Math.asin(Math.max(-1,Math.min(1,p[1])))*180/Math.PI,lon:Math.atan2(p[0],p[2])*180/Math.PI};
}

export function stepFleet(state,launch){
 if(!state.navalEnabled)return;
 for(const ship of state.fleet){
  const owner=state.fighters[ship.owner];if(owner.hp<=0||state.time<ship.readyAt||owner.energy<NAVAL.cost)continue;
  if(launch(ship,navalPoint(ship,state.time))){owner.energy-=NAVAL.cost;ship.shots++;ship.lastShotAt=state.time;ship.readyAt=state.time+NAVAL.cooldown;}
  else ship.readyAt=state.time+1;
 }
}
