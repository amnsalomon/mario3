'use strict';
// Robô "justo": joga sem estrela e sem invencibilidade, com todos os inimigos, canhões,
// barras de fogo, bolas de lava, esmagadores e maçaricos ligados. Começa como Super Mario e
// pode levar dano (vira pequeno), mas morrer encerra o ramo. Serve para mostrar que a
// dificuldade maior continua justa: cada fase tem um caminho que dá para fazer sem truques.
const path = require('node:path');
require(path.join(__dirname, '../js/levels.js'));
require(path.join(__dirname, '../js/engine.js'));
const { MarioGame } = globalThis.MarioCore;

const MACROS = [
  f => ({ move: 1, run: true }),
  f => ({ move: 1, run: true, jump: f > 0 }),
  f => ({ move: 1, run: true, jump: f > 0 && f < 5 }),
  f => ({ move: 1, jump: f > 0 }),
  f => ({ move: 1, jump: f > 0 && f < 4 }),
  f => ({ move: 0, jump: f > 0 }),
  f => ({ move: 1 }),
  f => ({ move: 0 }),
  f => ({ move: -1, jump: f > 0 }),
  f => ({ move: -1 })
];
const LEVEL_KEYS = ['tiles', 'sky', 'blocks', 'enemies', 'items', 'coins', 'platforms', 'crushers', 'vines', 'switches', 'cannons', 'boss', 'orb'];

function save(g) {
  const l = g.level, L = {};
  for (const k of LEVEL_KEYS) L[k] = l[k];
  return structuredClone({
    player: g.player, camera: g.camera, cameraY: g.cameraY, clock: g.clock, time: g.time, mode: g.mode, prev: g.prev,
    freeze: g.freeze, pTimer: g.pTimer, projectiles: g.projectiles, L
  });
}
function load(g, s) {
  const c = structuredClone(s);
  Object.assign(g.level, c.L);
  g.player = c.player;
  g.camera = c.camera; g.cameraY = c.cameraY; g.clock = c.clock; g.time = c.time; g.mode = c.mode; g.prev = c.prev;
  g.freeze = c.freeze; g.pTimer = c.pTimer; g.projectiles = c.projectiles;
  g.particles = []; g.events = []; g.ending = null; g.shake = 0;
}

// Tenta primeiro uma busca rápida; se não achar caminho, repete com um feixe mais largo.
function solveFair(index, opts = {}) {
  const first = searchFair(index, opts);
  if (first.ok || opts.beam) return first;
  const wide = searchFair(index, { ...opts, beam: 36 });
  return wide.ok ? { ...wide, wide: true } : first;
}

function searchFair(index, { beam = 20, frames = 12, maxIter = 700, power = 'big' } = {}) {
  const g = new MarioGame();
  g.savedPower = power;
  g.enterStage(index);
  const l = g.level;
  const target = l.boss ? l.arenaStart + 32 : l.goal.x;
  const rank = { small: 0, big: 1, raccoon: 1, fire: 1 };
  let states = [{ snap: save(g), score: 0 }];
  const seen = new Set();
  let best = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    const next = [];
    for (const s of states) {
      for (const macro of MACROS) {
        load(g, s.snap);
        let dead = false, won = false;
        for (let f = 0; f < frames; f++) {
          g.step(1 / 60, macro(f));
          g.events.length = 0;
          if (g.mode === 'clear' || (g.player && g.player.x >= target && g.mode === 'playing' && g.player.grounded)) { won = true; break; }
          if (g.mode !== 'playing' && g.mode !== 'clear') { dead = true; break; }
          if (g.player.pipe) { dead = true; break; }
        }
        if (won) return { ok: true, iter, x: Math.round(g.player.x), power: g.player ? g.player.power : '?' };
        if (dead) continue;
        const p = g.player;
        best = Math.max(best, p.x);
        const key = [Math.round(p.x / 6), Math.round(p.y / 6), Math.round(p.vx / 40), Math.round(p.vy / 60), p.grounded ? 1 : 0, rank[p.power], Math.floor(g.clock * 4), l.autoscroll ? Math.round(g.camera / 8) : 0].join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        // Na rolagem automática não adianta correr até a borda da tela: vale ficar numa posição segura.
        const pos = l.autoscroll ? p.x - 1.5 * Math.max(0, p.x - g.camera - 320) : p.x;
        next.push({ snap: save(g), score: pos + (p.grounded ? 32 : 0) + rank[p.power] * 160 - (p.invuln > 0 ? 40 : 0), y: p.y, grounded: p.grounded });
      }
    }
    if (!next.length) break;
    next.sort((a, b) => b.score - a.score);
    const picked = [], rows = new Map();
    const take = (list, limit) => {
      for (const n of list) {
        if (picked.length >= limit) break;
        if (picked.includes(n)) continue;
        const r = Math.round(n.y / 32) + (n.grounded ? 100 : 0);
        const c = rows.get(r) || 0;
        if (c >= Math.ceil(beam / 3)) continue;
        rows.set(r, c + 1);
        picked.push(n);
      }
    };
    take(next.filter(n => n.grounded), Math.ceil(beam / 2));
    take(next, beam);
    states = picked;
  }
  return { ok: false, x: Math.round(best), target: Math.round(target) };
}

module.exports = { solveFair };

if (require.main === module) {
  const list = process.argv.slice(2).map(Number);
  const levels = list.length ? list : Array.from({ length: 48 }, (_, i) => i);
  let fails = 0;
  for (const i of levels) {
    const t = Date.now();
    const r = solveFair(i);
    if (!r.ok) fails++;
    console.log(`${i} ${Math.floor(i / 6) + 1}-${(i % 6) + 1}`, r.ok ? 'OK' : 'FALHOU', JSON.stringify(r), `${Date.now() - t}ms`);
  }
  console.log('falhas', fails);
}
