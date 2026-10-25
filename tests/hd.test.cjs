'use strict';
// Executa toda a arte HD contra um canvas "rigoroso": qualquer método inexistente, número
// inválido, raio negativo ou parada de gradiente fora de 0..1 derruba o teste.
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../js/levels.js');
require('../js/engine.js');
require('../js/sprites.js');
require('../js/hd.js');
require('../js/scenery.js');
require('../js/renderer.js');
const { MarioGame, MAP_NODES, W, H } = globalThis.MarioCore;

const METHODS = new Set(['fillRect', 'strokeRect', 'clearRect', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse',
  'quadraticCurveTo', 'bezierCurveTo', 'rect', 'fill', 'stroke', 'save', 'restore', 'translate', 'scale', 'rotate', 'setTransform',
  'drawImage', 'fillText', 'strokeText', 'clip', 'createLinearGradient', 'createRadialGradient', 'measureText']);
const PROPS = new Set(['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'font', 'textBaseline', 'textAlign', 'lineCap', 'lineJoin',
  'shadowColor', 'shadowBlur', 'imageSmoothingEnabled', 'globalCompositeOperation']);
const stats = { calls: 0, canvases: 0, maxPixels: 0 };

function strictContext() {
  const state = {};
  return new Proxy(state, {
    has(_, prop) { return PROPS.has(prop) || METHODS.has(prop); },
    get(t, prop) {
      if (PROPS.has(prop)) return t[prop];
      if (!METHODS.has(prop)) throw new Error('método inexistente: ' + String(prop));
      return (...args) => {
        for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`${prop} recebeu número inválido`);
        if (prop === 'arc' && args[2] < 0) throw new Error('arc com raio negativo');
        if (prop === 'ellipse' && (args[2] < 0 || args[3] < 0)) throw new Error('ellipse com raio negativo');
        if (prop === 'createRadialGradient' && (args[2] < 0 || args[5] < 0)) throw new Error('gradiente radial com raio negativo');
        stats.calls++;
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return { addColorStop(o, c) { if (!(o >= 0 && o <= 1)) throw new Error('parada de gradiente inválida ' + o); if (typeof c !== 'string') throw new Error('cor inválida'); } };
        }
        if (prop === 'measureText') return { width: 10 };
        if (prop === 'drawImage' && (!args[0] || !(args[0].width > 0))) throw new Error('drawImage sem imagem');
        return undefined;
      };
    },
    set(t, prop, v) {
      if (!PROPS.has(prop)) throw new Error('propriedade inexistente: ' + String(prop));
      if (prop === 'globalAlpha' && !(v >= 0 && v <= 1)) throw new Error('globalAlpha inválido');
      t[prop] = v;
      return true;
    }
  });
}
function fakeCanvas(w, h) {
  assert(w > 0 && h > 0 && Number.isInteger(w) && Number.isInteger(h), `canvas ${w}x${h}`);
  stats.canvases++;
  stats.maxPixels = Math.max(stats.maxPixels, w * h);
  return { width: w, height: h, getContext: () => strictContext() };
}

