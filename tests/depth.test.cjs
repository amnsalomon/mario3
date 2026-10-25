'use strict';
// Dificuldade progressiva, segredos (céu de moedas, pé de feijão, Botão P, vidas escondidas)
// e os novos perigos (barra de fogo, bola de lava, esmagador, maçarico, plataforma frágil).
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/levels.js');
require('../js/engine.js');
const { MarioGame, createLevel, T, PHYS } = globalThis.MarioCore;
const { difficulty, SKY_ROWS } = globalThis.MarioLevels;

function game(stage = 0, power = 'small', keepEnemies = false) {
  const g = new MarioGame();
  g.savedPower = power;
  g.enterStage(stage);
  if (!keepEnemies) { g.level.enemies = []; g.level.cannons = []; }
  g.step(1 / 60, {});
  return g;
}
const tick = (g, n, input = {}) => { for (let i = 0; i < n; i++) g.step(1 / 60, typeof input === 'function' ? input(i) : input); };
const blockWith = (l, item) => Object.keys(l.blocks).find(k => l.blocks[k].item === item).split(',').map(Number);
const hazardCount = l => l.firebars.length + l.bubbles.length + l.crushers.length + l.burners.length + l.platforms.filter(p => p.kind === 'fall').length;

test('a dificuldade cresce de 1-1 até o castelo: mais inimigos, perigos e buracos maiores', () => {
  assert.equal(difficulty(0), 0);
  assert.equal(difficulty(47), 1);
  for (let i = 1; i < 48; i++) assert(difficulty(i) >= difficulty(i - 1));
  const sum = (from, to, fn) => { let s = 0; for (let i = from; i < to; i++) s += fn(createLevel(i)); return s; };
  const enemies = l => l.enemies.length + l.cannons.length;
  const early = sum(0, 12, enemies), late = sum(36, 48, enemies);
  assert(late > early * 1.6, `mundos 7-8 (${late}) bem mais povoados que 1-2 (${early})`);
  assert(sum(36, 48, hazardCount) > sum(0, 12, hazardCount) * 2, 'mais perigos no fim');
  const w1 = createLevel(0), w8 = createLevel(42);
  assert(w8.enemySpeed > w1.enemySpeed && w8.cannonDelay < w1.cannonDelay);
  for (let i = 0; i < 48; i++) {
    const l = createLevel(i);
    if (l.plan === 'grass' || l.plan === 'hills') assert(l.enemies.length >= 8, `${i}: 1-1 já tem inimigos de verdade`);
  }
});

test('todas as fases ao ar livre têm segredos, e o fim da fase mostra quantos foram achados', () => {
  let withSky = 0;
  for (let i = 0; i < 48; i++) {
    const l = createLevel(i);
    if (l.skyRows) {
      assert.equal(l.sky.length, SKY_ROWS);
      if (l.secrets.includes('sky')) withSky++;
    }
    if (['ground', 'sky'].includes(globalThis.MarioLevels.planFor(i).build) && !l.boss) assert(l.secrets.length >= 1, `fase ${i} sem segredo`);
  }
  assert(withSky >= 20, `céu de moedas em várias fases (${withSky})`);
  const g = game(1);
  assert(g.level.secrets.includes('pswitch'));
  g.findSecret('pswitch');
  g.clearStage('card');
  assert.deepEqual(g.ending.secrets, { found: 1, total: g.level.secrets.length });
});

test('pé de feijão: nasce do tijolo, o Mario sobe sozinho até o céu e acha o segredo', () => {
  const g = game(0, 'big');
  const l = g.level, [tx, ty] = blockWith(l, 'vine');
  g.hitBlock(tx, ty, 'player');
  assert.equal(g.tile(tx, ty), T.USED);
  assert.equal(l.vines.length, 1);
  tick(g, 60 * 5);
  const v = l.vines[0];
  assert.equal(v.top, v.target, 'cresceu até o céu');
  assert(v.target < -100);
  const p = g.player;
  p.x = tx * 16 + 1;
  p.y = ty * 16 - p.h;
  p.vx = 0;
  tick(g, 2, { up: true });
  assert(p.climb, 'agarrou com ↑');
  tick(g, 60 * 5);
  assert(p.y + p.h <= v.top + 9, 'chegou ao topo');
  assert(g.cameraY < -60, 'a câmera subiu junto');
  tick(g, 1, { move: 1 });
  assert(!p.climb, 'soltou para o lado');
  tick(g, 14, { move: 1 });
  tick(g, 30);
  assert(p.grounded && p.y < -64, 'pousou nas nuvens');
  assert(g.found.includes('sky'));
  assert(l.coins.some(c => c.y < -90 && !c.taken), 'há moedas no céu');
});

