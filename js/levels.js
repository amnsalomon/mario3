/* Gerador determinístico de fases.
 * Os desenhos são originais deste projeto: cada fase é montada a partir de peças próprias,
 * escolhidas conforme o tipo de fase do SMB3 (planície, deserto, mar, terra gigante, céu,
 * gelo, canos, fortaleza, nave, tanque e castelo). Nenhum mapa original foi copiado. */
(() => {
  'use strict';

  const TILE = 16;
  const ROWS = 14;
  const FLOOR = 12; // primeira linha do chão
  const ARENA = 28; // colunas reservadas para a arena do chefe (uma tela inteira)

  const T = Object.freeze({
    EMPTY: 0,
    GROUND: 1,
    BRICK: 2,
    QUESTION: 3,
    USED: 4,
    STONE: 5,
    PIPE_TL: 6,
    PIPE_TR: 7,
    PIPE_L: 8,
    PIPE_R: 9,
    SEMI: 10, // plataforma atravessável por baixo
    ICE: 11,
    WOOD: 12,
    SPIKE: 13,
    LAVA: 14,
    CANNON: 15,
    SAND: 16, // areia movediça
    CLOUD: 17, // nuvem atravessável por baixo
    HIDDEN: 18, // bloco invisível
    CANNON_BASE: 19,
    SEMI_BODY: 20 // corpo decorativo dos blocos grandes coloridos
  });

  const SOLID_TILES = new Set([
    T.GROUND, T.BRICK, T.QUESTION, T.USED, T.STONE, T.PIPE_TL, T.PIPE_TR, T.PIPE_L, T.PIPE_R,
    T.ICE, T.WOOD, T.SPIKE, T.CANNON, T.CANNON_BASE
  ]);
  const isSolid = t => SOLID_TILES.has(t);
  const isOneWay = t => t === T.SEMI || t === T.CLOUD;
  const isPipe = t => t >= T.PIPE_TL && t <= T.PIPE_R;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const WORLDS = [
    { name: 'REINO DOS CAMPOS', land: '#67ad46', ink: '#24463e', sea: '#4e9eb1', stages: ['grass', 'hills', 'underground', 'fortress', 'pipes', 'airship'] },
    { name: 'DUNAS DO DESERTO', land: '#dfa34f', ink: '#654927', sea: '#4e9eb1', stages: ['desert', 'pyramid', 'sandcave', 'fortress', 'quicksand', 'airship'] },
    { name: 'ILHAS DO MAR', land: '#4caaa5', ink: '#234c70', sea: '#2f7fb8', stages: ['islands', 'water', 'islands2', 'fortress', 'reef', 'airship'] },
    { name: 'TERRA GIGANTE', land: '#73b145', ink: '#305932', sea: '#4e9eb1', stages: ['giant', 'giant2', 'underground', 'fortress', 'giant3', 'airship'] },
    { name: 'REINO DAS NUVENS', land: '#e7dcb8', ink: '#466a91', sea: '#8ecfea', stages: ['climb', 'sky', 'sky2', 'fortress', 'skylift', 'airship'] },
    { name: 'TERRAS DE GELO', land: '#cde9e7', ink: '#4d6e96', sea: '#7fb7d6', stages: ['ice', 'ice2', 'icecave', 'fortress', 'ice3', 'airship'] },
    { name: 'LABIRINTO DOS CANOS', land: '#6e9c6b', ink: '#28574f', sea: '#4e9eb1', stages: ['pipeland', 'pipecave', 'pipeland2', 'fortress', 'piranhas', 'airship'] },
    { name: 'TERRA SOMBRIA', land: '#84616b', ink: '#201f32', sea: '#c2482f', stages: ['dark', 'tank', 'dark2', 'fortress', 'tank2', 'bowser'] }
  ];

  // Peças disponíveis em cada tipo de fase (peso = frequência).
  const POOLS = {
    basic: { flat: 1, pit: 3, blocks: 3, pipes: 2, stairs: 2, troop: 2, semis: 2, wall: 1, platforms: 1 },
    hills: { semis: 4, pit: 2, blocks: 2, troop: 2, stairs: 2, platforms: 1 },
    pipes: { pipes: 5, pit: 2, blocks: 2, troop: 2, stairs: 1 },
    cave: { blocks: 3, pit: 2, pipes: 2, troop: 2, lowceil: 3, wall: 2, stairs: 1 },
    desert: { quicksand: 3, pit: 1, blocks: 2, troop: 2, stairs: 2, pipes: 1 },
    pyramid: { pyramid: 4, quicksand: 1, blocks: 2, troop: 2 },
    islands: { pit: 4, platforms: 3, blocks: 2, troop: 1, semis: 1 },
    giant: { giant: 4, pit: 2, troop: 2, pipes: 1, stairs: 1 },
    climb: { stairs: 3, semis: 4, platforms: 2, blocks: 1 },
    ice: { pit: 3, iceblocks: 3, blocks: 2, troop: 2, platforms: 1 },
    pipeland: { pipes: 5, warp: 1, pit: 2, troop: 1, blocks: 1 },
    piranhas: { pipes: 6, pit: 2, blocks: 1 },
    dark: { pit: 3, blocks: 2, troop: 2, stairs: 2, cannons: 2, platforms: 1 },
    fortress: { spikepit: 3, lavapit: 2, fstairs: 2, lift: 2, lowceil: 2, troop: 1 }
  };

  const PLANS = {
    grass: { build: 'ground', theme: 'grass', len: 150, pool: 'basic', secret: true },
    hills: { build: 'ground', theme: 'grass', len: 160, pool: 'hills', secret: true },
    underground: { build: 'ground', theme: 'underground', len: 150, pool: 'cave', ceiling: 1 },
    fortress: { build: 'ground', theme: 'castle', kind: 'fortress', len: 120, pool: 'fortress', ceiling: 2, boss: 'boom' },
    pipes: { build: 'ground', theme: 'grass', len: 165, pool: 'pipes', secret: true },
    airship: { build: 'airship', theme: 'airship', kind: 'airship', len: 150, boss: 'boom', autoscroll: 36 },
    desert: { build: 'ground', theme: 'desert', len: 150, pool: 'desert', secret: true },
    pyramid: { build: 'ground', theme: 'desert', len: 160, pool: 'pyramid' },
    sandcave: { build: 'ground', theme: 'underground', len: 150, pool: 'cave', ceiling: 1 },
    quicksand: { build: 'ground', theme: 'desert', len: 170, pool: 'desert' },
    islands: { build: 'ground', theme: 'sea', len: 155, pool: 'islands' },
    water: { build: 'water', theme: 'water', len: 150 },
    islands2: { build: 'ground', theme: 'sea', len: 165, pool: 'islands', secret: true },
    reef: { build: 'water', theme: 'water', len: 165 },
    giant: { build: 'ground', theme: 'giant', len: 150, pool: 'giant', giant: true },
    giant2: { build: 'ground', theme: 'giant', len: 160, pool: 'giant', giant: true, secret: true },
    giant3: { build: 'ground', theme: 'giant', len: 170, pool: 'giant', giant: true },
    climb: { build: 'ground', theme: 'grass', len: 155, pool: 'climb' },
    sky: { build: 'sky', theme: 'sky', len: 150 },
    sky2: { build: 'sky', theme: 'sky', len: 165 },
    skylift: { build: 'sky', theme: 'sky', len: 170, lifts: true },
    ice: { build: 'ground', theme: 'ice', len: 150, pool: 'ice' },
    ice2: { build: 'ground', theme: 'ice', len: 160, pool: 'ice', secret: true, icyFloor: true },
    icecave: { build: 'ground', theme: 'underground', len: 155, pool: 'cave', ceiling: 1, icyFloor: true },
    ice3: { build: 'ground', theme: 'ice', len: 175, pool: 'ice', icyFloor: true },
    pipeland: { build: 'ground', theme: 'pipe', len: 155, pool: 'pipeland', secret: true },
    pipecave: { build: 'ground', theme: 'underground', len: 160, pool: 'pipes', ceiling: 1 },
    pipeland2: { build: 'ground', theme: 'pipe', len: 170, pool: 'pipeland' },
    piranhas: { build: 'ground', theme: 'pipe', len: 170, pool: 'piranhas' },
    dark: { build: 'ground', theme: 'lava', len: 155, pool: 'dark' },
    tank: { build: 'tank', theme: 'tank', kind: 'tank', len: 140, boss: 'boom', autoscroll: 32 },
    dark2: { build: 'ground', theme: 'lava', len: 170, pool: 'dark' },
    tank2: { build: 'tank', theme: 'tank', kind: 'tank', len: 160, boss: 'boom', autoscroll: 36 },
    bowser: { build: 'ground', theme: 'bowser', kind: 'bowser', len: 130, pool: 'fortress', ceiling: 2, boss: 'bowser', time: 400 }
  };

  const THEME_TILES = {
    grass: [T.GROUND, T.WOOD],
    underground: [T.STONE, T.STONE],
    castle: [T.STONE, T.STONE],
    bowser: [T.STONE, T.STONE],
    desert: [T.GROUND, T.GROUND],
    sea: [T.GROUND, T.WOOD],
    water: [T.GROUND, T.GROUND],
    giant: [T.GROUND, T.WOOD],
    sky: [T.GROUND, T.WOOD],
    ice: [T.GROUND, T.ICE],
    pipe: [T.GROUND, T.STONE],
    lava: [T.GROUND, T.STONE],
    airship: [T.WOOD, T.WOOD],
    tank: [T.GROUND, T.STONE]
  };

  // Tamanho dos inimigos (largura, altura) em pixels lógicos.
  const ENEMY_SIZE = { goomba: [16, 16], koopa: [14, 24], shell: [14, 14], piranha: [16, 24], fish: [16, 14], bullet: [16, 14] };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function planFor(index) {
    const world = Math.floor(index / 6), slot = index % 6;
    const key = WORLDS[world].stages[slot];
    const plan = { key, ...PLANS[key] };
    const [ground, hard] = THEME_TILES[plan.theme];
    plan.ground = plan.icyFloor ? T.ICE : ground;
    plan.hard = hard;
    return plan;
  }

  function makeEnemy(l, type, x, bottomY, extra = {}) {
    const giant = !!extra.giant;
    const [w0, h0] = ENEMY_SIZE[type];
    const w = giant ? w0 * 2 : w0, h = giant ? h0 * 2 : h0;
    const e = {
      id: l.enemies.length, type, x, y: bottomY - h, w, h, vx: 0, vy: 0, dir: -1, dead: false, active: false,
      grounded: false, timer: 0, grace: 0, giant, chain: 0, ...extra
    };
    e.giant = giant;
    l.enemies.push(e);
    return e;
  }

  function baseLevel(index, cols, plan) {
    const world = Math.floor(index / 6), slot = index % 6;
    return {
      index, world, slot, plan: plan.key, theme: plan.theme, kind: plan.kind || 'normal',
      cols, rows: ROWS, width: cols * TILE,
      tiles: Array.from({ length: ROWS }, () => new Array(cols).fill(T.EMPTY)),
      blocks: {}, groups: {}, boxes: [], enemies: [], items: [], coins: [], platforms: [], pipes: [], cannons: [],
      goal: null, orb: null, boss: null, arenaStart: null, water: null,
      autoscroll: plan.autoscroll || 0, time: plan.time || 300,
      spawn: { x: 40, y: FLOOR * TILE }, endX: null, bonus: false, secretExit: null, bonusRoom: null
    };
  }

  class Builder {
    constructor(l, plan, rng) {
      this.l = l;
      this.plan = plan;
      this.rng = rng;
      this.d = l.world / 7;
      this.ground = plan.ground;
      this.hard = plan.hard;
      this.maxGap = 3 + (l.world >= 3 ? 1 : 0) + (l.world >= 6 ? 1 : 0);
      this.powerCount = 0;
      this.groupCount = 0;
    }
    rand() { return this.rng(); }
    int(a, b) { return a + Math.floor(this.rng() * (b - a + 1)); }
    chance(p) { return this.rng() < p; }
    pick(list) { return list[Math.floor(this.rng() * list.length)]; }
    set(x, y, t) { if (x >= 0 && x < this.l.cols && y >= 0 && y < ROWS) this.l.tiles[y][x] = t; }
    get(x, y) { return x < 0 || x >= this.l.cols || y < 0 || y >= ROWS ? T.EMPTY : this.l.tiles[y][x]; }
    free(x, y) { return this.get(x, y) === T.EMPTY; }
    floor(x0, x1, top = FLOOR, tile = this.ground) {
      for (let x = Math.max(0, x0); x < Math.min(this.l.cols, x1); x++) for (let y = top; y < ROWS; y++) this.set(x, y, tile);
    }
    clearCol(x, from = FLOOR) { for (let y = from; y < ROWS; y++) this.set(x, y, T.EMPTY); }
    column(x, top, bottom, tile) { for (let y = top; y <= bottom; y++) this.set(x, y, tile); }
    coin(x, y) {
      if (!this.free(x, y)) return;
      if (this.l.coins.some(c => c.x === x * TILE + 4 && c.y === y * TILE + 2)) return;
      this.l.coins.push({ x: x * TILE + 4, y: y * TILE + 2, w: 8, h: 12, taken: false });
    }
    block(x, y, type, item = null) {
      this.set(x, y, type);
      delete this.l.blocks[x + ',' + y];
      if (item) this.l.blocks[x + ',' + y] = { item, bump: 0, alt: item === 'power' ? (this.chance(0.5) ? 'leaf' : 'flower') : null };
    }
    giantBlock(x, y, type, item = null) {
      const id = 'g' + this.groupCount++;
      this.l.groups[id] = { x, y, type };
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        this.set(x + dx, y + dy, type);
        this.l.blocks[x + dx + ',' + (y + dy)] = { item: dx === 0 && dy === 0 ? item : null, bump: 0, group: id, alt: item === 'power' ? (this.chance(0.5) ? 'leaf' : 'flower') : null };
      }
    }
    powerItem() { this.powerCount++; return 'power'; }
    needsPower() { return this.powerCount < 1 || (this.powerCount < 3 && this.chance(0.3)); }
    pitFill(x) {
      this.clearCol(x);
      if (['castle', 'bowser', 'lava'].includes(this.plan.theme)) this.set(x, 13, T.LAVA);
    }
    enemy(type, col, surfaceRow = FLOOR, extra = {}) {
      const giant = !!extra.giant;
      const w = (ENEMY_SIZE[type][0]) * (giant ? 2 : 1);
      const x = w <= TILE ? col * TILE + (TILE - w) / 2 : col * TILE;
      return makeEnemy(this.l, type, x, surfaceRow * TILE, extra);
    }
    walker(col, surfaceRow = FLOOR) {
      const giant = this.plan.giant && this.chance(0.45);
      const type = this.chance(0.35 + this.d * 0.3) ? 'koopa' : 'goomba';
      return this.enemy(type, col, surfaceRow, giant ? { giant: true } : {});
    }
    pipe(x, h, opts = {}) {
      const top = FLOOR - h;
      this.set(x, top, T.PIPE_TL);
      this.set(x + 1, top, T.PIPE_TR);
      for (let y = top + 1; y < FLOOR; y++) { this.set(x, y, T.PIPE_L); this.set(x + 1, y, T.PIPE_R); }
      if (opts.piranha) {
        makeEnemy(this.l, 'piranha', x * TILE + 8, top * TILE + 24, { baseY: top * TILE, phase: this.rand() * 4, hidden: true });
      }
      return { x, top };
    }
    cannon(col, h, surfaceRow = FLOOR) {
      const top = surfaceRow - h;
      this.set(col, top, T.CANNON);
      for (let y = top + 1; y < surfaceRow; y++) this.set(col, y, T.CANNON_BASE);
      this.l.cannons.push({ tx: col, ty: top, timer: 1 + this.rand() * 2 });
    }
    lift(opts) {
      this.l.platforms.push({
        x: opts.x, y: opts.y, w: opts.w || 48, h: 8, baseX: opts.x, baseY: opts.y,
        axis: opts.axis || 'x', amp: opts.amp, rate: opts.rate || 1.1, phase: this.rand() * Math.PI * 2, dx: 0, dy: 0, oldY: opts.y
      });
    }
    semiBox(x0, x1, top, color) {
      for (let c = x0; c < x1; c++) {
        this.set(c, top, T.SEMI);
        for (let y = top + 1; y < FLOOR; y++) if (this.free(c, y)) this.set(c, y, T.SEMI_BODY);
      }
      this.l.boxes.push({ x0, x1, top, color });
    }
    weighted(pool, last) {
      const entries = Object.entries(pool).filter(([k]) => k !== last || k === 'flat');
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = this.rng() * total;
      for (const [k, w] of entries) { r -= w; if (r < 0) return k; }
      return entries[0][0];
    }
  }

  /* ---------------------------------------------------------------------------
   * Peças para fases com chão. Cada peça recebe a coluna inicial e o limite,
   * garante chão nas bordas e devolve a próxima coluna livre (ou -1 se não couber).
   * ------------------------------------------------------------------------- */
  const PIECES = {
    intro(b, x) {
      b.floor(x, x + 11);
      b.block(x + 3, 8, T.QUESTION, b.powerItem());
      if (b.chance(0.6)) {
        b.block(x + 2, 8, T.BRICK);
        b.block(x + 4, 8, T.BRICK);
        b.block(x + 5, 8, T.QUESTION, 'coin');
      }
      if (b.l.world > 0 || b.l.slot > 0) b.walker(x + 9);
      else b.enemy('goomba', x + 9);
      return x + 11;
    },

    flat(b, x, max) {
      const n = b.int(4, 7);
      if (x + n > max) return -1;
      b.floor(x, x + n);
      if (b.chance(0.5)) for (let i = 1; i < n - 1; i++) b.coin(x + i, 9);
      if (b.chance(0.4)) b.walker(x + n - 2);
      return x + n;
    },

    pit(b, x, max) {
      const w = b.int(2, b.maxGap), n = w + 4;
      if (x + n > max) return -1;
      b.floor(x, x + 2);
      b.floor(x + 2 + w, x + n);
      for (let c = x + 2; c < x + 2 + w; c++) b.pitFill(c);
      for (let i = 0; i <= w + 1; i++) b.coin(x + 1 + i, 8 - Math.round(Math.sin((Math.PI * i) / (w + 1)) * 2));
      return x + n;
    },

    blocks(b, x, max) {
      const n = b.int(8, 10);
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const k = b.int(3, 5), start = x + Math.floor((n - k) / 2);
      const powerAt = b.needsPower() ? start + b.int(0, k - 1) : -1;
      for (let i = 0; i < k; i++) {
        const c = start + i;
        if (c === powerAt) b.block(c, 8, T.QUESTION, b.powerItem());
        else if (b.chance(0.45)) b.block(c, 8, T.QUESTION, b.chance(0.06) ? 'star' : 'coin');
        else b.block(c, 8, T.BRICK, b.chance(0.05) ? 'oneup' : null);
      }
      if (b.chance(0.4)) for (let i = 0; i < k; i++) b.coin(start + i, 4);
      else if (b.chance(0.3)) b.block(start + b.int(0, k - 1), 4, T.QUESTION, 'coin');
      if (b.chance(0.25)) b.block(x + n - 2, 8, T.HIDDEN, b.chance(0.5) ? 'oneup' : 'coin');
      if (b.chance(0.6)) b.walker(x + n - 2);
      return x + n;
    },

    pipes(b, x, max) {
      const k = b.int(1, 3), plan = [];
      for (let i = 0; i < k; i++) {
        let h = b.int(2, 3);
        if (b.d > 0.4 && b.chance(0.35)) h = 4;
        plan.push([b.int(h === 4 ? 3 : 2, 4), h]);
      }
      const n = plan.reduce((s, [g]) => s + g + 2, 0) + 2;
      if (x + n > max) return -1;
      b.floor(x, x + n);
      let c = x;
      plan.forEach(([gap, h], i) => {
        c += gap;
        if (h === 4) { b.set(c - 1, FLOOR - 1, b.hard); b.set(c - 1, FLOOR - 2, b.hard); }
        const piranha = b.chance(0.25 + 0.5 * b.d) || b.plan.pool === 'piranhas';
        b.pipe(c, h, { piranha });
        const next = plan[i + 1];
        if (next && next[0] >= 3 && next[1] !== 4 && b.chance(0.4)) b.walker(c + 3);
        c += 2;
      });
      return x + n;
    },

    stairs(b, x, max) {
      const h = b.int(3, 4), mode = b.pick(['pyramid', 'gap', 'up']);
      const g = mode === 'gap' ? b.int(2, 3) : 0;
      const w = mode === 'pyramid' ? 2 * h + 2 : mode === 'gap' ? 2 * h + 2 + g : h + 4;
      if (x + w + 2 > max) return -1;
      b.floor(x, x + w + 2);
      const base = x + 1;
      for (let i = 0; i < h; i++) b.column(base + i, FLOOR - 1 - i, FLOOR - 1, b.hard);
      if (mode === 'pyramid') {
        for (let i = 0; i < h; i++) b.column(base + h + i, FLOOR - h + i, FLOOR - 1, b.hard);
      } else if (mode === 'gap') {
        for (let i = 0; i < g; i++) b.pitFill(base + h + i);
        for (let i = 0; i < h; i++) b.column(base + h + g + i, FLOOR - h + i, FLOOR - 1, b.hard);
      } else {
        b.column(base + h, FLOOR - h, FLOOR - 1, b.hard);
        b.column(base + h + 1, FLOOR - h, FLOOR - 1, b.hard);
      }
      for (let i = 0; i < 3; i++) b.coin(base + h - 1 + i, FLOOR - h - 3);
      return x + w + 2;
    },

    troop(b, x, max) {
      const n = b.int(9, 12);
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const kind = b.int(0, 2);
      if (kind === 0) for (let i = 0; i < 3; i++) b.enemy('goomba', x + 3 + i * 2);
      else if (kind === 1) { b.enemy('koopa', x + 3); b.enemy('goomba', x + 6); }
      else { b.walker(x + 4); b.walker(x + 8); }
      if (b.chance(0.6)) {
        const c = x + 2 + b.int(0, n - 7);
        for (let i = 0; i < 3; i++) {
          if (i === 1) b.block(c + i, 8, T.QUESTION, b.needsPower() ? b.powerItem() : 'coin');
          else b.block(c + i, 8, T.BRICK);
        }
      }
      return x + n;
    },

    semis(b, x, max) {
      const n = b.int(11, 15);
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const color = b.int(0, 3);
      b.semiBox(x + 1, x + 5, 9, color);
      b.semiBox(x + 5, x + 10, 7, (color + 1) % 4);
      if (n >= 14) {
        b.semiBox(x + 10, x + 13, 5, (color + 2) % 4);
        for (let c = x + 10; c < x + 13; c++) b.coin(c, 3);
      } else for (let c = x + 6; c < x + 9; c++) b.coin(c, 5);
      if (b.chance(0.5)) b.enemy('goomba', x + 8, 7);
      return x + n;
    },

    wall(b, x, max) {
      const n = 7;
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const hgt = b.int(2, 3);
      for (let c = x + 3; c < x + 5; c++) for (let y = FLOOR - hgt; y < FLOOR; y++) b.block(c, y, T.BRICK);
      for (let c = x + 2; c < x + 6; c++) b.coin(c, FLOOR - hgt - 2);
      return x + n;
    },

    platforms(b, x, max) {
      const w = b.int(5, 7), n = w + 4;
      if (x + n > max) return -1;
      b.floor(x, x + 2);
      b.floor(x + 2 + w, x + n);
      for (let c = x + 2; c < x + 2 + w; c++) b.pitFill(c);
      if (b.d > 0.25 && b.chance(0.5)) {
        const left = (x + 2) * TILE, right = (x + 2 + w) * TILE, pw = 48;
        b.lift({ x: (left + right - pw) / 2, y: 10 * TILE, w: pw, axis: 'x', amp: (right - left - pw) / 2 + 6, rate: 1.1 });
      } else {
        const c = x + 2 + Math.floor(w / 2) - 1;
        b.set(c, 9, T.SEMI);
        b.set(c + 1, 9, T.SEMI);
        b.coin(c, 7);
        b.coin(c + 1, 7);
      }
      return x + n;
    },

    lowceil(b, x, max) {
      const n = b.int(10, 14);
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const castle = ['castle', 'bowser'].includes(b.plan.theme);
      for (let c = x + 2; c < x + n - 2; c++) {
        for (let y = 1; y < 7; y++) b.set(c, y, T.STONE);
        b.block(c, 7, castle ? T.STONE : T.BRICK);
        b.coin(c, 10);
      }
      if (castle) {
        b.set(x + 4, 8, T.SPIKE);
        if (n >= 12) b.set(x + n - 5, 8, T.SPIKE);
      } else if (b.chance(0.6)) b.enemy('goomba', x + n - 4);
      return x + n;
    },

    quicksand(b, x, max) {
      const w = b.int(3, 6), n = w + 4;
      if (x + n > max) return -1;
      b.floor(x, x + 2);
      b.floor(x + 2 + w, x + n);
      for (let c = x + 2; c < x + 2 + w; c++) { b.set(c, 12, T.SAND); b.set(c, 13, T.SAND); }
      if (w >= 5) {
        const c = x + 2 + Math.floor(w / 2) - 1;
        b.set(c, 9, T.SEMI);
        b.set(c + 1, 9, T.SEMI);
      }
      for (let i = 0; i <= w + 1; i++) b.coin(x + 1 + i, 7 - Math.round(Math.sin((Math.PI * i) / (w + 1)) * 2));
      return x + n;
    },

    pyramid(b, x, max) {
      const h = b.int(4, 5), n = 2 * h + 4;
      if (x + n > max) return -1;
      b.floor(x, x + n);
      for (let i = 0; i < h; i++) {
        b.column(x + 1 + i, FLOOR - 1 - i, FLOOR - 1, b.hard);
        b.column(x + 2 * h - i, FLOOR - 1 - i, FLOOR - 1, b.hard);
      }
      b.block(x + h + (b.chance(0.5) ? 0 : 1), FLOOR - h - 4, T.QUESTION, b.needsPower() ? b.powerItem() : 'coin');
      if (b.chance(0.6)) b.walker(x + n - 1);
      return x + n;
    },

    giant(b, x, max) {
      const n = b.int(9, 11);
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const type = b.chance(0.65) ? T.QUESTION : T.BRICK;
      b.giantBlock(x + 2, 7, type, type === T.QUESTION ? (b.needsPower() ? b.powerItem() : 'coin') : null);
      if (b.chance(0.5)) b.giantBlock(x + 5, 7, T.BRICK);
      b.enemy(b.chance(0.5) ? 'goomba' : 'koopa', x + n - 3, FLOOR, { giant: true });
      return x + n;
    },

    iceblocks(b, x, max) {
      const n = b.int(10, 12);
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const h = b.int(2, 3);
      for (let i = 0; i < h; i++) b.column(x + 2 + i, FLOOR - 1 - i, FLOOR - 1, T.ICE);
      for (let c = x + 2 + h; c < x + 5 + h; c++) b.column(c, FLOOR - h, FLOOR - 1, T.ICE);
      for (let c = x + 2 + h; c < x + 5 + h; c++) b.coin(c, FLOOR - h - 2);
      if (b.chance(0.6)) b.walker(x + n - 2);
      return x + n;
    },

    warp(b, x, max) {
      const n = 24;
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const a = b.pipe(x + 1, 2);
      b.pipe(x + 6, 3, { piranha: true });
      b.set(x + 10, FLOOR - 1, b.hard);
      b.set(x + 10, FLOOR - 2, b.hard);
      b.pipe(x + 11, 4, { piranha: true });
      b.pipe(x + 16, 3, { piranha: true });
      const z = b.pipe(x + 21, 2);
      b.l.pipes.push({ x: a.x * TILE, y: a.top * TILE, w: 32, target: { type: 'pos', x: z.x * TILE + 9, top: z.top * TILE } });
      return x + n;
    },

    cannons(b, x, max) {
      const n = b.int(9, 12);
      if (x + n > max) return -1;
      b.floor(x, x + n);
      b.cannon(x + 3, b.int(1, 2));
      if (n >= 11) b.cannon(x + n - 3, b.int(1, 3));
      return x + n;
    },

    spikepit(b, x, max) {
      const w = b.int(2, 4), n = w + 4;
      if (x + n > max) return -1;
      b.floor(x, x + 2);
      b.floor(x + 2 + w, x + n);
      for (let c = x + 2; c < x + 2 + w; c++) { b.clearCol(c); b.set(c, 13, T.SPIKE); }
      return x + n;
    },

    lavapit(b, x, max) {
      const w = b.int(2, 4), n = w + 4;
      if (x + n > max) return -1;
      b.floor(x, x + 2);
      b.floor(x + 2 + w, x + n);
      for (let c = x + 2; c < x + 2 + w; c++) { b.clearCol(c); b.set(c, 13, T.LAVA); }
      if (w === 4) b.column(x + 4, 10, 13, T.STONE);
      return x + n;
    },

    fstairs(b, x, max) {
      const h = 3, n = 11;
      if (x + n > max) return -1;
      b.floor(x, x + n);
      for (let i = 0; i < h; i++) b.column(x + 1 + i, FLOOR - 1 - i, FLOOR - 1, T.STONE);
      for (let c = x + 1 + h; c < x + 4 + h; c++) b.column(c, FLOOR - h, FLOOR - 1, T.STONE);
      b.block(x + 2 + h, FLOOR - h - 4, T.QUESTION, b.needsPower() ? b.powerItem() : 'coin');
      return x + n;
    },

    lift(b, x, max) {
      const w = b.int(6, 8), n = w + 4;
      if (x + n > max) return -1;
      b.floor(x, x + 2);
      b.floor(x + 2 + w, x + n);
      for (let c = x + 2; c < x + 2 + w; c++) { b.clearCol(c); b.set(c, 13, T.LAVA); }
      const left = (x + 2) * TILE, right = (x + 2 + w) * TILE, pw = 48;
      b.lift({ x: (left + right - pw) / 2, y: 10 * TILE, w: pw, axis: 'x', amp: (right - left - pw) / 2 + 6, rate: 1 });
      return x + n;
    },

    secret(b, x, max) {
      const n = 16;
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const a = b.pipe(x + 1, 2), z = b.pipe(x + 12, 2);
      for (let c = x + 5; c < x + 10; c++) b.coin(c, 9);
      b.l.pipes.push({ x: a.x * TILE, y: a.top * TILE, w: 32, target: { type: 'bonus' } });
      b.l.secretExit = { x: z.x * TILE + 9, top: z.top * TILE };
      return x + n;
    }
  };

  function ceiling(b, rows) {
    for (let x = 0; x < b.l.cols; x++) for (let y = 0; y < rows; y++) b.set(x, y, T.STONE);
  }

  function addGoal(b, surfaceRow = FLOOR) {
    const l = b.l, gx = l.cols - 8;
    for (let c = gx - 6; c < gx - 2; c++) b.coin(c, surfaceRow - 3);
    l.goal = { x: gx * TILE, y: surfaceRow * TILE - 72, w: 26, h: 40 };
    l.endX = gx * TILE + 40;
  }

  function addArena(b, surfaceRow = FLOOR) {
    const l = b.l, start = l.cols - ARENA;
    l.arenaStart = start * TILE;
    const ground = surfaceRow * TILE;
    if (b.plan.boss === 'bowser') {
      for (let c = start + 3; c < l.cols - 3; c++) { b.set(c, 12, T.BRICK); b.set(c, 13, T.BRICK); }
      l.boss = { type: 'bowser', x: (l.cols - 9) * TILE, y: ground - 44, w: 36, h: 44, vx: 0, vy: 0, hp: 20, dead: false, grounded: false, timer: 2, invuln: 0, awake: false, air: false, pound: false, facing: -1, fireTimer: 1.5 };
    } else {
      l.boss = { type: 'boss', x: (l.cols - 10) * TILE, y: ground - 30, w: 28, h: 30, vx: 0, vy: 0, hp: 3, dead: false, grounded: false, timer: 1.2, invuln: 0, awake: false, hits: 0, facing: -1 };
    }
  }

  function buildGround(l, plan, b) {
    if (plan.ceiling) ceiling(b, plan.ceiling);
    const limit = l.cols - (plan.boss ? ARENA : 22);
    b.floor(0, 8);
    let x = PIECES.intro(b, 8, limit), last = 'intro', guard = 0;
    let secretAt = plan.secret ? Math.floor(l.cols * (0.35 + b.rand() * 0.2)) : -1;
    while (x < limit && guard++ < 200) {
      if (secretAt >= 0 && x >= secretAt) {
        secretAt = -1;
        const nx = PIECES.secret(b, x, limit);
        if (nx > 0) { x = nx; last = 'secret'; continue; }
      }
      const name = b.weighted(POOLS[plan.pool], last);
      let nx = PIECES[name](b, x, limit);
      if (nx < 0) {
        nx = PIECES.flat(b, x, limit);
        if (nx < 0) break;
        last = 'flat';
      } else last = name;
      x = nx;
      const gap = b.int(1, 3);
      b.floor(x, Math.min(limit, x + gap));
      x += gap;
    }
    b.floor(x, l.cols);
    if (plan.boss) addArena(b);
    else addGoal(b);
  }

  function buildSky(l, plan, b) {
    b.floor(0, 10);
    b.block(5, 8, T.QUESTION, b.powerItem());
    const limit = l.cols - 24;
    let x = 10, row = FLOOR, guard = 0;
    while (x < limit - 4 && guard++ < 200) {
      if ((plan.lifts && b.chance(0.35)) || b.chance(0.12)) {
        const w = b.int(6, 8);
        if (x + w + 5 > limit) break;
        const left = x * TILE, right = (x + w) * TILE, pw = 48;
        b.lift({ x: (left + right - pw) / 2, y: row * TILE, w: pw, axis: 'x', amp: (right - left - pw) / 2 + 6, rate: 0.9 });
        x += w;
        const len = b.int(4, 6);
        for (let c = x; c < x + len; c++) b.set(c, row, T.CLOUD);
        x += len;
        continue;
      }
      const gap = b.int(2, Math.min(4, b.maxGap));
      const rise = gap >= 4 ? 1 : 2;
      const nrow = clamp(row + b.int(-rise, 2), 6, 11);
      const len = b.int(3, 7);
      if (x + gap + len > limit) break;
      x += gap;
      for (let c = x; c < x + len; c++) b.set(c, nrow, T.CLOUD);
      if (b.chance(0.5)) for (let c = x; c < x + len; c++) b.coin(c, nrow - 2);
      if (len >= 5 && b.chance(0.45)) b.enemy(b.chance(0.3 + b.d * 0.4) ? 'koopa' : 'goomba', x + len - 2, nrow);
      if (b.chance(0.3) && nrow >= 8) b.block(x + 1, nrow - 4, T.QUESTION, b.needsPower() ? b.powerItem() : 'coin');
      x += len;
      row = nrow;
    }
    x += 2;
    b.floor(x, l.cols);
    addGoal(b);
  }

  function buildWater(l, plan, b) {
    const cliff = l.cols - 18;
    l.water = { top: 56, x1: cliff * TILE };
    b.floor(0, cliff);
    b.block(6, 7, T.QUESTION, b.powerItem());
    let x = 12, guard = 0;
    while (x < cliff - 8 && guard++ < 200) {
      const kind = b.int(0, 4);
      if (kind === 0) {
        const h = b.int(2, 5), w = b.int(1, 2);
        for (let c = x; c < x + w; c++) b.column(c, FLOOR - h, FLOOR - 1, T.GROUND);
        for (let c = x; c < x + w; c++) b.coin(c, FLOOR - h - 2);
        x += w + b.int(3, 5);
      } else if (kind === 1) {
        const r = b.int(5, 8), w = b.int(2, 3);
        for (let c = x; c < x + w; c++) b.set(c, r, b.hard);
        for (let c = x; c < x + w; c++) b.coin(c, r + 2);
        x += w + b.int(3, 5);
      } else if (kind === 2) {
        const n = b.int(1, 3);
        for (let i = 0; i < n; i++) {
          const r = b.int(5, 10);
          b.enemy('fish', x + i * 2, r, { baseY: r * TILE - 14, phase: b.rand() * 6, vx: -24 - b.d * 20 });
        }
        x += 7;
      } else if (kind === 3) {
        b.block(x + 1, 7, T.QUESTION, b.needsPower() ? b.powerItem() : 'coin');
        for (let c = x; c < x + 4; c++) b.coin(c, 5);
        x += 6;
      } else {
        b.pipe(x, b.int(2, 3), { piranha: b.chance(0.5) });
        x += 6;
      }
    }
    for (let c = cliff; c < l.cols; c++) b.column(c, 4, ROWS - 1, T.GROUND);
    l.goal = { x: (l.cols - 7) * TILE, y: 12, w: 26, h: 40 };
    l.endX = (l.cols - 7) * TILE + 40;
  }

  function deck(b, x0, x1, top) {
    for (let x = x0; x < x1; x++) for (let y = top; y < ROWS; y++) b.set(x, y, T.WOOD);
  }

  function buildAirship(l, plan, b) {
    const arena = l.cols - ARENA;
    let top = 10;
    deck(b, 0, 14, top);
    b.block(7, top - 4, T.QUESTION, b.powerItem());
    l.spawn = { x: 40, y: top * TILE };
    let x = 14, guard = 0;
    while (guard++ < 100) {
      const gap = b.int(2, 3), ntop = clamp(top + b.int(-2, 2), 8, 11), len = b.int(6, 11);
      if (x + gap + len > arena - 2) break;
      x += gap;
      deck(b, x, x + len, ntop);
      if (len >= 7 && b.chance(0.75)) b.cannon(x + 2 + b.int(0, len - 5), b.int(1, 2), ntop);
      else if (b.chance(0.5)) b.column(x + len - 3, ntop - b.int(1, 2), ntop - 1, T.WOOD);
      if (b.chance(0.5)) for (let c = x + 1; c < x + len - 1; c++) b.coin(c, ntop - 3);
      x += len;
      top = ntop;
    }
    x += 2;
    deck(b, x, arena, top);
    deck(b, arena, l.cols, 10);
    addArena(b, 10);
  }

  function buildTank(l, plan, b) {
    const arena = l.cols - ARENA;
    b.floor(0, l.cols);
    b.block(6, 8, T.QUESTION, b.powerItem());
    let x = 12, guard = 0;
    while (guard++ < 100) {
      const len = b.int(8, 12);
      if (x + len > arena - 2) break;
      for (let c = x; c < x + len; c++) for (let y = 9; y < FLOOR; y++) b.set(c, y, T.STONE);
      b.cannon(x + 2, 1, 9);
      if (len >= 10) b.cannon(x + len - 3, b.int(1, 2), 9);
      for (let c = x + 4; c < x + len - 4; c++) b.coin(c, 7);
      const gap = b.int(3, 5);
      if (b.chance(0.4)) b.enemy('goomba', x + len + 1);
      x += len + gap;
    }
    addArena(b);
  }

  function createLevel(index) {
    const plan = planFor(index);
    const world = Math.floor(index / 6);
    const cols = plan.len + world * 2;
    const l = baseLevel(index, cols, plan);
    const rng = mulberry32(index * 7919 + 1301);
    const b = new Builder(l, plan, rng);
    if (plan.build === 'sky') buildSky(l, plan, b);
    else if (plan.build === 'water') buildWater(l, plan, b);
    else if (plan.build === 'airship') buildAirship(l, plan, b);
    else if (plan.build === 'tank') buildTank(l, plan, b);
    else buildGround(l, plan, b);
    l.enemies.forEach((e, i) => { e.id = i; });
    return l;
  }

  // Sala bônus subterrânea (uma por fase; permanece igual enquanto a fase durar).
  function createBonusRoom(main) {
    const cols = 30;
    const plan = { key: 'bonus', theme: 'underground', kind: 'bonus', time: main.time };
    const l = baseLevel(main.index, cols, plan);
    l.bonus = true;
    l.kind = 'bonus';
    const b = new Builder(l, { ...plan, ground: T.STONE, hard: T.STONE }, mulberry32(main.index * 31 + 7));
    b.floor(0, cols);
    for (let x = 0; x < cols; x++) b.set(x, 0, T.STONE);
    for (let y = 1; y < FLOOR; y++) { b.set(0, y, T.STONE); b.set(cols - 1, y, T.STONE); }
    for (let x = 7; x <= 23; x += 2) for (const y of [4, 6, 8]) b.coin(x, y);
    b.block(15, 9, T.QUESTION, 'star');
    const entry = b.pipe(2, 2), exit = b.pipe(cols - 4, 2);
    l.spawnPipe = { x: entry.x * TILE + 9, top: entry.top * TILE };
    l.pipes.push({ x: exit.x * TILE, y: exit.top * TILE, w: 32, target: { type: 'return' } });
    return l;
  }

  // Verificações usadas pelos testes: nada sobreposto ou flutuando de forma indevida.
  function validateLevel(l) {
    const issues = [];
    const tile = (x, y) => (x < 0 || x >= l.cols || y < 0 || y >= ROWS ? -1 : l.tiles[y][x]);
    const name = `${l.world + 1}-${l.slot + 1}`;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < l.cols; x++) {
      const t = l.tiles[y][x];
      if (!Object.values(T).includes(t)) issues.push(`${name}: tile inválido ${t} em ${x},${y}`);
      if (t === T.PIPE_TL && tile(x + 1, y) !== T.PIPE_TR) issues.push(`${name}: cano incompleto em ${x},${y}`);
      if (t === T.CANNON && y < FLOOR && !isSolid(tile(x, y + 1)) && tile(x, y + 1) !== -1) issues.push(`${name}: canhão sem base em ${x},${y}`);
      if (t === T.SPIKE && !isSolid(tile(x, y - 1)) && !isSolid(tile(x, y + 1)) && y < 13) issues.push(`${name}: espinho solto em ${x},${y}`);
    }
    for (const e of l.enemies) {
      if (['piranha', 'fish', 'bullet'].includes(e.type)) continue;
      const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 1) / TILE);
      const y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - 1) / TILE);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (isSolid(tile(x, y))) issues.push(`${name}: ${e.type} dentro de bloco em ${x},${y}`);
      const below = Math.floor((e.y + e.h) / TILE);
      let supported = false;
      for (let x = x0; x <= x1; x++) { const t = tile(x, below); if (isSolid(t) || isOneWay(t)) supported = true; }
      if (!supported) issues.push(`${name}: ${e.type} sem chão em x=${x0}`);
    }
    const sx = Math.floor(l.spawn.x / TILE), sy = Math.floor(l.spawn.y / TILE);
    for (let x = 0; x < 6; x++) {
      if (!isSolid(tile(x, sy))) issues.push(`${name}: início sem chão em ${x}`);
      for (let y = sy - 2; y < sy; y++) if (isSolid(tile(x, y))) issues.push(`${name}: início bloqueado em ${x},${y}`);
    }
    if (sx < 0) issues.push(`${name}: spawn inválido`);
    if (!l.goal && !l.boss && !l.bonus) issues.push(`${name}: sem final`);
    return issues;
  }

  globalThis.MarioLevels = Object.freeze({
    TILE, ROWS, FLOOR, ARENA, T, WORLDS, PLANS, POOLS, isSolid, isOneWay, isPipe,
    createLevel, createBonusRoom, validateLevel, planFor, mulberry32
  });
})();
