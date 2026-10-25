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
  const SKY_ROWS = 12; // linhas acima da tela, alcançadas voando ou subindo no pé de feijão
  const TAU = Math.PI * 2;

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
    SEMI_BODY: 20, // corpo decorativo dos blocos grandes coloridos
    BURNER: 21 // bocal de maçarico das naves e tanques
  });

  const SOLID_TILES = new Set([
    T.GROUND, T.BRICK, T.QUESTION, T.USED, T.STONE, T.PIPE_TL, T.PIPE_TR, T.PIPE_L, T.PIPE_R,
    T.ICE, T.WOOD, T.SPIKE, T.CANNON, T.CANNON_BASE, T.BURNER
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

  // Peças disponíveis em cada tipo de fase (peso = frequência). Peças perigosas só entram
  // a partir de certa dificuldade e ficam mais comuns conforme o jogo avança (PIECE_RULES).
  const POOLS = {
    basic: { flat: 1, pit: 3, blocks: 3, pipes: 2, stairs: 2, troop: 3, semis: 2, wall: 1, platforms: 1, fallplat: 1 },
    hills: { semis: 4, pit: 3, blocks: 2, troop: 3, stairs: 2, platforms: 1, fallplat: 1 },
    pipes: { pipes: 5, pit: 2, blocks: 2, troop: 2, stairs: 1 },
    cave: { blocks: 3, pit: 3, pipes: 2, troop: 3, lowceil: 3, wall: 2, stairs: 1, firebar: 1 },
    desert: { quicksand: 3, pit: 2, blocks: 2, troop: 3, stairs: 2, pipes: 1, firebar: 1 },
    pyramid: { pyramid: 4, quicksand: 1, blocks: 2, troop: 2, firebar: 1 },
    islands: { pit: 5, platforms: 3, blocks: 2, troop: 2, semis: 1, fallplat: 2 },
    giant: { giant: 4, pit: 2, troop: 3, pipes: 1, stairs: 1 },
    climb: { stairs: 3, semis: 4, platforms: 2, blocks: 1, fallplat: 2 },
    ice: { pit: 3, iceblocks: 3, blocks: 2, troop: 3, platforms: 1, fallplat: 2 },
    pipeland: { pipes: 5, warp: 1, pit: 2, troop: 2, blocks: 1 },
    piranhas: { pipes: 6, pit: 2, blocks: 1, troop: 1 },
    dark: { pit: 3, blocks: 2, troop: 3, stairs: 2, cannons: 3, platforms: 1, firebar: 2, bubblepit: 3, fallplat: 2, crusher: 1 },
    fortress: { spikepit: 2, bubblepit: 3, fstairs: 2, lift: 2, lowceil: 2, troop: 1, firebar: 4, crusher: 2 }
  };
  const PIECE_RULES = {
    firebar: { min: 0.06, grow: 2 },
    bubblepit: { min: 0.05, grow: 1.5 },
    fallplat: { min: 0.22, grow: 2 },
    crusher: { min: 0.36, grow: 2 },
    platforms: { min: 0, grow: 1 },
    troop: { min: 0, grow: 1.5 }
  };

  const PLANS = {
    grass: { build: 'ground', theme: 'grass', len: 150, pool: 'basic', secret: true, vine: true },
    hills: { build: 'ground', theme: 'grass', len: 160, pool: 'hills', secret: true, pswitch: true },
    underground: { build: 'ground', theme: 'underground', len: 150, pool: 'cave', ceiling: 1 },
    fortress: { build: 'ground', theme: 'castle', kind: 'fortress', len: 120, pool: 'fortress', ceiling: 2, boss: 'boom' },
    pipes: { build: 'ground', theme: 'grass', len: 165, pool: 'pipes', secret: true, vine: true },
    airship: { build: 'airship', theme: 'airship', kind: 'airship', len: 150, boss: 'boom', autoscroll: 36 },
    desert: { build: 'ground', theme: 'desert', len: 150, pool: 'desert', secret: true, vine: true, pswitch: true },
    pyramid: { build: 'ground', theme: 'desert', len: 160, pool: 'pyramid' },
    sandcave: { build: 'ground', theme: 'underground', len: 150, pool: 'cave', ceiling: 1 },
    quicksand: { build: 'ground', theme: 'desert', len: 170, pool: 'desert', vine: true },
    islands: { build: 'ground', theme: 'sea', len: 155, pool: 'islands', vine: true },
    water: { build: 'water', theme: 'water', len: 150 },
    islands2: { build: 'ground', theme: 'sea', len: 165, pool: 'islands', secret: true, pswitch: true },
    reef: { build: 'water', theme: 'water', len: 165 },
    giant: { build: 'ground', theme: 'giant', len: 150, pool: 'giant', giant: true, vine: true },
    giant2: { build: 'ground', theme: 'giant', len: 160, pool: 'giant', giant: true, secret: true, pswitch: true },
    giant3: { build: 'ground', theme: 'giant', len: 170, pool: 'giant', giant: true, vine: true },
    climb: { build: 'ground', theme: 'grass', len: 155, pool: 'climb', vine: true, pswitch: true },
    sky: { build: 'sky', theme: 'sky', len: 150 },
    sky2: { build: 'sky', theme: 'sky', len: 165 },
    skylift: { build: 'sky', theme: 'sky', len: 170, lifts: true },
    ice: { build: 'ground', theme: 'ice', len: 150, pool: 'ice', vine: true },
    ice2: { build: 'ground', theme: 'ice', len: 160, pool: 'ice', secret: true, icyFloor: true, pswitch: true },
    icecave: { build: 'ground', theme: 'underground', len: 155, pool: 'cave', ceiling: 1, icyFloor: true },
    ice3: { build: 'ground', theme: 'ice', len: 175, pool: 'ice', icyFloor: true, vine: true },
    pipeland: { build: 'ground', theme: 'pipe', len: 155, pool: 'pipeland', secret: true, pswitch: true },
    pipecave: { build: 'ground', theme: 'underground', len: 160, pool: 'pipes', ceiling: 1 },
    pipeland2: { build: 'ground', theme: 'pipe', len: 170, pool: 'pipeland', vine: true },
    piranhas: { build: 'ground', theme: 'pipe', len: 170, pool: 'piranhas', vine: true },
    dark: { build: 'ground', theme: 'lava', len: 155, pool: 'dark', vine: true },
    tank: { build: 'tank', theme: 'tank', kind: 'tank', len: 140, boss: 'boom', autoscroll: 32 },
    dark2: { build: 'ground', theme: 'lava', len: 170, pool: 'dark', pswitch: true },
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
  const PLAY_BOTTOM = ROWS * TILE + 24; // abaixo da tela: de onde saltam os peixes
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

  // Dificuldade de 0 (1-1) a 1 (castelo final), crescendo fase a fase como no SMB3.
  function difficulty(index) {
    const world = Math.floor(index / 6), slot = index % 6;
    return clamp((world + slot / 6) / 7.6, 0, 1);
  }
  const hasSky = plan => (plan.build === 'ground' || plan.build === 'sky') && !plan.ceiling;

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

  function baseLevel(index, cols, plan, opts = {}) {
    const world = Math.floor(index / 6), slot = index % 6;
    const d = opts.bonus ? 0 : difficulty(index);
    const skyRows = opts.bonus || !hasSky(plan) ? 0 : SKY_ROWS;
    return {
      index, world, slot, plan: plan.key, theme: plan.theme, kind: plan.kind || 'normal',
      cols, rows: ROWS, width: cols * TILE, diff: d,
      tiles: Array.from({ length: ROWS }, () => new Array(cols).fill(T.EMPTY)),
      skyRows, sky: Array.from({ length: skyRows }, () => new Array(cols).fill(T.EMPTY)),
      blocks: {}, groups: {}, boxes: [], enemies: [], items: [], coins: [], platforms: [], pipes: [], cannons: [],
      firebars: [], bubbles: [], crushers: [], burners: [], vines: [], switches: [], secrets: [],
      goal: null, orb: null, boss: null, arenaStart: null, water: null,
      autoscroll: plan.autoscroll || 0, time: plan.time || 300,
      enemySpeed: 1 + 0.3 * d, cannonDelay: 3.6 - 1.2 * d, bulletSpeed: 66 + 30 * d,
      spawn: { x: 40, y: FLOOR * TILE }, endX: null, bonus: false, secretExit: null, bonusRoom: null
    };
  }
  // Linha de blocos, incluindo as do céu (y negativo).
  const tileRow = (l, y) => (y >= 0 ? l.tiles[y] : l.sky[y + l.skyRows]);

  class Builder {
    constructor(l, plan, rng) {
      this.l = l;
      this.plan = plan;
      this.rng = rng;
      this.d = l.diff;
      this.ground = plan.ground;
      this.hard = plan.hard;
      this.maxGap = 3 + Math.floor(this.d * 3.2);
      this.powerCount = 0;
      this.groupCount = 0;
    }
    rate(base, grow = 0.4) { return clamp(base + this.d * grow, 0, 0.95); }
    rand() { return this.rng(); }
    int(a, b) { return a + Math.floor(this.rng() * (b - a + 1)); }
    chance(p) { return this.rng() < p; }
    pick(list) { return list[Math.floor(this.rng() * list.length)]; }
    set(x, y, t) { if (x >= 0 && x < this.l.cols && y >= -this.l.skyRows && y < ROWS) tileRow(this.l, y)[x] = t; }
    get(x, y) { return x < 0 || x >= this.l.cols || y < -this.l.skyRows || y >= ROWS ? T.EMPTY : tileRow(this.l, y)[x]; }
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
    needsPower() { return this.powerCount < 1 || (this.powerCount < (this.d < 0.3 ? 3 : 2) && this.chance(0.3 - this.d * 0.12)); }
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
      const type = this.chance(0.3 + this.d * 0.4) ? 'koopa' : 'goomba';
      const extra = giant ? { giant: true } : {};
      // Tartarugas em plataformas altas patrulham e dão meia-volta na beirada.
      if (type === 'koopa' && surfaceRow < FLOOR) extra.smart = true;
      return this.enemy(type, col, surfaceRow, extra);
    }
    firebar(cx, cy, n, speed) { this.l.firebars.push({ x: cx, y: cy, n, speed, phase: this.rand() * TAU }); }
    bubble(col, surfaceRow = 13) {
      this.l.bubbles.push({ x: col * TILE + 2, w: 12, h: 14, surface: surfaceRow * TILE, height: 92 + 48 * this.d + this.rand() * 16, period: 2.3 + this.rand() * 1.1, phase: this.rand() * 3 });
    }
    jumper(col, w) {
      // Peixe que salta de um lado ao outro do buraco.
      const dir = this.chance(0.5) ? 1 : -1;
      const span = w * TILE;
      const e = makeEnemy(this.l, 'fish', (dir > 0 ? col : col + w) * TILE - 8, PLAY_BOTTOM, {
        jumper: true, x0: (dir > 0 ? col : col + w) * TILE - 8, dirJ: dir, span, peak: 110 + 50 * this.d,
        period: 2.4 + this.rand() * 0.8, phase: this.rand() * 2, hidden: true
      });
      return e;
    }
    crusher(col, topRow) {
      this.l.crushers.push({ x: col * TILE, y: topRow * TILE, w: 32, h: 32, baseY: topRow * TILE, state: 'wait', timer: 0, vy: 0 });
    }
    burner(col, row) {
      this.set(col, row, T.BURNER);
      this.l.burners.push({ tx: col, ty: row, period: 3.2 - this.d * 0.4, on: 1.0 + this.d * 0.2, phase: this.rand() * 3 });
    }
    fallPlat(x, y, w = 32) {
      this.l.platforms.push({ x, y, w, h: 8, baseX: x, baseY: y, axis: 'x', amp: 0, rate: 0, phase: 0, dx: 0, oldY: y, kind: 'fall', state: 0, t: 0, vy: 0 });
    }
    pipe(x, h, opts = {}) {
      const top = FLOOR - h;
      this.set(x, top, T.PIPE_TL);
      this.set(x + 1, top, T.PIPE_TR);
      for (let y = top + 1; y < FLOOR; y++) { this.set(x, y, T.PIPE_L); this.set(x + 1, y, T.PIPE_R); }
      if (opts.piranha) {
        makeEnemy(this.l, 'piranha', x * TILE + 8, top * TILE + 24, { baseY: top * TILE, phase: this.rand() * 4, hidden: true, fire: !!opts.fire });
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
      const entries = Object.entries(pool).map(([k, w]) => {
        const rule = PIECE_RULES[k];
        if (!rule) return [k, w];
        return [k, this.d < rule.min ? 0 : w * (1 + rule.grow * (this.d - rule.min))];
      }).filter(([k, w]) => w > 0 && (k !== last || k === 'flat'));
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
      if (b.chance(b.rate(0.45))) b.walker(x + n - 2);
      return x + n;
    },

    pit(b, x, max) {
      const w = b.int(2, b.maxGap), n = w + 4;
      if (x + n > max) return -1;
      b.floor(x, x + 2);
      b.floor(x + 2 + w, x + n);
      for (let c = x + 2; c < x + 2 + w; c++) b.pitFill(c);
      if (b.chance(0.7)) for (let i = 0; i <= w + 1; i++) b.coin(x + 1 + i, 8 - Math.round(Math.sin((Math.PI * i) / (w + 1)) * 2));
      const lava = ['castle', 'bowser', 'lava'].includes(b.plan.theme);
      if (lava && b.chance(b.rate(0.3, 0.5))) b.bubble(x + 2 + Math.floor((w - 1) / 2));
      if (b.plan.theme === 'sea' && b.d > 0.18 && b.chance(b.rate(0.4))) b.jumper(x + 2, w);
      if (b.chance(b.rate(0.15, 0.4))) b.walker(x + n - 1);
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
        else b.block(c, 8, T.BRICK, b.chance(0.04) ? 'oneup' : b.chance(0.12) ? 'coins' : null);
      }
      if (b.chance(0.4)) for (let i = 0; i < k; i++) b.coin(start + i, 4);
      else if (b.chance(0.3)) b.block(start + b.int(0, k - 1), 4, T.QUESTION, 'coin');
      if (b.chance(0.2)) b.block(x + n - 2, 8, T.HIDDEN, 'coin');
      if (b.chance(b.rate(0.6, 0.35))) b.walker(x + n - 2);
      if (b.d > 0.35 && b.chance(b.rate(0.1, 0.5))) b.walker(start + Math.floor(k / 2), 8);
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
        const piranha = b.chance(0.3 + 0.5 * b.d) || b.plan.pool === 'piranhas';
        b.pipe(c, h, { piranha, fire: piranha && b.d > 0.15 && b.chance(b.rate(0.15, 0.6)) });
        const next = plan[i + 1];
        if (next && next[0] >= 3 && next[1] !== 4 && b.chance(b.rate(0.45))) b.walker(c + 3);
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
      if (mode !== 'gap' && b.chance(b.rate(0.25, 0.5))) b.walker(base + h - 1, FLOOR - h);
      if (b.chance(b.rate(0.3))) b.walker(x + w + 1);
      return x + w + 2;
    },

    troop(b, x, max) {
      const n = b.int(9, 12);
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const kind = b.int(0, 2), extra = b.d > 0.4 ? 1 : 0;
      if (kind === 0) for (let i = 0; i < 3 + extra; i++) b.enemy('goomba', x + 2 + i * 2);
      else if (kind === 1) { b.enemy('koopa', x + 3); b.enemy('goomba', x + 6); if (extra) b.enemy('goomba', x + 8); }
      else { b.walker(x + 3); b.walker(x + 6); if (b.chance(b.rate(0.3))) b.walker(x + 9); }
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
      if (b.chance(b.rate(0.5))) b.walker(x + 8, 7);
      if (b.chance(b.rate(0.3))) b.walker(x + 2, 9);
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

    firebar(b, x, max) {
      const n = 11;
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const low = b.chance(0.45), col = x + 5, row = low ? FLOOR - 1 : 8;
      b.block(col, row, T.USED);
      const balls = 4 + (b.d > 0.45 ? 1 : 0) + (b.d > 0.8 ? 1 : 0);
      const speed = (1.5 + b.d * 1.1) * (b.chance(0.5) ? 1 : -1);
      b.firebar(col * TILE + 8, row * TILE + 8, balls, speed);
      if (low) for (let c = x + 4; c < x + 7; c++) b.coin(c, 7);
      else for (let c = x + 2; c < x + 9; c += 2) b.coin(c, 10);
      if (b.chance(b.rate(0.2))) b.walker(x + n - 2);
      return x + n;
    },

    bubblepit(b, x, max) {
      const w = b.int(2, 3) + (b.d > 0.5 ? 1 : 0), n = w + 4;
      if (x + n > max) return -1;
      b.floor(x, x + 2);
      b.floor(x + 2 + w, x + n);
      for (let c = x + 2; c < x + 2 + w; c++) { b.clearCol(c); b.set(c, 13, T.LAVA); }
      b.bubble(x + 2 + Math.floor((w - 1) / 2));
      if (w >= 4) b.bubble(x + 1 + w);
      return x + n;
    },

    fallplat(b, x, max) {
      const w = b.int(6, 8) + (b.d > 0.6 ? 2 : 0), n = w + 4;
      if (x + n > max) return -1;
      b.floor(x, x + 2);
      b.floor(x + 2 + w, x + n);
      for (let c = x + 2; c < x + 2 + w; c++) b.pitFill(c);
      const k = Math.max(2, Math.round(w / 3.5)), seg = (w * TILE) / k;
      for (let i = 0; i < k; i++) {
        const px = Math.round((x + 2) * TILE + (i + 0.5) * seg - 16);
        b.fallPlat(px, (i % 2 ? 9 : 10) * TILE);
        b.coin(Math.floor((px + 12) / TILE), i % 2 ? 7 : 8);
      }
      return x + n;
    },

    crusher(b, x, max) {
      const n = 12;
      if (x + n > max) return -1;
      b.floor(x, x + n);
      const top = b.plan.ceiling || 2;
      b.crusher(x + 4, top);
      if (b.d > 0.6) b.crusher(x + 8, top);
      for (let c = x + 3; c < x + 10; c++) b.coin(c, 10);
      return x + n;
    },

    // Botão P: transforma os tijolos em moedas por alguns segundos.
    pswitch(b, x, max) {
      const n = 17;
      if (x + n > max) return -1;
      b.floor(x, x + n);
      b.block(x + 2, 8, T.BRICK);
      b.block(x + 3, 8, T.BRICK, 'pswitch');
      b.block(x + 4, 8, T.BRICK);
      for (let c = x + 7; c < x + 14; c++) for (let y = 5; y <= 7; y++) b.block(c, y, T.BRICK);
      for (let c = x + 7; c < x + 14; c++) b.coin(c, 3);
      b.block(x + 15, 4, T.HIDDEN, 'oneup');
      b.l.secrets.push('pswitch');
      if (b.chance(b.rate(0.3))) b.walker(x + 12);
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
    let switchAt = plan.pswitch ? Math.floor(l.cols * (0.18 + b.rand() * 0.12)) : -1;
    while (x < limit && guard++ < 200) {
      if (secretAt >= 0 && x >= secretAt) {
        secretAt = -1;
        const nx = PIECES.secret(b, x, limit);
        if (nx > 0) { x = nx; last = 'secret'; continue; }
      }
      if (switchAt >= 0 && x >= switchAt) {
        switchAt = -1;
        const nx = PIECES.pswitch(b, x, limit);
        if (nx > 0) { x = nx; last = 'pswitch'; continue; }
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
      b.floor(x, x + gap);
      x += gap;
    }
    b.floor(Math.min(x, limit), l.cols);
    fillPatrols(b, limit);
    if (plan.boss) addArena(b);
    else addGoal(b);
    hiddenOneUp(b);
    skyBonus(b, plan);
  }

  // Garante uma quantidade mínima de inimigos, crescente com a dificuldade (o SMB3 é bem povoado).
  function fillPatrols(b, limit) {
    const l = b.l;
    const fort = b.plan.pool === 'fortress';
    const want = fort ? Math.round(l.cols / 40 + b.d * l.cols / 30) : Math.round(l.cols / 15 + b.d * l.cols / 11);
    const near = c => l.enemies.some(e => e.type !== 'piranha' && Math.abs(e.x / TILE - c) < 5);
    for (let tries = 0; tries < 400 && l.enemies.filter(e => e.type !== 'piranha').length < want; tries++) {
      const c = b.int(18, limit - 2);
      if (near(c)) continue;
      // superfície mais alta livre nessa coluna
      let row = -1;
      for (let y = 3; y <= FLOOR; y++) {
        const t = b.get(c, y);
        if ((isSolid(t) || isOneWay(t)) && t !== T.SPIKE && t !== T.LAVA && t !== T.CANNON) { row = y; break; }
        if (t !== T.EMPTY) break;
      }
      const cols = b.plan.giant ? [c, c + 1] : [c];
      const rows = b.plan.giant ? 3 : 2;
      if (row < 0 || cols.some(x => isPipeTile(b.get(x, row)) || !(isSolid(b.get(x, row)) || isOneWay(b.get(x, row))))) continue;
      if (cols.some(x => { for (let k = 1; k <= rows; k++) if (b.get(x, row - k) !== T.EMPTY) return true; return false; })) continue;
      if (row === FLOOR && (!isSolid(b.get(c - 1, FLOOR)) || !isSolid(b.get(c + cols.length, FLOOR)))) continue;
      if (b.plan.giant) b.enemy(b.chance(0.5) ? 'goomba' : 'koopa', c, row, { giant: true, smart: row < FLOOR });
      else b.walker(c, row);
    }
  }
  const isPipeTile = t => t >= T.PIPE_TL && t <= T.PIPE_R;

  // Bloco invisível com vida extra na beirada de um buraco (lugar típico de segredo).
  function hiddenOneUp(b) {
    const l = b.l, spots = [];
    const end = (l.goal ? l.goal.x : l.arenaStart || l.width) / TILE - 10;
    for (let x = 16; x < end; x++) {
      if (!isSolid(b.get(x, FLOOR)) || isSolid(b.get(x + 1, FLOOR))) continue;
      const h = x - 3;
      let clear = true;
      for (const c of [h - 1, h, h + 1]) {
        if (!isSolid(b.get(c, FLOOR))) clear = false;
        for (let y = 4; y < FLOOR; y++) if (b.get(c, y) !== T.EMPTY) clear = false;
      }
      if (clear) spots.push(h);
    }
    if (!spots.length) return;
    const x = spots[Math.floor(b.rand() * spots.length)];
    b.block(x, 8, T.HIDDEN, 'oneup');
    l.coins = l.coins.filter(c => !(c.x === x * TILE + 4 && c.y === 8 * TILE + 2));
  }

  // Céu escondido: nuvens cheias de moedas acima da tela. Uma é alcançada por um pé de feijão
  // que nasce de um tijolo; a outra, mais alta, só voando com a Folha (há uma trilha de moedas
  // subindo como pista).
  function skyBonus(b, plan) {
    const l = b.l;
    if (!l.skyRows) return;
    const end = Math.floor((l.goal ? l.goal.x : l.arenaStart || l.width) / TILE) - 14;
    const clearCol = (c, from, to) => { for (let y = from; y <= to; y++) if (b.get(c, y) !== T.EMPTY) return false; return true; };
    const cloudStrip = (x0, x1, row, coinsRow, first = 0) => {
      let c = x0;
      while (c < x1) {
        const len = Math.min(x1 - c, c === x0 && first ? first : b.int(4, 7));
        for (let i = 0; i < len; i++) { b.set(c + i, row, T.CLOUD); b.coin(c + i, row - 1); if (coinsRow !== null) b.coin(c + i, coinsRow); }
        c += len + 2;
      }
    };
    let placed = 0;
    // 1) Pé de feijão
    if (plan.vine && plan.build === 'ground') {
      for (let tries = 0; tries < 80; tries++) {
        const c = b.int(22, Math.max(23, Math.floor(end * 0.6)));
        if (![c - 1, c, c + 1].every(x => isSolid(b.get(x, FLOOR)) && clearCol(x, 0, FLOOR - 1))) continue;
        if (l.coins.some(k => Math.abs(k.x - c * TILE) < 20 && k.y > 7 * TILE && k.y < 10 * TILE)) continue;
        const row = -6, len = b.int(15, 21);
        if (c + len > end) continue;
        b.block(c, 8, T.BRICK, 'vine');
        l.blocks[c + ',8'].vineTop = (row - 2) * TILE;
        cloudStrip(c - 2, c + len, row, row - 3, 9);
        b.block(c + Math.floor(len / 2), row - 4, T.QUESTION, b.chance(0.5) ? 'oneup' : 'star');
        placed++;
        break;
      }
    }
    // 2) Nuvem alta para quem voa
    const lo = Math.max(30, Math.floor(end * 0.45));
    for (let tries = 0; tries < 60; tries++) {
      const c = b.int(lo, Math.max(lo, end - 12));
      const row = -8, len = b.int(12, 16);
      let free = true;
      for (let x = c - 2; x < c + len + 1 && free; x++) for (let y = row - 4; y <= row; y++) if (b.get(x, y) !== T.EMPTY) free = false;
      if (!free || c + len > end + 10) continue;
      cloudStrip(c, c + len, row, null);
      for (let x = c + 1; x < c + len - 1; x += 2) b.coin(x, row - 3);
      // trilha de moedas subindo, na inclinação do voo
      for (let k = 0; k < 7; k++) b.coin(c - 14 + k * 2, 5 - Math.round(k * 2.2));
      if (b.chance(0.5)) b.block(c + len - 3, row - 4, T.QUESTION, 'oneup');
      placed++;
      break;
    }
    if (placed) l.secrets.push('sky');
  }

  function buildSky(l, plan, b) {
    b.floor(0, 10);
    b.block(5, 8, T.QUESTION, b.powerItem());
    const limit = l.cols - 24;
    let x = 10, row = FLOOR, guard = 0;
    while (x < limit - 4 && guard++ < 200) {
      if (b.d > 0.25 && b.chance(b.rate(0.05, 0.3))) {
        // nuvens frágeis que despencam
        const w = b.int(6, 8);
        if (x + w + 5 > limit) break;
        const k = Math.max(2, Math.round(w / 3.5)), seg = (w * TILE) / k;
        for (let i = 0; i < k; i++) b.fallPlat(Math.round(x * TILE + (i + 0.5) * seg - 16), clamp(row + (i % 2 ? -1 : 0), 6, 11) * TILE);
        x += w;
        const len = b.int(3, 5);
        for (let c = x; c < x + len; c++) b.set(c, row, T.CLOUD);
        x += len;
        continue;
      }
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
      const gap = b.int(2, Math.min(5, b.maxGap));
      const rise = gap >= 4 ? 1 : 2;
      const nrow = clamp(row + b.int(-rise, 2), 6, 11);
      const len = b.int(3, 7);
      if (x + gap + len > limit) break;
      x += gap;
      for (let c = x; c < x + len; c++) b.set(c, nrow, T.CLOUD);
      if (b.chance(0.5)) for (let c = x; c < x + len; c++) b.coin(c, nrow - 2);
      if (len >= 4 && b.chance(b.rate(0.45))) {
        const koopa = b.chance(0.3 + b.d * 0.4);
        b.enemy(koopa ? 'koopa' : 'goomba', x + len - 2, nrow, koopa ? { smart: true } : {});
      }
      if (b.chance(0.3) && nrow >= 8) b.block(x + 1, nrow - 4, T.QUESTION, b.needsPower() ? b.powerItem() : 'coin');
      x += len;
      row = nrow;
    }
    x += 2;
    b.floor(x, l.cols);
    addGoal(b);
    fillPatrols(b, limit);
    skyBonus(b, plan);
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
        const n = b.int(1, 3) + (b.d > 0.3 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const r = b.int(5, 10);
          b.enemy('fish', x + i * 2, r, { baseY: r * TILE - 14, phase: b.rand() * 6, vx: -24 - b.d * 30, chase: b.d > 0.25 && b.chance(0.4) });
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
      let used = -1;
      if (len >= 7 && b.chance(0.7 + 0.25 * b.d)) { used = x + 2 + b.int(0, len - 5); b.cannon(used, b.int(1, 2), ntop); }
      else if (b.chance(0.5)) { used = x + len - 3; b.column(used, ntop - b.int(1, 2), ntop - 1, T.WOOD); }
      if (len >= 6 && b.d > 0.05 && b.chance(b.rate(0.3, 0.5))) {
        let c = x + Math.floor(len / 2);
        if (Math.abs(c - used) < 3) c = used + 3 < x + len - 2 ? used + 3 : used - 3;
        if (c > x + 1 && c < x + len - 2 && Math.abs(c - used) >= 3 && b.get(c, ntop - 1) === T.EMPTY) b.burner(c, ntop);
      }
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
      if (b.chance(b.rate(0.35, 0.4))) b.burner(x + 5, 9);
      for (let c = x + 4; c < x + len - 4; c++) b.coin(c, 7);
      const gap = b.int(3, 5);
      if (b.chance(b.rate(0.45))) b.enemy('goomba', x + len + 1);
      x += len + gap;
    }
    addArena(b);
  }

  function createLevel(index) {
    const plan = planFor(index);
    const world = Math.floor(index / 6);
    const cols = plan.len + world * 4;
    const l = baseLevel(index, cols, plan);
    const rng = mulberry32(index * 7919 + 1301);
    const b = new Builder(l, plan, rng);
    if (plan.build === 'sky') buildSky(l, plan, b);
    else if (plan.build === 'water') buildWater(l, plan, b);
    else if (plan.build === 'airship') buildAirship(l, plan, b);
    else if (plan.build === 'tank') buildTank(l, plan, b);
    else buildGround(l, plan, b);
    l.enemies.forEach((e, i) => { e.id = i; });
    if (l.pipes.some(q => q.target.type === 'bonus')) l.secrets.push('bonus');
    if (Object.values(l.blocks).some(d => d.item === 'oneup') && [].concat(...l.tiles, ...l.sky).includes(T.HIDDEN)) {
      for (const [k, d] of Object.entries(l.blocks)) {
        const [x, y] = k.split(',').map(Number);
        if (d.item === 'oneup' && tileRow(l, y)[x] === T.HIDDEN) { l.secrets.push('oneup'); break; }
      }
    }
    l.secrets = [...new Set(l.secrets)];
    return l;
  }

  // Sala bônus subterrânea (uma por fase; permanece igual enquanto a fase durar).
  function createBonusRoom(main) {
    const cols = 30;
    const plan = { key: 'bonus', theme: 'underground', kind: 'bonus', time: main.time };
    const l = baseLevel(main.index, cols, plan, { bonus: true });
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
    for (let y = 0; y < (l.skyRows || 0); y++) for (let x = 0; x < l.cols; x++) {
      const t = l.sky[y][x];
      if (!Object.values(T).includes(t)) issues.push(`${name}: tile inválido no céu ${t} em ${x},${y - l.skyRows}`);
    }
    for (const q of l.firebars) if (!isSolid(tile(Math.floor(q.x / TILE), Math.floor(q.y / TILE)))) issues.push(`${name}: barra de fogo sem bloco`);
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
    TILE, ROWS, FLOOR, ARENA, SKY_ROWS, T, WORLDS, PLANS, POOLS, isSolid, isOneWay, isPipe,
    createLevel, createBonusRoom, validateLevel, planFor, mulberry32, difficulty
  });
})();
