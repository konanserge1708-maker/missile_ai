export const TECHNOLOGIES={
 destroyer:{name:'Destroyer terrestre',research:85,duration:45,description:'Un destroyer allié manœuvre, lance des salves de missiles et protège la coalition. Il peut être détruit.'},
 dragon:{name:'Dragon cosmique',research:75,duration:11,description:'Un dragon charge puis projette une gigantesque boule d’énergie.'},
 convergence:{name:'Convergence des nations',research:70,duration:12,description:'Les faisceaux des nations fusionnent avant de frapper le vaisseau.'},
 triple:{name:'Triple rempart',research:60,duration:35,description:'Trois couches de protection supplémentaires, destructibles et temporaires.'},
 barrage:{name:'Déluge mondial',research:65,duration:12,description:'Toutes les nations participantes bombardent le vaisseau en continu.'},
 rewind:{name:'Retour temporel',research:90,duration:3,description:'Restaure le combat trente secondes plus tôt. Le projet reste consommé.'},
 sun:{name:'Soleil artificiel',research:85,duration:20,description:'Une étoile plus grande que la Terre brûle progressivement le vaisseau.'}
};
export const FUNDING={eco:{name:'Économe',speed:.75,cost:.6},normal:{name:'Équilibré',speed:1,cost:1.4},priority:{name:'Prioritaire',speed:1.35,cost:2.8}};
export function initializeResearch(state,config,random){
 const keys=Object.keys(TECHNOLOGIES),enabled=config.research===true,profiles={aggressive:0,defensive:0,opportunist:0};state.fighters.forEach(f=>profiles[f.profile]++);
 const weights={destroyer:2+profiles.aggressive*2,dragon:2+profiles.aggressive,convergence:2+profiles.opportunist,triple:2+profiles.defensive*2,barrage:2+profiles.aggressive+profiles.opportunist,rewind:2+profiles.defensive+profiles.opportunist,sun:2+profiles.opportunist*2};
 let draw=random()*Object.values(weights).reduce((a,b)=>a+b,0),choice=keys.at(-1);for(const key of keys){draw-=weights[key];if(draw<0){choice=key;break;}}
 const id=TECHNOLOGIES[config.technology]?config.technology:choice;
 state.tech={enabled,id,funding:FUNDING[config.funding]?config.funding:'normal',phase:enabled?'researching':'disabled',progress:0,required:TECHNOLOGIES[id].research,readyAt:null,used:false,uses:0,elapsed:0,activeAt:null,activationTime:null,damage:0,absorbed:0,energySpent:0,hit:false,projectiles:[],nextVolley:0,sequence:0,destroyerHp:0,destroyerMaxHp:0,layers:[],centers:state.fighters.map((f,i)=>({owner:i,hp:36,maxHp:36,point:f.targets?.[Math.floor(f.targets.length/4)]||{lat:f.lat??0,lon:f.lon??i*40}})),sites:config.worldLaunchPoints?.length?structuredClone(config.worldLaunchPoints):state.fighters.map(f=>({lat:f.lat??0,lon:f.lon??0})),globalSites:Boolean(config.worldLaunchPoints?.length),siteCursor:0,rate:0,rewindFrom:null,rewindTo:null,trace:[]};
}
export function createResearchSystem(){
 let history=[],recordAt=0;
 function reset(){history=[];recordAt=0;}
 function record(state){if(state.time+1e-8<recordAt)return;const {tech,...battle}=state;history.push(structuredClone({...battle,researchCenterHealth:tech.centers.map(c=>c.hp)}));recordAt=state.time+.5;while(history.length>92)history.shift();}
 function step(state,dt,hooks){
  const t=state.tech;if(!t?.enabled)return null;const emit=(type,data={})=>hooks.emit(type,data),living=state.fighters.map((f,i)=>f.hp>0?i:-1).filter(i=>i>=0),scale=state.fighters.length/3;
  if(!living.length)return null;
  if(t.phase==='researching'){
   const funding=FUNDING[t.funding],requested=dt*funding.cost*living.length,available=living.reduce((s,i)=>s+state.fighters[i].energy,0),paid=Math.min(requested,available);
   if(paid>0)for(const i of living)state.fighters[i].energy=Math.max(0,state.fighters[i].energy-paid*state.fighters[i].energy/available);
   t.energySpent+=paid;const centers=living.reduce((s,i)=>s+t.centers[i].hp/t.centers[i].maxHp,0)/state.fighters.length,energyRate=requested?paid/requested:1;
   t.rate=funding.speed*(.2+.8*centers)*energyRate;t.progress=Math.min(t.required,t.progress+dt*t.rate);
   if(t.progress>=t.required-1e-8){t.phase='ready';t.readyAt=state.time;emit('technologyReady',{id:t.id});}
  }
  if(t.phase==='ready'){
   const danger=state.fighters.some(f=>f.hp>0&&f.hp<40)||state.ship.attack?.kind==='ray',wait=state.time-t.readyAt;
   const deploy=t.id==='destroyer'||t.id==='rewind'?(t.id!=='rewind'||danger||wait>=10):danger||state.ship.shield<state.ship.maxShield*.4||wait>=8;
   if(deploy){
    t.used=true;t.uses=1;t.phase='active';t.elapsed=0;t.activeAt=state.time;t.activationTime=state.time;
    t.destroyerMaxHp=t.destroyerHp=260*scale;t.layers=t.id==='triple'?Array(3).fill(25*state.fighters.length):[];emit('technologyActivated',{id:t.id});
    if(t.id==='rewind'){
     const desired=state.time-30,checkpoint=[...history].reverse().find(s=>s.time<=desired+1e-6);
     if(checkpoint){const restored=structuredClone(checkpoint);if(restored.researchCenterHealth)t.centers.forEach((c,i)=>c.hp=restored.researchCenterHealth[i]);delete restored.researchCenterHealth;t.rewindFrom=state.time;t.rewindTo=restored.time;t.trace=history.filter(s=>s.time>=restored.time&&s.time<=state.time).filter((_,i)=>i%3===0).map(s=>({time:s.time,point:hooks.point(s.ship,s.time)}));restored.tech=t;restored.status='running';restored.outcome=null;restored.rewindKnowledgeUntil=restored.time+30;restored.fighters.forEach(f=>{f.next=Math.min(f.next,restored.time+.5);f.strategy='Souvenir temporel · neutralise le canon';});history=[];recordAt=restored.time;emit('technologyRewind',{from:t.rewindFrom,to:t.rewindTo});return restored;}
     t.phase='spent';emit('technologyEnded',{id:t.id});
    }
   }
  }
  if(t.phase==='active'){
   const previous=t.elapsed;t.elapsed+=dt;const actor=living.reduce((a,b)=>state.fighters[a].damage>state.fighters[b].damage?a:b);
   const hit=(amount,part='reactor')=>{if(state.ship.hp<=0)return;const result=hooks.hitShip(actor,amount,part,'technology');t.damage+=result.damage+result.absorbed;};
   if(t.id==='destroyer'){
    if(t.destroyerHp>0){
     // Six staggered missiles every four seconds. Damage occurs only at impact.
     if(t.nextVolley===0)t.nextVolley=3;
     while(t.nextVolley<=t.elapsed&&t.nextVolley<40){
      const volley=t.nextVolley;t.nextVolley+=4;
      const originPoint={...hooks.point(state.ship,state.time)};
      for(let k=0;k<6;k++){
       const from=living[k%living.length];state.fighters[from].shots++;
       t.projectiles.push({id:++t.sequence,from,start:volley+k*.14,duration:1.8+k%3*.18,port:k,originPoint,part:['weapons','engines','reactor'][Math.floor(k/2)],lane:k-2.5});
      }
      emit('destroyerVolley',{count:6});
     }
     for(const shot of [...t.projectiles])if(t.elapsed>=shot.start+shot.duration){
      const impact=hooks.hitShip(shot.from,4.9*scale,shot.part,'technology');t.damage+=impact.damage+impact.absorbed;
      state.fighters[shot.from].hits++;t.projectiles.splice(t.projectiles.indexOf(shot),1);
      emit('destroyerMissileImpact',{id:shot.id,part:shot.part,damage:impact.damage,absorbed:impact.absorbed});
     }
    }else{t.projectiles=[];t.elapsed=TECHNOLOGIES.destroyer.duration;}
   }
   if(t.id==='dragon'&&!t.hit&&t.elapsed>=7){t.hit=true;hit(210*scale);emit('technologyStrike',{id:t.id});}
   if(t.id==='convergence'&&t.elapsed>4&&previous<10){hit(Math.max(0,Math.min(t.elapsed,10)-Math.max(previous,4))*43*scale*living.length/state.fighters.length,'weapons');}
   if(t.id==='sun'&&t.elapsed>3&&previous<19){hit(Math.max(0,Math.min(t.elapsed,19)-Math.max(previous,3))*13*scale);}
   if(t.id==='barrage'){
    while(t.nextVolley<=t.elapsed&&t.nextVolley<9){const volley=t.nextVolley;t.nextVolley+=.6;const count=Math.min(Math.max(12,living.length),t.sites.length*2);for(let k=0;k<count;k++){const from=living[k%living.length],sourcePoint=t.globalSites?t.sites[t.siteCursor++%t.sites.length]:state.fighters[from].targets?.[(t.sequence*7)%state.fighters[from].targets.length]||t.sites[from];state.fighters[from].shots++;t.projectiles.push({id:++t.sequence,from,start:volley,duration:2.2+(k%3)*.15,sourcePoint,lane:(t.sequence%7-3)*.04});}}
    for(const shot of [...t.projectiles])if(t.elapsed>=shot.start+shot.duration){const impact=hooks.hitShip(shot.from,1.5*scale,['weapons','engines','reactor'][shot.id%3],'technology');t.damage+=impact.damage+impact.absorbed;state.fighters[shot.from].hits++;t.projectiles.splice(t.projectiles.indexOf(shot),1);}

   }
   if(t.elapsed>=TECHNOLOGIES[t.id].duration-1e-8){t.phase='spent';t.layers=[];t.projectiles=[];emit('technologyEnded',{id:t.id});}
  }
  record(state);return null;
 }
 return {reset,step,record};
}
// These reserves never recharge: the three layers are a single-use deployment.
export function absorbTechnology(state,amount,emit){
 const t=state.tech;if(t?.phase!=='active'||t.id!=='triple')return {remaining:amount,absorbed:0};let remaining=amount;
 for(let i=t.layers.length-1;i>=0&&remaining>0;i--){const hit=Math.min(t.layers[i],remaining);t.layers[i]-=hit;remaining-=hit;if(hit>0&&t.layers[i]===0)emit('technologyLayerBroken',{layer:i});}
 const absorbed=amount-remaining;t.absorbed+=absorbed;return {remaining,absorbed};
}
