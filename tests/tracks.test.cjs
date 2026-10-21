'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/tracks.js');

class FakeAudio {
  constructor(src) { this.src = src; this.paused = true; this.events = {}; this.plays = 0; this.currentTime = 5; this.playbackRate = 1; }
  addEventListener(e, fn) { this.events[e] = fn; }
  play() { this.plays++; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
const flush = () => new Promise(r => setImmediate(r));

test('a faixa do mapa toca no mapa e silencia a trilha sintetizada; nas fases volta o sintetizador', async () => {
  const t = new MarioTracks({ map: 'music/map.mp3' }, FakeAudio);
  assert.equal(t.update('map', true), true);
  await flush();
  const a = t.audios.map;
  assert.equal(a.src, 'music/map.mp3');
  assert.equal(a.loop, true);
  assert.equal(a.currentTime, 0, 'recomeça do início ao chegar ao mapa');
  assert.equal(a.paused, false);
  for (let i = 0; i < 30; i++) t.update('map', true);
  await flush();
  assert.equal(a.plays, 1, 'não reinicia a cada quadro');
  assert.equal(t.update('overworld', true), false, 'fase sem arquivo usa a trilha própria');
  assert.equal(a.paused, true);
});

test('pausa, volume e velocidade de urgência são respeitados', async () => {
  const t = new MarioTracks({ map: 'm.mp3', castle: 'c.mp3' }, FakeAudio);
  t.update('map', true);
  await flush();
  t.update('map', false);
  assert.equal(t.audios.map.paused, true);
  t.setVolume(0.7);
  assert.equal(t.audios.map.volume, 0.7);
  t.update('castle', true, 1.25);
  assert.equal(t.audios.castle.playbackRate, 1.25);
});

test('arquivo ausente ou inválido cai para a trilha sintetizada', async () => {
  const t = new MarioTracks({ map: 'faltando.mp3' }, FakeAudio);
  t.update('map', true);
  t.audios.map.events.error();
  assert.equal(t.has('map'), false);
  assert.equal(t.update('map', true), false);
  const blocked = new MarioTracks({ map: 'm.mp3' }, class extends FakeAudio { play() { this.plays++; return Promise.reject(new Error('gesto')); } });
  blocked.update('map', true);
  await flush();
  for (let i = 0; i < 20; i++) blocked.update('map', true);
  await flush();
  assert.equal(blocked.audios.map.plays, 1, 'não insiste sem gesto do usuário');
  blocked.unlock();
  blocked.update('map', true);
  await flush();
  assert.equal(blocked.audios.map.plays, 2);
});
