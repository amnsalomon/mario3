'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/levels.js');
require('../js/engine.js');
require('../js/sprites.js');
require('../js/scenery.js');
require('../js/renderer.js');
const { MarioGame, createLevel, PHYS, CHAIN, T, MAP_NODES } = globalThis.MarioCore;
const { validateLevel, createBonusRoom } = globalThis.MarioLevels;

function game(stage = 0, power = 'small') {
  const g = new MarioGame();
  g.savedPower = power;
  g.enterStage(stage);
  g.level.enemies = [];
  g.level.cannons = [];
  g.step(1 / 60, {});
  return g;
}
function tick(g, n, input = {}) { for (let i = 0; i < n; i++) g.step(1 / 60, typeof input === 'function' ? input(i) : input); }
const stageNode = slot => MAP_NODES.findIndex(n => n.kind === 'stage' && n.slot === slot);

test('as 48 fases são determinísticas, válidas e têm o final certo', () => {
  const plans = new Set();
  for (let i = 0; i < 48; i++) {
    const l = createLevel(i);
    assert.deepEqual(l, createLevel(i));
    assert.deepEqual(validateLevel(l), [], `fase ${i}`);
    assert(l.tiles.every(r => r.length === l.cols));
    const bossStage = i % 6 === 3 || i % 6 === 5 || l.kind === 'tank';
    assert.equal(!!l.boss, bossStage, `chefe na fase ${i}`);
    if (!bossStage) assert(l.goal, `meta na fase ${i}`);
    plans.add(l.plan);
  }
  assert.equal(createLevel(47).boss.type, 'bowser');
  assert(plans.size >= 25, 'fases variadas por mundo');
  assert(createLevel(5).autoscroll > 0, 'nave com rolagem automática');
});

test('velocidades do SMB3: andar 1,5, correr 2,5 e 3,5 px/quadro só com o P cheio', () => {
  const walk = game();
  tick(walk, 90, { move: 1 });
  assert(Math.abs(walk.player.vx - PHYS.walk) < 0.01);
  const run = game();
  tick(run, 30, { move: 1, run: true });
  assert(run.player.vx <= PHYS.run + 0.01);
  tick(run, 120, { move: 1, run: true });
  assert.equal(run.player.pm, 7, 'medidor P cheio');
  assert(Math.abs(run.player.vx - PHYS.pspeed) < 1, 'velocidade P');
  assert.equal(PHYS.walk, 90);
  assert.equal(PHYS.run, 150);
  assert.equal(PHYS.pspeed, 210);
});

test('pulo variável: segurar sobe bem mais que um toque', () => {
  function height(hold) {
    const g = game();
    const y0 = g.player.y;
    let top = y0;
    for (let i = 0; i < 80; i++) { g.step(1 / 60, { jump: i < hold }); top = Math.min(top, g.player.y); }
    return y0 - top;
  }
  const tap = height(1), full = height(40);
  assert(tap > 12 && tap < 26, `toque: ${tap}`);
  assert(full > 64 && full < 80, `segurando: ${full}`);
});

test('pausa e retomada preservam o estado físico', () => {
  const g = game();
  tick(g, 30);
  g.pause();
  const t = g.time, x = g.player.x;
  tick(g, 60, { move: 1, jump: true });
  assert.equal(g.time, t);
  assert.equal(g.player.x, x);
  g.resume();
  tick(g, 20, { move: 1 });
  assert(g.player.x > x);
});

test('dano como no SMB3: Fogo e Guaxinim voltam a Super; Super volta a pequeno', () => {
  for (const power of ['fire', 'raccoon']) {
    const g = game(0, power);
    g.damage();
    assert.equal(g.player.power, 'big');
    g.freeze = 0;
    g.player.invuln = 0;
    g.damage();
    assert.equal(g.player.power, 'small');
    g.damage();
    assert.equal(g.mode, 'playing', 'invencível logo após o dano');
    g.player.invuln = 0;
    g.damage();
    assert.equal(g.mode, 'dying');
  }
});

test('cogumelo nunca rebaixa o Mario (correção do bug)', () => {
  const g = game(0, 'fire');
  g.collectItem({ type: 'mushroom', x: 0, y: 0 });
  assert.equal(g.player.power, 'fire');
  const r = game(0, 'raccoon');
  r.collectItem({ type: 'mushroom', x: 0, y: 0 });
  assert.equal(r.player.power, 'raccoon');
  const s = game(0, 'small');
  s.collectItem({ type: 'leaf', x: 0, y: 0 });
  assert.equal(s.player.power, 'raccoon', 'folha transforma direto, como no original');
});

