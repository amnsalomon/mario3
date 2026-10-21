(() => {
'use strict';
const {WORLDS}=MarioCore;
class MarioRenderer {
 constructor(canvas){this.c=canvas.getContext('2d');this.c.imageSmoothingEnabled=false;this.preview=new MarioCore.MarioGame();this.preview.enterStage();}
 rect(x,y,w,h,color){this.c.fillStyle=color;this.c.fillRect(Math.floor(x),Math.floor(y),w,h);}
 text(t,x,y,color='#fff',size=8){this.c.fillStyle=color;this.c.font=`bold ${size}px monospace`;this.c.textBaseline='top';this.c.fillText(t,Math.floor(x),Math.floor(y));}
 sprite(type,x,y,opts={}){MarioSprites.draw(this.c,type,Math.floor(x),Math.floor(y),opts);}
 draw(g,t){if(g.mode==='title')this.scene(this.preview,t);else if(g.mode==='map'||(g.mode==='paused'&&g.beforePause==='map')||!g.level)this.map(g,t);else this.scene(g,t);this.hud(g,t);}
 background(l,cam,t){let sky=WORLDS[l.world].sky;if(['castle','bowser','underground'].includes(l.theme))sky='#181e38';if(l.water)sky='#3b8bc7';this.rect(0,0,384,224,sky);
  if(['castle','bowser','underground'].includes(l.theme)){for(let y=16;y<192;y+=24)for(let x=-24;x<400;x+=48){let xx=x-((cam*.15)%48)+(y%48?24:0);this.rect(xx,y,46,22,'#242d49');this.rect(xx+1,y+1,44,1,'#39405b');}for(let x=0;x<450;x+=96){let xx=x-cam*.2%96;this.rect(xx,96,5,14,'#744b46');this.rect(xx-2,86,9,10,t%1<.5?'#ffbb49':'#f47b3f');}return;}
  for(let i=0;i<7;i++){let x=i*83-(cam*.18%83);let y=24+(i%3)*17;this.rect(x,y,38,12,'#f9f2d8');this.rect(x+8,y-6,22,6,'#f9f2d8');this.rect(x+7,y+12,26,3,'#d9e6de');}
  for(let i=0;i<8;i++){let x=i*72-(cam*.35%72),base=l.water?'#286999':l.theme==='desert'?'#c98d49':l.theme==='ice'?'#e0f2ed':'#4e9a62';for(let j=0;j<5;j++)this.rect(x+j*5,136-j*9,64-j*10,58+j*9,base);this.rect(x+24,137,3,7,'#24463e');this.rect(x+36,137,3,7,'#24463e');}
  if(l.water){for(let i=0;i<16;i++){let x=(i*31-cam*.5)%400,y=(i*47-t*15)%180;this.rect(x,y,2,3,'#a6e8ec');}this.rect(0,20,384,2,'#b0ecf4');}
 }
 scene(g,t){const l=g.level,p=g.player,cam=g.camera;this.background(l,cam,t);const types={1:'ground',2:'brick',3:'question',4:'used',5:'castle',6:'pipe',7:'pipe',8:'pipe',9:'pipe',10:'platform',11:'ice',12:'wood',13:'spike',14:'lava'};
  for(let y=0;y<14;y++)for(let x=Math.max(0,Math.floor(cam/16));x<Math.min(l.cols,Math.ceil((cam+384)/16));x++){let tile=l.tiles[y][x];if(!tile)continue;let bump=l.blocks[x+','+y]?.bump||0;this.sprite(types[tile],x*16-cam,y*16-Math.sin(bump/.18*Math.PI)*4,{theme:l.theme,frame:Math.floor(t*5)%2,part:({6:'top-left',7:'top-right',8:'body-left',9:'body-right'})[tile]});}
  for(const a of l.platforms){this.rect(a.x-cam,a.y,a.w,a.h,'#f3b590');this.rect(a.x-cam,a.y,a.w,2,'#fff0ce');}
  for(const a of l.coins)if(!a.taken)this.sprite('coin',a.x-cam,a.y,{frame:Math.floor(t*8)%4});
  for(const a of l.items)this.sprite(a.type,a.x-cam,a.y,{frame:Math.floor(t*8)%2});
  for(const a of l.enemies){if(a.hidden||a.carried||a.dead&&a.deathTime<=0)continue;const dim=MarioSprites.dimensions(a.type);this.sprite(a.type,a.x-cam,a.y+a.h-dim.h,{frame:Math.floor(t*6)%2,facing:a.vx<0?-1:1,state:a.dead?'dead':'walk'});}
  if(l.boss&&!l.boss.dead){let b=l.boss;this.sprite(b.type,b.x-cam,b.y,{frame:Math.floor(t*6)%2,facing:p.x<b.x?-1:1});this.text('BOSS '+Math.ceil(b.hp),306,8,'#fff1c9');}
  if(l.goal){let q=l.goal;this.rect(q.x-cam-4,q.y-5,32,47,'#17223c');this.rect(q.x-cam-2,q.y-3,28,43,'#f9efd5');this.rect(q.x-cam,q.y,24,36,'#17223c');this.sprite(l.boss&&!l.boss.dead?'used':['mushroom','flower','star'][Math.floor(t*5)%3],q.x-cam+4,q.y+8);this.text('FIM',q.x-cam+3,q.y-15,'#fff');}
  for(const a of g.projectiles){this.rect(a.x-cam,a.y,a.w||6,a.h||6,'#f6cf5c');this.rect(a.x-cam+1,a.y+1,3,3,'#e74b37');}
  if(p&&(!(p.invuln>0)||Math.floor(t*16)%2)){let state=g.mode==='dying'?'dead':p.duck?'duck':p.tail>0?'tail':!p.grounded?(p.flight>0?'fly':'jump'):Math.abs(p.vx)>8?'walk':'idle';let dim=MarioSprites.dimensions('mario',p.power);MarioSprites.drawMario(this.c,Math.floor(p.x-cam-1),Math.floor(p.y+p.h-dim.h),{power:p.power,state,frame:Math.floor(t*12)%3,facing:p.facing,star:p.star>0});if(p.carry)this.sprite('shell',p.x-cam+p.facing*12,p.y+8);}
  for(const a of g.particles)if(a.kind==='text')this.text(a.text,a.x-cam,a.y,'#fff');else if(a.kind==='coin')this.sprite('coin',a.x-cam,a.y);else this.rect(a.x-cam,a.y,3,3,a.color||'#dfa04b');
 }
 map(g,t){const w=WORLDS[g.world];this.rect(0,0,384,224,'#26344c');this.rect(8,8,368,208,'#f6dda0');this.rect(14,30,356,180,w.land);this.text('WORLD '+(g.world+1)+' / '+w.name,22,15,'#26344c',10);
  for(let y=42;y<202;y+=32)for(let x=24;x<368;x+=32){this.rect(x,y,3,3,'#ffffff35');this.rect(x+8,y+8,2,2,w.ink);}
  this.rect(16,174,352,30,'#4e9eb1');for(let x=18;x<360;x+=16)this.rect(x,181,8,2,'#9cd8d5');
  const nodes=[[40,140],[99,140],[149,90],[217,90],[276,140],[335,87]];
  for(let i=1;i<6;i++){let [x,y]=nodes[i-1],[xx,yy]=nodes[i];this.rect(x,y+6,xx-x+8,5,'#f5d78f');this.rect(xx+2,Math.min(y,yy)+6,5,Math.abs(y-yy)+5,'#f5d78f');}
  nodes.forEach(([x,y],i)=>{let n=g.world*6+i,open=n<=g.highest;this.rect(x-4,y-4,25,25,'#26344c');this.rect(x-2,y-2,21,21,open?'#edb14b':'#657365');if(i===3||i===5)this.sprite('castle',x,y);else this.text(g.completed.includes(n)?'M':String(i+1),x+4,y+3,open?'#26344c':'#abb4a5',12);if(n===g.stage)MarioSprites.drawMario(this.c,x,y-22-Math.floor(Math.sin(t*5)*2),{power:'small',frame:0});});
  this.sprite('mushroom',43,48);this.text('CASA DO TOAD',64,52,'#26344c');this.text('FASE '+(g.world+1)+'-'+(g.slot+1),140,193,'#fff');
 }
 hud(g){this.rect(0,224,384,32,'#17223c');this.rect(4,228,376,24,'#f5e7bf');this.rect(6,230,372,20,'#17223c');this.text('M '+String(g.lives).padStart(2,'0'),12,233);this.text(String(g.score).padStart(7,'0'),54,233);this.text('$'+String(g.coins).padStart(2,'0'),121,233,'#ffda74');this.text('T '+String(Math.ceil(g.time||300)).padStart(3,'0'),163,233);let m=g.player?.pMeter||0;for(let i=0;i<6;i++)this.text('>',215+i*8,233,i/6<m?'#f9d36a':'#647084');this.text('P',264,233,m>.98?'#f9d36a':'#647084');for(let i=0;i<3;i++){this.rect(290+i*28,228,24,24,'#f5e7bf');this.rect(292+i*28,230,20,20,'#17223c');if(g.cards[i])this.sprite(g.cards[i],294+i*28,232);}}
}
globalThis.MarioRenderer=MarioRenderer;
})();
