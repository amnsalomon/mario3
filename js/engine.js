/* Independent, deterministic platform game. Original series: Nintendo. */
(() => {
'use strict';
const TILE=16,W=384,H=256,PLAY=224;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const noise=n=>{let x=Math.imul(n|0,374761393)+1988|0;x=Math.imul(x^(x>>>13),1274126177);return ((x^(x>>>16))>>>0)/4294967296;};
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const WORLDS=[
 {name:'REINO DOS CAMPOS',theme:'grass',sky:'#77bfe8',land:'#67ad46',ink:'#24463e'},
 {name:'DUNAS DO DESERTO',theme:'desert',sky:'#f2d288',land:'#dfa34f',ink:'#654927'},
 {name:'ILHAS DO MAR',theme:'water',sky:'#83d3e9',land:'#4caaa5',ink:'#234c70'},
 {name:'TERRA GIGANTE',theme:'giant',sky:'#98cce9',land:'#73b145',ink:'#305932'},
 {name:'REINO DAS NUVENS',theme:'sky',sky:'#86cbe9',land:'#e7dcb8',ink:'#466a91'},
 {name:'TERRAS DE GELO',theme:'ice',sky:'#9dc7df',land:'#cde9e7',ink:'#4d6e96'},
 {name:'LABIRINTO DOS CANOS',theme:'pipe',sky:'#8dc8d7',land:'#6e9c6b',ink:'#28574f'},
 {name:'CASTELO DE BOWSER',theme:'lava',sky:'#272a41',land:'#84616b',ink:'#201f32'}
];
const BLOCK={GROUND:1,BRICK:2,QUESTION:3,USED:4,STONE:5,PIPE_TL:6,PIPE_TR:7,PIPE_L:8,PIPE_R:9,PLATFORM:10,ICE:11,WOOD:12,SPIKE:13,LAVA:14};
const solid=t=>t>0&&t!==10&&t!==13&&t!==14;
function createLevel(index,bonus=false){
 const world=Math.floor(index/6),slot=index%6,spec=WORLDS[world];
 let theme=slot===3?'castle':slot===5?'airship':spec.theme;
 if(slot===1&&[0,3,6].includes(world))theme='underground';
 if(world===7&&slot===5)theme='bowser';
 if(bonus)theme='underground';
 const water=theme==='water',width=bonus?32:144+slot*8+world*2;
 const l={index,world,slot,theme,water,bonus,width:width*TILE,cols:width,rows:14,tiles:Array.from({length:14},()=>Array(width).fill(0)),
   blocks:{},enemies:[],items:[],coins:[],platforms:[],pipes:[],goal:{x:(width-5)*TILE,y:144,w:24,h:40},boss:null};
 const set=(x,y,t)=>{if(x>=0&&x<width&&y>=0&&y<14)l.tiles[y][x]=t;};
 const groundType=theme==='ice'?11:['airship','bowser'].includes(theme)?12:['castle','underground'].includes(theme)?5:1;
 for(let x=0;x<width;x++)for(let y=12;y<14;y++)set(x,y,groundType);
 if(theme==='underground')for(let x=0;x<width;x++)set(x,0,5);
 const coin=(x,y)=>l.coins.push({x:x*TILE+4,y:y*TILE+2,w:8,h:12,taken:false});
 const block=(x,y,type=3,item='coin')=>{set(x,y,type);l.blocks[x+','+y]={item,bump:0};};
 const pipe=(x,height=2,secret=false)=>{
  const top=12-height;set(x,top,6);set(x+1,top,7);
  for(let y=top+1;y<12;y++){set(x,y,8);set(x+1,y,9);}
  if(secret)l.pipes.push({x:x*TILE,y:top*TILE,w:32,exitX:(x+4)*TILE});
 };
 const enemy=(type,x,y=11,extra={})=>l.enemies.push({id:l.enemies.length,type,x:x*TILE,y:y*TILE,w:type==='koopa'?14:16,h:type==='koopa'?24:16,vx:type==='koopa'?-30:-25,vy:0,dir:-1,dead:false,active:false,grounded:false,timer:0,invuln:0,...extra});
 if(bonus){
  for(let x=6;x<24;x+=2)for(let y=6;y<10;y+=2)coin(x,y);
  for(let x=6;x<24;x++)set(x,10,2);
  block(14,5,3,'star');pipe(27,2,true);l.goal=null;return l;
 }
 // First stretch is a safe runway, with the classic power-up progression.
 block(10,8,3,'power');block(12,8,2);block(13,8,3,'coin');block(14,8,2);block(18,5,3,'leaf');
 for(let x=20;x<=23;x++)coin(x,8);
 enemy('goomba',19,11);pipe(28,2,slot%2===0);
 if(slot>0)enemy('koopa',24,10.5);
 for(let segment=0;segment<5;segment++){
  const x=36+segment*18,kind=(slot+segment+world)%5;
  if(x>width-34)continue;
  if(kind===0){
   const gap=world>3?4:3;
   for(let q=x+6;q<x+6+gap;q++)for(let y=12;y<14;y++)set(q,y,theme==='lava'?14:0);
   for(let q=0;q<5;q++)coin(x+4+q,7-Math.round(Math.sin(q/4*Math.PI)*2));
   for(let q=0;q<3;q++)set(x+1+q,10,10);
   enemy(world>4?'koopa':'goomba',x+12,11);
  }else if(kind===1){
   pipe(x+4,2+(world%2),world===6);enemy('piranha',x+4+.5,8,{w:16,h:24,vx:0,baseY:(12-2-world%2)*16,timer:segment});
   for(let q=0;q<4;q++)block(x+10+q,8,q===1?3:2,q===1?(segment%2?'power':'coin'):'coin');
   enemy('koopa',x+14,10.5);
  }else if(kind===2){
   for(let q=0;q<5;q++){set(x+q,10,10);coin(x+q,8);}for(let q=0;q<4;q++)set(x+7+q,7,10);
   block(x+8,4,3,segment===2?'star':'coin');enemy('goomba',x+12,11);
   if(world>=3)l.platforms.push({x:(x+13)*16,y:144,w:40,h:8,baseX:(x+13)*16,baseY:144,axis:'y',amp:30,rate:1.2,phase:segment});
  }else if(kind===3){
   for(let q=0;q<4;q++)for(let y=11-q;y<12;y++)set(x+4+q,y,groundType);
   for(let q=0;q<4;q++)for(let y=8+q;y<12;y++)set(x+8+q,y,groundType);
   coin(x+7,6);coin(x+8,6);enemy('goomba',x+14,11);
  }else{
   for(let q=0;q<6;q++)block(x+3+q,8,q%2?2:3,q===2?'power':'coin');
   enemy('goomba',x+5,11);enemy('koopa',x+11,10.5);
   if(world>=4)enemy('goomba',x+15,11);
  }
 }
 if(water){
  // A continuous seabed and swimming leave room to pass every obstacle.
  for(let x=0;x<width;x++)for(let y=12;y<14;y++)set(x,y,1);
  l.enemies=l.enemies.filter(e=>e.type==='piranha');
  for(let x=22;x<width-20;x+=13)enemy('fish',x,5+Math.floor(noise(x)*5),{vx:-24,baseY:(5+Math.floor(noise(x)*5))*16});
  for(let x=34;x<width-20;x+=17){coin(x,4);coin(x+1,4);coin(x+2,4);}
 }
 if(['castle','airship','bowser','lava'].includes(theme)){
  for(let x=34;x<width-35;x+=23){if(theme==='castle'||theme==='lava')set(x,11,13);else enemy('cannon',x,10,{w:16,h:32,vx:0,timer:1.6});}
 }
 // End runway has no random obstacles and enough space for the boss encounter.
 for(let x=width-27;x<width;x++)for(let y=1;y<12;y++)set(x,y,0);
 l.enemies=l.enemies.filter(e=>e.x<(width-28)*16);
 if(slot===3||slot===5){
  const bowser=theme==='bowser';l.boss={type:bowser?'bowser':'boss',x:(width-14)*16,y:bowser?148:160,w:bowser?38:30,h:bowser?44:32,
    vx:bowser?0:-55,vy:0,hp:3,dead:false,grounded:false,timer:2.4,invuln:0,slams:0,air:false};
  l.arenaStart=(width-25)*16;l.goal.y=144;
 }
 for(let x=width-8;x<width-5;x++)coin(x,9);
 return l;
}
class MarioGame{
 constructor(){this.newGame();this.mode='title';}
 newGame(){
  this.mode='map';this.stage=0;this.highest=0;this.completed=[];this.lives=3;this.score=0;this.coins=0;this.cards=[];
  this.inventory=[];this.toadVisits=[];this.savedPower='small';this.pendingStar=0;this.events=[];this.particles=[];this.projectiles=[];
  this.clock=0;this.prev={};this.camera=0;this.deathTimer=0;this.clearTimer=0;this.returnLevel=null;this.level=null;this.player=null;
 }
 emit(type,data={}){this.events.push({type,...data});}
 takeEvents(){const e=this.events;this.events=[];return e;}
 get world(){return Math.floor(this.stage/6);}
 get slot(){return this.stage%6;}
 get music(){if(this.mode==='map'||this.mode==='title')return 'map';if(this.player?.star>0)return 'star';return ({grass:'overworld',desert:'overworld',giant:'overworld',sky:'overworld',ice:'overworld',pipe:'overworld',water:'water',underground:'underground',castle:'castle',lava:'castle',bowser:'castle',airship:'airship'})[this.level?.theme]||'overworld';}
 exportSave(){return {version:1,stage:this.stage,highest:this.highest,completed:[...this.completed],lives:Math.max(3,this.lives),score:this.score,coins:this.coins,cards:[...this.cards],inventory:[...this.inventory],toadVisits:[...this.toadVisits],power:this.savedPower};}
 loadSave(s){
  if(!s||s.version!==1||!Number.isInteger(s.highest)||s.highest<0||s.highest>47||!Number.isInteger(s.stage)||s.stage<0||s.stage>s.highest)return false;
  const items=['mushroom','leaf','flower','star'];this.newGame();this.stage=s.stage;this.highest=s.highest;
  this.completed=Array.isArray(s.completed)?[...new Set(s.completed.filter(n=>Number.isInteger(n)&&n>=0&&n<48&&n<=s.highest))]:[];
  this.lives=clamp(Math.floor(Number(s.lives)||3),1,99);this.score=clamp(Math.floor(Number(s.score)||0),0,9999999);this.coins=clamp(Math.floor(Number(s.coins)||0),0,99);
  this.inventory=(Array.isArray(s.inventory)?s.inventory:[]).filter(n=>items.includes(n)).slice(0,8);this.cards=(Array.isArray(s.cards)?s.cards:[]).filter(n=>['mushroom','flower','star'].includes(n)).slice(0,2);
  this.toadVisits=(Array.isArray(s.toadVisits)?s.toadVisits:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<8);this.savedPower=['small','big','raccoon','fire'].includes(s.power)?s.power:'small';return true;
 }
 selectStage(delta){if(this.mode!=='map')return;this.stage=clamp(this.stage+delta,0,this.highest);this.emit('select');}
 visitToad(){
  if(this.mode!=='map'||this.toadVisits.includes(this.world)||this.inventory.length>=8)return false;
  const item=['leaf','flower','star','mushroom'][this.world%4];this.inventory.push(item);this.toadVisits.push(this.world);this.emit('gift',{item});return true;
 }
 useItem(i){if(this.mode!=='map'||!this.inventory[i])return false;const item=this.inventory.splice(i,1)[0];
  if(item==='star')this.pendingStar=12;else this.savedPower={mushroom:'big',leaf:'raccoon',flower:'fire'}[item];this.emit('powerup');return true;}
 enterStage(index=this.stage){
  if(!Number.isInteger(index)||index<0||index>this.highest)return false;
  this.stage=index;this.level=createLevel(index);this.returnLevel=null;this.mode='playing';this.time=300;this.hurry=false;
  this.camera=0;this.clock=0;this.particles=[];this.projectiles=[];this.prev={};
  const power=this.savedPower,h=power==='small'?16:28;
  this.player={x:40,y:192-h,w:14,h,power,vx:0,vy:0,facing:1,grounded:true,duck:false,star:this.pendingStar,invuln:0,
    pMeter:0,flight:0,tail:0,attackCooldown:0,carry:null,coyote:0,jumpBuffer:0,pipeCooldown:0};this.pendingStar=0;
  this.emit('enterStage',{stage:index});return true;
 }
 pause(){if(['playing','map','dying','clear'].includes(this.mode)){this.beforePause=this.mode;this.mode='paused';this.emit('pause');}}
 resume(){if(this.mode==='paused'){this.mode=this.beforePause;this.prev={};this.emit('resume');}}
 returnToMap(){if(this.mode==='title')return;this.mode='map';this.savedPower=this.player?.power||this.savedPower;this.returnLevel=null;this.emit('map');}
 continueGame(){this.lives=3;this.savedPower='small';this.stage=Math.floor(this.stage/6)*6;this.mode='map';this.emit('map');}
 tile(tx,ty){if(tx<0||tx>=this.level.cols)return 5;if(ty<0||ty>=14)return 0;return this.level.tiles[ty][tx];}
 colliders(box,oneWay=false){
  const out=[];for(let y=Math.floor(box.y/16);y<=Math.floor((box.y+box.h-.01)/16);y++)for(let x=Math.floor(box.x/16);x<=Math.floor((box.x+box.w-.01)/16);x++){
   const t=this.tile(x,y);if(solid(t)||(oneWay&&t===10))out.push({x:x*16,y:y*16,w:16,h:16,tx:x,ty:y,t});
  }return out;
 }
 moveBody(b,dt,{player=false,oneWay=true}={}){
  const oldY=b.y;b.x+=b.vx*dt;let hitX=false;
  for(const c of this.colliders(b)){if(!overlap(b,c))continue;if(b.type==='shell'&&Math.abs(b.vx)>100&&[2,3].includes(c.t)){this.hitBlock(c.tx,c.ty,true);if(this.tile(c.tx,c.ty)===0)continue;}if(b.vx>0)b.x=c.x-b.w;else if(b.vx<0)b.x=c.x+c.w;hitX=true;}
  if(hitX){if(player)b.vx=0;else b.vx*=-1;}
  b.y+=b.vy*dt;b.grounded=false;let hitY=false;
  for(const c of this.colliders(b,oneWay)){
   if(c.t===10&&(b.vy<0||oldY+b.h>c.y+2))continue;if(!overlap(b,c))continue;
   if(b.vy>0){b.y=c.y-b.h;b.grounded=true;}else if(b.vy<0){b.y=c.y+c.h;if(player)this.hitBlock(c.tx,c.ty);}
   b.vy=0;hitY=true;
  }
  if(oneWay&&b.vy>=0)for(const platform of this.level.platforms){
   if(b.x+b.w>platform.x&&b.x<platform.x+platform.w&&oldY+b.h<=platform.oldY+3&&b.y+b.h>=platform.y&&b.y<platform.y){b.y=platform.y-b.h;b.vy=0;b.grounded=true;b.x+=platform.dx||0;}
  }
  return {hitX,hitY};
 }
 scorePoints(n,x=this.player?.x||0,y=this.player?.y||0){this.score=Math.min(9999999,this.score+n);this.particles.push({kind:'text',text:String(n),x,y,vy:-18,life:.8});}
 addCoin(x,y){this.coins++;this.scorePoints(50,x,y);this.emit('coin');if(this.coins>=100){this.coins-=100;this.lives=Math.min(99,this.lives+1);this.emit('oneup');}}
 debris(x,y,color='#d18a48'){for(let i=0;i<6;i++)this.particles.push({kind:'debris',x:x+8,y:y+8,vx:(i%3-1)*60,vy:-90-i*14,life:.65,color});}
 hitBlock(tx,ty,force=false){
  const t=this.tile(tx,ty),key=tx+','+ty;if(![2,3,4].includes(t))return;
  const data=this.level.blocks[key]||(this.level.blocks[key]={item:'coin',bump:0});if(data.bump>0)return;
  if(t===4){this.emit('bump');return;}data.bump=.18;
  if(t===2){
   if(this.player.power!=='small'||force){this.level.tiles[ty][tx]=0;this.debris(tx*16,ty*16);this.scorePoints(10,tx*16,ty*16);this.emit('break');}
   else this.emit('bump');
  }else{
   this.level.tiles[ty][tx]=4;let item=data.item;
   if(item==='coin'){this.addCoin(tx*16,ty*16-16);this.particles.push({kind:'coin',x:tx*16+4,y:ty*16-12,vy:-70,life:.45});}
   else{
    if(item==='power')item=this.player.power==='small'?'mushroom':(this.world%2?'flower':'leaf');
    if(item==='leaf'&&this.player.power==='small')item='mushroom';
    this.level.items.push({type:item,x:tx*16,y:ty*16-16,w:16,h:16,vx:item==='flower'?0:32,vy:0,life:0,grounded:false});this.emit('powerup');
   }
  }
  for(const e of this.level.enemies)if(!e.dead&&e.x+e.w>tx*16&&e.x<tx*16+16&&Math.abs(e.y+e.h-ty*16)<5)this.defeat(e,'bump');
 }
 setPower(power){const p=this.player;const h=power==='small'?16:28;p.y+=p.h-h;p.h=h;p.power=power;p.duck=false;this.savedPower=power;this.emit('powerup');}
 collectItem(item){item.dead=true;if(item.type==='star'){this.player.star=12;this.emit('powerup');}else this.setPower({mushroom:'big',leaf:'raccoon',flower:'fire'}[item.type]);this.scorePoints(1000,item.x,item.y);}
 damage(){
  const p=this.player;if(this.mode!=='playing'||p.invuln>0||p.star>0)return;
  if(p.power!=='small'){const bottom=p.y+p.h;p.power='small';p.h=16;p.y=bottom-16;p.invuln=2;p.flight=0;p.pMeter=0;this.savedPower='small';this.releaseShell();this.emit('powerdown');}
  else this.die();
 }
 die(){if(this.mode!=='playing')return;this.mode='dying';this.deathTimer=1.6;this.player.vy=-240;this.player.vx=0;this.savedPower='small';this.releaseShell();this.emit('death');}
 defeat(e,kind='stomp'){
  if(e.dead)return;e.dead=true;e.deathKind=kind;e.deathTime=.4;e.vy=-130;this.scorePoints(e.type==='boss'?1000:100,e.x,e.y);this.emit(kind==='stomp'?'stomp':'kick');
 }
 releaseShell(){const p=this.player;if(!p?.carry)return;const e=p.carry;e.held=false;e.x=p.x+(p.facing>0?p.w+2:-e.w-2);e.y=p.y+p.h-e.h;e.vx=p.facing*225;e.grace=.25;p.carry=null;this.emit('kick');}
 attack(){
  const p=this.player;if(p.attackCooldown>0)return;
  if(p.power==='fire'&&this.projectiles.filter(a=>a.kind==='fire').length<2){this.projectiles.push({kind:'fire',x:p.x+(p.facing>0?16:-6),y:p.y+10,w:6,h:6,vx:p.facing*230,vy:40,life:3});p.attackCooldown=.2;this.emit('fire');}
  if(p.power==='raccoon'){
   p.tail=.22;p.attackCooldown=.35;this.emit('tail');
   const hit={x:p.x-12,y:p.y+8,w:p.w+24,h:20};
   for(const e of this.level.enemies)if(!e.dead&&!e.held&&overlap(hit,e))this.defeat(e,'tail');
   for(const b of this.colliders(hit))if([2,3].includes(b.t))this.hitBlock(b.tx,b.ty,true);
  }
 }
 enterPipe(){
  const p=this.player;if(!p.grounded||p.pipeCooldown>0)return false;
  const pipe=this.level.pipes.find(q=>p.x+p.w/2>q.x+6&&p.x+p.w/2<q.x+q.w-6&&Math.abs(p.y+p.h-q.y)<3);if(!pipe)return false;
  if(this.level.bonus){const state=this.returnLevel;this.level=state.level;p.x=state.x;p.y=192-p.h;this.camera=state.camera;this.returnLevel=null;}
  else{this.returnLevel={level:this.level,x:pipe.exitX,camera:this.camera};this.level=createLevel(this.stage,true);p.x=32;p.y=192-p.h;this.camera=0;}
  p.vx=0;p.vy=0;p.pipeCooldown=1;this.projectiles=[];this.emit('pipe');return true;
 }
 clearStage(){
  if(this.mode!=='playing'||this.level.bonus)return;
  if(this.level.boss&&!this.level.boss.dead)return;
  this.mode='clear';this.clearTimer=2.4;this.scorePoints(Math.ceil(this.time)*10);this.savedPower=this.player.power;
  const card=['mushroom','flower','star'][Math.floor(this.clock*5)%3];this.cards.push(card);
  if(this.cards.length===3){const match=this.cards.every(c=>c===this.cards[0]);this.lives=Math.min(99,this.lives+(match?{mushroom:2,flower:3,star:5}[card]:1));this.cards=[];this.emit('oneup');}
  if(!this.completed.includes(this.stage))this.completed.push(this.stage);
  this.highest=Math.max(this.highest,Math.min(47,this.stage+1));
  this.emit(this.stage===47?'victory':this.slot===5?'worldClear':'clear');
 }
 updateBoss(dt){
  const b=this.level.boss,p=this.player;if(!b||b.dead||p.x<this.level.arenaStart-60)return;
  b.invuln=Math.max(0,b.invuln-dt);b.timer-=dt;b.vy+=900*dt;
  if(b.type==='bowser'){
   if(b.timer<=0&&b.grounded){b.vy=-330;b.vx=clamp((p.x-b.x)*.8,-90,90);b.air=true;b.timer=3;}
   if(b.timer>1.4&&b.timer<1.4+dt)this.projectiles.push({kind:'enemy',x:b.x,y:b.y+14,w:9,h:8,vx:p.x<b.x?-90:90,vy:0,life:5});
  }else if(b.timer<=0&&b.grounded){b.vy=-260;b.vx=p.x<b.x?-70:70;b.timer=1.8;}
  const wasAir=b.air;this.moveBody(b,dt);if(b.x<this.level.arenaStart){b.x=this.level.arenaStart;b.vx=Math.abs(b.vx);}if(b.x>this.level.width-90){b.x=this.level.width-90;b.vx=-Math.abs(b.vx);}
  if(b.type==='bowser'&&wasAir&&b.grounded){
   b.air=false;b.vx=0;b.slams++;this.debris(b.x+8,192);this.emit('break');
   if(b.slams>=3){const cx=Math.floor((b.x+b.w/2)/16);for(let x=cx-1;x<=cx+1;x++)for(let y=12;y<14;y++)this.level.tiles[y][x]=0;b.dead=true;this.scorePoints(5000,b.x,b.y);this.emit('worldClear');}
  }
  if(!b.dead&&overlap(p,b)){
   const stomp=p.vy>0&&p.y+p.h-b.y<15;
   if(stomp&&b.type!=='bowser'&&b.invuln===0){b.hp--;b.invuln=1;p.vy=-275;this.emit('stomp');if(b.hp<=0){b.dead=true;this.scorePoints(2000,b.x,b.y);this.emit('worldClear');}}
   else if(b.invuln===0)this.damage();
  }
 }
 updateEnemies(dt,input){
  const p=this.player;
  for(const e of this.level.enemies){
   if(e.dead){e.deathTime-=dt;e.y+=e.vy*dt;e.vy+=500*dt;continue;}
   if(e.x>this.camera+W+48||e.x+e.w<this.camera-96)continue;
   e.timer+=dt;e.grace=Math.max(0,(e.grace||0)-dt);
   if(e.held){e.x=p.x+(p.facing>0?p.w:-e.w);e.y=p.y+p.h-e.h-3;continue;}
   if(e.type==='piranha'){
    const wave=Math.sin(e.timer*1.8),near=Math.abs(p.x-e.x)<28;e.hidden=wave<0||near;e.y=e.baseY-(e.hidden?0:24*Math.max(0,wave));
    if(e.hidden)continue;
   }else if(e.type==='fish'){e.x+=e.vx*dt;e.y=e.baseY+Math.sin(e.timer*1.7)*22;}
   else if(e.type==='cannon'){
    if(e.timer>2.8){e.timer=0;this.projectiles.push({kind:'bullet',x:e.x,y:e.y+4,w:12,h:10,vx:p.x<e.x?-85:85,vy:0,life:6});this.emit('fire');}
   }else{e.vy=Math.min(420,e.vy+900*dt);this.moveBody(e,dt);if(e.y>PLAY+32){e.dead=true;continue;}}
   if(e.type==='shell'&&Math.abs(e.vx)>100){
    for(const other of this.level.enemies)if(other!==e&&!other.dead&&!other.held&&overlap(e,other))this.defeat(other,'shell');
   }
   if(!overlap(p,e)||e.grace>0)continue;
   if(p.star>0){this.defeat(e,'star');continue;}
   const stomp=!this.level.water&&p.vy>0&&(p.y+p.h-e.y<13)&&!['piranha','cannon'].includes(e.type);
   if(stomp){
    p.y=e.y-p.h;p.vy=input.jump?-350:-230;p.grounded=false;
    if(e.type==='koopa'){e.type='shell';e.y+=10;e.h=14;e.vx=0;e.timer=0;this.scorePoints(100,e.x,e.y);this.emit('stomp');}
    else if(e.type==='shell'){e.vx=Math.abs(e.vx)>0?0:p.facing*225;e.grace=.2;this.emit('kick');}
    else this.defeat(e,'stomp');
   }else if(e.type==='shell'&&e.vx===0){
    if(input.run&&!p.carry){p.carry=e;e.held=true;this.emit('select');}else{e.vx=(p.x<e.x?1:-1)*225;e.grace=.25;this.emit('kick');}
   }else this.damage();
  }
  this.level.enemies=this.level.enemies.filter(e=>!e.dead||e.deathTime>0);
 }
 updateProjectiles(dt){
  for(const a of this.projectiles){
   a.life-=dt;
   if(a.kind==='fire'){
    a.vy+=700*dt;const before=a.vx,hit=this.moveBody(a,dt);if(hit.hitX||a.vx!==before)a.life=0;if(a.grounded)a.vy=-180;
    for(const e of this.level.enemies)if(!e.dead&&!e.hidden&&e.type!=='cannon'&&overlap(a,e)){this.defeat(e,'fire');a.life=0;break;}
    const boss=this.level.boss;if(boss&&!boss.dead&&boss.type!=='bowser'&&boss.invuln<=0&&overlap(a,boss)){boss.hp-=.25;boss.invuln=.15;a.life=0;if(boss.hp<=0){boss.dead=true;this.scorePoints(2000,boss.x,boss.y);this.emit('worldClear');}}
   }else{a.x+=a.vx*dt;a.y+=a.vy*dt;if(overlap(a,this.player)){this.damage();a.life=0;}}
  }
  this.projectiles=this.projectiles.filter(a=>a.life>0&&a.y<PLAY+32&&a.x>this.camera-64&&a.x<this.camera+W+96);
 }
 step(dt,input={}){
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,1/30);
  if(this.mode==='paused'||this.mode==='map'||this.mode==='title'||this.mode==='gameover'||this.mode==='victory')return;
  this.clock+=dt;const p=this.player;
  if(this.mode==='dying'){
   this.deathTimer-=dt;p.vy+=650*dt;p.y+=p.vy*dt;
   if(this.deathTimer<=0){this.lives--;if(this.lives<=0){this.mode='gameover';this.emit('gameover');}else this.enterStage();}return;
  }
  if(this.mode==='clear'){
   this.clearTimer-=dt;if(this.clearTimer<=0){if(this.stage===47){this.mode='victory';this.emit('save');}else{this.stage=Math.min(47,this.stage+1);this.mode='map';this.emit('map');this.emit('save');}}return;
  }
  this.time=Math.max(0,this.time-dt);if(this.time<60&&!this.hurry){this.hurry=true;this.emit('hurry');}if(this.time<=0){this.die();return;}
  const move=clamp(Number(input.move)||0,-1,1),jumpPressed=!!input.jump&&!this.prev.jump,runPressed=!!input.run&&!this.prev.run;
  for(const key of ['star','invuln','flight','tail','attackCooldown','pipeCooldown','jumpBuffer'])p[key]=Math.max(0,p[key]-dt);
  if(jumpPressed)p.jumpBuffer=.1;
  if(p.grounded)p.coyote=.08;else p.coyote=Math.max(0,p.coyote-dt);
  const wantDuck=input.down&&p.grounded&&p.power!=='small';const wantedH=wantDuck||p.power==='small'?16:28;
  if(wantedH!==p.h){const box={...p,y:p.y+p.h-wantedH,h:wantedH};if(wantedH<p.h||this.colliders(box).length===0){p.y=box.y;p.h=wantedH;p.duck=!!wantDuck;}}
  const underwater=this.level.water&&p.y>38;
  const maxSpeed=underwater?(input.run?118:86):(input.run?205:116),accel=this.level.theme==='ice'&&p.grounded?410:900;
  if(move&&!p.duck){p.vx=clamp(p.vx+move*accel*dt,-maxSpeed,maxSpeed);p.facing=move>0?1:-1;}
  else{const friction=this.level.theme==='ice'?120:(p.grounded?1000:300);p.vx=Math.sign(p.vx)*Math.max(0,Math.abs(p.vx)-friction*dt);}
  if(p.grounded&&Math.abs(p.vx)>178&&input.run)p.pMeter=Math.min(1,p.pMeter+dt*.65);
  else if(p.flight===0)p.pMeter=Math.max(0,p.pMeter-dt*.45);
  if(underwater){if(jumpPressed){p.vy=-145;this.emit('jump');}p.vy=Math.min(95,p.vy+260*dt);}
  else{
   if(p.jumpBuffer>0&&p.coyote>0){p.vy=-(315+Math.abs(p.vx)*.2);p.grounded=false;p.coyote=0;p.jumpBuffer=0;
    if(p.power==='raccoon'&&p.pMeter>.98){p.flight=3.5;this.emit('fly');}else this.emit('jump');}
   else if(jumpPressed&&p.power==='raccoon'&&p.flight>0){p.vy=-210;this.emit('tail');}
   const gravity=p.vy<0&&input.jump?680:1100;p.vy=Math.min(490,p.vy+gravity*dt);
   if(p.power==='raccoon'&&input.jump&&p.vy>65)p.vy=65;
  }
  if(runPressed&&!p.carry)this.attack();if(p.carry&&!input.run)this.releaseShell();
  if(input.down&&!this.prev.down&&this.enterPipe()){this.prev={...input};return;}
  for(const platform of this.level.platforms){platform.oldY=platform.y;const oldX=platform.x;const wave=Math.sin(this.clock*platform.rate+platform.phase)*platform.amp;
   platform.x=platform.baseX+(platform.axis==='x'?wave:0);platform.y=platform.baseY+(platform.axis==='y'?wave:0);platform.dx=platform.x-oldX;}
  this.moveBody(p,dt,{player:true});p.x=clamp(p.x,0,this.level.width-p.w);p.y=Math.max(-32,p.y);
  if(p.y>PLAY+30){this.die();return;}
  const bottomRow=Math.floor((p.y+p.h-2)/16),leftCol=Math.floor(p.x/16),rightCol=Math.floor((p.x+p.w)/16);
  for(let x=leftCol;x<=rightCol;x++)if([13,14].includes(this.tile(x,bottomRow))){this.damage();break;}
  for(const coin of this.level.coins)if(!coin.taken&&overlap(p,coin)){coin.taken=true;this.addCoin(coin.x,coin.y);}
  for(const item of this.level.items){
   item.life+=dt;if(item.type==='leaf'){item.vy=Math.min(42,item.vy+100*dt);item.vx=Math.sin(item.life*4)*32;}else item.vy=Math.min(350,item.vy+700*dt);
   this.moveBody(item,dt);if(item.type==='star'&&item.grounded)item.vy=-180;
   if(!item.dead&&overlap(p,item))this.collectItem(item);
  }
  this.level.items=this.level.items.filter(a=>!a.dead&&a.y<PLAY+32);
  this.updateEnemies(dt,input);if(this.mode!=='playing')return;this.updateBoss(dt);this.updateProjectiles(dt);
  if(this.level.goal&&overlap(p,this.level.goal))this.clearStage();
  for(const data of Object.values(this.level.blocks))data.bump=Math.max(0,data.bump-dt);
  for(const a of this.particles){a.life-=dt;a.x+=(a.vx||0)*dt;a.y+=(a.vy||0)*dt;if(a.kind==='debris')a.vy+=450*dt;}
  this.particles=this.particles.filter(a=>a.life>0);
  this.camera=clamp(p.x-W*.38,0,this.level.width-W);this.prev={...input};
 }
}
globalThis.MarioCore={MarioGame,createLevel,WORLDS,BLOCK,TILE,W,H,PLAY,clamp,noise,overlap,solid};
})();