test('toda a arte HD desenha sem erro em várias resoluções, fases e telas', () => {
  MarioSprites.setCanvasFactory(fakeCanvas);
  const canvas = { width: W * 4, height: H * 4, getContext: () => strictContext() };
  const r = new MarioRenderer(canvas);
  for (const scale of [2, 5, 8]) {
    r.setScale(scale);
    assert.equal(canvas.width, W * scale);
    for (let i = 0; i < 48; i++) {
      const g = new MarioGame();
      g.savedPower = ['small', 'big', 'raccoon', 'fire'][i % 4];
      g.enterStage(i);
      for (const e of g.level.enemies) e.active = true;
      g.step(1 / 60, {});
      for (const cam of [0, g.level.width / 2, g.level.width - W]) {
        g.camera = Math.max(0, cam);
        r.draw(g, i * 0.37);
      }
      if (scale === 5) {
        g.player.star = 5;
        g.shake = 0.3;
        g.projectiles.push({ kind: 'fire', x: g.player.x, y: g.player.y, w: 14, h: 14, mega: true }, { kind: 'flame', x: g.player.x + 30, y: g.player.y, w: 22, h: 8 });
        g.particles.push({ kind: 'dust', x: g.player.x, y: 180, life: 0.2 }, { kind: 'puff', x: g.player.x, y: 160, life: 0.3 }, { kind: 'sparkle', x: 50, y: 50, life: 1 }, { kind: 'debris', x: 60, y: 60, life: 1 }, { kind: 'text', text: '1UP', x: 0, y: 0, life: 1 });
        r.draw(g, 3.3);
        // céu, pé de feijão, Botão P, voo com rastro e efeitos novos
        const p = g.player;
        g.level.vines.push({ x: p.x, w: 8, bottom: 128, top: -100, target: -128 });
        g.level.switches.push({ x: p.x + 40, y: 112, w: 16, h: 16, base: 128, pressed: false, emerge: 0.5 }, { x: p.x + 60, y: 123, w: 16, h: 5, base: 128, pressed: true, emerge: 0 });
        g.pTimer = 2.5;
        g.cameraY = g.level.skyRows ? -120 : 0;
        p.climb = true;
        p.climbStep = 0.3;
        r.draw(g, 3.4);
        p.climb = false;
        p.grounded = false;
        p.flight = 2;
        p.flapFx = 0.2;
        p.jumpFx = 0.1;
        p.vy = -80;
        p.tail = 0.2;
        for (let k = 0; k < 8; k++) r.draw(g, 3.5 + k / 20);
        p.flight = 0;
        p.grounded = true;
        p.landFx = 0.1;
        p.vx = 200;
        p.pm = 7;
        r.draw(g, 4);
        g.particles.push({ kind: 'streak', x: p.x, y: 100, dir: -1, life: 0.2 }, { kind: 'streak', x: p.x, y: 110, dir: 1, life: 0.1 }, { kind: 'gust', x: p.x, y: 120, size: 8, life: 0.2 });
        g.projectiles.push({ kind: 'spit', x: p.x + 20, y: 100, w: 8, h: 8 });
        for (const e of g.level.enemies) { if (e.jumper) { e.hidden = false; e.y = 120; e.vyJ = -100; } }
        r.draw(g, 4.1);
        g.found = g.level.secrets.slice(0, 1);
        g.cameraY = 0;
        g.clearStage(g.level.boss ? 'orb' : 'card');
        g.ending.timer = 2.5;
        g.ending.bonus = { lives: 5 };
        r.draw(g, 4);
      }
    }
    for (let w = 0; w < 8; w++) {
      const g = new MarioGame();
      g.newGame();
      g.world = w;
      g.completed = [w * 6, w * 6 + 3];
      g.toadOpened = w % 2 ? [w] : [];
      g.banner = { text: 'MUNDO', sub: 'x', time: 1 };
      MAP_NODES.forEach((_, pos) => { g.mapPos = pos; r.draw(g, pos); });
      g.mapAnim = { from: 0, to: 1, t: 0.5 };
      r.draw(g, 1);
      g.mapAnim = null;
      g.inventory = ['leaf', 'star', 'flower', 'mushroom', 'leaf', 'star', 'flower', 'mushroom', 'leaf'];
      g.invOpen = true;
      g.invCursor = 6;
      r.draw(g, 2);
    }
    const t = new MarioGame();
    t.newGame();
    t.completed = [0, 1];
    t.mapPos = 3;
    t.mapEnter();
    r.draw(t, 1);
    t.step(1 / 60, { jump: true });
    r.draw(t, 2);
    t.mode = 'title';
    r.draw(t, 3);
  }
  MarioSprites.setCanvasFactory(null);
  assert(stats.calls > 10000);
  assert(stats.maxPixels <= 3584 * 2048, 'nenhuma imagem maior que 4K');
});
