'use strict';
// Prova automática de que as 48 fases podem ser completadas com a física do jogo
// (busca com o Mario pequeno, sem inimigos; buracos, lava, areia e rolagem continuam valendo).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { solve } = require('./bot.cjs');

test('todas as 48 fases têm um caminho até o fim ou até a arena do chefe', { timeout: 300000 }, () => {
  const failed = [];
  for (let i = 0; i < 48; i++) {
    const r = solve(i);
    if (!r.ok) failed.push(`${Math.floor(i / 6) + 1}-${(i % 6) + 1} parou em x=${r.x} (meta ${r.target})`);
  }
  assert.deepEqual(failed, []);
});
