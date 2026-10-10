import {createGame, movePlayer, step, REWARDS} from './game.mjs';
const $ = selector => document.querySelector(selector);
const canvas = $('#field'), ctx = canvas.getContext('2d');
export let game = createGame();
let width, height, last = 0, pointer = null, toastUntil = 0, best = 0;
const images = {};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
try { best = Math.max(0, Number(localStorage.getItem('yf-kitty.lane-shooter.v1')) || 0); } catch {}
$('#record').textContent = `最好成绩 · ${best}`;
const ids = {mouse:'character.rodent.mouse.v1', hamster:'character.rodent.hamster.v1', golden:'character.rodent.golden.v1', cat:'character.cat-ranger.back.v1', road:'background.lane-road.v1', crate:'prop.upgrade-crate.v1'};
try {
  const catalog = await fetch('../../assets/catalog.json').then(r => {if (!r.ok) throw Error('catalog'); return r.json();});
  await Promise.all(Object.entries(ids).map(async ([name,id]) => {
    const asset = catalog.assets.find(a => a.id === id);
    const img = new Image(); img.src = `../../${asset.path}`; await img.decode(); images[name] = img;
  }));
  for (const name of ['mouse','hamster','golden']) { const img = images[name].cloneNode(); $('.cast').append(img); }
  $('#start').disabled = false; $('#start').textContent = '开始守护';
} catch { $('#description').textContent = '素材加载失败，请刷新重试。'; }
function resize() {
  width = canvas.clientWidth; height = canvas.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
}
new ResizeObserver(resize).observe(canvas); resize();
const project = (x,z) => ({x: width/2 + (x-.5)*width*(.96-.74*Math.min(1,z)), y: height*(.86-.63*z), scale:.22+.74*(1-Math.min(1,z))});
function ellipse(x,y,rx,ry,fill,stroke) { ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();} }
function text(value,x,y,size=12,color='#665346') {ctx.font=`600 ${size}px "PingFang SC",sans-serif`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(value,x,y);}
function render() {
  ctx.clearRect(0,0,width,height);
  if (images.road) ctx.drawImage(images.road,0,0,width,height);
  const actors = [...game.enemies,...game.gates].sort((a,b)=>b.z-a.z);
  for (const a of actors) {
    if (a.z > 1) continue;
    const p=project(a.x,a.z), isGate=!!a.reward;
    const w = width*p.scale*(isGate?.25:a.size), h = w*(isGate?1:256/224);
    const sway=reduced?0:Math.sin(game.time*8+a.id)*Math.min(3,w*.04);
    ellipse(p.x,p.y,w*.34,w*.07,'#67534118');
    ctx.save();ctx.globalAlpha = game.time-(a.hitAt??-1)<.08?.55:1;
    ctx.drawImage(isGate?images.crate:images[a.type==='boss'?'golden':a.type],p.x-w/2+sway,p.y-h,w,h);ctx.restore();
    if (isGate) {
      text(a.reward==='rate'?'»':a.reward==='dual'?'••':'✦',p.x-w*.06,p.y-h*.44,Math.max(11,w*.2));
      text(`${Math.ceil(a.hp)}`,p.x,p.y+12,11);
      if (p.scale>.45) text(REWARDS[a.reward],p.x,p.y-h-6,10);
    } else if (a.type==='boss') text('♛',p.x,p.y-h+5,22,'#b88b38');
    else if (a.maxHp>1 && a.hp<a.maxHp) {
      ctx.fillStyle='#d8c6ac';ctx.fillRect(p.x-w*.3,p.y-h-7,w*.6,3);
      ctx.fillStyle='#98ad86';ctx.fillRect(p.x-w*.3,p.y-h-7,w*.6*a.hp/a.maxHp,3);
    }
  }
  for (const b of game.bullets) {const p=project(b.x,b.z);const r=3+p.scale*3+game.weapon.damage*.3;ellipse(p.x,p.y,r,r,'#e7f4eecc','#85b9ba');ellipse(p.x-r*.3,p.y-r*.3,r*.2,r*.2,'#fff');}
  for (const a of game.particles) {const p=project(a.x,a.z);ctx.save();ctx.globalAlpha=1-a.age/a.life;ellipse(p.x,p.y,3+a.age*9,3+a.age*9,a.type==='paper'?'#d8bb83':'#ffffff44',a.type==='paper'?null:'#9ab9b0');ctx.restore();}
  if(images.cat){const p=project(game.playerX,.035),w=Math.min(86,width*.22),h=w*1.25;ctx.save();if(game.time<game.hitUntil)ctx.globalAlpha=.6;ctx.drawImage(images.cat,p.x-w/2,p.y-h+18,w,h);ctx.restore();}
}
function syncHud() {
  $('#score').textContent=game.score;$('#lives').textContent='♥ '.repeat(game.lives)+'♡ '.repeat(3-game.lives);$('#lives').setAttribute('aria-label',`${game.lives}颗爱心`);
  $('#weapon').textContent=`${['','单发','双发','三发'][game.weapon.barrels]} · ${game.weapon.rate.toFixed(1).replace('.0','')} / 秒${game.weapon.damage>1?` · 威力 ${game.weapon.damage}`:''}`;
  $('#timer').textContent=`${String(Math.floor(game.time/60)).padStart(2,'0')}:${String(Math.floor(game.time%60)).padStart(2,'0')}`;
  const boss=game.enemies.find(a=>a.type==='boss');$('#boss').hidden=!boss;if(boss)$('#boss progress').value=boss.hp;
}
function notice(message) { $('#toast').textContent=message;$('#toast').classList.add('visible');toastUntil=performance.now()+1800; }
function cover(title,description,button) {
  $('#cover').hidden=false;$('h1').textContent=title;$('.subtitle').textContent=game.status==='paused'?'小猫休息一下':'纸上冒险 · 第一关';$('#description').textContent=description;$('#start').textContent=button;
}
function end() {
  best=Math.max(best,game.score);try{localStorage.setItem('yf-kitty.lane-shooter.v1',String(best));}catch{}
  $('#record').textContent=`最好成绩 · ${best}`;$('#pause').disabled=true;
  cover(game.status==='won'?'守护成功！':'再试一次吧',`得分 ${game.score} · 赶跑 ${game.kills} 只鼠鼠`,'再玩一局');
}
$('#start').addEventListener('click',()=>{
  if(game.status==='paused') game.status='running';
  else {game=createGame();game.status='running';notice('左右拖动，瞄准补给箱');}
  $('#cover').hidden=true;$('#pause').disabled=false;last=performance.now();
});
function pause() {if(game.status!=='running')return;game.status='paused';pointer=null;cover('稍作休息','升级箱需要用泡泡打破，留意另一边的鼠鼠。','继续守护');}
$('#pause').addEventListener('click',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function aim(event) {const r=canvas.getBoundingClientRect();movePlayer(game,.5+(event.clientX-r.left-width/2)/(width*.934));}
canvas.addEventListener('pointerdown',event=>{if(game.status!=='running')return;pointer=event.pointerId;canvas.setPointerCapture(pointer);aim(event);});
canvas.addEventListener('pointermove',event=>{if(event.pointerId===pointer)aim(event);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{pointer=null;});
window.addEventListener('keydown',event=>{if(game.status!=='running')return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();movePlayer(game,event.key==='ArrowLeft'?.27:.73);}});
function frame(now) {
  step(game,Math.min((now-last)/1000,.05));last=now;
  for(const event of game.events.splice(0)) {if(event.type==='upgrade')notice(REWARDS[event.reward]+'！');if(event.type==='boss')notice('金丝熊队长来啦！');if(event.type==='hurt')notice('鼠鼠溜过去了，爱心 −1');if(event.type==='end')end();}
  if(now>toastUntil)$('#toast').classList.remove('visible');
  if(images.cat){render();syncHud();}requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
