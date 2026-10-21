/* Motor determinístico do jogo. Física e regras seguem os valores documentados de
 * Super Mario Bros. 3 (TASVideos, Data Crystal e Super Mario Wiki). Série original: Nintendo. */
(() => {
  'use strict';

  const LV = globalThis.MarioLevels;
  const { TILE, ROWS, FLOOR, T, WORLDS, createLevel, createBonusRoom, isSolid, isOneWay } = LV;
  const W = 448, H = 256, PLAY = 224; // área lógica widescreen (7:4, quase 16:9)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // O SMB3 mede velocidade em 1/16 de pixel por quadro, a 60 quadros por segundo.
  const U = 60 / 16; // unidade de velocidade -> px/s
  const A = 3600 / 16; // unidade de aceleração -> px/s²
  const PHYS = Object.freeze({
    walk: 24 * U, // 1,5 px/quadro
    run: 40 * U, // 2,5 px/quadro
    pspeed: 56 * U, // 3,5 px/quadro com o medidor P cheio
    fly: 38 * U,
    swim: 24 * U,
    sand: 6 * U,
    accel: 1 * A,
    skid: 2.5 * A,
    release: 1 * A,
    iceAccel: 0.4 * A,
    iceRelease: 0.15 * A,
    iceSkid: 0.8 * A,
    jump: 56 * U,
    jumpBonus: [0, 2 * U, 4 * U, 8 * U], // tabela por velocidade horizontal / 16
    gravity: 5 * A,
    gravityHold: 1 * A, // segurando pulo enquanto sobe
    holdUntil: -32 * U,
    maxFall: 69 * U,
    bounce: 48 * U,
    bounceHold: 56 * U,
    swimStroke: 32 * U,
    swimGravity: 1.5 * A,
    swimFall: 16 * U,
    leap: 40 * U,
    sandJump: 40 * U,
    sandSink: 4 * U,
    flyClimb: 24 * U,
    tailFall: 16 * U,
    pmeterStep: 8 / 60,
    pmeterDrain: 24 / 60,
    flightTime: 256 / 60,
    timeUnit: 0.68 // um "segundo" do relógio do SMB3 dura 0,68 s
  });

  const CHAIN = [100, 200, 400, 800, 1000, 2000, 4000, 8000];
  const CARDS = ['mushroom', 'flower', 'star'];
  const ITEMS = ['mushroom', 'leaf', 'flower', 'star'];
  const POWERS = ['small', 'big', 'raccoon', 'fire'];
  const CARD_BONUS = { mushroom: 2, flower: 3, star: 5 };
  const TOAD_ITEMS = [
    ['mushroom', 'leaf', 'flower'], ['leaf', 'flower', 'mushroom'], ['flower', 'leaf', 'star'], ['leaf', 'mushroom', 'flower'],
    ['leaf', 'star', 'flower'], ['flower', 'leaf', 'mushroom'], ['leaf', 'flower', 'star'], ['star', 'flower', 'leaf']
  ];
  const THEME_MUSIC = {
    grass: 'overworld', desert: 'overworld', giant: 'overworld', sky: 'overworld', ice: 'overworld', pipe: 'overworld',
    sea: 'overworld', water: 'water', underground: 'underground', castle: 'castle', lava: 'castle', bowser: 'castle',
    airship: 'airship', tank: 'airship'
  };

  // Mapa de cada mundo: um caminho próprio com 8 casas.
  const MAP_NODES = Object.freeze([
    { kind: 'start', x: 40, y: 168 },
    { kind: 'stage', slot: 0, x: 96, y: 168 },
    { kind: 'stage', slot: 1, x: 152, y: 168 },
    { kind: 'toad', x: 152, y: 112 },
    { kind: 'stage', slot: 2, x: 208, y: 112 },
    { kind: 'stage', slot: 3, x: 264, y: 112 },
    { kind: 'stage', slot: 4, x: 264, y: 58 },
    { kind: 'stage', slot: 5, x: 330, y: 58 }
  ]);
  const nodeOfSlot = slot => MAP_NODES.findIndex(n => n.kind === 'stage' && n.slot === slot);
  const SLOT_LABEL = ['1', '2', '3', 'F', '4', 'N'];
  function stageName(index) {
    const world = Math.floor(index / 6), slot = index % 6;
    if (slot === 3) return `Fortaleza ${world + 1}`;
    if (slot === 5) return world === 7 ? 'Castelo do Bowser' : `Nave ${world + 1}`;
    return `${world + 1}-${SLOT_LABEL[slot]}`;
  }

  const normalize = (i = {}) => ({
    move: clamp(Math.round(Number(i.move) || 0), -1, 1),
    jump: !!i.jump, run: !!i.run, down: !!i.down, up: !!i.up, start: !!i.start
  });

  class MarioGame {
    constructor() {
      this.newGame();
      this.mode = 'title';
    }

    newGame() {
      this.cheats = this.cheats || { fly: false, fire: false, triple: false, mega: false, invincible: false };
      this.shake = 0;
      this.mode = 'map';
      this.world = 0;
      this.mapPos = 0;
      this.completed = [];
      this.toadOpened = [];
      this.lives = 4;
      this.score = 0;
      this.coins = 0;
      this.cards = [];
      this.inventory = [];
      this.savedPower = 'small';
      this.pendingStar = 0;
      this.highest = 0;
      this.events = [];
      this.particles = [];
      this.projectiles = [];
      this.clock = 0;
      this.camera = 0;
      this.level = null;
      this.mainLevel = null;
      this.player = null;
      this.prev = {};
      this.mapAnim = null;
      this.invOpen = false;
      this.invCursor = 0;
      this.toad = null;
      this.banner = null;
      this.time = 300;
      this.hurry = false;
      this.freeze = 0;
      this.deathTimer = 0;
      this.ending = null;
      this.currentStage = -1;
      this.beforePause = 'map';
    }

    emit(type, data = {}) { this.events.push({ type, ...data }); }
    takeEvents() { const e = this.events; this.events = []; return e; }

    get node() { return MAP_NODES[this.mapPos]; }
    get inLevel() { return ['playing', 'dying', 'clear'].includes(this.mode) || (this.mode === 'paused' && ['playing', 'dying', 'clear'].includes(this.beforePause)); }
    get stage() {
      if (this.inLevel && this.currentStage >= 0) return this.currentStage;
      const n = this.node;
      return n && n.kind === 'stage' ? this.world * 6 + n.slot : -1;
    }
    get slot() { return this.stage >= 0 ? this.stage % 6 : -1; }
    get music() {
      const mode = this.mode === 'paused' ? this.beforePause : this.mode;
      if (['map', 'title', 'toad', 'gameover', 'victory'].includes(mode) || !this.level) return 'map';
      if (this.player && this.player.star > 0) return 'star';
      return THEME_MUSIC[this.level.theme] || 'overworld';
    }
    stageName(index = this.stage) { return index >= 0 ? stageName(index) : ''; }
    isCompleted(index) { return this.completed.includes(index); }
    isPassable(pos) {
      const n = MAP_NODES[pos];
      if (!n) return false;
      if (n.kind === 'stage') return this.isCompleted(this.world * 6 + n.slot);
      return true;
    }
    rouletteCard(clock = this.clock) { return CARDS[Math.floor(clock * 7.5) % 3]; }

    /* ---------------------------- Save ---------------------------- */
    continueFields() {
      const w = this.world;
      return {
        lives: 4, score: 0, cards: [], savedPower: 'small', pendingStar: 0, mapPos: 0,
        completed: this.completed.filter(s => Math.floor(s / 6) !== w || s % 6 === 3),
        toadOpened: this.toadOpened.filter(x => x !== w)
      };
    }
    exportSave() {
      const s = {
        version: 2, world: this.world, mapPos: this.mapPos, completed: [...this.completed], toadOpened: [...this.toadOpened],
        lives: this.lives, score: this.score, coins: this.coins, cards: [...this.cards], inventory: [...this.inventory],
        power: this.savedPower, highest: this.highest, finished: this.mode === 'victory'
      };
      if (this.mode === 'gameover' || this.lives <= 0) {
        const c = this.continueFields();
        Object.assign(s, { lives: c.lives, score: c.score, cards: c.cards, power: c.savedPower, mapPos: 0, completed: c.completed, toadOpened: c.toadOpened });
      }
      return s;
    }
    loadSave(raw) {
      if (!raw || typeof raw !== 'object') return false;
      let s = raw;
      if (s.version === 1) s = migrateV1(s);
      if (!s || s.version !== 2) return false;
      if (!Number.isInteger(s.world) || s.world < 0 || s.world > 7) return false;
      if (!Number.isInteger(s.mapPos) || s.mapPos < 0 || s.mapPos >= MAP_NODES.length) return false;
      this.newGame();
      this.world = s.world;
      this.completed = Array.isArray(s.completed) ? [...new Set(s.completed.filter(n => Number.isInteger(n) && n >= 0 && n < 48))] : [];
      this.toadOpened = Array.isArray(s.toadOpened) ? [...new Set(s.toadOpened.filter(n => Number.isInteger(n) && n >= 0 && n < 8))] : [];
      this.mapPos = this.reachable(s.mapPos);
      this.lives = clamp(Math.floor(Number(s.lives) || 4), 1, 99);
      this.score = clamp(Math.floor(Number(s.score) || 0), 0, 9999999);
      this.coins = clamp(Math.floor(Number(s.coins) || 0), 0, 99);
      this.cards = (Array.isArray(s.cards) ? s.cards : []).filter(c => CARDS.includes(c)).slice(0, 2);
      this.inventory = (Array.isArray(s.inventory) ? s.inventory : []).filter(i => ITEMS.includes(i)).slice(0, 28);
      this.savedPower = POWERS.includes(s.power) ? s.power : 'small';
      this.highest = Math.max(0, ...this.completed.map(n => n + 1));
      return true;
    }
    // Garante que a posição salva não pule casas não concluídas.
    reachable(pos) {
      let p = 0;
      while (p < pos && this.isPassable(p)) p++;
      return p;
    }

    /* ----------------------------- Mapa ---------------------------- */
    mapMove(dir, edge = true) {
      if (this.mode !== 'map' || this.mapAnim || this.invOpen || !dir) return false;
      const to = this.mapPos + dir;
      if (to < 0 || to >= MAP_NODES.length || (dir > 0 && !this.isPassable(this.mapPos))) {
        if (edge) this.emit('bump');
        return false;
      }
      this.mapAnim = { from: this.mapPos, to, t: 0 };
      this.emit('select');
      return true;
    }
    mapEnter() {
      if (this.mode !== 'map' || this.mapAnim) return false;
      const n = this.node;
      if (n.kind === 'stage') {
        const s = this.world * 6 + n.slot;
        if (this.isCompleted(s)) { this.emit('bump'); return false; }
        return this.enterStage(s);
      }
      if (n.kind === 'toad') {
        if (this.toadOpened.includes(this.world)) { this.emit('bump'); return false; }
        this.openToad();
        return true;
      }
      return false;
    }
    stepMap(dt, inp, pressed) {
      this.clock += dt;
      if (this.banner) { this.banner.time -= dt; if (this.banner.time <= 0) this.banner = null; }
      if (this.mapAnim) {
        this.mapAnim.t += dt / 0.24;
        if (this.mapAnim.t < 1) return;
        this.mapPos = this.mapAnim.to;
        this.mapAnim = null;
      }
      const moveEdge = inp.move !== 0 && inp.move !== (this.prev.move || 0);
      if (this.invOpen) {
        if (!this.inventory.length || pressed('run')) { this.invOpen = false; this.emit('select'); return; }
        if (moveEdge) { this.invCursor = clamp(this.invCursor + inp.move, 0, this.inventory.length - 1); this.emit('select'); }
        if (pressed('jump') || pressed('start')) this.useItem(this.invCursor);
        return;
      }
      if (pressed('run') && this.inventory.length) { this.invOpen = true; this.invCursor = 0; this.emit('select'); return; }
      if (pressed('jump') || pressed('start')) { if (this.mapEnter()) return; }
      if (inp.move) this.mapMove(inp.move, moveEdge);
    }

    /* ------------------------ Casa do Toad ------------------------ */
    openToad() {
      const pool = TOAD_ITEMS[this.world];
      const seed = (this.score + this.coins * 7 + this.world * 13 + Math.floor(this.clock * 60)) >>> 0;
      const rng = LV.mulberry32(seed);
      this.toad = { cursor: 1, opened: -1, item: null, timer: 0, items: [0, 1, 2].map(() => pool[Math.floor(rng() * pool.length)]) };
      this.mode = 'toad';
      this.emit('enterToad');
    }
    stepToad(dt, inp, pressed) {
      this.clock += dt;
      const t = this.toad;
      if (t.opened < 0) {
        const moveEdge = inp.move !== 0 && inp.move !== (this.prev.move || 0);
        if (moveEdge) { t.cursor = clamp(t.cursor + inp.move, 0, 2); this.emit('select'); }
        if (pressed('jump') || pressed('start')) {
          t.opened = t.cursor;
          t.item = t.items[t.cursor];
          this.addItem(t.item);
          t.timer = 2;
          this.emit('powerup');
        }
        return;
      }
      t.timer -= dt;
      if (t.timer <= 0) {
        if (!this.toadOpened.includes(this.world)) this.toadOpened.push(this.world);
        this.toad = null;
        this.mode = 'map';
        this.emit('map');
      }
    }
    addItem(item) {
      if (!ITEMS.includes(item)) return;
      if (this.inventory.length >= 28) this.inventory[27] = item;
      else this.inventory.push(item);
    }
    canUseItem(i) {
      const item = this.inventory[i];
      if (this.mode !== 'map' || !item) return false;
      if (item === 'mushroom') return this.savedPower === 'small';
      if (item === 'leaf') return this.savedPower !== 'raccoon';
      if (item === 'flower') return this.savedPower !== 'fire';
      return this.pendingStar === 0;
    }
    useItem(i) {
      if (!this.canUseItem(i)) { this.emit('bump'); return false; }
      const item = this.inventory.splice(i, 1)[0];
      if (item === 'star') this.pendingStar = 12;
      else this.savedPower = { mushroom: 'big', leaf: 'raccoon', flower: 'fire' }[item];
      this.invCursor = clamp(this.invCursor, 0, Math.max(0, this.inventory.length - 1));
      if (!this.inventory.length) this.invOpen = false;
      this.emit('powerup');
      return true;
    }

    /* --------------------------- Fases --------------------------- */
    enterStage(index = this.stage) {
      if (!Number.isInteger(index) || index < 0 || index > 47) return false;
      this.world = Math.floor(index / 6);
      this.mapPos = nodeOfSlot(index % 6);
      this.currentStage = index;
      this.level = createLevel(index);
      this.mainLevel = this.level;
      this.mode = 'playing';
      this.time = this.level.time;
      this.hurry = false;
      this.freeze = 0;
      this.clock = 0;
      this.camera = 0;
      this.particles = [];
      this.projectiles = [];
      this.ending = null;
      this.invOpen = false;
      this.prev = { jump: true, run: true, down: true, start: true };
      const power = this.savedPower, h = power === 'small' ? 16 : 28;
      this.player = {
        x: this.level.spawn.x, y: this.level.spawn.y - h, w: 14, h, power, vx: 0, vy: 0, facing: 1, grounded: true,
        duck: false, star: this.pendingStar, invuln: 0, pm: 0, pmFill: 0, pmDrain: 0, flight: 0, flap: 0, wag: 0,
        tail: 0, attackCooldown: 0, carry: null, chain: 0, starChain: 0, pipe: null, pipeCooldown: 0, coyote: 0,
        jumpBuffer: 0, jumpHeld: false, skidding: false, inSand: false, swimming: false, prevBottom: 0, deathJump: false
      };
      this.pendingStar = 0;
      this.emit('enterStage', { stage: index });
      return true;
    }

    pause() {
      if (['playing', 'map', 'toad', 'dying', 'clear'].includes(this.mode)) {
        this.beforePause = this.mode;
        this.mode = 'paused';
        this.emit('pause');
      }
    }
    resume() {
      if (this.mode !== 'paused') return;
      this.mode = this.beforePause;
      this.prev = { jump: true, run: true, down: true, start: true };
      this.emit('resume');
    }
    continueGame() {
      if (this.mode !== 'gameover') return false;
      Object.assign(this, this.continueFields());
      this.mode = 'map';
      this.mapAnim = null;
      this.invOpen = false;
      this.emit('map');
      return true;
    }
    endGame() {
      if (this.mode !== 'gameover') return false;
      Object.assign(this, this.continueFields());
      this.mode = 'title';
      return true;
    }

    tile(tx, ty) {
      const l = this.level;
      if (tx < 0 || tx >= l.cols) return T.STONE;
      if (ty < 0 || ty >= ROWS) return T.EMPTY;
      return l.tiles[ty][tx];
    }
    setTile(tx, ty, t) { if (tx >= 0 && tx < this.level.cols && ty >= 0 && ty < ROWS) this.level.tiles[ty][tx] = t; }

    colliders(box, mode = 'solid') {
      const out = [];
      const y0 = Math.floor(box.y / TILE), y1 = Math.floor((box.y + box.h - 0.01) / TILE);
      const x0 = Math.floor(box.x / TILE), x1 = Math.floor((box.x + box.w - 0.01) / TILE);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = this.tile(x, y);
        const one = isOneWay(t), hidden = t === T.HIDDEN;
        if (isSolid(t) || (mode !== 'solid' && one) || (mode === 'player' && hidden)) out.push({ x: x * TILE, y: y * TILE, w: TILE, h: TILE, tx: x, ty: y, t, oneWay: one, hidden });
      }
      return out;
    }

    moveBody(b, dt, opts = {}) {
      const player = !!opts.player;
      const oldY = b.y;
      let hitX = false, hitY = false;
      b.x += b.vx * dt;
      for (const c of this.colliders(b)) {
        if (!overlap(b, c)) continue;
        if (b.type === 'shell' && Math.abs(b.vx) > 100 && (c.t === T.BRICK || c.t === T.QUESTION)) {
          this.hitBlock(c.tx, c.ty, 'shell', b);
          if (!isSolid(this.tile(c.tx, c.ty))) continue;
        }
        if (b.vx > 0) b.x = c.x - b.w;
        else if (b.vx < 0) b.x = c.x + c.w;
        hitX = true;
      }
      if (hitX) b.vx = player ? 0 : -b.vx;
      b.y += b.vy * dt;
      b.grounded = false;
      const heads = [];
      const vy = b.vy;
      for (const c of this.colliders(b, player ? 'player' : 'oneway')) {
        if (!overlap(b, c)) continue;
        if (c.oneWay && (vy < 0 || oldY + b.h > c.y + 1)) continue;
        if (c.hidden && (vy >= 0 || oldY < c.y + c.h - 0.5)) continue;
        if (vy > 0) { b.y = c.y - b.h; b.grounded = true; hitY = true; }
        else if (vy < 0) { b.y = c.y + c.h; hitY = true; heads.push(c); }
      }
      if (hitY) b.vy = 0;
      if (vy >= 0) {
        for (const p of this.level.platforms) {
          if (b.x + b.w > p.x && b.x < p.x + p.w && oldY + b.h <= p.oldY + 3 && b.y + b.h >= p.y && b.y < p.y + p.h) {
            b.y = p.y - b.h;
            b.vy = 0;
            b.grounded = true;
            b.x += p.dx || 0;
          }
        }
      }
      if (player && heads.length) {
        const cx = Math.floor((b.x + b.w / 2) / TILE);
        const hit = heads.find(c => c.tx === cx) || heads[0];
        this.hitBlock(hit.tx, hit.ty, 'player');
      }
      return { hitX, hitY };
    }

    award(points, x, y) {
      if (points === '1UP') {
        this.lives = Math.min(99, this.lives + 1);
        this.emit('oneup');
        this.particles.push({ kind: 'text', text: '1UP', x, y, vy: -30, life: 0.9 });
        return;
      }
      this.score = Math.min(9999999, this.score + points);
      this.particles.push({ kind: 'text', text: String(points), x, y, vy: -30, life: 0.8 });
    }
    chainPoints(holder, key) {
      const n = holder[key] || 0;
      holder[key] = n + 1;
      return n < CHAIN.length ? CHAIN[n] : '1UP';
    }
    addCoin(x, y) {
      this.coins++;
      this.score = Math.min(9999999, this.score + 50);
      this.emit('coin');
      if (this.coins >= 100) {
        this.coins -= 100;
        this.lives = Math.min(99, this.lives + 1);
        this.emit('oneup');
        this.particles.push({ kind: 'text', text: '1UP', x, y, vy: -30, life: 0.9 });
      }
    }
    debris(x, y, color = '#d18a48') {
      for (let i = 0; i < 4; i++) this.particles.push({ kind: 'debris', x: x + 4 + (i % 2) * 8, y: y + 4 + (i > 1 ? 8 : 0), vx: (i % 2 ? 1 : -1) * 70, vy: i > 1 ? -150 : -260, life: 0.9, color });
    }
    dust(x, y, n) {
      for (let i = 0; i < n; i++) this.particles.push({ kind: 'dust', x: x + (i - n / 2) * 4, y: y - 3, vx: (i - n / 2 + 0.5) * 30, vy: -18 - (i % 2) * 10, life: 0.35 });
    }
    puff(x, y) { for (let i = 0; i < 6; i++) this.particles.push({ kind: 'puff', x: x + (i % 3) * 6, y: y + Math.floor(i / 3) * 8, vx: (i % 3 - 1) * 30, vy: -20, life: 0.45 }); }

    hitBlock(tx, ty, by = 'player', source = null) {
      const l = this.level, t = this.tile(tx, ty), key = tx + ',' + ty;
      if (![T.BRICK, T.QUESTION, T.HIDDEN].includes(t)) {
        if (t === T.USED && by === 'player') this.emit('bump');
        return;
      }
      const data = l.blocks[key];
      if (data && data.bump > 0) return;
      const group = data && data.group ? l.groups[data.group] : null;
      const tiles = group ? [[group.x, group.y], [group.x + 1, group.y], [group.x, group.y + 1], [group.x + 1, group.y + 1]] : [[tx, ty]];
      const origin = group ? l.blocks[group.x + ',' + group.y] : data;
      const item = origin ? origin.item : null;
      const p = this.player;
      const strong = by !== 'player' || (p && p.power !== 'small');
      if (t === T.BRICK && !item) {
        if (strong) {
          for (const [x, y] of tiles) { this.setTile(x, y, T.EMPTY); delete l.blocks[x + ',' + y]; this.debris(x * TILE, y * TILE); }
          this.score = Math.min(9999999, this.score + 10);
          this.emit('break');
        } else {
          for (const [x, y] of tiles) l.blocks[x + ',' + y] = { ...(l.blocks[x + ',' + y] || {}), item: null, bump: 0.18 };
          this.emit('bump');
        }
        this.bumpEnemiesAbove(tiles);
        return;
      }
      for (const [x, y] of tiles) {
        this.setTile(x, y, T.USED);
        const d = l.blocks[x + ',' + y] || (l.blocks[x + ',' + y] = {});
        d.item = null;
        d.bump = 0.18;
        d.group = group ? data.group : null;
      }
      const ox = (group ? group.x : tx) * TILE + (group ? 8 : 0), oy = (group ? group.y : ty) * TILE;
      const dir = p && p.x + p.w / 2 > ox + 8 ? -1 : 1;
      let kind = item || 'coin';
      if (kind === 'power') kind = p && p.power !== 'small' ? origin.alt || 'leaf' : 'mushroom';
      if (kind === 'coin') {
        this.addCoin(ox, oy - 16);
        this.particles.push({ kind: 'coin', x: ox + 4, y: oy - 14, vy: -220, life: 0.5, gravity: 600 });
      } else this.spawnItem(kind, ox, oy, dir);
      this.bumpEnemiesAbove(tiles);
    }
    spawnItem(type, x, y, dir) {
      const it = { type, x, y, w: 16, h: 16, vx: 0, vy: 0, life: 0, grounded: false, emerge: type === 'leaf' ? 0 : 1, dir };
      if (type === 'leaf') { it.y = y - 16; it.vy = -230; }
      this.level.items.push(it);
      this.emit('sprout');
    }
    bumpEnemiesAbove(tiles) {
      for (const [x, y] of tiles) {
        for (const e of this.level.enemies) {
          if (e.dead || e.held || ['piranha', 'bullet'].includes(e.type)) continue;
          if (e.x + e.w > x * TILE && e.x < x * TILE + TILE && Math.abs(e.y + e.h - y * TILE) < 5) this.defeatEnemy(e, 'bump', 100);
        }
        for (const c of this.level.coins) {
          if (!c.taken && c.x >= x * TILE && c.x < x * TILE + TILE && c.y + c.h <= y * TILE + 2 && c.y + c.h > y * TILE - 18) { c.taken = true; this.addCoin(c.x, c.y); }
        }
      }
    }

    setPower(power) {
      const p = this.player;
      const h = power === 'small' ? 16 : p.duck ? 16 : 28;
      p.y += p.h - h;
      p.h = h;
      p.power = power;
      if (power === 'small') p.duck = false;
    }
    grow(power) {
      const p = this.player;
      if (power === 'raccoon' || p.power === 'raccoon') this.puff(p.x - 2, p.y + p.h - 16);
      this.setPower(power);
      this.freeze = 0.45;
      this.emit('powerup');
    }
    collectItem(item) {
      const p = this.player;
      item.dead = true;
      if (item.type === 'oneup') { this.award('1UP', item.x, item.y); return; }
      if (item.type === 'star') { p.star = 12; p.starChain = 0; this.emit('powerup'); }
      else if (item.type === 'mushroom') { if (p.power === 'small') this.grow('big'); else this.emit('powerup'); }
      else if (item.type === 'leaf') { if (p.power !== 'raccoon') this.grow('raccoon'); else this.emit('powerup'); }
      else if (item.type === 'flower') { if (p.power !== 'fire') this.grow('fire'); else this.emit('powerup'); }
      this.award(1000, item.x, item.y);
    }
    damage() {
      const p = this.player;
      if (this.mode !== 'playing' || !p || p.invuln > 0 || p.star > 0 || p.pipe || this.cheats.invincible) return;
      if (p.power === 'fire' || p.power === 'raccoon') {
        this.puff(p.x - 2, p.y + p.h - 16);
        this.setPower('big');
      } else if (p.power === 'big') this.setPower('small');
      else { this.die(); return; }
      p.invuln = 2;
      p.flight = 0;
      p.pm = 0;
      this.releaseShell();
      this.freeze = 0.3;
      this.emit('powerdown');
    }
    die() {
      if (this.mode !== 'playing') return;
      const p = this.player;
      this.mode = 'dying';
      this.deathTimer = 0;
      p.vx = 0;
      p.vy = 0;
      p.deathJump = false;
      p.pipe = null;
      if (p.carry) { p.carry.held = false; p.carry = null; }
      if (p.power !== 'small') { p.y += p.h - 16; p.h = 16; p.power = 'small'; }
      this.savedPower = 'small';
      this.emit('death');
    }
    defeatEnemy(e, kind, points) {
      if (e.dead) return;
      e.dead = true;
      e.held = false;
      e.deathKind = kind;
      e.deathTime = kind === 'stomp' ? 0.4 : 1.4;
      if (kind !== 'stomp') { e.vy = -220; e.vx = (e.x < (this.player ? this.player.x : 0) ? -1 : 1) * 40; }
      if (this.player && this.player.carry === e) this.player.carry = null;
      if (points !== undefined) this.award(points, e.x, e.y);
      this.emit(kind === 'stomp' || kind === 'fall' ? 'stomp' : 'kick');
    }
    toShell(e) {
      e.type = 'shell';
      const h = e.giant ? 28 : 14;
      e.y += e.h - h;
      e.h = h;
      e.vx = 0;
      e.shellTime = 0;
      e.chain = 0;
    }
    kickShell(e, dir) {
      e.vx = dir * 190;
      e.dir = dir;
      e.grace = 0.2;
      e.chain = 0;
      this.emit('kick');
    }
    releaseShell() {
      const p = this.player;
      if (!p || !p.carry) return;
      const e = p.carry;
      e.held = false;
      e.x = p.facing > 0 ? p.x + p.w + 1 : p.x - e.w - 1;
      e.y = p.y + p.h - e.h;
      p.carry = null;
      if (this.colliders(e).length) { e.x = p.x + (p.w - e.w) / 2; }
      this.kickShell(e, p.facing);
    }
    attack() {
      const p = this.player, c = this.cheats;
      if (p.attackCooldown > 0 || p.duck) return;
      const cheatFire = c.fire || c.triple || c.mega;
      if (p.power === 'fire' || cheatFire) {
        const limit = cheatFire ? 9 : 2;
        if (this.projectiles.filter(a => a.kind === 'fire').length < limit) {
          const size = c.mega ? 14 : 8;
          const base = { kind: 'fire', x: p.x + (p.facing > 0 ? p.w : -size), y: p.y + (p.h > 16 ? 8 : 4), w: size, h: size, vx: p.facing * (c.mega ? 260 : 240), life: 3, pierce: c.mega, mega: c.mega };
          this.projectiles.push({ ...base, vy: 60 });
          if (c.triple) {
            this.projectiles.push({ ...base, vy: -260 });
            this.projectiles.push({ ...base, vy: 0, straight: true, life: 1.6 });
          }
          p.attackCooldown = cheatFire ? 0.12 : 0.2;
          this.emit('fire');
        }
      }
      if (p.power === 'raccoon') {
        p.tail = 0.25;
        p.attackCooldown = Math.max(p.attackCooldown, cheatFire ? 0.12 : 0.32);
        this.emit('tail');
        const hit = { x: p.x - 10, y: p.y + p.h - 14, w: p.w + 20, h: 12 };
        for (const e of this.level.enemies) {
          if (e.dead || e.held || (e.type === 'piranha' && e.hidden) || !overlap(hit, e)) continue;
          if (e.type === 'koopa') { this.toShell(e); e.vy = -160; this.award(100, e.x, e.y); this.emit('kick'); }
          else this.defeatEnemy(e, 'tail', 100);
        }
        for (const b of this.colliders(hit)) if (b.t === T.BRICK || b.t === T.QUESTION) this.hitBlock(b.tx, b.ty, 'tail');
        const boss = this.level.boss;
        if (boss && boss.awake && !boss.dead && boss.type === 'boss' && boss.invuln <= 0 && overlap(hit, boss)) this.hurtBoss(1);
      }
    }

    inWater(b) {
      const w = this.level && this.level.water;
      return !!w && b.x + b.w / 2 < w.x1 && b.y + b.h / 2 > w.top;
    }
    onIce(p) {
      const y = Math.floor((p.y + p.h + 1) / TILE);
      return this.tile(Math.floor((p.x + 2) / TILE), y) === T.ICE || this.tile(Math.floor((p.x + p.w - 2) / TILE), y) === T.ICE;
    }
    touching(box, tileType, pad = 0) {
      const b = { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
      const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 0.01) / TILE);
      const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.01) / TILE);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.tile(x, y) === tileType) return true;
      return false;
    }

    /* ---------------------------- Passo ---------------------------- */
    step(dt, input = {}) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, 1 / 30);
      const inp = normalize(input);
      const pressed = k => inp[k] && !this.prev[k];
      switch (this.mode) {
        case 'map': this.stepMap(dt, inp, pressed); break;
        case 'toad': this.stepToad(dt, inp, pressed); break;
        case 'gameover': if (pressed('jump') || pressed('start')) this.continueGame(); break;
        case 'playing': this.stepPlaying(dt, inp, pressed); break;
        case 'dying': this.stepDying(dt); break;
        case 'clear': this.stepClear(dt); break;
        default: break;
      }
      this.prev = inp;
    }

    stepPlaying(dt, inp, pressed) {
      const p = this.player, l = this.level;
      if (this.freeze > 0) { this.freeze -= dt; return; }
      if (p.pipe) { this.stepPipe(dt); this.updateParticles(dt); return; }
      this.clock += dt;
      this.shake = Math.max(0, this.shake - dt);
      this.time = Math.max(0, this.time - dt / PHYS.timeUnit);
      if (this.time < 100 && !this.hurry) { this.hurry = true; this.emit('hurry'); }
      if (this.time <= 0) { this.die(); return; }
      for (const k of ['star', 'invuln', 'flight', 'flap', 'wag', 'tail', 'attackCooldown', 'pipeCooldown', 'jumpBuffer', 'coyote']) p[k] = Math.max(0, p[k] - dt);
      if (p.star <= 0) p.starChain = 0;
      this.updatePlatforms(dt);
      this.updatePlayer(dt, inp, pressed);
      if (this.mode !== 'playing' || p.pipe) return;
      this.updateCannons(dt);
      this.updateItems(dt);
      this.updateEnemies(dt, inp);
      if (this.mode !== 'playing') return;
      this.updateBoss(dt);
      if (this.mode !== 'playing') return;
      this.updateProjectiles(dt);
      if (this.mode !== 'playing') return;
      for (const c of l.coins) if (!c.taken && overlap(p, c)) { c.taken = true; this.addCoin(c.x, c.y); }
      if (l.goal && p.x + p.w > l.goal.x && p.x < l.goal.x + l.goal.w) this.clearStage('card');
      if (l.orb && l.orb.ready && overlap(p, l.orb)) this.clearStage('orb');
      for (const d of Object.values(l.blocks)) if (d.bump > 0) d.bump = Math.max(0, d.bump - dt);
      this.updateParticles(dt);
      this.updateCamera(dt);
    }

    updatePlatforms() {
      for (const pl of this.level.platforms) {
        pl.oldY = pl.y;
        const ox = pl.x;
        const wave = Math.sin(this.clock * pl.rate + pl.phase) * pl.amp;
        pl.x = pl.baseX + (pl.axis === 'x' ? wave : 0);
        pl.y = pl.baseY + (pl.axis === 'y' ? wave : 0);
        pl.dx = pl.x - ox;
      }
    }

    updatePlayer(dt, inp, pressed) {
      const p = this.player, l = this.level;
      const water = this.inWater(p);
      p.swimming = water;
      const icy = p.grounded && this.onIce(p);
      const move = inp.move;

      // Agachar (só Super, Fogo e Guaxinim, como no original)
      const wantDuck = inp.down && p.grounded && p.power !== 'small' && !water;
      if (wantDuck !== p.duck && p.power !== 'small') {
        const h = wantDuck ? 16 : 28;
        const box = { x: p.x, y: p.y + p.h - h, w: p.w, h };
        if (wantDuck || this.colliders(box).length === 0) { p.y = box.y; p.h = h; p.duck = wantDuck; }
      }

      // Movimento horizontal
      let max = PHYS.walk;
      if (water) max = PHYS.swim;
      else if (inp.run) max = p.pm >= 7 ? PHYS.pspeed : PHYS.run;
      if (p.flight > 0 && !p.grounded) max = Math.min(Math.max(max, PHYS.fly), PHYS.fly);
      if (p.inSand) max = PHYS.sand;
      const sameDir = move !== 0 && (p.vx === 0 || Math.sign(p.vx) === move);
      p.skidding = false;
      if (move && !p.duck) {
        p.facing = move;
        if (!sameDir) {
          p.vx += move * (icy ? PHYS.iceSkid : PHYS.skid) * dt;
          p.skidding = p.grounded;
          if (Math.sign(p.vx) === move) p.vx = move * Math.min(Math.abs(p.vx), 20);
        } else if (Math.abs(p.vx) < max) {
          p.vx = clamp(p.vx + move * (icy ? PHYS.iceAccel : PHYS.accel) * dt, -max, max);
        } else if (p.grounded || water || p.inSand || p.flight > 0) {
          p.vx = Math.sign(p.vx) * Math.max(max, Math.abs(p.vx) - PHYS.release * dt);
        }
      } else if (p.grounded || water || p.inSand) {
        const dec = icy ? PHYS.iceRelease : PHYS.release;
        p.vx = Math.sign(p.vx) * Math.max(0, Math.abs(p.vx) - dec * dt);
      }

      // Medidor P: enche correndo no chão em velocidade máxima, uma seta a cada 8 quadros.
      const fullRun = p.grounded && inp.run && move !== 0 && sameDir && Math.abs(p.vx) >= PHYS.run - 1 && !water && !p.duck && !p.inSand;
      if (p.flight > 0) p.pm = 7;
      else if (fullRun) {
        p.pmDrain = 0;
        p.pmFill += dt;
        while (p.pmFill >= PHYS.pmeterStep) { p.pmFill -= PHYS.pmeterStep; if (p.pm < 7) p.pm++; }
      } else if (p.grounded || p.power === 'raccoon' || water) {
        p.pmFill = 0;
        p.pmDrain += dt;
        while (p.pmDrain >= PHYS.pmeterDrain) { p.pmDrain -= PHYS.pmeterDrain; if (p.pm > 0) p.pm--; }
      }

      // Pulo, nado, voo e balanço da cauda
      const canFly = p.power === 'raccoon' || this.cheats.fly;
      if (this.cheats.fly && !water) { p.pm = 7; if (!p.grounded && p.flight <= 0) p.flight = PHYS.flightTime; if (p.flight > 0) p.flight = Math.max(p.flight, 1); }
      if (p.grounded) p.coyote = 0.05;
      if (!inp.jump) p.jumpHeld = false;
      if (pressed('jump')) p.jumpBuffer = 0.05;
      if (water) {
        if (pressed('jump')) {
          p.vy = p.y + p.h / 2 < l.water.top + 12 ? -PHYS.leap : -PHYS.swimStroke;
          p.jumpBuffer = 0;
          this.emit('swim');
        }
        p.vy = Math.min(PHYS.swimFall, p.vy + PHYS.swimGravity * dt);
      } else {
        const canJump = p.grounded || p.coyote > 0 || p.inSand;
        if (p.jumpBuffer > 0 && canJump) {
          const idx = Math.min(3, Math.floor(Math.abs(p.vx) / U / 16));
          p.vy = p.inSand ? -PHYS.sandJump : -(PHYS.jump + PHYS.jumpBonus[idx]);
          p.grounded = false;
          p.coyote = 0;
          p.jumpBuffer = 0;
          p.jumpHeld = true;
          if (canFly && p.pm >= 7 && !p.inSand && p.flight <= 0) { p.flight = PHYS.flightTime; this.emit('fly'); }
          else if (p.flight > 0) this.emit('fly');
          else this.emit('jump');
        } else if (pressed('jump') && canFly && !p.grounded) {
          if (p.flight > 0) { p.flap = 8 / 60; this.emit('tail'); }
          else if (p.vy > -20 && p.power === 'raccoon') { p.wag = 16 / 60; this.emit('tail'); }
          if (p.power === 'raccoon') p.tail = Math.max(p.tail, 0.12);
        }
        if (p.flap > 0) p.vy = -PHYS.flyClimb;
        else {
          const hold = p.jumpHeld && inp.jump && p.vy < PHYS.holdUntil;
          p.vy = Math.min(PHYS.maxFall, p.vy + (hold ? PHYS.gravityHold : PHYS.gravity) * dt);
          if (p.wag > 0 && p.vy > PHYS.tailFall) p.vy = PHYS.tailFall;
        }
        if (p.inSand) p.vy = Math.min(p.vy, PHYS.sandSink);
      }

      // Ataque (B): bola de fogo ou cauda; segurar B com casco parado = carregar
      if (pressed('run') && !p.carry) this.attack();
      if (p.carry && !inp.run) this.releaseShell();

      // Entrar em cano segurando para baixo
      if (inp.down && p.grounded && !p.carry && p.pipeCooldown <= 0 && this.tryPipe()) return;

      p.prevBottom = p.y + p.h;
      const wasAir = !p.grounded, fallSpeed = p.vy;
      const res = this.moveBody(p, dt, { player: true });
      if (wasAir && p.grounded && fallSpeed > 160) this.dust(p.x + p.w / 2, p.y + p.h, 4);
      if (p.skidding && Math.floor(this.clock * 20) % 3 === 0) this.dust(p.x + p.w / 2 - p.facing * 6, p.y + p.h, 1);
      if (res.hitX && p.grounded) { p.pm = 0; p.pmFill = 0; }
      if (p.flight > 0 && p.grounded && p.vy >= 0 && !inp.run) p.flight = 0;

      // Limites horizontais
      const minX = l.autoscroll || this.arenaLocked() ? this.camera : 0;
      const maxX = l.autoscroll ? Math.min(l.width, this.camera + W) - p.w : l.width - p.w;
      if (p.x < minX) {
        p.x = minX;
        if (l.autoscroll && this.colliders(p).length) { this.die(); return; }
        if (p.vx < 0) p.vx = 0;
      }
      if (p.x > maxX) { p.x = maxX; if (p.vx > 0) p.vx = 0; }
      p.y = Math.max(-64, p.y);

      if (p.y > PLAY + 16) { this.die(); return; }
      if (this.touching({ x: p.x + 2, y: p.y + 4, w: p.w - 4, h: p.h - 4 }, T.LAVA)) { this.die(); return; }
      if (this.touching(p, T.SPIKE, 1)) this.damage();
      p.inSand = this.touching({ x: p.x + 2, y: p.y + p.h - 6, w: p.w - 4, h: 6 }, T.SAND);
      if (p.inSand && p.y + 4 > (ROWS - 1) * TILE) { this.die(); return; }
      if (p.grounded && !p.inSand) p.chain = 0;
      if (p.carry) {
        const e = p.carry;
        e.x = p.facing > 0 ? p.x + p.w - 4 : p.x - e.w + 4;
        e.y = p.y + p.h - e.h - (p.power === 'small' ? 1 : 6);
      }
    }

    tryPipe() {
      const p = this.player, l = this.level;
      const pipe = l.pipes.find(q => p.x + p.w / 2 > q.x + 6 && p.x + p.w / 2 < q.x + q.w - 6 && Math.abs(p.y + p.h - q.y) < 3);
      if (!pipe) return false;
      p.pipe = { phase: 'in', t: 0, target: pipe.target, startY: p.y };
      p.x = pipe.x + (pipe.w - p.w) / 2;
      p.vx = 0;
      p.vy = 0;
      p.duck = false;
      if (p.power !== 'small') { p.y += p.h - 28; p.h = 28; }
      this.emit('pipe');
      return true;
    }
    stepPipe(dt) {
      const p = this.player, pp = p.pipe;
      pp.t += dt;
      const dur = 0.55;
      if (pp.phase === 'in') {
        p.y = pp.startY + Math.min(1, pp.t / dur) * (p.h + 2);
        if (pp.t < dur) return;
        const exit = this.warp(pp.target);
        pp.phase = 'out';
        pp.t = 0;
        pp.exitTop = exit.top;
        p.x = exit.x - p.w / 2 + 2;
        p.y = exit.top + 2;
        this.emit('pipe');
        return;
      }
      p.y = pp.exitTop + 2 - Math.min(1, pp.t / dur) * (p.h + 2);
      if (pp.t >= dur) {
        p.y = pp.exitTop - p.h;
        p.pipe = null;
        p.pipeCooldown = 0.6;
        p.grounded = true;
        this.prev.down = true;
      }
      this.updateCamera(dt, true);
    }
    warp(target) {
      const main = this.mainLevel;
      let exit;
      if (target.type === 'bonus') {
        main.bonusRoom = main.bonusRoom || createBonusRoom(main);
        this.level = main.bonusRoom;
        exit = this.level.spawnPipe;
      } else if (target.type === 'return') {
        this.level = main;
        exit = main.secretExit;
      } else exit = { x: target.x, top: target.top };
      this.projectiles = [];
      this.camera = clamp(exit.x - W * 0.4, 0, Math.max(0, this.level.width - W));
      return exit;
    }

    arenaLocked() {
      const l = this.level, b = l.boss;
      return !!b && b.awake && !l.autoscroll;
    }

    updateCamera(dt, instant = false) {
      const l = this.level, p = this.player;
      const maxCam = Math.max(0, l.width - W);
      if (l.autoscroll && !l.bonus) {
        this.camera = Math.min(maxCam, this.camera + l.autoscroll * dt);
        return;
      }
      let target = p.x + p.w / 2 - W * 0.42;
      if (this.arenaLocked()) target = Math.max(target, l.arenaStart - 32);
      const cam = clamp(target, 0, maxCam);
      this.camera = instant ? cam : cam;
    }

    updateCannons(dt) {
      const p = this.player, l = this.level;
      for (const c of l.cannons) {
        const cx = c.tx * TILE + 8;
        if (cx < this.camera - 32 || cx > this.camera + W + 32) continue;
        if (this.tile(c.tx, c.ty) !== T.CANNON) continue;
        c.timer -= dt;
        if (c.timer > 0) continue;
        c.timer = 3.2;
        const pc = p.x + p.w / 2;
        if (Math.abs(pc - cx) < 40) continue;
        const dir = pc < cx ? -1 : 1;
        const e = { id: l.enemies.length + 1000, type: 'bullet', x: dir < 0 ? c.tx * TILE - 16 : c.tx * TILE + 16, y: c.ty * TILE + 1, w: 16, h: 14, vx: dir * 66, vy: 0, dir, dead: false, active: true, timer: 0, grace: 0, chain: 0 };
        l.enemies.push(e);
        this.emit('cannon');
      }
    }

    updateItems(dt) {
      const p = this.player, l = this.level;
      for (const it of l.items) {
        it.life += dt;
        if (it.emerge > 0) {
          it.emerge = Math.max(0, it.emerge - dt / 0.5);
          it.y -= (16 / 0.5) * dt;
          if (it.emerge === 0) it.vx = it.type === 'flower' ? 0 : it.type === 'star' ? it.dir * 70 : it.dir * 60;
          if (it.emerge < 0.5 && overlap(p, it)) this.collectItem(it);
          continue;
        }
        if (it.type === 'leaf') {
          if (it.vy < 0) it.vy += PHYS.gravity * dt;
          else { it.vy = 40; it.vx = Math.cos(it.life * 3.2) * 70; }
          it.x += it.vx * dt;
          it.y += it.vy * dt;
        } else if (it.type !== 'flower') {
          it.vy = Math.min(PHYS.maxFall, it.vy + PHYS.gravity * dt);
          this.moveBody(it, dt);
          if (it.type === 'star' && it.grounded) it.vy = -280;
        }
        if (!it.dead && overlap(p, it)) this.collectItem(it);
      }
      l.items = l.items.filter(a => !a.dead && a.y < PLAY + 32 && a.x > -32 && a.x < l.width + 32);
    }

    updateEnemies(dt, inp) {
      const p = this.player, l = this.level;
      const walkers = [];
      for (const e of l.enemies) {
        if (e.dead) {
          e.deathTime -= dt;
          if (e.deathKind !== 'stomp') { e.vy += PHYS.gravity * 0.7 * dt; e.y += e.vy * dt; e.x += (e.vx || 0) * dt; }
          continue;
        }
        if (!e.active) {
          if (e.x < this.camera + W + 24 && e.x + e.w > this.camera - 24) e.active = true;
          else continue;
        }
        if (e.type === 'bullet') {
          if (e.x > this.camera + W + 64 || e.x + e.w < this.camera - 64) { e.dead = true; e.deathTime = 0; continue; }
        } else if (e.x > this.camera + W + 160 || e.x + e.w < this.camera - 160) continue;
        e.timer += dt;
        e.grace = Math.max(0, e.grace - dt);
        if (e.held) {
          e.shellTime = (e.shellTime || 0) + dt;
          if (e.shellTime > 7) { this.reviveKoopa(e); this.damage(); }
          continue;
        }
        switch (e.type) {
          case 'goomba':
          case 'koopa': {
            e.vx = e.dir * (e.type === 'koopa' ? 32 : 30);
            e.vy = Math.min(PHYS.maxFall, e.vy + PHYS.gravity * dt);
            const r = this.moveBody(e, dt);
            if (r.hitX) e.dir = -e.dir;
            walkers.push(e);
            break;
          }
          case 'shell': {
            e.vy = Math.min(PHYS.maxFall, e.vy + PHYS.gravity * dt);
            const before = e.vx;
            this.moveBody(e, dt);
            if (before !== 0 && e.vx !== before) this.emit('bump');
            if (e.vx === 0) {
              e.shellTime = (e.shellTime || 0) + dt;
              if (e.shellTime > 7) this.reviveKoopa(e);
            } else {
              e.shellTime = 0;
              for (const o of l.enemies) {
                if (o === e || o.dead || o.held || (o.type === 'piranha' && o.hidden) || !overlap(e, o)) continue;
                this.defeatEnemy(o, 'shell', this.chainPoints(e, 'chain'));
              }
            }
            break;
          }
          case 'piranha': {
            const period = 4;
            const near = Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) < 28;
            let t = (e.timer + e.phase) % period;
            if (t < 1.6 && near) { e.timer -= dt; t = (e.timer + e.phase) % period; }
            const out = t < 1.6 ? 0 : t < 2.1 ? (t - 1.6) / 0.5 : t < 3.5 ? 1 : 1 - (t - 3.5) / 0.5;
            e.y = e.baseY - out * e.h;
            e.hidden = out < 0.2;
            e.hb = { x: e.x + 2, y: e.y + 2, w: 12, h: Math.max(0, e.baseY - e.y - 2) };
            if (e.hidden) continue;
            break;
          }
          case 'fish':
            e.x += e.vx * dt;
            e.y = e.baseY + Math.sin(e.timer * 1.6 + (e.phase || 0)) * 18;
            break;
          case 'bullet':
            e.x += e.vx * dt;
            break;
          default:
            break;
        }
        if (e.y > PLAY + 32) { e.dead = true; e.deathTime = 0; continue; }
        if (this.touching(e, T.LAVA)) { e.dead = true; e.deathTime = 0; continue; }
        this.enemyVsPlayer(e, inp);
        if (this.mode !== 'playing') return;
      }
      // Inimigos que andam se viram ao se encontrar
      for (let i = 0; i < walkers.length; i++) for (let j = i + 1; j < walkers.length; j++) {
        const a = walkers[i], b = walkers[j];
        if (!a.dead && !b.dead && overlap(a, b)) {
          if (a.x < b.x) { a.dir = -1; b.dir = 1; } else { a.dir = 1; b.dir = -1; }
        }
      }
      l.enemies = l.enemies.filter(e => !e.dead || e.deathTime > 0);
    }
    reviveKoopa(e) {
      const p = this.player;
      if (p.carry === e) p.carry = null;
      e.held = false;
      e.type = 'koopa';
      const h = e.giant ? 48 : 24;
      e.y -= h - e.h;
      e.h = h;
      e.dir = p.x < e.x ? -1 : 1;
      e.shellTime = 0;
      e.grace = 0.3;
      if (this.colliders(e).length) e.y = Math.floor((e.y + e.h) / TILE) * TILE - e.h;
    }
    enemyVsPlayer(e, inp) {
      const p = this.player;
      if (p.pipe || p.carry === e) return;
      const box = e.type === 'piranha' ? e.hb : e;
      if (!box || box.h <= 0 || !overlap(p, box) || e.grace > 0) return;
      if (p.star > 0) { this.defeatEnemy(e, 'star', this.chainPoints(p, 'starChain')); return; }
      const stompable = !['piranha', 'fish'].includes(e.type) && !this.inWater(p);
      const stomp = stompable && p.vy > 0 && p.prevBottom <= e.y + 6 + (e.giant ? 6 : 0);
      if (stomp) {
        p.y = e.y - p.h;
        p.vy = -(inp.jump ? PHYS.bounceHold : PHYS.bounce);
        p.jumpHeld = !!inp.jump;
        p.grounded = false;
        const pts = this.chainPoints(p, 'chain');
        if (e.type === 'koopa') { this.toShell(e); this.award(pts, e.x, e.y); this.emit('stomp'); }
        else if (e.type === 'shell') {
          if (e.vx !== 0) { e.vx = 0; e.shellTime = 0; this.award(pts, e.x, e.y); this.emit('stomp'); }
          else this.kickShell(e, p.x + p.w / 2 < e.x + e.w / 2 ? 1 : -1);
        } else this.defeatEnemy(e, e.type === 'goomba' ? 'stomp' : 'fall', pts);
        return;
      }
      if (e.type === 'shell' && e.vx === 0) {
        if (inp.run && !p.carry && !this.inWater(p) && !e.giant) { p.carry = e; e.held = true; this.emit('select'); }
        else this.kickShell(e, p.x + p.w / 2 < e.x + e.w / 2 ? 1 : -1);
        return;
      }
      this.damage();
    }

    hurtBoss(amount) {
      const b = this.level.boss;
      if (!b || b.dead || b.invuln > 0) return;
      b.hp -= amount;
      b.invuln = amount >= 1 ? 1 : 0.12;
      b.hits = (b.hits || 0) + (amount >= 1 ? 1 : 0);
      this.emit(amount >= 1 ? 'stomp' : 'bump');
      if (b.hp <= 0) this.killBoss();
    }
    killBoss() {
      const l = this.level, b = l.boss;
      b.dead = true;
      this.award(b.type === 'bowser' ? 10000 : 2000, b.x, b.y);
      this.puff(b.x + 6, b.y + 6);
      this.projectiles = this.projectiles.filter(a => a.kind === 'fire');
      if (b.type === 'bowser') { this.clearStage('bowser'); return; }
      l.orb = { x: b.x + b.w / 2 - 8, y: Math.max(16, b.y - 24), w: 16, h: 16, vy: -160, ready: false, grounded: false, vx: 0, life: 0 };
      this.emit('orb');
    }
    updateBoss(dt) {
      const l = this.level, p = this.player, b = l.boss;
      if (l.orb) {
        const o = l.orb;
        o.life += dt;
        o.vy = Math.min(PHYS.maxFall, o.vy + PHYS.gravity * 0.6 * dt);
        this.moveBody(o, dt);
        if (o.life > 0.6) o.ready = true;
      }
      if (!b || b.dead) return;
      if (!b.awake) {
        if (p.x + p.w > l.arenaStart + 24 || (l.autoscroll && this.camera >= l.width - W - 1)) { b.awake = true; this.emit('bossAwake'); }
        else return;
      }
      b.invuln = Math.max(0, b.invuln - dt);
      b.timer -= dt;
      b.facing = p.x < b.x ? -1 : 1;
      const left = l.arenaStart + 8, right = l.width - b.w - 8;
      if (b.type === 'bowser') this.updateBowser(dt, b, left, right);
      else {
        const speed = 55 + (b.hits || 0) * 25;
        if (b.invuln > 0.5) b.vx = 0;
        else if (b.grounded) {
          b.vx = b.facing * speed;
          if (b.timer <= 0) { b.vy = -300; b.timer = 1.4 + ((b.hits || 0) % 2) * 0.4; this.emit('jump'); }
        }
        b.vy = Math.min(PHYS.maxFall, b.vy + PHYS.gravity * dt);
        this.moveBody(b, dt);
        b.x = clamp(b.x, left, right);
      }
      if (b.dead || this.mode !== 'playing') return;
      if (overlap(p, b)) {
        if (b.type === 'boss' && p.vy > 0 && p.prevBottom <= b.y + 10) {
          p.vy = -PHYS.bounceHold;
          p.y = b.y - p.h;
          p.jumpHeld = true;
          if (b.invuln <= 0) this.hurtBoss(1);
        } else if (b.type === 'bowser' || b.invuln <= 0.5) this.damage();
      }
    }
    updateBowser(dt, b, left, right) {
      const l = this.level, p = this.player;
      if (b.falling) {
        b.vy = Math.min(PHYS.maxFall, b.vy + PHYS.gravity * dt);
        b.y += b.vy * dt;
        if (b.y > PLAY + 16) { b.hp = 0; this.killBoss(); }
        return;
      }
      b.fireTimer -= dt;
      const wasAir = !b.grounded;
      if (b.grounded && b.timer <= 0) {
        const pc = p.x + p.w / 2, bc = b.x + b.w / 2;
        b.vy = -360;
        b.vx = clamp((pc - bc) / 0.9, -110, 110);
        b.pound = true;
        b.timer = 2.6;
        this.emit('jump');
      } else if (b.grounded) {
        b.vx = b.facing * 18;
        if (b.fireTimer <= 0) {
          b.fireTimer = 2.2;
          const dir = b.facing;
          this.projectiles.push({ kind: 'flame', x: dir < 0 ? b.x - 20 : b.x + b.w, y: b.y + 10, w: 22, h: 8, vx: dir * 80, vy: (p.y + p.h / 2 - (b.y + 14)) * 0.25, life: 7 });
          this.emit('flame');
        }
      }
      b.vy = Math.min(PHYS.maxFall, b.vy + PHYS.gravity * dt);
      this.moveBody(b, dt);
      b.x = clamp(b.x, left, right);
      if (wasAir && b.grounded && b.pound) {
        b.pound = false;
        b.vx = 0;
        this.shake = 0.35;
        this.debris(b.x + 8, b.y + b.h - 8, '#9c7466');
        this.emit('break');
        const y = Math.floor((b.y + b.h + 1) / TILE);
        const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.01) / TILE);
        for (let x = x0; x <= x1; x++) {
          if (this.tile(x, y) === T.BRICK) { this.setTile(x, y, T.EMPTY); this.debris(x * TILE, y * TILE, '#b06a4a'); }
        }
      }
      if (!b.grounded && b.vy > 0 && b.y + b.h > FLOOR * TILE + 8) {
        const x0 = Math.floor((b.x + 6) / TILE), x1 = Math.floor((b.x + b.w - 6) / TILE);
        let hole = true;
        for (let x = x0; x <= x1; x++) if (isSolid(this.tile(x, 12)) || isSolid(this.tile(x, 13))) hole = false;
        if (hole) { b.falling = true; this.emit('bowserFall'); }
      }
    }

    updateProjectiles(dt) {
      const p = this.player, l = this.level;
      for (const a of this.projectiles) {
        a.life -= dt;
        if (a.kind === 'fire') {
          if (!a.straight) a.vy = Math.min(PHYS.maxFall, a.vy + 1100 * dt);
          const before = a.vx;
          const hit = this.moveBody(a, dt);
          if (hit.hitX || a.vx !== before) { a.life = 0; this.particles.push({ kind: 'puff', x: a.x, y: a.y, vx: 0, vy: 0, life: 0.2 }); }
          if (a.straight && hit.hitY) a.life = 0;
          if (a.grounded) a.vy = -170;
          for (const e of l.enemies) {
            if (e.dead || e.held || (e.type === 'bullet' && !a.mega) || (e.type === 'piranha' && e.hidden)) continue;
            const box = e.type === 'piranha' ? e.hb : e;
            if (box && overlap(a, box)) { this.defeatEnemy(e, 'fire', 100); if (!a.pierce) { a.life = 0; break; } }
          }
          const b = l.boss;
          if (a.life > 0 && b && b.awake && !b.dead && overlap(a, b)) {
            a.life = 0;
            if (b.type === 'bowser') { b.hp -= a.mega ? 3 : 1; this.emit('bump'); if (b.hp <= 0) { b.falling = true; b.vy = -120; } }
            else this.hurtBoss(a.mega ? 0.5 : 0.2);
          }
        } else {
          a.x += a.vx * dt;
          a.y += a.vy * dt;
          if (overlap(a, p)) { this.damage(); if (this.mode !== 'playing') return; }
        }
      }
      this.projectiles = this.projectiles.filter(a => a.life > 0 && a.y < PLAY + 32 && a.y > -64 && a.x > this.camera - 64 && a.x < this.camera + W + 96);
    }

    updateParticles(dt) {
      for (const a of this.particles) {
        a.life -= dt;
        a.x += (a.vx || 0) * dt;
        a.y += (a.vy || 0) * dt;
        if (a.kind === 'debris') a.vy += 900 * dt;
        if (a.gravity) a.vy += a.gravity * dt;
      }
      this.particles = this.particles.filter(a => a.life > 0);
    }

    clearStage(kind) {
      if (this.mode !== 'playing') return;
      const l = this.level, p = this.player;
      if (l.bonus) return;
      if (kind === 'card' && l.boss && !l.boss.dead) return;
      const stage = this.currentStage;
      this.mode = 'clear';
      const card = kind === 'card' ? this.rouletteCard() : null;
      if (card) this.cards.push(card);
      if (p.carry) { p.carry.held = false; p.carry.dead = true; p.carry.deathTime = 0; p.carry = null; }
      p.star = 0;
      p.flight = 0;
      this.savedPower = p.power;
      if (!this.completed.includes(stage)) this.completed.push(stage);
      this.highest = Math.max(this.highest, Math.min(47, stage + 1));
      this.ending = { kind, card, timer: 0, total: kind === 'bowser' ? 5 : 4, tallyRate: Math.max(60, this.time / 1.6), bonus: null };
      const slot = stage % 6;
      this.emit(kind === 'bowser' ? 'victory' : slot === 5 ? 'worldClear' : 'clear');
    }
    stepClear(dt) {
      const e = this.ending, p = this.player;
      e.timer += dt;
      this.clock += dt;
      if (e.timer > 0.6 && this.time > 0) {
        const units = Math.min(this.time, e.tallyRate * dt);
        const before = Math.ceil(this.time);
        this.time = Math.max(0, this.time - units);
        this.score = Math.min(9999999, this.score + (before - Math.ceil(this.time)) * 50);
        if (before !== Math.ceil(this.time) && Math.floor(e.timer * 20) % 2 === 0) this.emit('tick');
      }
      if (e.kind === 'card') {
        p.vx = 70;
        p.facing = 1;
        p.vy = Math.min(PHYS.maxFall, p.vy + PHYS.gravity * dt);
        this.moveBody(p, dt);
        if (p.y > PLAY + 16) { p.y = PLAY + 16; p.vy = 0; }
      } else {
        p.vx = 0;
        p.vy = Math.min(PHYS.maxFall, p.vy + PHYS.gravity * dt);
        this.moveBody(p, dt);
      }
      this.updateParticles(dt);
      if (e.timer > 2.2 && !e.bonus && this.cards.length >= 3) {
        const match = this.cards.every(c => c === this.cards[0]);
        const lives = match ? CARD_BONUS[this.cards[0]] : 1;
        this.lives = Math.min(99, this.lives + lives);
        e.bonus = { lives, card: match ? this.cards[0] : null };
        this.cards = [];
        this.emit('oneup');
      }
      if (e.timer < e.total) return;
      const stage = this.currentStage;
      this.level = null;
      this.mainLevel = null;
      this.projectiles = [];
      this.particles = [];
      if (stage === 47) { this.mode = 'victory'; this.emit('save'); return; }
      if (stage % 6 === 5) {
        this.world = Math.min(7, this.world + 1);
        this.mapPos = 0;
        this.banner = { text: `MUNDO ${this.world + 1}`, sub: WORLDS[this.world].name, time: 3 };
      }
      this.mode = 'map';
      this.emit('map');
    }

    stepDying(dt) {
      const p = this.player;
      this.deathTimer += dt;
      if (this.deathTimer > 0.5 && !p.deathJump) { p.deathJump = true; p.vy = -270; }
      if (p.deathJump) { p.vy += 700 * dt; p.y += p.vy * dt; }
      if (this.deathTimer < 2.7) return;
      this.lives -= 1;
      this.level = null;
      this.mainLevel = null;
      this.projectiles = [];
      this.particles = [];
      this.savedPower = 'small';
      if (this.lives <= 0) {
        this.lives = 0;
        this.mode = 'gameover';
        this.emit('gameover');
      } else {
        this.mode = 'map';
        this.emit('map');
      }
    }

    /* ------------------------ Códigos secretos ------------------------ */
    applyCheat(raw) {
      const code = String(raw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const mode = this.mode === 'paused' ? this.beforePause : this.mode;
      const inLevel = ['playing'].includes(mode) && this.level;
      const onMap = mode === 'map';
      if (!inLevel && !onMap) return { ok: false, label: 'Use os códigos no mapa ou durante a fase' };
      const toggle = (key, name) => {
        this.cheats[key] = !this.cheats[key];
        return { ok: true, label: `${name}: ${this.cheats[key] ? 'LIGADO' : 'DESLIGADO'}` };
      };
      const power = (pw, label) => {
        if (inLevel) { if (this.player.power !== pw) this.grow(pw); this.freeze = 0; }
        this.savedPower = pw;
        return { ok: true, label };
      };
      let result;
      const world = code.match(/^MUNDO([1-8])$/);
      if (world) result = this.cheatWarp(Number(world[1]) - 1);
      else switch (code) {
        case 'PULAFASE': result = this.cheatSkip(); break;
        case 'PULAMUNDO': result = this.cheatSkipWorld(); break;
        case 'COGUMELO':
          for (let i = 0; i < 5; i++) this.addItem('mushroom');
          if ((inLevel ? this.player.power : this.savedPower) === 'small') power('big', '');
          result = { ok: true, label: 'Cogumelos! +5 no inventário' };
          break;
        case 'FOLHA': result = power('raccoon', 'Mario Guaxinim'); break;
        case 'FLOR': result = power('fire', 'Mario de Fogo'); break;
        case 'ESTRELA':
          if (inLevel) { this.player.star = 20; this.player.starChain = 0; } else this.pendingStar = 20;
          result = { ok: true, label: 'Estrela por 20 segundos' };
          break;
        case 'VIDAEXTRA': this.lives = Math.min(99, this.lives + 10); result = { ok: true, label: '+10 vidas' }; break;
        case 'VOARSEMPRE': result = toggle('fly', 'Voo infinito'); break;
        case 'TIROLIVRE': result = toggle('fire', 'Tiro em qualquer forma'); break;
        case 'TIROTRIPLO': result = toggle('triple', 'Tiro triplo'); break;
        case 'MEGATIRO': result = toggle('mega', 'Megatiro perfurante'); break;
        case 'INVENCIVEL': result = toggle('invincible', 'Invencível'); break;
        case 'NORMAL':
          for (const k of Object.keys(this.cheats)) this.cheats[k] = false;
          result = { ok: true, label: 'Códigos desligados' };
          break;
        default: result = { ok: false, label: 'Código inválido' };
      }
      this.emit(result.ok ? 'cheat' : 'bump');
      return result;
    }
    activeCheats() { return Object.keys(this.cheats).filter(k => this.cheats[k]); }
    cheatSkip() {
      const mode = this.mode === 'paused' ? this.beforePause : this.mode;
      if (this.mode === 'paused') this.resume();
      if (mode === 'playing') {
        if (this.level.bonus) this.level = this.mainLevel;
        const b = this.level.boss;
        if (b && !b.dead) {
          b.dead = true;
          if (b.type === 'bowser') { this.clearStage('bowser'); return { ok: true, label: 'Bowser derrotado!' }; }
        }
        this.clearStage(b ? 'orb' : 'card');
        return { ok: true, label: 'Fase concluída' };
      }
      let pos = this.mapPos;
      while (pos < MAP_NODES.length && (MAP_NODES[pos].kind !== 'stage' || this.isCompleted(this.world * 6 + MAP_NODES[pos].slot))) pos++;
      if (pos >= MAP_NODES.length) return this.cheatSkipWorld();
      const stage = this.world * 6 + MAP_NODES[pos].slot;
      this.completed.push(stage);
      this.highest = Math.max(this.highest, Math.min(47, stage + 1));
      this.mapAnim = null;
      this.mapPos = pos;
      if (stage % 6 === 5) this.finishWorld();
      return { ok: true, label: `${stageName(stage)} concluída` };
    }
    cheatSkipWorld() {
      if (this.mode === 'paused') this.resume();
      for (let s = this.world * 6; s < this.world * 6 + 6; s++) if (!this.completed.includes(s)) this.completed.push(s);
      this.highest = Math.max(this.highest, Math.min(47, this.world * 6 + 6));
      this.level = null;
      this.mainLevel = null;
      this.player = null;
      this.mode = 'map';
      this.finishWorld();
      return { ok: true, label: 'Mundo concluído' };
    }
    finishWorld() {
      if (this.world >= 7) { this.mode = 'victory'; this.emit('victory'); return; }
      this.world += 1;
      this.mapPos = 0;
      this.mapAnim = null;
      this.banner = { text: `MUNDO ${this.world + 1}`, sub: WORLDS[this.world].name, time: 3 };
      this.emit('map');
    }
    cheatWarp(w) {
      if (this.mode === 'paused') this.resume();
      for (let s = 0; s < w * 6; s++) if (!this.completed.includes(s)) this.completed.push(s);
      this.highest = Math.max(this.highest, w * 6);
      this.level = null;
      this.mainLevel = null;
      this.player = null;
      this.mode = 'map';
      this.world = w;
      this.mapPos = 0;
      this.mapAnim = null;
      this.banner = { text: `MUNDO ${w + 1}`, sub: WORLDS[w].name, time: 3 };
      this.emit('map');
      return { ok: true, label: `Indo para o Mundo ${w + 1}` };
    }

    // Estado mínimo para busca automática nos testes de jogabilidade.
    snapshot() {
      return {
        player: { ...this.player, carry: null, pipe: null }, camera: this.camera, clock: this.clock, time: this.time,
        mode: this.mode, prev: { ...this.prev }, freeze: this.freeze, platforms: this.level.platforms.map(p => ({ ...p }))
      };
    }
    restore(s) {
      this.player = { ...s.player };
      this.camera = s.camera;
      this.clock = s.clock;
      this.time = s.time;
      this.mode = s.mode;
      this.prev = { ...s.prev };
      this.freeze = s.freeze;
      this.level.platforms = s.platforms.map(p => ({ ...p }));
      this.ending = null;
    }
  }

  function migrateV1(s) {
    if (!Number.isInteger(s.highest) || s.highest < 0 || s.highest > 47) return null;
    if (!Number.isInteger(s.stage) || s.stage < 0 || s.stage > s.highest) return null;
    const completed = Array.isArray(s.completed) ? s.completed.filter(n => Number.isInteger(n) && n >= 0 && n < 48 && n <= s.highest) : [];
    const world = Math.floor(s.stage / 6);
    let mapPos = 0;
    while (mapPos < MAP_NODES.length - 1) {
      const n = MAP_NODES[mapPos];
      if (n.kind === 'stage' && !completed.includes(world * 6 + n.slot)) break;
      mapPos++;
    }
    return {
      version: 2, world, mapPos, completed, toadOpened: Array.isArray(s.toadVisits) ? s.toadVisits : [],
      lives: s.lives, score: s.score, coins: s.coins, cards: s.cards, inventory: s.inventory, power: s.power
    };
  }

  globalThis.MarioCore = Object.freeze({
    MarioGame, createLevel, createBonusRoom, WORLDS, T, TILE, ROWS, FLOOR, W, H, PLAY, PHYS, CHAIN, CARDS, ITEMS,
    MAP_NODES, TOAD_ITEMS, stageName, clamp, overlap, isSolid, isOneWay
  });
})();