test('blocos ? dão cogumelo ao Mario pequeno e folha/flor ao grande; usados não repetem', () => {
  const g = game();
  g.hitBlock(11, 8);
  assert.equal(g.tile(11, 8), T.USED);
  assert.equal(g.level.items[0].type, 'mushroom');
  g.hitBlock(11, 8);
  assert.equal(g.level.items.length, 1);
  const b = game(0, 'big');
  b.hitBlock(11, 8);
  assert(['leaf', 'flower'].includes(b.level.items[0].type));
  b.hitBlock(10, 8);
  if (b.level.tiles[8][10] === T.EMPTY) assert(b.score >= 10, 'tijolo quebrado');
});

test('pisões seguidos valem 100, 200, 400 … 8000 e depois vidas', () => {
  const g = game();
  const p = g.player, got = [];
  const lives = g.lives;
  for (let i = 0; i < 9; i++) {
    const e = { id: i, type: 'goomba', x: p.x, y: p.y + p.h - 2, w: 16, h: 16, vx: 0, vy: 0, dir: -1, dead: false, active: true, timer: 0, grace: 0 };
    p.vy = 100;
    p.prevBottom = e.y;
    const before = g.score;
    g.enemyVsPlayer(e, {});
    got.push(g.score - before);
  }
  assert.deepEqual(got.slice(0, 8), CHAIN);
  assert.equal(g.lives, lives + 1);
});

test('relógio: 300 unidades de 0,68 s e aviso abaixo de 100', () => {
  const g = game();
  tick(g, 60 * 10);
  assert(Math.abs(g.time - (300 - 10 / 0.68)) < 0.2);
  g.time = 100.05;
  tick(g, 3);
  assert(g.hurry);
  assert(g.takeEvents().some(e => e.type === 'hurry'));
});

test('a carta ganha é a mesma que aparece na roleta (correção do bug)', () => {
  const g = game();
  for (const clock of [0, 0.15, 0.3, 1.11]) {
    const h = game();
    h.clock = clock;
    const shown = h.rouletteCard();
    h.clearStage('card');
    assert.equal(h.cards.at(-1), shown);
  }
  g.cards = ['star', 'star'];
  g.clock = 0.3;
  assert.equal(g.rouletteCard(), 'star');
  const lives = g.lives;
  g.clearStage('card');
  tick(g, 60 * 3);
  assert.equal(g.lives, lives + 5, 'três estrelas = 5 vidas');
  assert.deepEqual(g.cards, []);
});

test('mapa: fase concluída não se repete e é preciso concluir para avançar', () => {
  const g = new MarioGame();
  g.newGame();
  assert.equal(g.mapMove(1), true);
  tick(g, 20);
  assert.equal(g.mapPos, 1);
  assert.equal(g.mapMove(1), false, 'fase 1 ainda não concluída');
  g.mapEnter();
  assert.equal(g.mode, 'playing');
  g.level.enemies = [];
  g.clearStage('card');
  tick(g, 60 * 5);
  assert.equal(g.mode, 'map');
  assert.equal(g.mapPos, 1, 'Mario fica no painel concluído');
  assert.equal(g.mapEnter(), false, 'painel M não abre de novo');
  assert.equal(g.mapMove(1), true);
});

test('Casa do Toad: três baús, um item e a casa fecha', () => {
  const g = new MarioGame();
  g.newGame();
  g.completed = [0, 1];
  g.mapPos = 3;
  assert(g.mapEnter());
  assert.equal(g.mode, 'toad');
  assert.equal(g.toad.items.length, 3);
  g.step(1 / 60, {});
  g.step(1 / 60, { move: 1 });
  g.step(1 / 60, {});
  g.step(1 / 60, { jump: true });
  assert.equal(g.inventory.length, 1);
  tick(g, 150);
  assert.equal(g.mode, 'map');
  assert.equal(g.mapEnter(), false, 'casa visitada não reabre');
  g.inventory = Array(28).fill('mushroom');
  g.addItem('star');
  assert.equal(g.inventory.length, 28);
  assert.equal(g.inventory[27], 'star');
});

test('itens do mapa não rebaixam o Mario (correção do bug)', () => {
  const g = new MarioGame();
  g.newGame();
  g.savedPower = 'raccoon';
  g.inventory = ['mushroom', 'leaf', 'flower', 'star'];
  assert.equal(g.canUseItem(0), false);
  assert.equal(g.useItem(0), false);
  assert.equal(g.savedPower, 'raccoon');
  assert.equal(g.canUseItem(1), false);
  assert(g.useItem(2));
  assert.equal(g.savedPower, 'fire');
  assert(g.useItem(g.inventory.indexOf('star')));
  assert.equal(g.pendingStar, 12);
});

