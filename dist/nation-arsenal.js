export const SPECIAL_WEAPONS={
 disarm:{name:'Missile de désarmement',cost:28,cooldown:19,description:'Neutralise brièvement les silos. Un bouclier chargé réduit son effet.'},
 siphon:{name:'Rayon siphon',cost:25,cooldown:26,description:'Draine le bouclier pendant 4 s et récupère 45 % de sa charge.'},
 mines:{name:'Mines orbitales',cost:28,cooldown:28,description:'5 mines pendant 16 s. Une mine intercepte un missile ; deux repoussent un satellite.'}
};
export const SHIELD_STYLES={
 network:{name:'Réseau solidaire',description:'Transfère sa réserve aux alliés moins protégés, contre de l’énergie. Équipes et trêves uniquement.'},
 reactive:{name:'Carapace réactive',description:'Renforce le secteur frappé jusqu’à 42 %, mais affaiblit les autres secteurs.'},
 mirror:{name:'Miroir énergétique',description:'Renvoie 35 % des lasers absorbés. La chaleur peut suspendre la réflexion pendant 6 s.'}
};
export const DEFAULT_KITS={aggressive:['disarm','siphon'],defensive:['disarm','mines'],opportunist:['siphon','mines']};
export function initializeArsenal(state,enabled){
 state.specialArsenal=enabled===true;state.arsenalLinks=[];
 state.fighters.forEach((f,i)=>{
  const selected=[...new Set((f.specials||[]).filter(id=>SPECIAL_WEAPONS[id]))].slice(0,2);
  f.arsenal=state.specialArsenal?{weapons:selected.length?selected:[...(DEFAULT_KITS[f.profile]||DEFAULT_KITS.aggressive)],shield:SHIELD_STYLES[f.shieldStyle]?f.shieldStyle:(['teams','ffa'].includes(state.mode)?['network','reactive','mirror'][i%3]:['reactive','mirror'][i%2]),ready:{disarm:4,siphon:7,mines:3},disabledUntil:0,siphon:null,mines:0,minesUntil:0,facets:Array(6).fill(0),lastSector:-1,heat:0,overheatedUntil:0,reflectAt:-Infinity,stolen:0,shared:0,reflected:0,mineKills:0}:null;
 });
}
export function clearArsenal(state){state.arsenalLinks=[];for(const f of state.fighters)if(f.arsenal){f.arsenal.siphon=null;f.arsenal.mines=0;}}
export function selectSpecial(state,from,to,events){
 const f=state.fighters[from],a=f.arsenal,target=state.fighters[to];if(!a)return null;
 const has=id=>a.weapons.includes(id)&&a.ready[id]<=state.time&&f.energy>=SPECIAL_WEAPONS[id].cost;
 const incoming=state.flights.some(s=>s.to===from&&s.launched&&!s.intercepted),orbital=state.satellites.some(s=>s.target===from&&['transit','charging','firing'].includes(s.phase));
 if(has('mines')&&!a.mines&&(incoming||orbital||f.profile==='defensive')){
  f.energy-=28;a.ready.mines=state.time+28;a.mines=5;a.minesUntil=state.time+16;f.strategy='Pose un champ de mines orbitales';events.push({type:'minesDeployed',from});return 'action';
 }
 if(has('siphon')&&!a.siphon&&target.shield>=10&&f.shield<35){
  f.energy-=25;a.ready.siphon=state.time+26;a.siphon={to,start:state.time,until:state.time+4};f.strategy='Siphonne le bouclier adverse';events.push({type:'siphonStart',from,to});return 'action';
 }
 if(a.disabledUntil>state.time){f.strategy='Silos neutralisés · '+Math.ceil(a.disabledUntil-state.time)+' s';return 'wait';}
 if(has('disarm')&&f.zones.some(z=>z.type==='silo'&&z.hp>0)&&target.arsenal?.disabledUntil<=state.time&&target.zones.some(z=>z.type==='silo'&&z.hp>0)){
  a.ready.disarm=state.time+19;f.strategy='Neutralise les silos adverses';return 'disarm';
 }
 return null;
}
export function shieldSector(f,point){
 const origin=f.zones[0]?.point||f,lat=f.lat??origin.lat??0,lon=f.lon??origin.lon??0;
 const dx=(((point?.lon??lon)-lon+540)%360-180)*Math.cos(lat*Math.PI/180),dy=(point?.lat??lat)-lat;
 return Math.min(5,Math.floor((Math.atan2(dy,dx)+Math.PI)/(Math.PI*2)*6));
}
export function reactiveDamage(state,to,amount,point){
 const f=state.fighters[to],a=f.arsenal;if(a?.shield!=='reactive'||f.shield<=0)return amount;
 const sector=shieldSector(f,point),result=amount*(1-a.facets[sector]);a.lastSector=sector;
 // Continuous beams adapt by energy received, not by frame count.
 for(let i=0;i<6;i++)a.facets[i]=Math.max(0,Math.min(.42,a.facets[i]+(i===sector?.012:-.006)*amount));
 return result;
}
export function reflectEnergy(state,from,to,absorbed,kind,events,damage){
 const f=state.fighters[to],a=f.arsenal;
 if(a?.shield!=='mirror'||!['laser','siphon'].includes(kind)||a.overheatedUntil>state.time||absorbed<=0||state.fighters[from].hp<=0)return;
 const reflected=absorbed*.35;a.heat=Math.min(15,a.heat+reflected*2);a.reflected+=reflected;
 damage(to,from,reflected,events,'reflection');
 if(state.time-a.reflectAt>=.3){a.reflectAt=state.time;events.push({type:'mirrorReflect',from:to,to:from});}
 if(a.heat>=12){a.heat=0;a.overheatedUntil=state.time+6;events.push({type:'mirrorOverheat',from:to});}
}
export function disarmImpact(state,flight,events){
 const target=state.fighters[flight.to],a=target.arsenal;if(!a||target.hp<=0)return;
 const seconds=target.shield>=16?1.5:5;
 a.disabledUntil=Math.max(a.disabledUntil,state.time+seconds);target.strategy='Silos neutralisés';events.push({type:'silosDisabled',from:flight.from,to:flight.to,seconds});
}
export function mineIntercept(state,flight,events){
 const a=state.fighters[flight.to].arsenal;
 if(!a||a.mines<=0||a.minesUntil<=state.time||flight.intercepted||(state.time-flight.start)/flight.duration<.84)return;
 a.mines--;a.mineKills++;flight.intercepted=true;flight.mineIntercepted=true;flight.interceptAt=.92;flight.defenseChecked=true;events.push({type:'mineTriggered',from:flight.to,flight});
}
export function mineRepelSatellite(state,satellite,events){
 const a=state.fighters[satellite.target]?.arsenal;
 if(!a||a.mines<2||a.minesUntil<=state.time)return false;
 a.mines-=2;a.mineKills++;events.push({type:'mineSatellite',from:satellite.target,to:satellite.owner});return true;
}
export function stepArsenal(state,dt,{friendly,damage,events}){
 state.arsenalLinks=[];if(!state.specialArsenal)return;
 for(let i=0;i<state.fighters.length;i++){
  const f=state.fighters[i],a=f.arsenal;if(!a)continue;
  if(f.hp<=0){a.siphon=null;a.mines=0;continue;}
  a.heat=Math.max(0,a.heat-dt*.6);if(state.time>=a.minesUntil)a.mines=0;
  const channel=a.siphon;
  if(channel){
   const target=state.fighters[channel.to],slice=Math.max(0,Math.min(state.time,channel.until)-Math.max(state.time-dt,channel.start));
   if(target.hp>0&&!friendly(i,channel.to)&&target.shield>0&&slice>0){
    const hit=damage(i,channel.to,Math.min(target.shield,6*slice),events,'siphon');
    const gain=Math.min(40-f.shield,hit.absorbed*.45);f.shield+=gain;a.stolen+=gain;
   }
   if(state.time>=channel.until||target.hp<=0||target.shield<=0||friendly(i,channel.to))a.siphon=null;
  }
  if(a.shield==='network'&&f.energy>3&&f.shield>8){
   const allies=state.fighters.map((other,j)=>({other,j})).filter(({other,j})=>j!==i&&other.hp>0&&friendly(i,j)&&other.shield<f.shield-6).sort((x,y)=>x.other.shield-y.other.shield);
   if(allies.length){const {other,j}=allies[0],amount=Math.min(dt*7,(f.shield-other.shield)/2,f.shield-8,40-other.shield,f.energy/.6);
    if(amount>0){f.shield-=amount;other.shield+=amount;f.energy-=amount*.6;a.shared+=amount;state.arsenalLinks.push({from:i,to:j,amount});}}
  }
 }
}
