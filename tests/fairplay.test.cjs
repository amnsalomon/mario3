'use strict';
// Prova de que a dificuldade nova é justa: um robô sem estrela e sem invencibilidade, com todos
// os inimigos e perigos ligados, termina fases de vários tipos (o conjunto completo das 48 fases
// roda com `node tests/fairbot.cjs`, que leva alguns minutos).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { solveFair } = require('./fairbot.cjs');

test('fases difíceis continuam justas sem truques (1-1, Fortaleza 5, Fortaleza 8 e Nave 6)', { timeout: 300000 }, () => {
  const failed = [];
  for (const i of [0, 27, 45, 35]) {
    const r = solveFair(i);
    if (!r.ok) failed.push(`${Math.floor(i / 6) + 1}-${(i % 6) + 1} parou em x=${r.x} (meta ${r.target})`);
  }
  assert.deepEqual(failed, []);
});