test('morrer volta ao mapa; game over recomeça o mundo como no SMB3', () => {
  const g = new MarioGame();
  g.newGame();
  g.world = 0;
  g.completed = [0, 1, 2, 3];
  g.toadOpened = [0];
  g.cards = ['star'];
  g.score = 5000;
  g.lives = 1;
  g.enterStage(4);
  g.die();
  tick(g, 60 * 3);
  assert.equal(g.mode, 'gameover');
  const save = g.exportSave();
  assert.equal(save.lives, 4, 'save do game over já é o recomeço');
  assert.deepEqual(save.completed, [3]);
  g.continueGame();
  assert.equal(g.mode, 'map');
  assert.equal(g.lives, 4);
  assert.equal(g.score, 0);
  assert.deepEqual(g.cards, []);
  assert.deepEqual(g.completed, [3], 'fortaleza destruída continua destruída');
  assert.deepEqual(g.toadOpened, []);
  assert.equal(g.mapPos, 0);
  const h = game();
  const lives = h.lives;
  h.die();
  tick(h, 60 * 3);
  assert.equal(h.mode, 'map');
  assert.equal(h.lives, lives - 1);
});

test('save guarda as vidas reais e aceita saves antigos (correção do bug)', () => {
  const g = new MarioGame();
  g.newGame();
  g.lives = 1;
  assert.equal(g.exportSave().lives, 1);
  const v1 = { version: 1, stage: 7, highest: 8, completed: [0, 1, 2, 3, 4, 5, 6, 7], lives: 2, score: 900, coins: 12, cards: ['star'], inventory: ['leaf'], toadVisits: [0], power: 'big' };
  const m = new MarioGame();
  assert(m.loadSave(v1));
  assert.equal(m.world, 1);
  assert.equal(m.mapPos, stageNode(2));
  assert.equal(m.lives, 2);
  assert(m.loadSave({ ...g.exportSave(), inventory: 'x', cards: 42, toadOpened: {} }));
  assert(!m.loadSave({ ...g.exportSave(), world: 99 }));
  const n = new MarioGame();
  assert(n.loadSave({ ...g.exportSave(), mapPos: 7, completed: [] }));
  assert.equal(n.mapPos, 1, 'posição salva não pula fases');
});

test('sala bônus não se renova ao entrar de novo (sem moedas infinitas)', () => {
  const g = game(0);
  const pipe = g.level.pipes.find(p => p.target.type === 'bonus');
  assert(pipe, 'fase 1-1 tem cano secreto');
  const enter = () => {
    g.player.x = pipe.x + 9;
    g.player.y = pipe.y - g.player.h;
    g.player.grounded = true;
    g.player.pipeCooldown = 0;
    g.step(1 / 60, { down: true });
    tick(g, 80);
  };
  enter();
  assert(g.level.bonus);
  const total = g.level.coins.length;
  g.level.coins.forEach(c => { c.taken = true; });
  const exit = g.level.pipes[0];
  g.player.x = exit.x + 9;
  g.player.y = exit.y - g.player.h;
  g.player.grounded = true;
  g.player.pipeCooldown = 0;
  g.step(1 / 60, { down: true });
  tick(g, 80);
  assert(!g.level.bonus);
  enter();
  assert(g.level.bonus);
  assert.equal(g.level.coins.filter(c => !c.taken).length, 0, `das ${total} moedas, nenhuma voltou`);
});

test('entrar na fase segurando pulo não faz o Mario pular (correção do bug)', () => {
  const g = new MarioGame();
  g.newGame();
  g.step(1 / 60, { move: 1 });
  tick(g, 20);
  g.step(1 / 60, { jump: true });
  assert.equal(g.mode, 'playing');
  const y = g.player.y;
  tick(g, 10, { jump: true });
  assert.equal(g.player.y, y);
});

test('voo do guaxinim: P cheio decola, dura cerca de 4 s e não se renova sozinho', () => {
  const g = game(0, 'raccoon');
  g.player.pm = 7;
  g.player.vx = PHYS.pspeed;
  g.step(1 / 60, { move: 1, run: true, jump: true });
  assert(Math.abs(g.player.flight - PHYS.flightTime) < 0.05);
  const y0 = g.player.y;
  tick(g, 60, i => ({ move: 1, run: true, jump: i % 6 < 3 }));
  assert(g.player.y < y0 - 40, 'apertar pulo repetidamente sobe');
  tick(g, 240, i => ({ move: 1, run: true, jump: i % 6 < 3 }));
  assert.equal(g.player.flight, 0);
  assert(PHYS.flightTime > 4 && PHYS.flightTime < 4.5);
});

