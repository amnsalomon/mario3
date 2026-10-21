'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/audio.js'),'utf8');
function setup(withAudio=true){
 const contexts=[];
 class Param{
  constructor(){this.value=0;this.calls=[];}
  add(method,value,time){assert.ok(Number.isFinite(value));assert.ok(Number.isFinite(time)&&time>=0);this.calls.push([method,value,time]);this.value=value;}
  setValueAtTime(value,time){this.add('set',value,time);}
  exponentialRampToValueAtTime(value,time){assert.ok(value>0);this.add('exp',value,time);}
  linearRampToValueAtTime(value,time){this.add('linear',value,time);}
  cancelScheduledValues(time){this.calls.push(['cancel',time]);}
 }
 class Node{
  constructor(context,type){this.context=context;this.kind=type;this.frequency=new Param();this.gain=new Param();this.connections=[];this.stopCalls=[];this.disconnected=false;}
  connect(target){this.connections.push(target);}
  disconnect(){this.disconnected=true;}
  start(time){assert.ok(time>=this.context.currentTime);this.started=time;}
  stop(time){assert.ok(Number.isFinite(time));this.stopCalls.push(time);}
 }
 class Context{
  constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=24000;this.destination={};this.nodes=[];contexts.push(this);}
  createGain(){const n=new Node(this,'gain');this.nodes.push(n);return n;}
  createOscillator(){const n=new Node(this,'oscillator');this.nodes.push(n);return n;}
  createBufferSource(){const n=new Node(this,'noise');this.nodes.push(n);return n;}
  createBuffer(channels,length){const data=new Float32Array(length);return {getChannelData(){return data;}};}
  async resume(){this.state='running';}
  async close(){this.state='closed';}
 }
 const scope=withAudio?{AudioContext:Context}:{};vm.createContext(scope);vm.runInContext(source,scope);
 return {Audio:scope.MarioAudio,contexts};
}

