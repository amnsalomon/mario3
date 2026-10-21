'use strict';
// Robô de busca (beam search) que tenta completar uma fase usando a física real do jogo.
// Inimigos e canhões são removidos e o Mario fica invencível a dano, mas buracos, lava,
// areia movediça e rolagem automática continuam matando. Serve para provar que o desenho
// de cada fase é transponível.
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
  f => ({ move: -1, run: true })
];

function solve(index, { beam = 24, frames = 12, maxIter = 900, power = 'small', enemies = false } = {}) {
  const g = new MarioGame();
  g.savedPower = power;
  g.enterStage(index);
  const l = g.level;
  if (!enemies) { l.enemies = []; l.cannons = []; }
  g.player.star = 1e9;
  const target = l.boss ? l.arenaStart + 32 : l.goal.x;
  let states = [{ snap: g.snapshot(), score: 0 }];
  const seen = new Set();
  for (let iter = 0; iter < maxIter; iter++) {
    const next = [];
    for (const s of states) {
      for (const macro of MACROS) {
        g.restore(s.snap);
        g.level.items = [];
        let dead = false, won = false;
        for (let f = 0; f < frames; f++) {
          g.step(1 / 60, macro(f));
          if (g.mode === 'clear' || (g.player && g.player.x >= target && g.mode === 'playing' && g.player.grounded)) { won = true; break; }
          if (g.mode !== 'playing') { dead = true; break; }
        }
        if (won) return { ok: true, iter, x: Math.round(g.player.x) };
        if (dead) continue;
        const p = g.player;
        const key = [Math.round(p.x / 6), Math.round(p.y / 6), Math.round(p.vx / 40), Math.round(p.vy / 60), p.grounded ? 1 : 0, l.autoscroll ? Math.round(g.camera / 8) : 0].join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ snap: g.snapshot(), score: p.x + (p.grounded ? 32 : 0) });
      }
    }
    if (!next.length) break;
    next.sort((a, b) => b.score - a.score);
    // Mantém diversidade de alturas para não perder caminhos por cima.
    const picked = [], rows = new Map();
    const take = (list, limit) => {
      for (const n of list) {
        if (picked.length >= limit) break;
        if (picked.includes(n)) continue;
        const r = Math.round(n.snap.player.y / 32) + (n.snap.player.grounded ? 100 : 0);
        const c = rows.get(r) || 0;
        if (c >= Math.ceil(beam / 3)) continue;
        rows.set(r, c + 1);
        picked.push(n);
      }
    };
    take(next.filter(n => n.snap.player.grounded), Math.ceil(beam / 2));
    take(next, beam);
    states = picked;
  }
  const best = states.length ? Math.round(states[0].snap.player.x) : 0;
  return { ok: false, x: best, target: Math.round(target) };
}

module.exports = { solve };

if (require.main === module) {
  const list = process.argv.slice(2).map(Number);
  const levels = list.length ? list : Array.from({ length: 48 }, (_, i) => i);
  let fails = 0;
  const t0 = Date.now();
  for (const i of levels) {
    const t = Date.now();
    const r = solve(i);
    if (!r.ok) fails++;
    console.log(`${Math.floor(i / 6) + 1}-${(i % 6) + 1}`, r.ok ? 'OK' : 'FALHOU', JSON.stringify(r), `${Date.now() - t}ms`);
  }
  console.log('falhas', fails, 'tempo', Date.now() - t0, 'ms');
}