test('cauda: tocar pulo na queda segura a descida', () => {
  const g = game(0, 'raccoon');
  g.player.y = 40;
  g.player.vy = 200;
  g.player.grounded = false;
  g.step(1 / 60, {});
  g.step(1 / 60, { jump: true });
  tick(g, 6);
  assert(g.player.vy <= PHYS.tailFall + 0.01);
});

test('flor lança no máximo duas bolas de fogo e elas derrotam inimigos', () => {
  const g = game(0, 'fire');
  g.player.attackCooldown = 0;
  g.attack(); g.player.attackCooldown = 0;
  g.attack(); g.player.attackCooldown = 0;
  g.attack();
  assert.equal(g.projectiles.length, 2);
  const e = { id: 1, type: 'goomba', x: g.player.x + 20, y: g.player.y, w: 16, h: 16, vx: 0, vy: 0, dir: -1, dead: false, active: true, timer: 0, grace: 0 };
  g.level.enemies.push(e);
  tick(g, 20);
  assert(e.dead);
});

test('casco: segurar B carrega, soltar chuta; parado volta a ser Koopa', () => {
  const g = game();
  const p = g.player;
  const shell = { id: 1, type: 'shell', x: p.x + 10, y: p.y + p.h - 14, w: 14, h: 14, vx: 0, vy: 0, dir: -1, dead: false, active: true, timer: 0, grace: 0, chain: 0, shellTime: 0 };
  g.level.enemies.push(shell);
  g.player.vy = 0;
  g.enemyVsPlayer(shell, { run: true });
  assert.equal(p.carry, shell);
  tick(g, 2, { run: true });
  tick(g, 1, {});
  assert.equal(p.carry, null);
  assert(Math.abs(shell.vx) > 100);
  const h = game();
  const s2 = { id: 2, type: 'shell', x: 400, y: 192 - 14, w: 14, h: 14, vx: 0, vy: 0, dir: -1, dead: false, active: true, timer: 0, grace: 0, chain: 0, shellTime: 0 };
  h.level.enemies.push(s2);
  tick(h, 60 * 7.3);
  assert.equal(s2.type, 'koopa');
});

test('canhão é bloco sólido e não atira com o Mario colado', () => {
  const g = new MarioGame();
  g.enterStage(5);
  const l = g.level;
  const c = l.cannons[0];
  assert.equal(l.tiles[c.ty][c.tx], T.CANNON);
  assert(MarioCore.isSolid(T.CANNON) && MarioCore.isSolid(T.CANNON_BASE));
  l.enemies = [];
  g.camera = c.tx * 16 - 100;
  g.player.x = c.tx * 16 + 20;
  c.timer = 0;
  g.updateCannons(1 / 60);
  assert.equal(l.enemies.length, 0);
  g.player.x = c.tx * 16 + 150;
  c.timer = 0;
  g.updateCannons(1 / 60);
  assert.equal(l.enemies.filter(e => e.type === 'bullet').length, 1);
});

test('chefe da fortaleza: três pisões, esfera e fim sem carta', () => {
  const g = game(3);
  const b = g.level.boss;
  g.player.x = g.level.arenaStart + 60;
  g.camera = g.level.arenaStart - 32;
  g.updateBoss(1 / 60);
  assert(b.awake);
  for (let i = 0; i < 3; i++) { b.invuln = 0; g.hurtBoss(1); }
  assert(b.dead);
  assert(g.level.orb);
  g.level.orb.ready = true;
  g.player.x = g.level.orb.x;
  g.player.y = g.level.orb.y;
  const cards = g.cards.length;
  g.clearStage('orb');
  assert.equal(g.mode, 'clear');
  assert.equal(g.cards.length, cards);
});

test('Bowser quebra o chão de tijolos ao cair com força e despenca no buraco', () => {
  const g = game(47, 'big');
  const l = g.level, b = l.boss;
  g.player.star = 1e9;
  g.player.x = l.arenaStart + 40;
  b.awake = true;
  const before = l.tiles[12].filter(t => t === T.BRICK).length + l.tiles[13].filter(t => t === T.BRICK).length;
  let broke = false;
  for (let i = 0; i < 60 * 30 && g.mode === 'playing'; i++) {
    g.player.x = b.x + 4;
    g.player.y = 120;
    g.player.vy = 0;
    g.updateBoss(1 / 60);
    const now = l.tiles[12].filter(t => t === T.BRICK).length + l.tiles[13].filter(t => t === T.BRICK).length;
    if (now < before) broke = true;
  }
  assert(broke, 'pancadas quebram tijolos');
  assert(b.dead, 'Bowser caiu');
  assert.equal(g.mode, 'clear');
});

