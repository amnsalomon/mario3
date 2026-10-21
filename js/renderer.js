/* Renderização em Canvas 2D: superfície de 1536×1024 para um espaço de jogo de 384×256. */
(() => {
  'use strict';

  const { WORLDS, T, TILE, MAP_NODES, FLOOR } = MarioCore;
  const ITEM_NAMES = { mushroom: 'Cogumelo', leaf: 'Folha', flower: 'Flor de fogo', star: 'Estrela' };
  const BOX_COLORS = [
    ['#f3b590', '#fff0ce', '#c47a55'],
    ['#9fd3e8', '#e8f8ff', '#5f9fbe'],
    ['#b9e3a1', '#effbe3', '#76ad5e'],
    ['#f5d36b', '#fff4c4', '#c99a2e']
  ];

  class MarioRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.c = canvas.getContext('2d');
      if (this.c && 'imageSmoothingEnabled' in this.c) this.c.imageSmoothingEnabled = false;
      if (this.c && this.c.setTransform) this.c.setTransform(4, 0, 0, 4, 0, 0);
      this.scenery = new MarioScenery(this);
      this.shapes = new Map();
      this.canCache = typeof this.c.drawImage === 'function';
      this.preview = new MarioCore.MarioGame();
      this.preview.enterStage(0);
      this.preview.player.x = 64;
    }

    rect(x, y, w, h, color) {
      this.c.fillStyle = color;
      this.c.fillRect(Math.floor(x), Math.floor(y), w, h);
    }
    text(t, x, y, color = '#fff', size = 8, align = 'left') {
      this.c.font = `bold ${size}px monospace`;
      this.c.textBaseline = 'top';
      if ('textAlign' in this.c) this.c.textAlign = align;
      this.c.fillStyle = '#0b1220';
      this.c.fillText(t, Math.floor(x) + 1, Math.floor(y) + 1);
      this.c.fillStyle = color;
      this.c.fillText(t, Math.floor(x), Math.floor(y));
      if ('textAlign' in this.c) this.c.textAlign = 'left';
    }
    sprite(type, x, y, opts = {}) { MarioSprites.draw(this.c, type, Math.floor(x), Math.floor(y), opts); }

    // Forma estática desenhada uma vez (em 4×) e reaproveitada.
    blit(key, w, h, x, y, paint) {
      if (this.canCache) {
        let cv = this.shapes.get(key);
        if (cv === undefined) {
          cv = MarioSprites.makeCanvas(Math.ceil(w * 4), Math.ceil(h * 4));
          if (cv) {
            const g = cv.getContext('2d');
            g.scale(4, 4);
            paint((xx, yy, ww, hh, c) => { g.fillStyle = c; g.fillRect(xx, yy, ww, hh); });
          }
          if (this.shapes.size < 600) this.shapes.set(key, cv);
        }
        if (cv) { this.c.drawImage(cv, Math.floor(x), Math.floor(y), w, h); return; }
      }
      paint((xx, yy, ww, hh, c) => this.rect(x + xx, y + yy, ww, hh, c));
    }

    draw(g, t) {
      const mode = g.mode === 'paused' ? g.beforePause : g.mode;
      if (g.mode === 'title') this.scene(this.preview, t);
      else if (mode === 'toad') this.toadHouse(g, t);
      else if (['map', 'gameover', 'victory'].includes(mode) || !g.level) this.map(g, t);
      else this.scene(g, t);
      this.hud(g, t);
    }

    /* ------------------------------ Fase ------------------------------ */
    scene(g, t) {
      const l = g.level, p = g.player, cam = Math.round(g.camera);
      this.scenery.draw(l, cam, t);
      const x0 = Math.max(0, Math.floor(cam / TILE) - 1), x1 = Math.min(l.cols, Math.ceil((cam + 384) / TILE) + 1);
      const boxTiles = new Set();
      for (const box of l.boxes) {
        if (box.x1 * TILE < cam - 8 || box.x0 * TILE > cam + 392) continue;
        this.semiBox(box, cam);
      }
      for (const box of l.boxes) for (let c = box.x0; c < box.x1; c++) boxTiles.add(c + ',' + box.top);
      // Atrás dos blocos e canos: piranhas, itens nascendo e o Mario dentro do cano.
      for (const e of l.enemies) {
        if (e.type !== 'piranha' || e.dead || e.hidden) continue;
        this.sprite('piranha', e.x - cam, e.y, { frame: Math.floor(t * 4) % 2 });
      }
      for (const it of l.items) if (it.emerge > 0) this.sprite(it.type, it.x - cam, it.y, { frame: Math.floor(t * 8) % 2 });
      if (p && p.pipe) this.player(g, t, cam);
      this.tiles(l, cam, t, x0, x1, boxTiles);
      for (const pl of l.platforms) for (let x = 0; x < pl.w; x += 16) this.sprite('lift', pl.x - cam + x, pl.y);
      for (const c of l.coins) if (!c.taken && c.x - cam > -16 && c.x - cam < 400) this.sprite('coin', c.x - cam, c.y, { frame: Math.floor(t * 8) % 4 });
      for (const it of l.items) if (!it.emerge) this.sprite(it.type, it.x - cam, it.y, { frame: Math.floor(t * 8) % 2 });
      for (const e of l.enemies) if (e.type !== 'piranha') this.enemy(e, cam, t);
      if (l.boss) this.boss(l.boss, cam, t, g);
      if (l.orb) this.sprite('orb', l.orb.x - cam, l.orb.y, { frame: Math.floor(t * 6) % 2 });
      if (l.goal) this.goal(g, l, cam, t);
      for (const a of g.projectiles) {
        if (a.kind === 'fire') this.sprite('fireball', a.x - cam, a.y, { frame: Math.floor(t * 12) % 2 });
        else if (a.kind === 'flame') this.sprite('flame', a.x - cam, a.y - 1, { frame: Math.floor(t * 10) % 2, facing: a.vx < 0 ? 1 : -1 });
        else this.rect(a.x - cam, a.y, a.w, a.h, '#f6cf5c');
      }
      if (p && !p.pipe) this.player(g, t, cam);
      for (const a of g.particles) {
        if (a.kind === 'text') this.text(a.text, a.x - cam, a.y, '#fff', 7);
        else if (a.kind === 'coin') this.sprite('coin', a.x - cam, a.y, { frame: Math.floor(t * 16) % 4 });
        else if (a.kind === 'puff') { this.rect(a.x - cam, a.y, 6, 6, '#f4f1e6'); this.rect(a.x - cam + 1, a.y + 1, 4, 4, '#ffffff'); }
        else this.rect(a.x - cam, a.y, 5, 5, a.color || '#dfa04b');
      }
      if (l.water) {
        const xEnd = Math.min(384, l.water.x1 - cam);
        if (xEnd > 0) this.rect(0, l.water.top, xEnd, 224 - l.water.top, 'rgba(40,120,200,0.18)');
      }
      if (l.endX && l.endX - cam < 384) {
        const ex = Math.max(0, l.endX - cam);
        this.rect(ex, 0, 384 - ex, 224, 'rgba(6,10,20,0.92)');
      }
      if (g.ending && g.mode !== 'title') this.endingBanner(g, t);
    }

    tiles(l, cam, t, x0, x1, boxTiles) {
      const names = { 2: 'brick', 3: 'question', 4: 'used', 5: 'castle', 11: 'ice', 12: 'wood', 14: 'lava', 15: 'cannon', 16: 'sand', 17: 'cloud', 19: 'cannonbase' };
      const parts = { 6: 'top-left', 7: 'top-right', 8: 'body-left', 9: 'body-right' };
      for (let y = 0; y < 14; y++) for (let x = x0; x < x1; x++) {
        const tile = l.tiles[y][x];
        if (!tile || tile === T.HIDDEN || tile === T.SEMI_BODY) continue;
        const sx = x * TILE - cam, sy = y * TILE;
        if (tile === T.GROUND) { this.scenery.ground(l, x, y, sx, sy); continue; }
        if (tile === T.SEMI) { if (!boxTiles.has(x + ',' + y)) this.sprite('platform', sx, sy); continue; }
        if (tile >= 6 && tile <= 9) { this.sprite('pipe', sx, sy, { part: parts[tile] }); continue; }
        if (tile === T.SPIKE) {
          const hanging = l.tiles[y - 1] && MarioCore.isSolid(l.tiles[y - 1][x]) && !(l.tiles[y + 1] && MarioCore.isSolid(l.tiles[y + 1][x]));
          this.sprite('spike', sx, sy, { flipY: hanging });
          continue;
        }
        const data = l.blocks[x + ',' + y];
        const bump = data && data.bump ? Math.sin((data.bump / 0.18) * Math.PI) * 4 : 0;
        if (data && data.group) {
          const grp = l.groups[data.group];
          if (grp && (grp.x !== x || grp.y !== y)) continue;
          this.sprite(names[tile], sx, sy - bump, { theme: l.theme, frame: Math.floor(t * 5) % 2, scale: 2 });
          continue;
        }
        if (tile === T.LAVA) { this.sprite('lava', sx, sy, { frame: Math.floor(t * 4) % 4 }); continue; }
        this.sprite(names[tile], sx, sy - bump, { theme: l.theme, frame: tile === T.SAND ? Math.floor(t * 2) % 8 : Math.floor(t * 5) % 2 });
        if (l.theme === 'tank' && tile === T.STONE && y === 11) this.wheel(sx, sy, t);
      }
    }

    wheel(x, y, t) {
      const spin = Math.floor(t * 8) % 2;
      this.rect(x + 2, y + 4, 12, 12, '#16131d');
      this.rect(x + 4, y + 6, 8, 8, '#4a4552');
      this.rect(x + 7, y + 5 + spin * 5, 2, 2, '#a7a3b8');
      this.rect(x + 7, y + 9, 2, 2, '#16131d');
    }

    semiBox(box, cam) {
      const [fill, light, dark] = BOX_COLORS[box.color % BOX_COLORS.length];
      const x = box.x0 * TILE - cam, y = box.top * TILE, w = (box.x1 - box.x0) * TILE, h = (FLOOR - box.top) * TILE;
      this.rect(x + 4, y + 4, w, h - 4, 'rgba(20,30,40,0.35)');
      this.rect(x, y, w, h, '#202b3d');
      this.rect(x + 1, y + 1, w - 2, h - 1, fill);
      this.rect(x + 2, y + 2, w - 4, 2, light);
      this.rect(x + w - 3, y + 3, 2, h - 3, dark);
      for (const xx of [x + 4, x + w - 6]) for (const yy of [y + 4, y + h - 6]) { this.rect(xx, yy, 2, 2, '#314351'); this.rect(xx, yy, 1, 1, '#f3f1d8'); }
    }

    enemy(e, cam, t) {
      const x = e.x - cam;
      if (x < -64 || x > 420) return;
      if (e.dead && e.deathTime <= 0) return;
      const scale = e.giant ? 2 : 1;
      const dim = MarioSprites.dimensions(e.type);
      const frame = Math.floor(t * 6) % 2;
      const sx = x + (e.w - dim.w * scale) / 2, sy = e.y + e.h - dim.h * scale;
      if (e.dead && e.deathKind === 'stomp') {
        if (this.c.save) {
          this.c.save();
          this.c.translate(Math.floor(sx), Math.floor(e.y + e.h - (dim.h * scale) / 2));
          this.c.scale(1, 0.5);
          this.sprite(e.type, 0, 0, { frame: 0, scale });
          this.c.restore();
        } else this.sprite(e.type, sx, sy, { frame: 0, scale });
        return;
      }
      if (e.type === 'bullet') { this.sprite('bullet', sx, sy, { facing: e.vx > 0 ? -1 : 1, flipY: e.dead }); return; }
      const facing = e.type === 'fish' ? (e.vx < 0 ? 1 : -1) : (e.vx || e.dir) < 0 ? -1 : 1;
      this.sprite(e.type, sx, sy, { frame: e.type === 'shell' ? 0 : frame, facing, scale, flipY: e.dead });
    }

    boss(b, cam, t, g) {
      if (b.dead && !b.falling) return;
      if (b.invuln > 0 && Math.floor(t * 16) % 2 && b.type !== 'bowser') return;
      if (b.type === 'bowser') this.sprite('bowser', b.x - cam - 2, b.y, { frame: Math.floor(t * 4) % 2, facing: b.facing < 0 ? 1 : -1 });
      else this.sprite('boss', b.x - cam - 2, b.y + b.h - 32, { frame: Math.floor(t * 6) % 2, facing: g.player && g.player.x < b.x ? -1 : 1 });
    }

    goal(g, l, cam, t) {
      const q = l.goal, x = q.x - cam;
      if (x < -40 || x > 400) return;
      const taken = g.ending && g.ending.kind === 'card';
      this.rect(x - 2, q.y - 2, q.w + 4, q.h + 4, '#0b1220');
      this.rect(x, q.y, q.w, q.h, '#f9efd5');
      this.rect(x + 3, q.y + 3, q.w - 6, q.h - 6, '#0b1220');
      if (!taken) this.sprite(g.rouletteCard(), x + 5, q.y + 12);
      else {
        const rise = Math.min(1, g.ending.timer / 0.8) * 60;
        this.sprite(g.ending.card, x + 5, q.y + 12 - rise);
      }
    }

    endingBanner(g, t) {
      const e = g.ending;
      if (e.timer < 0.8) return;
      const title = e.kind === 'bowser' ? 'O REINO ESTÁ SALVO!' : 'FASE CONCLUÍDA!';
      this.rect(84, 50, 216, e.card ? 62 : 36, 'rgba(11,18,32,0.82)');
      this.text(title, 192, 58, '#fff1c9', 10, 'center');
      if (e.card) {
        this.text('VOCÊ GANHOU UMA CARTA', 172, 80, '#fff', 8, 'center');
        this.rect(266, 74, 22, 22, '#f9efd5');
        this.sprite(e.card, 269, 77);
      }
      if (e.bonus) {
        this.rect(84, 116, 216, 22, 'rgba(11,18,32,0.82)');
        this.text(`${e.bonus.lives} VIDA${e.bonus.lives > 1 ? 'S' : ''} EXTRA!`, 192, 122, '#ffd85d', 9, 'center');
      }
    }

    player(g, t, cam) {
      const p = g.player;
      if (!p) return;
      if (p.invuln > 0 && Math.floor(t * 16) % 2) return;
      if (g.freeze > 0 && Math.floor(t * 20) % 2) return;
      let state = 'idle';
      if (g.mode === 'dying') state = 'dead';
      else if (p.duck) state = 'duck';
      else if (p.tail > 0) state = 'tail';
      else if (!p.grounded && !p.pipe) state = p.flight > 0 || p.wag > 0 ? 'fly' : 'jump';
      else if (Math.abs(p.vx) > 8) state = 'walk';
      const dim = MarioSprites.dimensions('mario', p.power);
      const speed = Math.abs(p.vx) > 180 ? 20 : Math.abs(p.vx) > 120 ? 15 : 10;
      MarioSprites.drawMario(this.c, Math.floor(p.x - cam - 1), Math.floor(p.y + p.h - dim.h), {
        power: p.power, state, frame: Math.floor(t * speed) % 3, facing: p.facing, star: p.star > 0
      });
      if (p.carry) this.sprite('shell', p.carry.x - cam, p.carry.y, { facing: p.facing });
    }

    /* ------------------------------- Mapa ------------------------------- */
    map(g, t) {
      const w = WORLDS[g.world];
      this.rect(0, 0, 384, 224, '#26344c');
      this.rect(8, 8, 368, 208, '#f6dda0');
      this.rect(14, 30, 356, 180, w.land);
      this.text(`MUNDO ${g.world + 1} · ${w.name}`, 22, 14, '#26344c', 10);
      for (let y = 42; y < 186; y += 32) for (let x = 24; x < 368; x += 32) { this.rect(x, y, 3, 3, '#ffffff35'); this.rect(x + 8, y + 8, 2, 2, w.ink); }
      this.rect(16, 190, 352, 18, w.sea);
      for (let x = 18; x < 360; x += 16) this.rect(x + (Math.floor(t * 2) % 2) * 2, 196, 8, 2, '#d2f1e0');
      for (const [x, y] of [[60, 70], [200, 150], [310, 120], [120, 60], [340, 160]]) {
        this.rect(x + 5, y + 13, 4, 7, '#795139');
        this.blit('tree' + g.world, 18, 17, x, y, (b) => {
          MarioScenery.oval(b, 0, 0, 18, 17, '#285a3d');
          MarioScenery.oval(b, 2, 1, 14, 12, g.world === 5 ? '#e7f5ea' : g.world === 7 ? '#6d5a72' : '#91d764');
          b(6, 5, 2, 4, '#284238'); b(11, 5, 2, 4, '#284238');
        });
      }
      // Caminho
      for (let i = 1; i < MAP_NODES.length; i++) {
        const a = MAP_NODES[i - 1], b = MAP_NODES[i];
        const open = g.isPassable(i - 1);
        const col = open ? '#fff3c4' : '#e8cf92';
        if (a.y === b.y) this.rect(Math.min(a.x, b.x) + 8, a.y + 7, Math.abs(b.x - a.x), 6, col);
        else this.rect(a.x + 7, Math.min(a.y, b.y) + 8, 6, Math.abs(b.y - a.y), col);
      }
      let reach = 0;
      while (reach < MAP_NODES.length - 1 && g.isPassable(reach)) reach++;
      MAP_NODES.forEach((n, i) => this.mapNode(g, n, i, i <= reach, t));
      // Mario no mapa, na forma atual
      let mx, my;
      const nodeAt = i => MAP_NODES[i];
      if (g.mapAnim) {
        const a = nodeAt(g.mapAnim.from), b = nodeAt(g.mapAnim.to), k = Math.min(1, g.mapAnim.t);
        mx = a.x + (b.x - a.x) * k; my = a.y + (b.y - a.y) * k;
      } else { mx = nodeAt(g.mapPos).x; my = nodeAt(g.mapPos).y; }
      const big = g.savedPower !== 'small';
      MarioSprites.drawMario(this.c, Math.floor(mx + 2), Math.floor(my - (big ? 22 : 12) - (g.mapAnim ? 0 : Math.abs(Math.sin(t * 4)) * 2)), {
        power: g.savedPower, state: g.mapAnim ? 'walk' : 'idle', frame: Math.floor(t * 8) % 3, facing: g.mapAnim && nodeAt(g.mapAnim.to).x < nodeAt(g.mapAnim.from).x ? -1 : 1,
        star: g.pendingStar > 0
      });
      const n = g.node;
      const label = n.kind === 'start' ? 'INÍCIO' : n.kind === 'toad' ? (g.toadOpened.includes(g.world) ? 'CASA DO TOAD (VISITADA)' : 'CASA DO TOAD') : g.stageName(g.world * 6 + n.slot).toUpperCase() + (g.isCompleted(g.world * 6 + n.slot) ? ' ✓' : '');
      this.text(label, 192, 195, '#fff', 8, 'center');
      if (g.banner) {
        this.rect(92, 84, 200, 48, 'rgba(11,18,32,0.88)');
        this.text(g.banner.text, 192, 92, '#ffd85d', 14, 'center');
        if (g.banner.sub) this.text(g.banner.sub, 192, 112, '#fff', 8, 'center');
      }
    }

    mapNode(g, n, i, open, t) {
      const { x, y } = n;
      if (n.kind === 'start') {
        this.rect(x - 4, y + 2, 28, 16, '#26344c');
        this.rect(x - 2, y + 4, 24, 12, '#f5e7bf');
        this.text('IN', x + 3, y + 6, '#26344c', 7);
        return;
      }
      if (n.kind === 'toad') {
        const done = g.toadOpened.includes(g.world);
        this.blit('house' + (done ? 'd' : ''), 26, 30, x - 3, y - 10, (b) => {
          b(4, 11, 18, 18, done ? '#d8d0bf' : '#f8e1ae');
          MarioScenery.oval(b, 0, 0, 26, 20, done ? '#8f8a82' : '#b83e32');
          b(4, 4, 7, 5, '#fff1d4'); b(16, 2, 7, 5, '#fff1d4'); b(10, 19, 6, 10, '#4c4838');
        });
        return;
      }
      const stage = g.world * 6 + n.slot, done = g.isCompleted(stage);
      if (n.slot === 3) {
        if (done) { this.rect(x, y + 8, 20, 10, '#8f8a82'); this.rect(x + 3, y + 4, 6, 6, '#a6a198'); this.rect(x + 12, y + 2, 5, 8, '#a6a198'); return; }
        this.rect(x - 2, y - 2, 24, 22, '#26344c');
        this.rect(x, y + 3, 20, 15, open ? '#e6d2b3' : '#b9b0a0');
        for (let j = 0; j < 3; j++) this.rect(x + 1 + j * 7, y - 1, 5, 5, open ? '#e6d2b3' : '#b9b0a0');
        this.rect(x + 7, y + 10, 6, 8, '#253047');
        return;
      }
      if (n.slot === 5) {
        if (g.world === 7) {
          this.rect(x - 4, y - 8, 28, 28, '#26344c');
          this.rect(x - 2, y - 2, 24, 20, '#5b4b66');
          for (let j = 0; j < 4; j++) this.rect(x - 2 + j * 7, y - 6, 4, 5, '#5b4b66');
          this.rect(x + 7, y + 8, 7, 10, '#e0562f');
          return;
        }
        this.sprite('ship', x - 2, y - 2 + Math.round(Math.sin(t * 2) * 2));
        return;
      }
      this.rect(x - 4, y - 4, 28, 28, '#26344c');
      this.rect(x - 2, y - 2, 24, 24, done ? '#e9513e' : open ? '#edb14b' : '#657365');
      const label = done ? 'M' : ['1', '2', '3', '', '4'][n.slot];
      this.text(label, x + 10, y + 3, done ? '#fff1c9' : open ? '#26344c' : '#abb4a5', 12, 'center');
    }

    /* --------------------------- Casa do Toad --------------------------- */
    toadHouse(g, t) {
      const td = g.toad;
      this.rect(0, 0, 384, 224, '#c98b54');
      for (let y = 0; y < 184; y += 12) { this.rect(0, y, 384, 1, '#a46a3c'); for (let x = (y / 12) % 2 ? 0 : 24; x < 384; x += 48) this.rect(x, y, 1, 12, '#a46a3c'); }
      this.rect(0, 184, 384, 40, '#6e4329');
      this.rect(0, 184, 384, 3, '#8c5a37');
      this.rect(120, 24, 144, 30, 'rgba(11,18,32,0.85)');
      this.text('CASA DO TOAD', 192, 28, '#ffd85d', 10, 'center');
      this.text(td && td.opened >= 0 ? `VOCÊ GANHOU: ${ITEM_NAMES[td.item].toUpperCase()}!` : 'ESCOLHA UM BAÚ', 192, 42, '#fff', 7, 'center');
      if (!td) return;
      const xs = [112, 184, 256];
      xs.forEach((x, i) => {
        this.sprite(td.opened === i ? 'chestopen' : 'chest', x, 168, {});
        if (td.opened === i) {
          const rise = Math.min(1, (2 - td.timer) / 0.6) * 30;
          this.sprite(td.item, x, 150 - rise, { frame: Math.floor(t * 8) % 2 });
        }
      });
      if (td.opened < 0) {
        const cx = xs[td.cursor] + 8;
        const bob = Math.floor(t * 4) % 2;
        this.rect(cx - 4, 140 + bob, 8, 3, '#fff1c9');
        this.rect(cx - 2, 143 + bob, 4, 3, '#fff1c9');
      }
      const mx = xs[td.opened >= 0 ? td.opened : td.cursor];
      const big = g.savedPower !== 'small';
      MarioSprites.drawMario(this.c, mx, 184 - (big ? 28 : 16) - 18, { power: g.savedPower, state: 'idle', frame: 0, facing: 1 });
    }

    /* -------------------------------- HUD -------------------------------- */
    hud(g, t) {
      this.rect(0, 224, 384, 32, '#17223c');
      this.rect(4, 227, 280, 26, '#f5e7bf');
      this.rect(6, 229, 276, 22, '#17223c');
      if ((g.mode === 'map' || (g.mode === 'paused' && g.beforePause === 'map')) && g.invOpen) { this.inventoryBar(g, t); }
      else {
        this.text(`W${g.world + 1}`, 10, 231, '#fff1c9', 7);
        const p = g.player && g.inLevel ? g.player : null;
        const pm = p ? p.pm : 0;
        for (let i = 0; i < 6; i++) this.text('>', 34 + i * 7, 231, i < pm ? '#f9d36a' : '#647084', 7);
        const full = pm >= 7;
        this.rect(78, 231, 14, 8, full && Math.floor(t * 8) % 2 ? '#f9d36a' : '#2a3654');
        this.text('P', 82, 231, full ? '#17223c' : '#647084', 7);
        this.text('$' + String(g.coins).padStart(2, '0'), 214, 231, '#ffda74', 7);
        this.text('M×' + String(g.lives).padStart(2, '0'), 10, 241, '#fff', 7);
        this.text(String(g.score).padStart(7, '0'), 64, 241, '#fff', 7);
        const time = g.inLevel ? Math.ceil(g.time) : 0;
        this.text('⏱' + String(time).padStart(3, '0'), 210, 241, g.hurry && g.inLevel ? '#ff8060' : '#fff', 7);
      }
      for (let i = 0; i < 3; i++) {
        const x = 292 + i * 30;
        this.rect(x, 227, 26, 26, '#f5e7bf');
        this.rect(x + 2, 229, 22, 22, '#17223c');
        if (g.cards[i]) this.sprite(g.cards[i], x + 5, 232);
      }
    }

    inventoryBar(g, t) {
      const items = g.inventory;
      const start = Math.max(0, Math.min(g.invCursor - 3, items.length - 7));
      this.text('ITENS', 10, 231, '#fff1c9', 7);
      this.text(`${g.invCursor + 1}/${items.length}`, 10, 241, '#9fb1cc', 7);
      for (let i = 0; i < 7; i++) {
        const idx = start + i, item = items[idx];
        const x = 60 + i * 30;
        this.rect(x, 229, 22, 22, idx === g.invCursor && Math.floor(t * 6) % 2 ? '#f9d36a' : '#2a3654');
        if (item) this.sprite(item, x + 3, 232);
      }
    }
  }

  globalThis.MarioRenderer = MarioRenderer;
})();
