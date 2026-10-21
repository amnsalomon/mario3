/* Native pixel-art assets. All positions are TOP-LEFT; dimensions are unscaled pixels.
 * draw(ctx,type,x,y,{frame,facing,scale,theme,part,color,flash})
 * drawMario(ctx,x,y,{power,frame,state,facing,star,hidden,scale})
 * Mario is hand drawn at 2x density (32x32 / 32x56); each art pixel is 0.5 logical units.
 * Mario's big/raccoon/fire drawing always occupies a 16x28 box, including ducking.
 * Only fillRect and fillStyle are required from the Canvas context. */
(() => {
  'use strict';
  const INK='#202437',PALETTE={
    k:INK,R:'#df4037',r:'#9d282d',H:'#ff8060',S:'#ffc49a',s:'#de8c63',h:'#60352d',
    B:'#3569bd',b:'#24427b',C:'#8baedc',W:'#fff3d5',w:'#cfdbc9',Y:'#ffd85d',y:'#c38a36',
    F:'#ffe3bb',d:'#38272c',t:'#aa6a3d',G:'#55a64b',g:'#29683f',L:'#a5d86e',O:'#eaa14b',o:'#a96735',P:'#dc94bc',p:'#a44f86'
  };
  class Pixels{
    constructor(w,h){this.w=w;this.h=h;this.rows=Array.from({length:h},()=>Array(w).fill('.'));}
    rect(x,y,w,h,c){for(let yy=Math.max(0,y);yy<Math.min(this.h,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(this.w,x+w);xx++)this.rows[yy][xx]=c;return this;}
    poly(points,c){
      for(let y=0;y<this.h;y++){
        const xs=[];for(let i=0;i<points.length;i++){
          const a=points[i],b=points[(i+1)%points.length];
          if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)this.rect(Math.ceil(xs[i]),y,Math.ceil(xs[i+1])-Math.ceil(xs[i]),1,c);
      }return this;
    }
    ellipse(cx,cy,rx,ry,c){for(let y=Math.ceil(cy-ry);y<=cy+ry;y++){const half=Math.sqrt(Math.max(0,1-((y-cy)/ry)**2))*rx;this.rect(Math.ceil(cx-half),y,Math.floor(half*2)+1,1,c);}return this;}
    stamp(rows,x=0,y=0){rows.forEach((row,j)=>[...row].forEach((v,i)=>{if(v!=='.')this.rect(x+i,y+j,1,1,v);}));return this;}
    outline(){const before=this.rows.map(r=>r.slice());for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++)if(before[y][x]==='.'&&[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([xx,yy])=>before[yy]?.[xx]&&before[yy][xx]!=='.'))this.rows[y][x]='k';return this;}
  }
  // Mario is authored on a double-density grid, not enlarged from the old sprites.
  // The renderer maps each of these pixels to 0.5 logical units.
  function glove(p,x,y,raised=false){
    p.poly([[x+1,y],[x+5,y],[x+6,y+2],[x+6,y+5],[x+4,y+7],[x+1,y+6],[x,y+3]],'W');
    p.rect(x+1,y+5,4,1,'w').rect(x+2,y+1,1,2,'F');
    if(raised)p.rect(x+1,y+1,4,1,'w');else p.rect(x+4,y+2,1,3,'w');
  }
  function shoe(p,x,y,w=10,h=5){
    p.poly([[x+2,y],[x+w-3,y],[x+w,y+2],[x+w,y+h],[x,y+h],[x,y+2]],'h');
    p.rect(x+2,y+1,Math.max(2,w-4),1,'t').rect(x,y+h-1,w,1,'d');
  }
  function marioHead(p,y,small,raccoon,dead=false){
    const sy=small?.7:1;
    const r=(x,yy,w,h,c)=>p.rect(x,Math.round(y+yy*sy),w,Math.max(1,Math.round(h*sy)),c);
    const poly=(pts,c)=>p.poly(pts.map(([x,yy])=>[x,Math.round(y+yy*sy)]),c);
    // Hair, ear and a rounded cheek are distinct from the projecting nose.
    poly([[9,10],[14,8],[23,10],[25,15],[29,16],[30,19],[28,22],[24,23],[24,25],[16,25],[12,22],[9,17]],'S');
    poly([[9,10],[16,10],[15,14],[13,14],[13,20],[10,19],[8,15]],'h');
    r(9,11,3,5,'d');r(18,12,6,4,'F');r(21,16,3,5,'F');
    r(12,16,3,5,'S');r(12,17,1,2,'s');r(13,20,2,2,'s');
    r(26,17,3,3,'F');r(28,19,2,2,'s');r(18,24,5,1,'s');
    r(20,12,4,6,'W');r(22,13,2,5,'k');r(22,14,1,2,'b');r(20,11,5,1,'h');
    // Three lobes give the moustache its familiar silhouette at half-pixel scale.
    poly([[18,19],[21,19],[22,20],[24,19],[24,21],[28,21],[27,23],[24,23],[23,22],[21,24],[18,23],[17,21]],'h');
    r(19,21,2,1,'d');r(24,22,3,1,'d');
    if(raccoon){
      poly([[6,7],[5,1],[8,0],[13,5]],'h');poly([[22,4],[25,0],[28,1],[27,8]],'h');
      poly([[7,5],[7,2],[10,5]],'O');poly([[24,5],[26,2],[26,6]],'O');
    }
    // Rounded crown, raised front, separate brim and a tiny embroidered M.
    poly([[8,9],[9,5],[12,2],[18,1],[23,2],[26,5],[26,10]],'R');
    r(10,5,2,4,'r');r(13,3,8,1,'H');r(12,4,2,1,'H');r(11,8,8,2,'r');
    poly([[18,9],[29,9],[31,11],[28,13],[19,12],[17,11]],'R');r(20,9,8,1,'H');r(22,12,6,1,'r');
    r(20,4,5,5,'W');r(19,5,1,3,'W');
    r(20,5,1,3,'R');r(24,5,1,3,'R');r(21,6,1,1,'R');r(23,6,1,1,'R');r(22,7,1,1,'R');
    if(dead){r(20,13,4,1,'h');r(21,12,1,3,'h');r(23,14,1,2,'h');r(23,23,2,1,'h');}
  }
  function smallMario(frame,state){
    const p=new Pixels(32,32);p.density=2;
    const airborne=state==='jump'||state==='fly',step=state==='walk'?frame%3:0;
    // Bent arms and asymmetric hand positions keep the running pose readable.
    p.poly([[10,17],[24,17],[27,20],[26,25],[8,25],[6,21]],'R');
    p.rect(9,18,3,5,'H').rect(22,19,4,4,'r');
    if(airborne||state==='dead'){p.rect(4,15,5,7,'R');glove(p,2,11,true);glove(p,25,20);}
    else{glove(p,5,20+Number(step===1));glove(p,25,18+Number(step===2));}
    p.poly([[12,18],[15,18],[15,21],[21,21],[21,18],[24,18],[24,26],[10,26],[10,21],[12,21]],'B');
    p.rect(12,21,2,2,'Y').rect(22,21,2,2,'Y').rect(14,24,7,1,'C').rect(10,25,14,1,'b');
    if(airborne||state==='dead'){
      p.poly([[10,25],[17,25],[16,29],[8,29]],'B');p.rect(21,24,6,3,'B');
      shoe(p,4,28,11,3);shoe(p,23,25,8,4);
    }else if(step===1){
      p.poly([[10,25],[17,25],[14,29],[7,29]],'B');p.rect(20,25,5,5,'B');
      shoe(p,2,28,12,3);shoe(p,21,29,10,3);
    }else if(step===2){
      p.rect(13,25,7,5,'B').rect(21,25,4,2,'B');shoe(p,10,29,12,3);shoe(p,24,26,7,4);
    }else{
      p.rect(10,25,6,4,'B').rect(20,25,6,4,'B').rect(10,25,2,4,'b');
      shoe(p,7,28,10,4);shoe(p,20,28,11,4);
    }
    marioHead(p,0,true,false,state==='dead');return p.outline();
  }
  function bigMario(frame,state,power){
    const p=new Pixels(32,56);p.density=2;
    const duck=state==='duck',airborne=state==='jump',flying=state==='fly';
    const raccoon=power==='raccoon'||power==='tanooki',step=state==='walk'?frame%3:0;
    const headY=duck?17:2;
    // The striped tail is behind the body and occupies the same collision-neutral box.
    if(raccoon){
      const y=duck?43:36;
      p.poly([[10,y+7],[5,y+5],[1,y],[0,y-6],[3,y-8],[6,y-4],[5,y],[11,y+2]],'O');
      p.poly([[1,y-5],[5,y-5],[6,y-2],[2,y-2]],'h');p.poly([[4,y+1],[8,y+2],[8,y+5],[5,y+4]],'h');
      p.rect(1,y-6,2,1,'Y');
      if(state==='tail'){p.poly([[2,y-4],[11,y-2],[12,y+2],[1,y+1],[0,y-2]],frame%2?'O':'h');p.rect(1,y-2,3,1,'Y');}
    }
    if(duck){
      p.poly([[10,42],[25,42],[28,47],[26,51],[7,51],[6,47]],'R');p.rect(10,47,15,5,'B');
      p.rect(12,46,2,2,'Y').rect(23,46,2,2,'Y').rect(12,50,10,1,'C');
      glove(p,4,45);glove(p,25,44);shoe(p,5,51,12,5);shoe(p,20,51,11,5);
    }else{
      // Red sleeves and white gloves are separate silhouettes, with moving elbows.
      if(airborne||state==='dead'){
        p.poly([[10,29],[7,30],[5,25],[4,23],[1,25],[3,33],[9,37]],'R');glove(p,1,18,true);
        p.poly([[23,29],[27,28],[28,24],[31,25],[30,34],[25,37]],'R');glove(p,25,20,true);
      }else if(flying){
        p.poly([[10,29],[4,29],[1,31],[1,35],[10,36]],'R');glove(p,0,30);
        p.poly([[23,29],[29,29],[31,31],[30,36],[23,36]],'R');glove(p,25,31);
      }else{
        const leftY=step===1?31:33,rightY=step===2?31:33;
        p.poly([[10,29],[6,leftY],[5,leftY+7],[9,leftY+9],[12,36]],'R');p.rect(6,leftY+2,2,4,'H');glove(p,4,leftY+6);
        p.poly([[23,29],[27,rightY],[29,rightY+6],[25,rightY+9],[22,36]],'r');glove(p,24,rightY+5);
      }
      p.poly([[11,28],[23,28],[26,34],[25,43],[9,43],[8,34]],'R');
      p.rect(10,30,4,8,'H').rect(22,30,3,9,'r');
      p.poly([[12,29],[15,29],[15,36],[21,36],[21,29],[24,29],[25,44],[9,44],[10,36],[12,36]],'B');
      p.rect(12,30,1,7,'C').rect(22,30,1,7,'C').rect(11,37,3,3,'Y').rect(22,37,3,3,'Y');
      p.rect(12,37,1,1,'W').rect(23,37,1,1,'W');p.rect(10,41,14,2,'b').rect(14,40,7,1,'C');
      if(airborne||state==='dead'){
        p.poly([[10,43],[17,43],[17,49],[10,50],[6,48]],'B');p.rect(7,46,3,3,'b');
        p.poly([[20,43],[25,43],[29,46],[27,49],[22,49],[20,46]],'B');p.rect(23,46,5,1,'C');
        shoe(p,3,50,13,5);shoe(p,23,47,9,5);
      }else if(step===1){
        p.poly([[10,43],[17,43],[16,48],[10,51],[5,50],[7,47]],'B');p.rect(7,48,3,2,'b');
        p.poly([[20,43],[25,43],[25,52],[21,53],[19,49]],'B');p.rect(21,45,2,5,'C');
        shoe(p,1,49,12,5);shoe(p,21,51,11,5);
      }else if(step===2){
        p.poly([[12,43],[19,43],[20,51],[16,53],[11,51]],'B');p.rect(12,45,2,5,'b');
        p.poly([[21,43],[26,43],[27,46],[24,49],[20,48]],'B');
        shoe(p,9,51,13,5);shoe(p,23,46,9,5);
      }else{
        p.rect(10,43,7,9,'B').rect(20,43,6,9,'B').rect(10,43,2,8,'b').rect(21,44,2,6,'C');
        shoe(p,7,51,11,5);shoe(p,20,51,12,5);
      }
    }
    marioHead(p,headY,false,raccoon,state==='dead');return p.outline();
  }
  function goomba(frame){
    const p=new Pixels(16,16);p.poly([[5,1],[11,1],[15,8],[14,12],[2,12],[1,8]],'o');
    p.rect(5,2,6,2,'O').rect(3,6,4,4,'W').rect(9,6,4,4,'W');
    p.rect(5,7,2,3,'k').rect(9,7,2,3,'k').rect(3,5,3,1,'k').rect(10,5,3,1,'k');
    p.rect(6,11,4,3,'S').rect(frame%2?1:2,14,5,2,'h').rect(frame%2?10:9,14,5,2,'h');return p.outline();
  }
  function koopa(frame,shell=false){
    const p=new Pixels(16,shell?14:24),base=shell?0:10;
    p.ellipse(8,base+6,6,5,'g').ellipse(7,base+4,5,4,'G').rect(4,base+8,8,3,'W');
    p.rect(7,base+2,1,5,'L').rect(4,base+5,8,1,'g').rect(4,base+4,1,3,'g').rect(11,base+4,1,3,'g');
    if(shell){p.rect(2,10,12,2,'w').rect(4,12,8,1,'k');}
    else{
      p.rect(10,2,4,8,'Y').rect(9,4,6,5,'Y').rect(11,1,3,3,'Y');
      p.rect(11,3,2,3,'W').rect(12,3,1,2,'k').rect(12,7,3,1,'o');
      p.rect(11,10,3,4,'Y').rect(6,19,4,3,'Y');
      p.rect(frame%2?3:5,22,6,2,'o').rect(frame%2?10:9,20,5,2,'o');
    }return p.outline();
  }
  function piranha(frame){
    const p=new Pixels(16,24);p.rect(7,12,3,12,'g').rect(7,12,1,12,'L');
    p.poly([[7,19],[2,16],[2,20],[7,22]],'G').poly([[10,17],[15,14],[14,19],[10,21]],'G');
    p.ellipse(8,7,6,6,'R').rect(3,4,3,2,'W').rect(9,2,3,2,'W').rect(10,9,3,2,'W');
    if(frame%2){p.rect(2,6,12,3,'k');for(let x=3;x<14;x+=3)p.rect(x,6,1,1,'W').rect(x+1,8,1,1,'W');}
    else{p.rect(2,7,12,1,'W').rect(4,8,8,1,'k');}
    return p.outline();
  }
  function fish(frame){
    const p=new Pixels(16,16);p.poly([[10,6],[15,2],[15,13],[10,10]],'O');p.ellipse(6,8,5,6,'R');
    p.ellipse(5,10,4,3,'W').rect(1,5,3,3,'W').rect(1,6,1,2,'k').rect(0,9,2,2,'O');
    p.poly([[6,10],[9,frame%2?7:13],[4,13]],'O').rect(5,2,4,2,'H');return p.outline();
  }
  function mushroom(life=false){
    const p=new Pixels(16,16);p.rect(5,9,6,6,'W');p.ellipse(8,7,7,6,life?'G':'R');
    p.rect(5,2,5,4,'W').rect(1,7,3,3,'W').rect(11,6,3,4,'W').rect(4,11,8,3,'W');
    p.rect(6,12,1,2,'k').rect(9,12,1,2,'k').rect(5,15,6,1,'s');return p.outline();
  }
  function leaf(){
    const p=new Pixels(16,16);p.poly([[12,1],[14,3],[13,8],[10,12],[6,13],[2,10],[2,6],[7,3]],'O');
    p.poly([[12,2],[10,7],[5,10],[3,8],[5,5]],'Y');p.rect(7,11,2,4,'o').rect(9,14,3,1,'o');
    p.rect(6,7,1,3,'k').rect(9,6,1,3,'k');return p.outline();
  }
  function flower(frame){
    const p=new Pixels(16,16);p.rect(7,9,2,7,'g').poly([[7,14],[3,11],[1,11],[3,14],[7,15]],'G').poly([[9,13],[12,10],[15,10],[13,14],[9,15]],'L');
    p.ellipse(8,5,6,4,frame%2?'O':'R').ellipse(8,5,4,3,'Y').ellipse(8,5,3,2,'W');
    p.rect(6,4,1,3,'k').rect(9,4,1,3,'k');return p.outline();
  }
  function star(frame){
    const p=new Pixels(16,16);p.poly([[8,0],[10,5],[16,5],[12,9],[14,15],[8,12],[2,15],[4,9],[0,5],[6,5]],frame%2?'Y':'W');
    p.rect(6,6,1,4,'k').rect(9,6,1,4,'k');return p.outline();
  }
  function coin(frame){const p=new Pixels(8,12),width=[6,4,2,4][frame%4],x=(8-width)/2;p.ellipse(3.5,5.5,width/2,5.5,'y').rect(x,2,Math.max(1,width-1),8,'Y').rect(x,3,1,6,'W');return p;}
  function boomBoom(frame){
    const p=new Pixels(32,32);p.ellipse(16,20,11,10,'g').ellipse(15,19,9,8,'G');
    p.ellipse(17,23,7,7,'Y').rect(14,20,7,1,'o').rect(13,24,9,1,'o');
    p.ellipse(17,10,8,7,'O').rect(13,5,4,5,'W').rect(20,5,3,5,'W').rect(15,6,2,3,'k').rect(20,6,2,3,'k');
    p.rect(15,13,9,3,'h').rect(16,13,2,1,'W').rect(21,13,2,1,'W');
    p.ellipse(5,frame%2?14:21,5,5,'O').ellipse(27,frame%2?21:14,4,5,'O');
    p.rect(5,28,10,4,'o').rect(20,28,10,4,'o').rect(6,29,7,1,'Y').rect(21,29,7,1,'Y');return p.outline();
  }
  function bowser(frame){
    const p=new Pixels(40,44);p.ellipse(18,26,15,15,'g').ellipse(17,23,13,12,'G');
    for(const [x,y] of [[7,13],[13,10],[20,11],[27,14],[5,23]])p.poly([[x,y],[x+3,y-5],[x+5,y+2]],'W');
    p.ellipse(22,30,10,12,'Y');for(let y=24;y<40;y+=4)p.rect(15,y,15,1,'o');
    p.poly([[16,12],[16,6],[20,2],[23,8],[30,8],[33,12],[33,24],[20,25]],'O');
    p.poly([[17,8],[13,3],[13,0],[20,5]],'W').poly([[29,8],[35,2],[35,7],[32,12]],'W');
    p.poly([[20,7],[20,1],[24,4],[26,0],[28,7]],'R');
    p.rect(21,11,5,5,'W').rect(28,11,4,5,'W').rect(24,12,2,3,'k').rect(28,12,2,3,'k');
    p.rect(20,10,6,2,'r').rect(28,10,5,2,'r');p.ellipse(28,20,9,6,'Y');p.rect(25,18,1,2,'k').rect(32,18,1,2,'k');
    p.rect(24,24,11,2,'h').rect(25,24,2,2,'W').rect(31,24,2,2,'W');
    p.ellipse(7,frame%2?29:32,6,6,'O').ellipse(33,frame%2?32:29,6,6,'O');
    p.rect(3,31,8,3,'k').rect(30,31,8,3,'k');for(const x of [4,8,31,35])p.rect(x,31,1,1,'W');
    p.rect(8,39,11,4,'O').rect(25,39,12,4,'O');p.rect(8,42,3,2,'W').rect(14,42,3,2,'W').rect(26,42,3,2,'W').rect(32,42,3,2,'W');return p.outline();
  }
  function boo(frame){const p=new Pixels(16,16);p.ellipse(8,7,7,6,'W').poly([[1,9],[1,14],[5,12],[8,15],[11,12],[14,13],[14,8]],'W');p.rect(8,4,1,3,'k').rect(11,4,1,3,'k');if(frame%2)p.rect(6,6,7,4,'w');else p.rect(9,8,4,3,'h').rect(10,10,2,2,'P');return p.outline();}
  function bullet(){const p=new Pixels(16,16);p.rect(5,3,10,10,'k').ellipse(5,8,5,5,'k').rect(2,5,3,2,'W').rect(6,9,4,3,'w').rect(11,4,1,8,'b');return p;}
  function tile(type,frame,theme,part){
    const p=new Pixels(16,16),ice=theme==='ice',desert=theme==='desert',castle=theme==='castle'||theme==='lava';
    if(type==='question'||type==='used'){
      p.rect(0,0,16,16,'k').rect(1,1,14,14,type==='used'?'o':'y').rect(2,2,12,11,type==='used'?'o':'Y');
      p.rect(2,2,11,1,type==='used'?'O':'W').rect(2,2,1,10,type==='used'?'O':'W');
      for(const [x,y] of [[2,2],[13,2],[2,13],[13,13]])p.rect(x,y,1,1,'k');
      if(type==='question')p.stamp(['.kkk.','kk.kk','...kk','..kk.','..k..','.....','..k..'],5,4);
      if(frame%4===3&&type==='question')p.rect(3,3,9,1,'W');
    }else if(type==='brick'||type==='castle'||type==='wood'){
      p.rect(0,0,16,16,'o');for(let y=0;y<16;y+=5){p.rect(0,y,16,1,'k');p.rect(0,y+1,16,1,'O');for(let x=(y%2?0:8);x<16;x+=8)p.rect(x,y,1,5,'k');}
      if(type==='wood'){p.rect(0,0,16,16,'O');for(const y of [0,7,15])p.rect(0,y,16,1,'h');for(const x of [2,13])p.rect(x,2,1,4,'o').rect(x,9,1,4,'o');p.rect(7,4,4,1,'o').rect(9,11,3,1,'o');}
    }else if(type==='ground'){
      p.rect(0,0,16,16,'O').rect(0,0,16,3,desert?'Y':ice?'W':castle?'o':'G').rect(0,3,16,1,desert?'y':ice?'w':castle?'k':'g');
      for(const [x,y] of [[2,6],[10,7],[6,12],[14,13]])p.rect(x,y,2,2,'o').rect(x,y,1,1,'Y');
      if(!desert&&!ice&&!castle){p.rect(1,1,4,1,'L').rect(8,1,5,1,'L');for(const x of [3,10])p.rect(x,3,2,2,'g');}
    }else if(type==='pipe'){
      const body=part.includes('body'),left=part.includes('left'),right=part.includes('right');
      p.rect(0,0,16,16,'g').rect(2,0,12,16,'G').rect(3,0,3,16,'L').rect(12,0,2,16,'g');
      if(!body)p.rect(0,0,16,1,'k').rect(0,1,16,2,'L').rect(0,5,16,2,'k');
      if(left||(!left&&!right))p.rect(0,body?0:1,1,16,'k');
      if(right||(!left&&!right))p.rect(15,body?0:1,1,16,'k');
      if(right)p.rect(0,body?0:1,3,body?16:4,'G').rect(0,7,3,9,'G');
    }else if(type==='platform'){
      p.rect(0,0,16,16,'k').rect(1,1,14,14,'B').rect(2,2,12,11,'C').rect(2,2,11,1,'W');
      for(const [x,y] of [[2,2],[12,2],[2,12],[12,12]])p.rect(x,y,2,2,'b').rect(x,y,1,1,'W');
    }else if(type==='ice'){
      p.rect(0,0,16,16,'b').rect(1,1,14,14,'C').rect(2,2,12,12,'w');p.poly([[2,2],[8,2],[2,8]],'W').poly([[5,14],[14,5],[14,8],[8,14]],'C');
    }else if(type==='spike'){
      p.rect(0,13,16,3,'b');for(let x=0;x<16;x+=8)p.poly([[x,13],[x+4,1],[x+8,13]],'k').poly([[x+2,12],[x+4,4],[x+5,12]],'W');
    }else if(type==='lava'){
      p.rect(0,0,16,16,'R').rect(0,5,16,2,'O');for(let x=0;x<16;x++)p.rect(x,Math.round(2+Math.sin((x+frame*3)/3)*2),1,3,'Y');
      p.rect((frame*3)%13,10,3,1,'O').rect((frame*4+7)%12,14,4,1,'r');
    }else if(type==='cannon'){
      p.rect(1,0,14,16,'k').rect(3,1,9,14,'b').rect(3,2,2,12,'C').rect(0,0,16,3,'k').rect(0,14,16,2,'k');p.rect(8,5,5,5,'k').rect(9,6,3,3,'w');
    }
    return p;
  }
  const cache=new Map(),known=new Set(['mario','goomba','koopa','shell','piranha','fish','cheep','mushroom','oneup','leaf','flower','star','coin','boom','boomboom','boss','bowser','boo','bullet','brick','question','used','ground','pipe','platform','ice','castle','wood','spike','lava','cannon']);
  function dimensions(type,power='small'){
    type=String(type).toLowerCase();if(type==='mario')return {w:16,h:power==='small'?16:28};
    if(type==='koopa'||type==='piranha')return {w:16,h:24};if(type==='shell')return {w:16,h:14};
    if(type==='coin')return {w:8,h:12};if(['boom','boomboom','boss'].includes(type))return {w:32,h:32};
    if(type==='bowser')return {w:40,h:44};return {w:16,h:16};
  }
  function palette(type,options){
    const p={...PALETTE},theme=options.theme;
    if(type==='mario'){p.C='#6891cf';p.B='#3769b9';p.b='#24427b';}
    if(type==='mario'&&['raccoon','tanooki'].includes(options.power)){p.R='#bf773f';p.r='#70402d';p.H='#e6a052';p.B='#b37843';p.b='#70402d';p.C='#d7a05b';}
    if(type==='mario'&&options.power==='fire'){p.R='#fff0d1';p.r='#cbbb9b';p.H='#fffaf1';p.B='#df4037';p.b='#9d282d';p.C='#ff8761';}
    if(type==='castle'||(type==='ground'&&(theme==='castle'||theme==='lava'))){p.O='#8d95a3';p.o='#555e74';p.Y='#c4c8d0';}
    if(type==='ground'&&theme==='ice'){p.O='#b4d5df';p.o='#80a8c3';p.Y='#e9f4e9';}
    if(type==='ground'&&theme==='desert'){p.O='#e6b76d';p.o='#c18b4d';p.Y='#f8d891';}
    if(type==='mario'&&options.star){const colors=['#6cdce3','#ffd55b','#ff98b4','#a9e878'];p.R=colors[Math.floor(options.frame||0)%4];p.B=colors[(Math.floor(options.frame||0)+2)%4];p.S='#fff4cf';}
    if(options.color){if(type==='pipe'){p.G=options.color;}else if(type==='koopa'||type==='shell'){p.G=options.color;}else p.R=options.color;}
    if(options.flash)for(const k of Object.keys(p))if(k!=='k')p[k]='#fff9e9';
    return {...p,...options.palette};
  }
  function build(type,frame,options){
    switch(type){
      case 'mario':return options.power==='small'?smallMario(frame,options.state):bigMario(frame,options.state,options.power);
      case 'goomba':return goomba(frame);
      case 'koopa':return koopa(frame);
      case 'shell':return koopa(frame,true);
      case 'piranha':return piranha(frame);
      case 'fish':case 'cheep':return fish(frame);
      case 'mushroom':return mushroom();case 'oneup':return mushroom(true);
      case 'leaf':return leaf();case 'flower':return flower(frame);case 'star':return star(frame);case 'coin':return coin(frame);
      case 'boom':case 'boomboom':case 'boss':return boomBoom(frame);case 'bowser':return bowser(frame);
      case 'boo':return boo(frame);case 'bullet':return bullet();
      default:return tile(type,frame,options.theme,options.part||'');
    }
  }
  function draw(ctx,type,x,y,options={}){
    if(options.hidden)return;type=String(type).toLowerCase();if(!known.has(type))return;
    const frame=((Math.floor(options.frame||0)%12)+12)%12,power=options.power||'small',state=options.state||'idle';
    const opts={...options,power,state,frame,part:String(options.part||'').toLowerCase().replace(/[^a-z]/g,'')};
    const key=[type,frame,power,state,opts.theme||'',opts.part].join('|');let art=cache.get(key);
    if(!art){art=build(type,frame,opts);if(cache.size<1400)cache.set(key,art);}
    const colors=palette(type,opts),scale=(Number.isFinite(options.scale)&&options.scale>0?options.scale:1)/(art.density||1),flip=options.facing===-1;
    x=Math.round(x);y=Math.round(y);
    art.rows.forEach((row,j)=>{
      for(let i=0;i<art.w;){const symbol=row[i];let end=i+1;while(end<art.w&&row[end]===symbol)end++;
        if(symbol!=='.'){ctx.fillStyle=colors[symbol]||INK;const xx=flip?art.w-end:i;ctx.fillRect(x+xx*scale,y+j*scale,(end-i)*scale,scale);}i=end;
      }
    });
  }
  function drawMario(ctx,x,y,options={}){draw(ctx,'mario',x,y,options);}
  globalThis.MarioSprites=Object.freeze({draw,drawMario,dimensions,types:Object.freeze([...known])});
})();