test('cano de atalho leva a outro cano na mesma fase', () => {
  let found = null;
  for (let i = 0; i < 48 && !found; i++) {
    const l = createLevel(i);
    const p = l.pipes.find(q => q.target.type === 'pos');
    if (p) found = [i, p];
  }
  assert(found, 'existe cano de atalho');
  const [stage, pipe] = found;
  const g = game(stage);
  g.player.x = pipe.x + 9;
  g.player.y = pipe.y - g.player.h;
  g.player.grounded = true;
  g.step(1 / 60, { down: true });
  tick(g, 90);
  assert(Math.abs(g.player.x + g.player.w / 2 - (pipe.target.x + 2)) < 4);
  assert(g.player.y + g.player.h <= pipe.target.top + 0.5);
});

test('areia movediça engole quem para; pulando dá para sair', () => {
  let stage = -1, col = -1;
  for (let i = 0; i < 48 && stage < 0; i++) {
    const l = createLevel(i);
    const c = l.tiles[12].findIndex((t, x) => t === T.SAND && l.tiles[12][x - 1] !== T.SAND && l.tiles[12][x + 1] === T.SAND);
    if (c > 0) { stage = i; col = c; }
  }
  const sandWidth = l => { let w = 0; while (l.tiles[12][col + w] === T.SAND) w++; return w; };
  const g = game(stage);
  const w = sandWidth(g.level);
  g.player.x = (col + 1) * 16;
  g.player.y = 196 - g.player.h;
  g.player.grounded = false;
  tick(g, 60 * 4);
  assert.notEqual(g.mode, 'playing', 'afundou');
  const h = game(stage);
  h.player.x = (col + 1) * 16;
  h.player.y = 196 - h.player.h;
  h.player.grounded = false;
  tick(h, 60 * 3, i => ({ move: 1, jump: i % 10 < 5 }));
  assert.equal(h.mode, 'playing');
  assert(h.player.x > (col + w) * 16, 'saiu da areia');
});

test('debaixo d\'água o Mario nada e salta para fora na superfície', () => {
  const g = game(13);
  assert(g.inWater(g.player));
  const y = g.player.y;
  tick(g, 20, i => ({ jump: i % 10 < 3 }));
  assert(g.player.y < y);
  assert(g.player.vy <= PHYS.swimFall + 0.01);
});

test('rolagem automática empurra e esmaga contra a parede', () => {
  const g = game(5);
  const cam = g.camera;
  tick(g, 60);
  assert(g.camera > cam + 30);
  const h = game(5);
  h.level.tiles[8][6] = T.WOOD;
  h.level.tiles[9][6] = T.WOOD;
  h.player.x = 6 * 16 - h.player.w;
  h.player.y = 160 - h.player.h;
  h.player.grounded = true;
  h.camera = h.player.x + 1;
  tick(h, 3);
  assert.notEqual(h.mode, 'playing');
});

test('concluir a nave leva ao próximo mundo', () => {
  const g = game(5);
  g.level.boss.dead = true;
  g.clearStage('orb');
  tick(g, 60 * 5);
  assert.equal(g.mode, 'map');
  assert.equal(g.world, 1);
  assert.equal(g.mapPos, 0);
  const f = game(47);
  f.level.boss.dead = true;
  f.clearStage('bowser');
  tick(f, 60 * 6);
  assert.equal(f.mode, 'victory');
});

test('renderização usa coordenadas finitas em todas as fases e telas', () => {
  const c = {
    fillRect(...a) { assert(a.every(Number.isFinite)); },
    fillText(t, x, y) { assert(Number.isFinite(x) && Number.isFinite(y)); }
  };
  const r = new MarioRenderer({ getContext: () => c });
  for (let i = 0; i < 48; i++) {
    const g = game(i);
    r.draw(g, 1);
    g.camera = g.level.width - 384;
    r.draw(g, 1.5);
    g.mode = 'map';
    r.draw(g, 1);
  }
  const g = new MarioGame();
  g.newGame();
  g.inventory = ['leaf', 'star'];
  g.invOpen = true;
  r.draw(g, 2);
  g.invOpen = false;
  g.completed = [0, 1];
  g.mapPos = 3;
  g.mapEnter();
  r.draw(g, 2);
  for (const power of ['small', 'big', 'fire', 'raccoon']) { const h = game(0, power); r.draw(h, 2); }
  const b = createBonusRoom(createLevel(0));
  assert(b.coins.length > 0);
});
