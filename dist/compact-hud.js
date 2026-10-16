// Reserve the space actually occupied by panels instead of fixed roster heights.
export function createCompactHUD(){
 const world=document.querySelector('.world'),scoreboard=document.querySelector('.scoreboard'),ship=document.querySelector('#invasion-hud'),dock=document.querySelector('.battle-dock');
 let pending=false;
 function measure(){
  pending=false;
  const mobile=innerWidth<=700;
  const top=ship.hidden?50:ship.offsetTop+ship.offsetHeight+6;
  scoreboard.style.setProperty('top',top+'px','important');
  const playTop=Math.ceil(top+scoreboard.offsetHeight+10);
  // Bottom is measured independently of the world's height to avoid resize loops.
  const dockBottom=parseFloat(getComputedStyle(dock).bottom)||0;
  const bottom=Math.ceil(dock.offsetHeight+dockBottom+16);
  const header=document.querySelector('header').offsetHeight;
  const height=Math.ceil(Math.max(innerHeight-header,playTop+bottom+(mobile?450:470)));
  world.style.setProperty('--play-top',playTop+'px');world.style.setProperty('--play-bottom',bottom+'px');world.style.setProperty('--arena-height',height+'px');
  world.style.setProperty('--controls-top',(playTop+(height-playTop-bottom)/2)+'px');
 }
 function schedule(){if(pending)return;pending=true;requestAnimationFrame(measure);}
 const observer=new ResizeObserver(schedule);[scoreboard,ship,dock].forEach(el=>observer.observe(el));
 new MutationObserver(schedule).observe(ship,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('resize',schedule);schedule();
 return {measure:schedule};
}