test('voando com a Folha dá para chegar ao céu acima da tela', () => {
  const g = game(0, 'raccoon');
  const p = g.player;
  p.pm = 7;
  g.step(1 / 60, { move: 1, run: true, jump: true });
  assert(p.flight > 0);
  tick(g, 60 * 3, i => ({ move: 1, run: true, jump: i % 6 < 3 }));
  assert(p.y < -100, `subiu acima da tela (${Math.round(p.y)})`);
  assert(g.cameraY < -60);
});

test('Botão P: tijolos viram moedas, moedas viram tijolos e tudo volta depois de 10 s', () => {
  const g = game(1, 'big');
  const l = g.level, [tx, ty] = blockWith(l, 'pswitch');
  const bricksBefore = l.tiles.flat().filter(t => t === T.BRICK).length;
  const coinsBefore = l.coins.filter(c => !c.taken).length;
  g.hitBlock(tx, ty, 'player');
  tick(g, 30);
  const sw = l.switches[0];
  assert(sw && sw.emerge === 0);
  const p = g.player;
  p.x = sw.x + 1;
  p.y = sw.y - p.h - 6;
  p.vy = 60;
  tick(g, 6);
  assert(sw.pressed, 'pisou no botão');
  p.x = 40;
  p.y = 192 - p.h;
  p.vy = 0;
  assert(g.pTimer > 9);
  assert(g.found.includes('pswitch'));
  const bricksOn = l.tiles.flat().filter(t => t === T.BRICK).length;
  const coinsOn = l.coins.filter(c => !c.taken && c.fromBrick).length;
  assert(coinsOn >= 15, 'o bloco de tijolos virou moedas');
  assert(bricksOn > 0 && bricksOn !== bricksBefore);
  tick(g, 60 * 10.5);
  assert.equal(g.pTimer, 0);
  assert.equal(l.tiles.flat().filter(t => t === T.BRICK).length, bricksBefore - 1, 'tijolos voltaram (menos o do botão, que virou bloco usado)');
  assert.equal(l.coins.filter(c => !c.taken).length, coinsBefore, 'moedas voltaram');
});

test('tijolo de várias moedas e vida escondida contam como prêmio e segredo', () => {
  const g = game(0, 'small');
  const l = g.level;
  l.blocks['5,8'] = { item: 'coins', bump: 0 };
  l.tiles[8][5] = T.BRICK;
  const before = g.coins;
  for (let i = 0; i < 6; i++) { g.hitBlock(5, 8, 'player'); tick(g, 12); }
  assert.equal(g.coins - before, 6);
  assert.equal(g.tile(5, 8), T.BRICK, 'ainda dá moedas');
  tick(g, 60 * 5);
  g.hitBlock(5, 8, 'player');
  assert.equal(g.tile(5, 8), T.USED, 'acaba depois de alguns segundos');
  const [hx, hy] = Object.keys(l.blocks).map(k => k.split(',').map(Number)).find(([x, y]) => l.blocks[x + ',' + y].item === 'oneup' && g.tile(x, y) === T.HIDDEN);
  g.hitBlock(hx, hy, 'player');
  assert(g.found.includes('oneup'));
  assert(l.items.some(it => it.type === 'oneup'));
});

