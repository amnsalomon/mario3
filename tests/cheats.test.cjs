'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/levels.js');
require('../js/engine.js');
const { MarioGame, PHYS } = globalThis.MarioCore;

function level(stage = 0, power = 'small') {
  const g = new MarioGame();
  g.savedPower = power;
  g.enterStage(stage);
  g.level.enemies = [];
  g.level.cannons = [];
  g.step(1 / 60, {});
  return g;
}
const tick = (g, n, input = {}) => { for (let i = 0; i < n; i++) g.step(1 / 60, typeof input === 'function' ? input(i) : input); };

test('códigos aceitam minúsculas, espaços e acentos; código errado é recusado', () => {
  const g = level();
  assert.equal(g.applyCheat('voar sempre').ok, true);
  assert.equal(g.cheats.fly, true);
  assert.equal(g.applyCheat('Invencível').ok, true);
  assert.equal(g.cheats.invincible, true);
  assert.equal(g.applyCheat('abracadabra').ok, false);
  assert.equal(g.applyCheat('NORMAL').ok, true);
  assert.deepEqual(g.activeCheats(), []);
});

test('VOARSEMPRE: qualquer forma voa sem limite de tempo', () => {
  const g = level(0, 'small');
  g.applyCheat('VOARSEMPRE');
  g.step(1 / 60, { jump: true });
  const y0 = g.player.y;
  tick(g, 60 * 8, i => ({ move: i % 120 < 60 ? 1 : -1, jump: i % 6 < 3 }));
  assert(g.player.y < y0 - 80, 'continua subindo depois de 8 s');
  assert(g.player.flight > 0);
  assert.equal(g.player.pm, 7);
  g.applyCheat('VOARSEMPRE');
  assert.equal(g.cheats.fly, false, 'digitar de novo desliga');
});

test('TIROLIVRE, TIROTRIPLO e MEGATIRO', () => {
  const g = level(0, 'small');
  g.applyCheat('TIROLIVRE');
  g.attack();
  assert.equal(g.projectiles.length, 1, 'Mario pequeno atira');
  g.applyCheat('TIROTRIPLO');
  g.player.attackCooldown = 0;
  g.attack();
  assert.equal(g.projectiles.length, 4, 'três de uma vez');
  assert(g.projectiles.some(a => a.straight));
  const m = level(0, 'big');
  m.applyCheat('MEGATIRO');
  const mk = x => ({ id: x, type: 'goomba', x: m.player.x + x, y: m.player.y + 12, w: 16, h: 16, vx: 0, vy: 0, dir: -1, dead: false, active: true, timer: 0, grace: 0 });
  const a = mk(24), b = mk(48);
  m.level.enemies.push(a, b);
  m.attack();
  m.projectiles[0].vy = 0;
  m.projectiles[0].straight = true;
  tick(m, 20);
  assert(a.dead && b.dead, 'megatiro atravessa os inimigos');
});

test('INVENCIVEL ignora dano', () => {
  const g = level(0, 'small');
  g.applyCheat('INVENCIVEL');
  g.damage();
  assert.equal(g.mode, 'playing');
  assert.equal(g.player.power, 'small');
});

test('PULAFASE termina a fase, também no mapa; na nave passa de mundo', () => {
  const g = level(0);
  assert(g.applyCheat('PULAFASE').ok);
  assert.equal(g.mode, 'clear');
  tick(g, 60 * 5);
  assert.equal(g.mode, 'map');
  assert(g.completed.includes(0));
  assert(g.applyCheat('PULAFASE').ok);
  assert(g.completed.includes(1));
  for (let i = 0; i < 4; i++) g.applyCheat('PULAFASE');
  assert.equal(g.world, 1, 'concluir a nave abre o mundo 2');
  const b = level(3);
  b.applyCheat('PULAFASE');
  assert.equal(b.mode, 'clear');
  assert.equal(b.ending.kind, 'orb');
});

test('PULAMUNDO e MUNDO1 a MUNDO8', () => {
  const g = new MarioGame();
  g.newGame();
  assert(g.applyCheat('PULAMUNDO').ok);
  assert.equal(g.world, 1);
  assert.equal([0, 1, 2, 3, 4, 5].every(s => g.completed.includes(s)), true);
  assert(g.applyCheat('mundo 8').ok);
  assert.equal(g.world, 7);
  assert.equal(g.mode, 'map');
  assert(g.completed.includes(41));
  g.applyCheat('PULAMUNDO');
  assert.equal(g.mode, 'victory');
  const h = level(10);
  h.applyCheat('MUNDO3');
  assert.equal(h.mode, 'map');
  assert.equal(h.world, 2);
  assert.equal(h.level, null);
});

test('COGUMELO, FOLHA, FLOR, ESTRELA e VIDAEXTRA', () => {
  const g = level(0, 'small');
  g.applyCheat('COGUMELO');
  assert.equal(g.player.power, 'big');
  assert.equal(g.inventory.filter(i => i === 'mushroom').length, 5);
  g.applyCheat('FOLHA');
  assert.equal(g.player.power, 'raccoon');
  g.applyCheat('FLOR');
  assert.equal(g.player.power, 'fire');
  g.applyCheat('ESTRELA');
  assert(g.player.star >= 19);
  const lives = g.lives;
  g.applyCheat('VIDAEXTRA');
  assert.equal(g.lives, lives + 10);
  const m = new MarioGame();
  m.newGame();
  m.applyCheat('FLOR');
  assert.equal(m.savedPower, 'fire', 'no mapa vale para a próxima fase');
  assert(PHYS.flightTime > 4);
});