test('audio is gated on a gesture and unavailable AudioContext is harmless',async()=>{
 const {Audio,contexts}=setup(),audio=new Audio();assert.equal(contexts.length,0);
 audio.update();assert.equal(audio.effect('jump'),false);assert.equal(contexts.length,0);
 assert.equal(await audio.unlock(),true);assert.equal(contexts.length,1);assert.equal(contexts[0].state,'running');
 assert.equal(await audio.unlock(),true);assert.equal(contexts.length,1);
 const unavailable=new (setup(false).Audio)();
 assert.equal(await unavailable.unlock(),false);unavailable.setPaused(true);unavailable.setEnabled(false);unavailable.setVolume(.8);unavailable.setTheme('water');unavailable.update();unavailable.dispose();
});
test('seven distinct looping compositions and all event effects contain valid musical data',()=>{
 const {Audio}=setup(),names=['overworld','underground','water','castle','airship','map','star'];
 assert.deepEqual(Object.keys(Audio.themes),names);
 const signatures=new Set();
 for(const name of names){
  const t=Audio.themes[name];assert.ok(t.bpm>=80&&t.bpm<=220);assert.equal(t.lead.length%8,0);assert.equal(t.lead.length/8,t.chords.length);
  t.lead.filter(n=>n!==null).forEach(n=>assert.ok(Number.isInteger(n)&&n>=36&&n<=96));
  t.chords.flat().forEach(n=>assert.ok(Audio.frequency(n)>20&&Audio.frequency(n)<5000));
  signatures.add(t.lead.join(','));
 }
 assert.equal(signatures.size,names.length);
 const events=['jump','coin','bump','break','stomp','kick','powerup','powerdown','oneup','fire','tail','fly','pipe','death','clear','worldClear','victory','pause','select','hurry','swim','sprout','cannon','flame','orb','tick','gameover','cheat'];
 assert.equal(Object.keys(Audio.effects).length,events.length);
 for(const name of events){
  assert.ok(Audio.effects[name].length>0,name);
  for(const [offset,duration,start,end,type,volume] of Audio.effects[name]){
   assert.ok(offset>=0&&duration>0&&duration<1);assert.ok(start>0&&end>0);assert.ok(['square','triangle','noise'].includes(type));assert.ok(volume>0&&volume<.2);
  }
 }
 assert.equal(new Set(events.map(name=>JSON.stringify(Audio.effects[name]))).size,events.length);
});
test('lookahead starts music without duplicate scheduling or a burst after a stalled frame',async()=>{
 const {Audio,contexts}=setup(),audio=new Audio();await audio.unlock();const ctx=contexts[0];
 audio.update();const first=[...audio.voices];assert.ok(first.length>=3);assert.ok(first.every(v=>v.music));
 audio.update();assert.equal(audio.voices.size,first.length);
 ctx.currentTime=.2;audio.update();assert.ok([...audio.voices].some(v=>v.source.started>.2));
 ctx.currentTime=20;audio.update();const active=[...audio.voices];assert.ok(active.length<=5);assert.ok(active.every(v=>v.source.started>=20));
});
test('pause stops every source and resume schedules new notes without leftovers',async()=>{
 const {Audio,contexts}=setup(),audio=new Audio();await audio.unlock();const ctx=contexts[0];
 audio.update();audio.effect('coin');const voices=[...audio.voices];audio.setPaused(true);
 assert.equal(audio.voices.size,0);assert.equal(audio.master.gain.value,0);assert.ok(voices.every(v=>v.source.disconnected&&v.source.stopCalls.length===2));
 audio.update();assert.equal(audio.effect('jump'),false);assert.equal(audio.voices.size,0);
 ctx.currentTime=2;audio.setPaused(false);audio.update();assert.ok(audio.voices.size>0);assert.ok([...audio.voices].every(v=>v.source.started>=2));
 assert.equal(audio.master.gain.value,.55);
});
test('music mute preserves effects, global mute silences everything, and volume is clamped',async()=>{
 const {Audio}=setup(),audio=new Audio();await audio.unlock();audio.update();audio.effect('coin');
 const effects=[...audio.voices].filter(v=>!v.music);assert.equal(effects.length,2);
 audio.setMusicEnabled(false);assert.equal(audio.voices.size,effects.length);audio.update();assert.equal(audio.voices.size,effects.length);
 audio.setVolume(2);assert.equal(audio.volume,1);assert.equal(audio.master.gain.value,1);
 audio.setVolume(-1);assert.equal(audio.volume,0);audio.setVolume(NaN);assert.equal(audio.volume,0);audio.setVolume(.6);
 audio.setEnabled(false);assert.equal(audio.voices.size,0);assert.equal(audio.effect('fire'),false);assert.equal(audio.master.gain.value,0);
 audio.setEnabled(true);assert.equal(audio.master.gain.value,.6);assert.equal(audio.effect('fire'),true);
});
test('death and clear fanfares suspend music and survive a subsequent theme change',async()=>{
 for(const effect of ['death','clear','worldClear','victory','gameover']){
  const {Audio,contexts}=setup(),audio=new Audio();await audio.unlock();audio.update();audio.effect(effect);
  const stinger=[...audio.voices];assert.equal(stinger.length,Audio.effects[effect].length);assert.ok(stinger.every(v=>!v.music));
  audio.setTheme('castle');audio.update();assert.equal(audio.voices.size,stinger.length);assert.ok(stinger.every(v=>!v.source.disconnected));
  contexts[0].currentTime=audio.duckUntil+.1;audio.update();assert.ok([...audio.voices].some(v=>v.music));
 }
});
test('rapid repeated effects are limited and pausing a fanfare does not leave silent dead time',async()=>{
 const {Audio,contexts}=setup(),audio=new Audio();await audio.unlock();assert.equal(audio.effect('jump'),true);assert.equal(audio.effect('jump'),false);
 contexts[0].currentTime=.1;assert.equal(audio.effect('jump'),true);
 audio.effect('victory');assert.ok(audio.duckUntil>2);audio.setPaused(true);audio.setPaused(false);audio.update();assert.ok([...audio.voices].some(v=>v.music));
 assert.equal(audio.effect('not-an-event'),false);
});
test('theme replacement cancels only music and disposal releases the audio graph',async()=>{
 const {Audio,contexts}=setup(),audio=new Audio();await audio.unlock();audio.update();audio.effect('pipe');
 const music=[...audio.voices].filter(v=>v.music),effects=[...audio.voices].filter(v=>!v.music);
 audio.setTheme('water');assert.ok(music.every(v=>v.source.disconnected));assert.ok(effects.every(v=>!v.source.disconnected));
 audio.setTheme('unknown');assert.equal(audio.themeName,'overworld');audio.dispose();assert.equal(audio.voices.size,0);assert.equal(contexts[0].state,'closed');
 assert.equal(await audio.unlock(),false);assert.equal(audio.effect('coin'),false);audio.update();assert.equal(audio.voices.size,0);
});

test('hurry speeds up the synthesized music and tempo is clamped',async()=>{
 const {Audio,contexts}=setup(),audio=new Audio();await audio.unlock();
 audio.update();const fast=new (setup().Audio)();await fast.unlock();fast.setTempo(1.3);fast.update();
 const step=a=>a.nextTime-.025;
 assert.ok(Math.abs(step(audio)/step(fast)-1.3)<.01,'each step is 1.3x shorter');
 fast.setTempo(10);assert.equal(fast.tempo,2);fast.setTempo(-1);assert.equal(fast.tempo,2);fast.setTempo(1);assert.equal(fast.tempo,1);
});
