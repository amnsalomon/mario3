/* Original NES-style synthesis and compositions. No recordings or ROM assets. */
(() => {
  'use strict';
  const ROOT=globalThis;
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  const semitones={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  function note(value){
    if(value==='-'||value==='.')return null;
    const match=/^([A-G])([#b]?)([0-8])$/.exec(value);
    if(!match)throw new Error('Invalid musical note: '+value);
    return (+match[3]+1)*12+semitones[match[1]]+(match[2]==='#'?1:match[2]==='b'?-1:0);
  }
  const melody=text=>text.trim().split(/\s+/).map(note);
  const hz=midi=>440*Math.pow(2,(midi-69)/12);
  function theme(bpm,lead,chords,bassStyle='bounce',leadType='square'){
    return {bpm,stepBeats:.5,lead:melody(lead),chords:chords.map(c=>c.map(note)),bassStyle,leadType};
  }
  // Each eight-step chord spans a bar. These melodies are newly composed for this game.
  const THEMES={
    overworld:theme(150,
      'G5 - E5 G5 A5 G5 E5 D5 C5 - E5 G5 D5 E5 G5 - '+
      'A5 - G5 E5 C6 B5 A5 G5 E5 - G5 A5 E5 D5 C5 - '+
      'F5 A5 C6 - A5 G5 F5 E5 D5 - F5 A5 G5 F5 D5 - '+
      'G5 B5 D6 B5 A5 G5 E5 D5 C6 - G5 E5 D5 C5 G4 -',
      [['C3','E4','G4'],['C3','E4','G4'],['A2','C4','E4'],['A2','C4','E4'],['F2','A3','C4'],['D3','F4','A4'],['G2','B3','D4'],['C3','E4','G4']]),
    underground:theme(118,
      'C4 - G4 - Eb4 - Bb4 G4 C5 - G4 Eb4 D4 - C4 - '+
      'Ab4 - Eb4 - C5 - Bb4 Ab4 G4 - Eb4 C4 G3 - C4 - '+
      'F4 - C5 - Ab4 - Eb5 C5 Bb4 Ab4 F4 - G4 - Eb4 - '+
      'G4 - B4 D5 C5 B4 G4 F4 Eb4 - D4 - C4 - - -',
      [['C2','Eb3','G3'],['C2','Eb3','G3'],['Ab2','C4','Eb4'],['C2','Eb3','G3'],['F2','Ab3','C4'],['F2','Ab3','C4'],['G2','B3','D4'],['C2','Eb3','G3']], 'sparse','triangle'),
    water:theme(105,
      'E5 - G5 - B5 A5 G5 - D5 - F5 - A5 G5 F5 - '+
      'C5 E5 G5 B5 C6 - G5 - A5 - G5 E5 D5 - - - '+
      'F5 - A5 - C6 B5 A5 G5 E5 - G5 - B5 A5 G5 - '+
      'D5 F5 A5 C6 B5 - G5 F5 E5 - D5 - C5 - - -',
      [['C3','E4','G4'],['D3','F4','A4'],['C3','E4','G4'],['A2','C4','E4'],['F2','A3','C4'],['E3','G4','B4'],['G2','B3','D4'],['C3','E4','G4']], 'flow','triangle'),
    castle:theme(132,
      'D5 - A4 D5 F5 E5 D5 C#5 D5 - F5 A5 G5 F5 E5 - '+
      'Bb4 - D5 F5 A5 G5 F5 E5 D5 C5 Bb4 - A4 - - - '+
      'G4 Bb4 D5 - F5 E5 D5 C5 A4 C#5 E5 - G5 F5 E5 D5 '+
      'C#5 E5 A5 G5 F5 E5 D5 C#5 D5 A4 F4 A4 D5 - - -',
      [['D2','F3','A3'],['D2','F3','A3'],['Bb2','D4','F4'],['Bb2','D4','F4'],['G2','Bb3','D4'],['A2','C#4','E4'],['A2','C#4','E4'],['D2','F3','A3']], 'march'),
    airship:theme(144,
      'E5 B4 E5 - G5 F#5 E5 D5 B4 D5 E5 - F#5 G5 B5 - '+
      'C5 G4 C5 - E5 D5 C5 B4 A4 C5 E5 - G5 E5 D5 - '+
      'A4 E5 A5 - G5 F#5 E5 D5 B4 F#5 B5 - A5 G5 F#5 E5 '+
      'D#5 F#5 B5 A5 G5 F#5 E5 D#5 E5 - B4 G4 E4 - - -',
      [['E2','G3','B3'],['E2','G3','B3'],['C3','E4','G4'],['C3','E4','G4'],['A2','C4','E4'],['B2','D#4','F#4'],['B2','D#4','F#4'],['E2','G3','B3']], 'march'),
    map:theme(125,
      'C5 E5 G5 - A5 G5 E5 - F5 A5 C6 - G5 E5 D5 - '+
      'E5 G5 B5 - C6 G5 E5 C5 D5 F5 A5 G5 E5 D5 C5 -',
      [['C3','E4','G4'],['F2','A3','C4'],['E3','G4','B4'],['G2','B3','D4']], 'bounce'),
    star:theme(188,
      'C6 G5 E5 G5 C6 E6 D6 C6 A5 E5 C5 E5 A5 C6 B5 A5 '+
      'F5 C6 A5 C6 F6 E6 D6 C6 G5 D6 B5 G5 C6 E6 G6 -',
      [['C3','E4','G4'],['A2','C4','E4'],['F2','A3','C4'],['G2','B3','D4']], 'bounce')
  };
  // A step is [offset seconds, duration, start Hz, end Hz, waveform, volume].
  const tone=(offset,duration,start,end=start,type='square',volume=.075)=>[offset,duration,start,end,type,volume];
  const sequence=(notes,seconds,type='square',volume=.075)=>notes.map((n,i)=>tone(i*seconds,seconds*.86,hz(note(n)),hz(note(n)),type,volume));
  const EFFECTS={
    jump:[tone(0,.13,180,760,'square',.065),tone(.07,.08,440,980,'triangle',.055)],
    coin:[tone(0,.065,1568,1568,'square',.055),tone(.065,.19,2093,2093,'square',.052)],
    bump:[tone(0,.075,148,70,'triangle',.15)],
    break:[tone(0,.16,1,1,'noise',.075),tone(.02,.1,94,36,'square',.065)],
    stomp:[tone(0,.085,240,58,'square',.08)],
    kick:[tone(0,.09,420,95,'square',.068),tone(0,.035,1,1,'noise',.025)],
    powerup:sequence(['C5','E5','G5','C6','E6','G6'],.085,'square',.065),
    powerdown:[tone(0,.24,820,110,'square',.065),tone(.08,.22,420,65,'triangle',.065)],
    oneup:sequence(['E5','G5','C6','A5','B5','E6'],.105,'square',.075),
    fire:[tone(0,.095,620,115,'square',.06),tone(.01,.055,1,1,'noise',.018)],
    tail:[tone(0,.105,1,1,'noise',.035),tone(.01,.085,130,420,'triangle',.05)],
    fly:[tone(0,.09,620,960,'triangle',.07),tone(.07,.09,760,1200,'square',.035)],
    pipe:[tone(0,.11,420,160,'square',.055),tone(.12,.11,350,130,'square',.055),tone(.24,.13,280,95,'square',.05)],
    death:sequence(['C6','B5','G5','E5','Eb5','C5','G4','C4'],.13,'square',.08),
    clear:sequence(['C5','E5','G5','C6','G5','A5','B5','C6','E6','C6'],.125,'square',.075),
    worldClear:sequence(['G4','C5','E5','G5','C6','E6','D6','B5','G5','C6','E6','G6'],.14,'square',.075),
    victory:sequence(['C5','G5','E5','C6','B5','G5','A5','C6','E6','D6','B5','G5','C6','E6','G6','C6'],.17,'square',.075),
    pause:[tone(0,.06,523,523,'square',.045),tone(.075,.06,659,659,'square',.045)],
    select:[tone(0,.05,880,1047,'square',.05)],
    hurry:sequence(['G5','C6','G5','C6','A5','D6'],.075,'square',.06),
    swim:[tone(0,.09,300,520,'triangle',.06)],
    sprout:[tone(0,.18,220,660,'square',.045),tone(.05,.15,330,880,'triangle',.04)],
    cannon:[tone(0,.14,1,1,'noise',.09),tone(0,.12,120,45,'square',.07)],
    flame:[tone(0,.22,1,1,'noise',.05),tone(0,.2,200,90,'triangle',.06)],
    orb:sequence(['E6','C6','G6'],.07,'triangle',.07),
    tick:[tone(0,.03,1760,1760,'square',.025)],
    gameover:sequence(['C5','G4','E4','A4','B4','A4','Ab4','Bb4','Ab4','G4','F4','G4'],.16,'square',.07),
    cheat:sequence(['C6','E6','G6','B6','D7'],.06,'triangle',.07)
  };
  const STINGERS=new Set(['death','clear','worldClear','victory','gameover']);
  const RATE_LIMIT={jump:.045,coin:.04,stomp:.04,kick:.05,fire:.07,tail:.09,fly:.12,bump:.07,tick:.05,swim:.06,cannon:.2};
  for(const t of Object.values(THEMES)){Object.freeze(t.lead);t.chords.forEach(Object.freeze);Object.freeze(t.chords);Object.freeze(t);}
  for(const steps of Object.values(EFFECTS)){steps.forEach(Object.freeze);Object.freeze(steps);}
  Object.freeze(THEMES);Object.freeze(EFFECTS);

  class MarioAudio {
    constructor(){
      this.enabled=true;this.musicEnabled=true;this.volume=.55;this.paused=false;
      this.context=null;this.master=null;this.noiseBuffer=null;this.voices=new Set();
      this.themeName='overworld';this.nextStep=0;this.nextTime=0;this.duckUntil=0;
      this.lastEffect=new Map();this.disposed=false;this.unlocked=false;this.tempo=1;
    }
    setTempo(tempo){
      const n=Number(tempo);if(!Number.isFinite(n)||n<=0)return;
      this.tempo=clamp(n,.5,2);
    }
    async unlock(){
      if(this.disposed||!this.enabled)return false;
      try{
        if(!this.context){
          const Audio=ROOT.AudioContext||ROOT.webkitAudioContext||ROOT.window?.AudioContext||ROOT.window?.webkitAudioContext;
          if(!Audio)return false;
          this.context=new Audio();this.master=this.context.createGain();
          this.master.gain.value=this.volume;this.master.connect(this.context.destination);
          const length=Math.ceil(this.context.sampleRate*.5);
          this.noiseBuffer=this.context.createBuffer(1,length,this.context.sampleRate);
          const samples=this.noiseBuffer.getChannelData(0);let seed=1988;
          for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;samples[i]=((seed>>>0)/2147483648-1)*.65;}
          this.nextTime=this.context.currentTime+.025;
        }
        if(this.context.state==='suspended')await this.context.resume();
        this.unlocked=this.context.state==='running';return this.unlocked;
      }catch{
        if(this.context&&!this.master){try{await this.context.close();}catch{}this.context=null;}
        this.unlocked=false;return false;
      }
    }
    setEnabled(enabled){
      enabled=!!enabled;if(this.enabled===enabled)return;
      this.enabled=enabled;
      if(!enabled){this._stopVoices();this.duckUntil=0;}
      this._gain();this._resetClock();
    }
    setMusicEnabled(enabled){
      enabled=!!enabled;if(this.musicEnabled===enabled)return;
      this.musicEnabled=enabled;this._stopVoices(v=>v.music);this._resetClock();
    }
    setVolume(volume){
      const n=Number(volume);if(!Number.isFinite(n))return;
      this.volume=clamp(n,0,1);this._gain();
    }
    setTheme(name){
      const next=Object.hasOwn(THEMES,name)?name:'overworld';
      if(this.themeName===next)return;
      this.themeName=next;this._stopVoices(v=>v.music);this._resetClock();
    }
    setPaused(paused){
      paused=!!paused;if(this.paused===paused)return;
      this.paused=paused;
      if(paused){this._stopVoices();this.duckUntil=0;}
      this._resetClock();this._gain();
    }
    _gain(){
      if(!this.master||!this.context)return;
      const now=this.context.currentTime,g=this.master.gain;
      g.cancelScheduledValues(now);g.setValueAtTime(this.enabled&&!this.paused?this.volume:0,now);
    }
    _resetClock(){this.nextStep=0;this.nextTime=(this.context?.currentTime||0)+.025;}
    _ready(){return !this.disposed&&this.enabled&&!this.paused&&this.unlocked&&this.context?.state==='running';}
    _stopVoices(predicate=()=>true){
      const now=this.context?.currentTime||0;
      for(const voice of [...this.voices]){
        if(!predicate(voice))continue;
        try{voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(0,now);voice.source.stop(now);}catch{/* It may already have ended. */}
        this._release(voice);
      }
    }
    _release(voice){
      this.voices.delete(voice);
      try{voice.source.disconnect();voice.gain.disconnect();}catch{}
    }
    _sound(time,duration,start,end,type,volume,music=false){
      if(!this._ready())return;
      const ctx=this.context,source=type==='noise'?ctx.createBufferSource():ctx.createOscillator(),gain=ctx.createGain();
      if(type==='noise'){source.buffer=this.noiseBuffer;source.loop=true;}
      else{
        source.type=type;source.frequency.setValueAtTime(Math.max(20,start),time);
        if(start!==end)source.frequency.exponentialRampToValueAtTime(Math.max(20,end),time+duration*.92);
      }
      const attack=Math.min(.006,duration*.15),release=Math.min(.035,duration*.3);
      gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(volume,time+attack);
      gain.gain.setValueAtTime(volume*.8,time+Math.max(attack,duration-release));
      gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
      source.connect(gain);gain.connect(this.master);
      const voice={source,gain,end:time+duration+.008,music};this.voices.add(voice);
      source.onended=()=>this._release(voice);source.start(time);source.stop(voice.end);
    }
    effect(name){
      if(!this._ready()||!Object.hasOwn(EFFECTS,name))return false;
      const now=this.context.currentTime,previous=this.lastEffect.get(name);
      if(previous!==undefined&&now-previous<(RATE_LIMIT[name]||.015))return false;
      this.lastEffect.set(name,now);
      const steps=EFFECTS[name];
      if(STINGERS.has(name)){
        this._stopVoices();
        this.duckUntil=now+Math.max(...steps.map(s=>s[0]+s[1]))+.15;
        this.nextTime=this.duckUntil;this.nextStep=0;
      }
      for(const [offset,duration,start,end,type,volume] of steps)this._sound(now+.008+offset,duration,start,end,type,volume,false);
      return true;
    }
    _scheduleStep(index,time){
      const t=THEMES[this.themeName],duration=60/t.bpm*t.stepBeats/this.tempo;
      const local=index%t.lead.length,chord=t.chords[Math.floor(local/8)%t.chords.length],beat=local%8,lead=t.lead[local];
      if(lead!==null)this._sound(time,duration*(t.bassStyle==='flow'?.94:.73),hz(lead),hz(lead),t.leadType,t.leadType==='triangle'?.11:.043,true);
      // Quiet square arpeggios and a triangle bass recreate a four-channel texture.
      if(beat%2===1){const harmonic=chord[1+(beat%4===3?1:0)];this._sound(time,duration*.65,hz(harmonic),hz(harmonic),'square',.014,true);}
      const sparse=t.bassStyle==='sparse';
      if(beat%2===0&&(!sparse||beat%4===0)){
        const bass=chord[0]+(beat===2||beat===6?7:0);
        this._sound(time,duration*(t.bassStyle==='flow'?1.65:.75),hz(bass),hz(bass),'triangle',.105,true);
      }
      if(t.bassStyle!=='flow'&&t.bassStyle!=='sparse'){
        if(beat%4===0)this._sound(time,.05,90,39,'triangle',.08,true);
        else if(beat%4===2)this._sound(time,.045,1,1,'noise',.018,true);
        else this._sound(time,.018,1,1,'noise',.008,true);
      }
    }
    update(){
      if(!this._ready())return;
      const now=this.context.currentTime;
      for(const v of [...this.voices])if(v.end<now-.05)this._release(v);
      if(!this.musicEnabled||now<this.duckUntil)return;
      if(this.nextTime<now-.2)this.nextTime=now+.02;
      const seconds=60/THEMES[this.themeName].bpm*THEMES[this.themeName].stepBeats/this.tempo;
      let guard=0;
      while(this.nextTime<now+.12&&guard++<12){this._scheduleStep(this.nextStep++,this.nextTime);this.nextTime+=seconds;}
    }
    dispose(){
      this._stopVoices();this.disposed=true;this.unlocked=false;
      if(this.context){try{const result=this.context.close();if(result?.catch)result.catch(()=>{});}catch{}}
      try{this.master?.disconnect();}catch{}
    }
  }
  MarioAudio.themes=THEMES;MarioAudio.effects=EFFECTS;MarioAudio.frequency=hz;
  ROOT.MarioAudio=MarioAudio;
})();
