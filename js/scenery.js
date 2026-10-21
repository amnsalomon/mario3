/* Layered, hand-drawn scenery in game coordinates. No external image assets. */
(() => {
class MarioScenery {
 constructor(renderer){this.r=renderer;}
 box(x,y,w,h,c){this.r.rect(x,y,w,h,c);}
 oval(x,y,w,h,c){for(let row=0;row<h;row++){const f=Math.sqrt(Math.max(0,1-((row+.5-h/2)/(h/2))**2)),span=Math.max(1,Math.round(w*f));this.box(x+Math.floor((w-span)/2),y+row,span,1,c);}}
 cloud(x,y,scale=1){const b=(xx,yy,w,h,c)=>this.box(x+xx*scale,y+yy*scale,w*scale,h*scale,c);b(3,5,30,12,'#152a3e');b(8,1,17,20,'#152a3e');b(1,9,34,6,'#152a3e');b(4,6,28,10,'#fffbe9');b(9,2,15,17,'#fffbe9');b(2,10,32,4,'#fffbe9');b(5,16,26,2,'#c6e4ef');b(13,7,2,5,'#172741');b(20,7,2,5,'#172741');b(13,7,1,1,'#fff');b(20,7,1,1,'#fff');}
 hill(x,base,w,h,c){this.oval(x,base-h,w,h*2,'#244d48');this.oval(x+2,base-h+2,w-4,h*2-3,c);this.oval(x+w*.3,base-h+15,4,10,'#b8e98f');this.box(x+w*.5-6,base-h+25,2,6,'#244d48');this.box(x+w*.5+3,base-h+25,2,6,'#244d48');}
 bush(x,y){for(let i=0;i<3;i++){this.oval(x+i*11,y-(i%2)*4,18,19,'#193f33');this.oval(x+i*11+1,y+1-(i%2)*4,16,17,'#71ca49');this.box(x+i*11+5,y+3-(i%2)*4,5,2,'#b1ed6a');}this.box(x+3,y+15,34,2,'#3a8c38');}
 panel(x,y,w,h,color){this.box(x+4,y+4,w,h,'#354745');this.box(x,y,w,h,'#202b3d');this.box(x+1,y+1,w-2,h-2,color);this.box(x+2,y+2,w-4,2,'#ffffff90');this.box(x+w-3,y+3,2,h-5,'#00000028');for(const xx of [x+4,x+w-6])for(const yy of [y+4,y+h-6]){this.box(xx,yy,2,2,'#314351');this.box(xx,yy,1,1,'#f3f1d8');}}
 draw(l,cam,t){const b=this.box.bind(this),theme=l.theme;
 const dark=['castle','bowser','underground','lava'].includes(theme);const sky=dark?'#10172e':l.water?'#3c96d5':theme==='airship'?'#697fad':theme==='ice'?'#a5d9f0':'#8ecfea';b(0,0,384,224,sky);
 if(dark){for(let y=0;y<192;y+=16)for(let x=-32;x<416;x+=32){let xx=x+(y%32?16:0)-cam*.1%32;b(xx,y,31,15,'#263047');b(xx+1,y+1,29,1,'#3c4660');b(xx+30,y+2,1,12,'#171f34');}for(let i=-1;i<5;i++){const x=i*112-cam*.18%112;b(x+24,42,27,118,'#11182c');this.oval(x+24,30,27,29,'#11182c');b(x+34,35,2,123,'#384259');b(x+24,78,27,2,'#384259');b(x+24,119,27,2,'#384259');for(const xx of [x+8,x+67]){b(xx,84,5,14,'#9c7466');this.oval(xx-2,74,9,12,t%1<.5?'#ff942f':'#ffbf49');this.oval(xx,77,4,8,'#fff2a2');}}if(theme==='lava'||theme==='bowser'){b(0,181,384,11,'#d84a35');for(let x=0;x<384;x+=8)b(x,181+Math.sin(x+t*5)*2,7,3,'#ffcf5c');}return;}
 if(l.water){for(let i=-1;i<9;i++){let x=i*56-cam*.25%56;this.oval(x,128+(i%2)*15,50,100,'#367eb3');for(let j=0;j<3;j++){let xx=x+j*13;b(xx,163-j*5,3,34,'#2c927a');b(xx-5,171-j*5,7,3,'#52bd84');b(xx+2,166-j*5,5,3,'#52bd84');}}for(let i=0;i<15;i++){let x=(i*37-cam*.4+800)%400,y=(i*47-t*12+1800)%180;b(x,y,3,1,'#b2edff');b(x-1,y+1,1,2,'#b2edff');b(x+3,y+1,1,2,'#b2edff');b(x,y+3,3,1,'#7ac9e9');}b(0,21,384,2,'#dcf7ff');return;}
 for(let i=-1;i<5;i++)this.cloud(i*116-cam*.12%116,22+(Math.abs(i)%3)*17);
 if(theme==='airship'){for(let i=-1;i<4;i++)this.cloud(i*145-cam*.4%145,151+(i%2)*19,1.6);return;}
 if(theme==='desert'){for(let i=-1;i<5;i++){let x=i*123-cam*.2%123;for(let y=0;y<72;y++){b(x+70-y,121+y,y*2+1,1,'#e4b270');b(x+70,121+y,y,1,'#c38f57');}}for(let i=-1;i<6;i++){let x=i*88-cam*.4%88;b(x,158,5,34,'#649249');b(x-8,169,9,4,'#649249');b(x-8,162,4,10,'#649249');b(x+4,166,7,4,'#649249');b(x+8,157,3,13,'#649249');b(x+1,159,1,31,'#a3bf69');}return;}
 if(theme==='sky'){for(let i=-1;i<5;i++)this.cloud(i*96-cam*.3%96,174+(i%2)*8,1.5);return;}
 if(theme==='ice'){for(let i=-1;i<5;i++){let x=i*108-cam*.25%108;this.hill(x,194,72,100,'#d8eff2');b(x+23,108,4,37,'#b4d8e6');b(x+44,143,3,44,'#a4c8df');}for(let i=0;i<28;i++)b((i*37+t*6)%384,(i*29+t*12)%192,1,2,'#fff');return;}
 for(let i=-1;i<4;i++){let x=i*145-cam*.18%145;this.hill(x+35,197,69,88,'#83cf8b');this.hill(x,202,55,58,'#9fdfa1');}
 // Pastel bolted scenery evokes the theatrical backdrops of the third game.
 for(let i=-1;i<4;i++){let x=i*164-cam*.35%164;this.panel(x+60,139,46,59,'#a9d2df');this.panel(x+100,158,34,40,'#efc5b5');}
 for(let i=-1;i<7;i++)this.bush(i*76-cam*.55%76,176);
 }
 ground(l,tx,ty,x,y){const above=l.tiles[ty-1]?.[tx],top=above!==1,desert=l.theme==='desert';const b=this.box.bind(this);b(x,y,16,16,desert?'#efd089':'#edba80');for(let i=0;i<16;i+=4){b(x+i,y+((i+tx*3+ty*5)%13),2,1,'#d89a66');}if(top){b(x,y,16,1,'#263735');b(x,y+1,16,3,desert?'#ffe6a2':'#f6dca2');b(x,y+4,16,1,'#765843');for(let i=0;i<16;i+=4){b(x+i,y+2,2,1,desert?'#f0ce7f':'#fff0bd');b(x+i+1,y+5,1,2,'#c78957');}}else{for(let i=-12;i<16;i+=8){for(let j=0;j<16;j++)if(i+j>=0&&i+j<16)b(x+i+j,y+j,1,1,'#d9a16e');}}}
 mapDecor(g,t){const b=this.box.bind(this);for(const [x,y] of [[78,75],[180,150],[300,56],[323,155]]){b(x+5,y+13,4,7,'#795139');this.oval(x,y,18,17,'#285a3d');this.oval(x+2,y+1,14,12,g.world===5?'#e7f5ea':'#91d764');b(x+6,y+5,2,4,'#284238');b(x+11,y+5,2,4,'#284238');}b(40,47,24,18,'#f8e1ae');this.oval(35,36,34,20,'#b83e32');b(39,40,8,5,'#fff1d4');b(53,37,8,5,'#fff1d4');b(46,55,8,10,'#4c4838');for(let x=20;x<370;x+=22)b(x+(Math.floor(t*2)%2)*2,187,8,1,'#d2f1e0');}
}
globalThis.MarioScenery=MarioScenery;
})();