test('barra de fogo, bola de lava, maçarico e esmagador ferem; a estrela protege', () => {
  const g = game(45, 'big');
  const l = g.level, p = g.player;
  const f = l.firebars[0];
  g.camera = Math.max(0, f.x - 200);
  const ball = g.firebarBalls(f)[f.n - 1];
  p.x = ball.x - p.w / 2;
  p.y = ball.y - p.h / 2;
  p.invuln = 0;
  g.updateHazards(1 / 60);
  assert.equal(p.power, 'small', 'barra de fogo machuca');

  const b = l.bubbles[0];
  let st = null;
  for (let k = 0; k < 400 && !st; k++) { g.clock += 0.01; st = g.bubbleState(b); }
  p.invuln = 0;
  p.star = 5;
  g.camera = Math.max(0, b.x - 200);
  p.x = st.x;
  p.y = st.y;
  g.updateHazards(1 / 60);
  assert.equal(g.mode, 'playing', 'com estrela passa ileso');
  p.star = 0;
  g.updateHazards(1 / 60);
  assert.equal(g.mode, 'dying', 'sem estrela, Mario pequeno morre');

  const c = createLevel(33).crushers[0];
  const h = game(33, 'big');
  const cr = h.level.crushers[0], hp = h.player;
  hp.x = cr.x + 8;
  hp.y = 192 - hp.h;
  h.camera = Math.max(0, cr.x - 200);
  for (let i = 0; i < 60 && cr.state !== 'ground'; i++) h.updateHazards(1 / 60);
  assert(['ground', 'rise'].includes(cr.state) || h.player.power === 'small', 'esmagador cai em quem passa embaixo');
  assert.equal(h.player.power, 'small');
  assert(c.y < cr.y || cr.state !== 'wait');

  const a = game(35, 'big');
  const q = a.level.burners[0];
  a.camera = q.tx * 16 - 200;
  a.clock = q.period - q.phase + 0.3;
  assert(a.burnerState(q).on);
  a.player.x = q.tx * 16;
  a.player.y = q.ty * 16 - 30;
  a.updateHazards(1 / 60);
  assert.equal(a.player.power, 'small', 'maçarico aceso queima');
});

test('plataforma frágil treme, cai e volta depois de um tempo', () => {
  const i = Array.from({ length: 48 }, (_, k) => k).find(k => createLevel(k).platforms.some(p => p.kind === 'fall'));
  const g = game(i, 'big');
  const pl = g.level.platforms.find(p => p.kind === 'fall');
  const p = g.player;
  p.x = pl.x + 8;
  p.y = pl.y - p.h - 2;
  p.vy = 0;
  g.camera = Math.max(0, pl.x - 150);
  tick(g, 8);
  assert(pl.state >= 1, 'pisou');
  tick(g, 40);
  assert(pl.y > pl.baseY, 'caiu');
  tick(g, 60 * 5, () => ({}));
  if (g.mode === 'playing') assert(pl.state === 0 && pl.y === pl.baseY, 'voltou ao lugar');
});

test('planta de fogo cospe na direção do Mario; peixe saltador sai do buraco', () => {
  const g = game(40, 'big', true);
  const l = g.level, e = l.enemies.find(x => x.fire);
  g.cheats.invincible = true;
  g.camera = Math.max(0, e.x - 200);
  const p = g.player;
  p.x = e.x - 80;
  p.y = 192 - p.h;
  e.active = true;
  let shot = null;
  for (let k = 0; k < 400 && !shot; k++) { g.step(1 / 60, {}); p.x = e.x - 80; shot = g.projectiles.find(a => a.kind === 'spit'); }
  assert(shot, 'cuspiu');
  assert(shot.vx < 0, 'mirou para o lado do Mario');

  const s = game(12, 'big', true);
  const fish = s.level.enemies.find(x => x.jumper);
  s.cheats.invincible = true;
  s.camera = Math.max(0, fish.x0 - 200);
  s.player.x = fish.x0 - 120;
  fish.active = true;
  let seen = false;
  for (let k = 0; k < 300 && !seen; k++) { s.step(1 / 60, {}); s.player.x = fish.x0 - 120; seen = !fish.hidden && fish.y < 180; }
  assert(seen, 'o peixe salta acima do chão');
});

test('tartaruga em plataforma alta não cai da beirada', () => {
  const g = game(0, 'big');
  const l = g.level;
  for (let x = 20; x < 24; x++) l.tiles[7][x] = T.SEMI;
  const k = { id: 99, type: 'koopa', x: 21 * 16, y: 7 * 16 - 24, w: 14, h: 24, vx: 0, vy: 0, dir: 1, dead: false, active: true, grounded: true, timer: 0, grace: 0, chain: 0, smart: true };
  l.enemies.push(k);
  g.camera = 0;
  g.player.x = 600;
  tick(g, 60 * 6);
  assert(!k.dead && k.y < 7 * 16, 'continua lá em cima');
  assert(k.x >= 20 * 16 - 2 && k.x + k.w <= 24 * 16 + 2);
});

test('os códigos secretos continuam valendo junto com as novidades', () => {
  const g = game(0, 'small');
  assert(g.applyCheat('VOARSEMPRE').ok);
  tick(g, 60 * 4, i => ({ move: 1, jump: i % 6 < 3 }));
  assert(g.player.y < -60, 'voo infinito alcança o céu');
  assert(g.cameraY < 0);
  assert(g.applyCheat('PULAFASE').ok);
  assert.equal(g.mode, 'clear');
});
