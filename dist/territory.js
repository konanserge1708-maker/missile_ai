function inRing(lon,lat,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [x,y]=ring[i],[u,v]=ring[j];
  if((y>lat)!==(v>lat)&&lon<(u-x)*(lat-y)/(v-y)+x)inside=!inside;
 }
 return inside;
}
export function inTerritory(lon,lat,feature){
 const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
 return polygons.some(p=>inRing(lon,lat,p[0])&&!p.slice(1).some(h=>inRing(lon,lat,h)));
}
function halton(index,base){let result=0,scale=1;while(index){scale/=base;result+=scale*(index%base);index=Math.floor(index/base);}return result;}
// Cache a spread of valid land coordinates, rather than scattering around a capital into the sea.
export function territoryTargets(feature,count=48){
 const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
 const points=polygons.flatMap(p=>p[0]);const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),targets=[];
 for(let i=1;i<=30000&&targets.length<count;i++){
  const lon=minX+(maxX-minX)*halton(i,2),lat=minY+(maxY-minY)*halton(i,3);
  if(inTerritory(lon,lat,feature))targets.push({lon,lat});
 }
 if(targets.length<count)throw Error('Échantillonnage du territoire incomplet : '+feature.id);
 return targets;
}
