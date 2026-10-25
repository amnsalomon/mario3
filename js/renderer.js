/* Renderização em alta definição. O jogo usa uma área lógica de 448×256 (quase 16:9) e o canvas
 * acompanha a resolução real da tela (pixels de dispositivo), então tudo fica nítido em HD,
 * Full HD, retina e 4K. Cenários, blocos, efeitos e interface são vetoriais (MarioHD);
 * personagens e itens mantêm os desenhos em pixel art de sprites.js. */
(() => {
  'use strict';

  const { WORLDS, T, TILE, MAP_NODES, FLOOR, W, H } = MarioCore;
  const HD = MarioHD;
  const PH = 224;
  const MAP_X = (W - 384) / 2; // o mapa foi desenhado em 384 de largura e fica centralizado
  const ITEM_NAMES = { mushroom: 'Cogumelo', leaf: 'Folha', flower: 'Flor de fogo', star: 'Estrela' };
  const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace';
  const TREE_TINTS = {
    5: ['#ffffff', '#cfe6f2', '#7fa9c4'],
    7: ['#b48fc0', '#6d5a72', '#3a2a40'],
    default: ['#c8f59a', '#6fc24f', '#2f7a34']
  };

  // Bloco em qualquer linha, incluindo o céu acima da tela (y negativo).
  const tileAt = (l, x, y) => {
    if (x < 0 || x >= l.cols || y >= 14) return 0;
    if (y >= 0) return l.tiles[y][x];
    const r = l.sky && l.sky[y + (l.skyRows || 0)];
    return r ? r[x] : 0;
  };

  // Contexto "de mentira" usado quando não há canvas fora da tela (testes em Node):
  // mantém só os retângulos, com deslocamento, e ignora o resto.
  function fallbackContext(base, ox, oy) {
    const grad = { addColorStop() {} };
    const noop = () => {};
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'fillRect') return (x, y, w, h) => base.fillRect(ox + x, oy + y, w, h);
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
        return noop;
      },
      set(_, prop, value) { if (prop === 'fillStyle') base.fillStyle = value; return true; }
    });
  }

  class MarioRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.c = canvas.getContext('2d');
      this.shapes = new Map();
      this.canCache = typeof this.c.drawImage === 'function';
      this.scale = 0;
      this.setScale(Math.round((canvas.width || W * 4) / W) || 4);
      this.scenery = new MarioScenery(this);
      this.preview = new MarioCore.MarioGame();
      this.preview.enterStage(0);
      this.preview.player.x = 64;
    }

    // Ajusta a resolução interna (pixels de dispositivo por pixel do jogo).
    setScale(s) {
      const n = Math.max(1, Math.min(10, Math.round(s)));
      if (n === this.scale) return false;
      this.scale = n;
      if (this.canvas.width !== W * n) this.canvas.width = W * n;
      if (this.canvas.height !== H * n) this.canvas.height = H * n;
      if (this.c.setTransform) this.c.setTransform(n, 0, 0, n, 0, 0);
      if ('imageSmoothingEnabled' in this.c) this.c.imageSmoothingEnabled = false;
      this.shapes.clear();
      MarioSprites.setScale(n);
      return true;
    }

    rect(x, y, w, h, color) {
      this.c.fillStyle = color;
      this.c.fillRect(x, y, w, h);
    }
    text(t, x, y, color = '#fff', size = 8, align = 'left', weight = 800) {
      const c = this.c;
      c.font = `${weight} ${size}px ${FONT}`;
      c.textBaseline = 'top';
      if ('textAlign' in c) c.textAlign = align;
      const dark = /^#[0-4]/.test(color);
      if (dark && typeof c.fillText === 'function') {
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.fillText(t, x + 0.6, y + 0.6);
      } else if (typeof c.strokeText === 'function') {
        c.lineJoin = 'round';
        c.lineWidth = Math.max(1.5, size * 0.28);
        c.strokeStyle = 'rgba(8,12,24,0.85)';
        c.strokeText(t, x, y);
      } else {
        c.fillStyle = '#0b1220';
        c.fillText(t, x + 1, y + 1);
      }
      c.fillStyle = color;
      c.fillText(t, x, y);
      if ('textAlign' in c) c.textAlign = 'left';
    }
    sprite(type, x, y, opts = {}) { MarioSprites.draw(this.c, type, Math.round(x), Math.round(y), opts); }

    // Forma desenhada uma vez na resolução atual e reaproveitada.
    blit(key, w, h, x, y, paint, dw = w, dh = h, opaque = false) {
      if (this.canCache) {
        let cv = this.shapes.get(key);
        if (cv === undefined) {
          const s = this.scale;
          cv = MarioSprites.makeCanvas(Math.max(1, Math.ceil(w * s)), Math.max(1, Math.ceil(h * s)));
          if (cv) {
            const g = cv.getContext('2d', opaque ? { alpha: false } : undefined);
            g.scale(s, s);
            paint(g);
          }
          if (this.shapes.size > 900) this.shapes.clear();
          this.shapes.set(key, cv);
        }
        if (cv) { this.c.drawImage(cv, x, y, dw, dh); return; }
      }
      paint(fallbackContext(this.c, x, y));
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
      const l = g.level, p = g.player;
      const shake = g.shake > 0 && this.c.save ? (Math.random() - 0.5) * 4 * Math.min(1, g.shake * 4) : 0;
      if (shake && this.c.save) { this.c.save(); this.c.translate(shake, shake * 0.6); }
      const cam = Math.round(g.camera * this.scale) / this.scale;
      const camY = l.skyRows ? Math.round((g.cameraY || 0) * this.scale) / this.scale : 0;
      this.scenery.draw(l, cam, t, camY);
      const c = this.c, vertical = !!l.skyRows && typeof c.save === 'function';
      if (vertical) {
        c.save();
        c.beginPath();
        c.rect(0, 0, W, PH);
        c.clip();
        c.translate(0, -camY);
      }
      this.camY = camY;
      const x0 = Math.max(0, Math.floor(cam / TILE) - 1), x1 = Math.min(l.cols, Math.ceil((cam + W) / TILE) + 1);
      const boxTiles = new Set();
      for (const box of l.boxes) {
        for (let c = box.x0; c < box.x1; c++) boxTiles.add(c + ',' + box.top);
        if (box.x1 * TILE < cam - 8 || box.x0 * TILE > cam + W + 8) continue;
        this.semiBox(box, cam);
      }
      // Atrás dos blocos e canos: piranhas, itens nascendo e o Mario dentro do cano.
      for (const e of l.enemies) {
        if (e.type !== 'piranha' || e.dead || e.hidden) continue;
        if (e.fire) this.blit('fireGlow', 24, 24, e.x - cam - 4, e.y - 6, gg => HD.glow(gg, 12, 'rgba(255,150,60,0.5)', 'rgba(255,90,30,0)'));
        const rot = Math.sin(t * 3 + e.id) * 0.09;
        this.transformed(e.x - cam + 8, e.baseY, 8, e.baseY - e.y, rot, 1, 1, ox => this.sprite('piranha', ox, -(e.baseY - e.y), { frame: Math.floor(t * 4) % 2 }), true);
      }
      for (const it of l.items) if (it.emerge > 0) this.sprite(it.type, it.x - cam, it.y, { frame: Math.floor(t * 8) % 2 });
      if (p && p.pipe) this.player(g, t, cam);
      for (const sw of l.switches || []) if (sw.emerge > 0) this.blit('pswitch', 16, 16, sw.x - cam, sw.y, gg => HD.pswitch(gg, false));
      this.vines(l, cam, t);
      this.tiles(l, cam, t, x0, x1, boxTiles, camY);
      for (const sw of l.switches || []) if (!sw.emerge) this.blit('pswitch' + (sw.pressed ? 'P' : ''), 16, 16, sw.x - cam, sw.base - 16, gg => HD.pswitch(gg, sw.pressed));
      for (const pl of l.platforms) {
        if (pl.kind === 'fall') {
          if (pl.state === 3) continue;
          const jx = pl.state === 1 ? Math.sin(t * 90) * 0.8 : 0;
          this.blit('fragile', 32, 8, pl.x - cam + jx, pl.y, HD.fragile, pl.w, 8);
          continue;
        }
        for (let x = 0; x < pl.w; x += 16) this.blit('lift', 16, 8, pl.x - cam + x, pl.y, HD.lift);
      }
      const coinFrame = Math.floor(t * 10) % 8;
      for (const c of l.coins) {
        if (c.taken || c.x - cam < -16 || c.x - cam > W + 16) continue;
        this.blit('coin' + coinFrame, 8, 12, c.x - cam, c.y, gg => HD.coin(gg, coinFrame));
      }
      // sombras suaves no chão
      if (p && !p.pipe && g.mode !== 'dying') this.shadowUnder(l, p, cam);
      for (const e of l.enemies) if (!e.dead && e.type !== 'piranha' && e.type !== 'bullet' && e.type !== 'fish' && e.x - cam > -40 && e.x - cam < W + 40) this.shadowUnder(l, e, cam);
      for (const it of l.items) {
        if (it.emerge) continue;
        const rot = it.type === 'leaf' ? Math.sin(it.life * 3.2) * 0.4 : it.type === 'star' ? Math.sin(t * 9) * 0.15 : 0;
        const ky = it.type === 'star' && it.grounded ? 0.85 : 1;
        this.transformed(it.x - cam + 8, it.y + 16, 8, 16, rot, 1 / ky > 1 ? 1.08 : 1, ky, ox => this.sprite(it.type, ox, -16, { frame: Math.floor(t * 8) % 2 }), rot !== 0);
      }
      for (const e of l.enemies) if (e.type !== 'piranha') this.enemy(e, cam, t);
      if (l.boss) this.boss(l.boss, cam, t, g);
      if (l.orb) this.blit('orb' + (Math.floor(t * 6) % 2), 16, 16, l.orb.x - cam, l.orb.y, gg => HD.orb(gg, Math.floor(t * 6) % 2));
      if (l.goal) this.goal(g, l, cam, t);
      this.hazards(g, l, cam, t);
      for (const a of g.projectiles) {
        if (a.kind === 'fire') {
          const r = a.mega ? 12 : 8;
          this.blit('fireball' + (a.mega ? 'M' : ''), 16, 16, a.x + a.w / 2 - cam - r, a.y + a.h / 2 - r, gg => HD.fireball(gg, a.mega), r * 2, r * 2);
        } else if (a.kind === 'flame') {
          this.blit('flameHD', 24, 8, a.x - cam, a.y, HD.flame);
        } else if (a.kind === 'spit') {
          this.blit('fireball', 16, 16, a.x + a.w / 2 - cam - 6, a.y + a.h / 2 - 6, gg => HD.fireball(gg, false), 12, 12);
        } else this.rect(a.x - cam, a.y, a.w, a.h, '#f6cf5c');
      }
      if (p && !p.pipe) this.player(g, t, cam);
      for (const a of g.particles) this.particle(a, cam);
      if (l.water) this.waterOverlay(l, cam, t);
      if (l.endX && l.endX - cam < W) {
        const ex = Math.max(0, l.endX - cam);
        this.blit('endFade', 48, PH, ex - 48, camY, gg => {
          gg.fillStyle = HD.lin(gg, 0, 0, 48, 0, [[0, 'rgba(6,10,20,0)'], [1, 'rgba(6,10,20,0.94)']]);
          gg.fillRect(0, 0, 48, PH);
        });
        this.rect(ex, camY, W - ex, PH, 'rgba(6,10,20,0.94)');
      }
      if (vertical) c.restore();
      this.camY = 0;
      if (g.pTimer > 0 && g.mode !== 'title') this.pswitchBar(g, t);
      if (shake && this.c.save) this.c.restore();
      if (g.ending && g.mode !== 'title') this.endingBanner(g, t);
    }

    tiles(l, cam, t, x0, x1, boxTiles, camY = 0) {
      const parts = { 6: 'top-left', 7: 'top-right', 8: 'body-left', 9: 'body-right' };
      const lavaFrame = Math.floor(t * 8) % 8, sandFrame = Math.floor(t * 3) % 8;
      const y0 = Math.max(-(l.skyRows || 0), Math.floor(camY / TILE)), y1 = Math.min(14, Math.ceil((camY + PH) / TILE) + 1);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const tile = tileAt(l, x, y);
        if (!tile || tile === T.HIDDEN || tile === T.SEMI_BODY) continue;
        const sx = x * TILE - cam, sy = y * TILE;
        const data = l.blocks[x + ',' + y];
        const bump = data && data.bump ? Math.sin((data.bump / 0.18) * Math.PI) * 4 : 0;
        if (data && data.group) {
          const grp = l.groups[data.group];
          if (grp && (grp.x !== x || grp.y !== y)) continue;
          if (tile === T.BRICK) this.blit('brick2', 32, 32, sx, sy - bump, gg => { gg.scale(2, 2); HD.brick(gg); });
          else this.sprite(tile === T.QUESTION ? 'question' : 'used', sx, sy - bump, { frame: Math.floor(t * 5) % 2, scale: 2 });
          continue;
        }
        switch (tile) {
          case T.GROUND: this.scenery.ground(l, x, y, sx, sy); break;
          case T.BRICK: this.blit('brick', 16, 16, sx, sy - bump, HD.brick); break;
          case T.QUESTION: this.sprite('question', sx, sy - bump, { frame: Math.floor(t * 5) % 2 }); break;
          case T.USED: this.sprite('used', sx, sy - bump, {}); break;
          case T.STONE: { const v = (x * 7 + y * 3) % 9; this.blit(`stone-${l.theme}-${v}`, 16, 16, sx, sy, gg => HD.stone(gg, l.theme, v)); break; }
          case T.WOOD: this.blit('wood' + (l.theme === 'airship' ? 'A' : ''), 16, 16, sx, sy, gg => HD.wood(gg, l.theme === 'airship')); break;
          case T.ICE: this.blit('ice', 16, 16, sx, sy, HD.ice); break;
          case T.SEMI: if (!boxTiles.has(x + ',' + y)) this.blit('platformHD', 16, 16, sx, sy, HD.platform); break;
          case T.CLOUD: this.blit('cloudTile', 16, 12, sx, sy, HD.cloud); break;
          case T.SAND: this.blit('sand' + sandFrame, 16, 16, sx, sy, gg => HD.sand(gg, sandFrame)); break;
          case T.LAVA:
            this.blit('lava' + lavaFrame, 16, 16, sx, sy, gg => HD.lava(gg, lavaFrame));
            if (tileAt(l, x, y - 1) !== T.LAVA) this.blit('lavaGlow', 16, 24, sx, sy - 22, gg => {
              gg.fillStyle = HD.lin(gg, 0, 0, 0, 24, [[0, 'rgba(255,120,40,0)'], [1, 'rgba(255,140,50,0.45)']]);
              gg.fillRect(0, 0, 16, 24);
            });
            break;
          case T.SPIKE: {
            const hanging = MarioCore.isSolid(tileAt(l, x, y - 1)) && !MarioCore.isSolid(tileAt(l, x, y + 1));
            this.blit('spike' + (hanging ? 'D' : ''), 16, 16, sx, sy, gg => { if (hanging) { gg.translate(0, 16); gg.scale(1, -1); } HD.spike(gg); });
            break;
          }
          case T.CANNON: this.blit('cannon', 16, 16, sx, sy, HD.cannon); break;
          case T.CANNON_BASE: this.blit('cannonBase', 16, 16, sx, sy, HD.cannonBase); break;
          case T.BURNER: this.blit('burner', 16, 16, sx, sy, HD.burner); break;
          default:
            if (tile >= 6 && tile <= 9) this.blit('pipe' + tile, 16, 16, sx, sy, gg => HD.pipe(gg, parts[tile]));
        }
        if (l.theme === 'tank' && tile === T.STONE && y === 11) this.wheel(sx, sy, t);
      }
    }

    vines(l, cam, t) {
      for (const v of l.vines || []) {
        const x = v.x + v.w / 2 - 8 - cam;
        if (x < -20 || x > W + 4) continue;
        const h = v.bottom - v.top;
        if (h <= 0) continue;
        const sway = Math.sin(t * 2.2) * 0.6;
        for (let y = v.bottom - 16, i = 0; y > v.top - 1; y -= 16, i++) {
          const top = y <= v.top + 0.5;
          const yy = Math.max(v.top, y);
          if (top || y - 16 < v.top) this.blit('vineTop', 16, 16, x + sway, v.top, HD.vineTop);
          else this.blit('vine' + (i % 2), 16, 16, x + sway * (i % 2 ? 1 : -1) * 0.5, yy, gg => HD.vine(gg, i % 2));
          if (top) break;
        }
      }
    }

    hazards(g, l, cam, t) {
      const seen = x => x > cam - 64 && x < cam + W + 64;
      for (const f of l.firebars || []) {
        if (!seen(f.x)) continue;
        const balls = g.firebarBalls(f, g.clock);
        for (let i = 0; i < balls.length; i++) {
          const b = balls[i], r = i === 0 ? 4.5 : 5.5;
          this.blit('fireball', 16, 16, b.x - cam - r, b.y - r, gg => HD.fireball(gg, false), r * 2, r * 2);
        }
      }
      for (const b of l.bubbles || []) {
        if (!seen(b.x)) continue;
        const st = g.bubbleState(b, g.clock);
        if (!st) continue;
        const key = 'bubble' + (st.up ? '' : 'D');
        this.blit(key, 14, 16, st.x - cam, st.y, gg => { if (!st.up) { gg.translate(0, 16); gg.scale(1, -1); } HD.lavaBubble(gg); });
        if (st.up && Math.floor(t * 20) % 2) this.blit('sparkle', 8, 8, st.x - cam + 3, st.y + 14, HD.sparkle, 5, 5);
      }
      const ff = Math.floor(t * 16) % 4;
      for (const q of l.burners || []) {
        const x = q.tx * TILE - cam;
        if (x < -20 || x > W + 20) continue;
        const st = g.burnerState(q, g.clock);
        if (st.on) {
          const h = 46 * st.k;
          this.blit('burnGlow', 24, 24, x - 4, q.ty * TILE - h * 0.6 - 12, gg => HD.glow(gg, 12, 'rgba(255,170,80,0.45)', 'rgba(255,120,40,0)'), 24, 24);
          this.blit('burnFlame' + ff, 12, 48, x + 2, q.ty * TILE - h, gg => HD.burnFlame(gg, ff), 12, h);
        } else if (st.warm && Math.floor(t * 24) % 2) {
          this.blit('puff', 8, 8, x + 4, q.ty * TILE - 8, HD.puff, 8, 8);
        }
      }
      for (const c of l.crushers || []) {
        const x = c.x - cam;
        if (x < -40 || x > W + 8) continue;
        const jx = c.state === 'wait' && c.timer <= 0 && Math.abs(g.player.x + g.player.w / 2 - (c.x + 16)) < 70 ? Math.sin(t * 60) * 0.6 : 0;
        this.rect(x + jx + 15, c.baseY - 32, 2, Math.max(0, c.y - c.baseY + 32), 'rgba(40,40,50,0.6)');
        this.blit('crusher', 32, 32, x + jx, c.y, HD.crusher);
      }
    }

    pswitchBar(g, t) {
      const k = Math.min(1, g.pTimer / 10), w = 120, x = (W - w) / 2, y = 6;
      this.panel(x - 30, y - 2, w + 60, 14, 0.8);
      this.blit('pswitchIcon', 16, 16, x - 26, y - 1, gg => HD.pswitch(gg, false), 12, 12);
      this.rect(x, y + 3, w, 5, 'rgba(255,255,255,0.18)');
      this.rect(x, y + 3, w * k, 5, g.pTimer < 3 && Math.floor(t * 8) % 2 ? '#ffe27a' : '#5fd8f5');
      this.text(String(Math.ceil(g.pTimer)), x + w + 8, y + 1, '#fff', 8, 'left', 900);
    }

    wheel(x, y, t) {
      const f = Math.floor(t * 8) % 4;
      this.blit('wheel' + f, 16, 16, x, y + 2, g => {
        g.fillStyle = HD.rad(g, 8, 8, 1, 8, [[0, '#6d6779'], [0.7, '#36313f'], [1, '#16131d']]);
        HD.circle(g, 8, 8, 7);
        g.fill();
        g.strokeStyle = '#a7a3b8';
        g.lineWidth = 1;
        for (let k = 0; k < 2; k++) {
          const a = (f / 4) * Math.PI + k * Math.PI / 2;
          g.beginPath();
          g.moveTo(8 - Math.cos(a) * 5, 8 - Math.sin(a) * 5);
          g.lineTo(8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5);
          g.stroke();
        }
      });
    }

    shadowUnder(l, b, cam) {
      const cx = b.x + b.w / 2, foot = b.y + b.h;
      let gy = -1;
      for (let ty = Math.floor(foot / TILE); ty < Math.min(14, Math.floor(foot / TILE) + 6); ty++) {
        const t0 = tileAt(l, Math.floor(cx / TILE), ty);
        if (t0 && (MarioCore.isSolid(t0) || MarioCore.isOneWay(t0))) { gy = ty * TILE; break; }
      }
      if (gy < 0) return;
      const dist = gy - foot;
      if (dist > 80) return;
      const k = 1 - dist / 100, w = Math.max(10, b.w * 1.25) * k;
      this.blit('shadow', 32, 8, cx - cam - w / 2, gy - 3 * k, HD.shadow, w, 6 * k);
    }

    particle(a, cam) {
      const x = a.x - cam;
      if (a.kind === 'text') this.text(a.text, x, a.y, a.text === '1UP' ? '#9df07a' : '#fff', 7, 'left', 900);
      else if (a.kind === 'coin') this.blit('coin' + (Math.floor(a.life * 30) % 8), 8, 12, x, a.y, gg => HD.coin(gg, Math.floor(a.life * 30) % 8));
      else if (a.kind === 'puff') { const s = 6 + (0.45 - Math.min(0.45, a.life)) * 14; this.blit('puff', 8, 8, x - s / 2 + 3, a.y - s / 2 + 3, HD.puff, s, s); }
      else if (a.kind === 'dust') { const s = 4 + (0.35 - Math.min(0.35, a.life)) * 18; this.blit('dust', 6, 6, x - s / 2, a.y - s / 2, HD.dust, s, s); }
      else if (a.kind === 'sparkle') this.blit('sparkle', 8, 8, x - 4, a.y - 4, HD.sparkle);
      else if (a.kind === 'streak') {
        const k = Math.min(1, a.life / 0.26), len = 10 + 10 * k;
        const c = this.c;
        if (c.save) { c.save(); c.globalAlpha = 0.25 + 0.6 * k; }
        this.blit('streak' + (a.dir < 0 ? 'L' : ''), 16, 2, a.dir < 0 ? x : x - len, a.y, gg => { if (a.dir < 0) { gg.translate(16, 0); gg.scale(-1, 1); } HD.streak(gg); }, len, 1.6);
        if (c.save) c.restore();
      } else if (a.kind === 'gust') {
        const k = 1 - Math.min(1, a.life / 0.32), s = (a.size || 8) * (0.8 + k * 1.4);
        const c = this.c;
        if (c.save) { c.save(); c.globalAlpha = 1 - k; }
        this.blit('gust', 16, 6, x - s / 2, a.y, HD.gust, s, s * 0.38);
        if (c.save) c.restore();
      }
      else this.blit('debris', 5, 5, x, a.y, HD.debris);
    }

    waterOverlay(l, cam, t) {
      const xEnd = Math.min(W, l.water.x1 - cam);
      if (xEnd <= 0) return;
      const top = l.water.top;
      for (let x = -((cam * 0.8) % 24); x < xEnd; x += 24) {
        const y = top - 1 + Math.sin(t * 3 + x * 0.1) * 1;
        this.rect(x, y, Math.min(14, xEnd - x), 1.5, 'rgba(230,250,255,0.85)');
      }
    }

    semiBox(box, cam) {
      const x = box.x0 * TILE - cam, y = box.top * TILE, w = (box.x1 - box.x0) * TILE, h = (FLOOR - box.top) * TILE;
      this.rect(x + 5, y + 5, w, h - 5, 'rgba(20,30,40,0.28)');
      this.blit(`box-${w}-${h}-${box.color}`, w, h, x, y, g => HD.semiBox(g, w, h, box.color));
    }

    enemy(e, cam, t) {
      const x = e.x - cam;
      if (x < -64 || x > W + 40) return;
      if (e.dead && e.deathTime <= 0) return;
      const scale = e.giant ? 2 : 1;
      const dim = MarioSprites.dimensions(e.type);
      const frame = Math.floor(t * 6) % 2;
      const sx = x + (e.w - dim.w * scale) / 2, sy = e.y + e.h - dim.h * scale;
      if (e.dead && e.deathKind === 'stomp') {
        if (this.c.save) {
          this.c.save();
          this.c.translate(Math.round(sx), Math.round(e.y + e.h - (dim.h * scale) / 2));
          this.c.scale(1, 0.5);
          this.sprite(e.type, 0, 0, { frame: 0, scale });
          this.c.restore();
        } else this.sprite(e.type, sx, sy, { frame: 0, scale });
        return;
      }
      if (e.type === 'bullet') { this.sprite('bullet', sx, sy, { facing: e.vx > 0 ? -1 : 1, flipY: e.dead }); return; }
      if (e.hidden) return;
      const facing = e.type === 'fish' ? (e.vx < 0 ? 1 : -1) : (e.vx || e.dir) < 0 ? -1 : 1;
      const opts = { frame: e.type === 'shell' ? 0 : frame, facing, scale, flipY: e.dead };
      // Animação: balanço ao andar, giro do casco, peixe inclinado no salto.
      let rot = 0, kx = 1, ky = 1, dy = 0;
      if (!e.dead && !e.held) {
        if (e.type === 'goomba' || e.type === 'koopa') { rot = (frame ? 1 : -1) * 0.07; dy = -Math.abs(Math.sin(t * 12 + e.id)) * 0.8; }
        else if (e.type === 'shell' && Math.abs(e.vx) > 1) kx = 0.55 + 0.45 * Math.abs(Math.cos(t * 26));
        else if (e.type === 'fish') rot = e.jumper ? Math.atan2(-(e.vyJ || 0), Math.abs(e.vx) * 4) * (e.vx < 0 ? 1 : -1) * 0.9 : Math.sin(t * 5 + e.id) * 0.12;
      }
      this.transformed(sx + (dim.w * scale) / 2, sy + dim.h * scale + dy, (dim.w * scale) / 2, dim.h * scale, rot, kx, ky, ox => this.sprite(e.type, ox, -dim.h * scale, opts), rot !== 0);
    }

    // Desenha com giro/escala ao redor do pé (cx, foot). Sem save/restore cai no desenho simples.
    transformed(cx, foot, halfW, h, rot, kx, ky, draw, smooth = false) {
      const c = this.c;
      if ((rot === 0 && kx === 1 && ky === 1) || typeof c.save !== 'function') {
        c.save && c.save();
        if (c.translate) c.translate(cx, foot);
        draw(-halfW);
        c.restore && c.restore();
        return;
      }
      c.save();
      c.translate(cx, foot);
      if (kx !== 1 || ky !== 1) c.scale(kx, ky);
      if (rot) { c.translate(0, -h / 2); c.rotate(rot); c.translate(0, h / 2); }
      if (smooth) c.imageSmoothingEnabled = true;
      draw(-halfW);
      if (smooth) c.imageSmoothingEnabled = false;
      c.restore();
    }

    boss(b, cam, t, g) {
      if (b.dead && !b.falling) return;
      if (b.invuln > 0 && Math.floor(t * 16) % 2 && b.type !== 'bowser') return;
      this.blit('shadow', 32, 8, b.x - cam - 4, b.y + b.h - 3, HD.shadow, b.w + 8, 6);
      if (b.type === 'bowser') this.sprite('bowser', b.x - cam - 2, b.y, { frame: Math.floor(t * 4) % 2, facing: b.facing < 0 ? 1 : -1 });
      else this.sprite('boss', b.x - cam - 2, b.y + b.h - 32, { frame: Math.floor(t * 6) % 2, facing: g.player && g.player.x < b.x ? -1 : 1 });
    }

    goal(g, l, cam, t) {
      const q = l.goal, x = q.x - cam;
      if (x < -40 || x > W + 16) return;
      const taken = g.ending && g.ending.kind === 'card';
      this.blit('goalBox', q.w + 8, q.h + 8, x - 4, q.y - 4, gg => {
        gg.fillStyle = HD.rad(gg, (q.w + 8) / 2, (q.h + 8) / 2, 2, q.h, [[0, 'rgba(255,240,180,0.45)'], [1, 'rgba(255,240,180,0)']]);
        gg.fillRect(0, 0, q.w + 8, q.h + 8);
        gg.fillStyle = HD.lin(gg, 0, 0, 0, q.h + 8, [[0, '#fff6dc'], [1, '#e9d2a0']]);
        HD.rr(gg, 2, 2, q.w + 4, q.h + 4, 4);
        gg.fill();
        gg.strokeStyle = '#2a2414';
        gg.lineWidth = 1;
        gg.stroke();
        gg.fillStyle = HD.lin(gg, 0, 6, 0, q.h, [[0, '#1a2440'], [1, '#0b1020']]);
        HD.rr(gg, 6, 6, q.w - 4, q.h - 4, 3);
        gg.fill();
      });
      if (!taken) this.sprite(g.rouletteCard(), x + 5, q.y + 12);
      else {
        const rise = Math.min(1, g.ending.timer / 0.8) * 60;
        this.sprite(g.ending.card, x + 5, q.y + 12 - rise);
      }
    }

    panel(x, y, w, h, alpha = 0.86) {
      const c = this.c;
      if (typeof c.createLinearGradient !== 'function' || typeof c.fill !== 'function') { this.rect(x, y, w, h, `rgba(11,18,32,${alpha})`); return; }
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = HD.lin(c, 0, y, 0, y + h, [[0, '#1d2a4a'], [1, '#0b1224']]);
      HD.rr(c, x, y, w, h, 5);
      c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = 'rgba(255,224,150,0.65)';
      c.lineWidth = 1;
      c.stroke();
      c.restore();
    }

    endingBanner(g, t) {
      const e = g.ending;
      if (e.timer < 0.8) return;
      const title = e.kind === 'bowser' ? 'O REINO ESTÁ SALVO!' : 'FASE CONCLUÍDA!';
      const cx = W / 2;
      this.panel(cx - 116, 48, 232, e.card ? 64 : 38);
      this.text(title, cx, 56, '#ffe27a', 11, 'center', 900);
      if (e.card) {
        this.text('VOCÊ GANHOU UMA CARTA', cx - 18, 82, '#fff', 8, 'center');
        this.rect(cx + 76, 76, 22, 22, '#f9efd5');
        this.sprite(e.card, cx + 79, 79);
      }
      if (e.secrets && e.secrets.total) {
        const y = e.card ? 114 : 88;
        this.panel(cx - 70, y, 140, 18, 0.8);
        this.text(`SEGREDOS ${e.secrets.found}/${e.secrets.total}`, cx, y + 5, e.secrets.found === e.secrets.total ? '#9df07a' : '#cfe0ff', 8, 'center', 900);
      }
      if (e.bonus) {
        this.panel(cx - 116, 138, 232, 24);
        this.text(`${e.bonus.lives} VIDA${e.bonus.lives > 1 ? 'S' : ''} EXTRA!`, cx, 145, '#9df07a', 9, 'center', 900);
      }
    }

    player(g, t, cam) {
      const p = g.player;
      if (!p) return;
      const blink = (p.invuln > 0 && Math.floor(t * 16) % 2) || (g.freeze > 0 && Math.floor(t * 20) % 2);
      let state = 'idle';
      const flying = !p.grounded && !p.pipe && !p.climb && (p.flight > 0 || p.wag > 0 || (g.cheats && g.cheats.fly && !p.swimming));
      if (g.mode === 'dying') state = 'dead';
      else if (p.duck) state = 'duck';
      else if (p.climb) state = 'jump';
      else if (p.tail > 0) state = 'tail';
      else if (!p.grounded && !p.pipe) state = flying && p.power !== 'small' ? 'fly' : 'jump';
      else if (Math.abs(p.vx) > 8) state = 'walk';
      const dim = MarioSprites.dimensions('mario', p.power);
      const speed = Math.abs(p.vx) > 180 ? 20 : Math.abs(p.vx) > 120 ? 15 : 10;
      const px = p.x - cam - 1, py = p.y + p.h - dim.h;
      let facing = p.facing;
      if (p.climb) facing = Math.floor((p.climbStep || 0) * 7) % 2 ? 1 : -1;
      const frame = state === 'fly' ? (p.flapFx > 0.1 ? 1 : 0) : Math.floor(t * speed) % 3;

      // Postura: esticar no pulo, achatar na aterrissagem, inclinar na corrida e no voo.
      let rot = 0, kx = 1, ky = 1;
      if (g.mode === 'playing' && !p.pipe && !p.climb) {
        if (p.jumpFx > 0) { const k = p.jumpFx / 0.16; ky = 1 + 0.13 * k; kx = 1 - 0.09 * k; }
        if (p.landFx > 0) { const k = p.landFx / 0.14; ky = 1 - 0.16 * k; kx = 1 + 0.13 * k; }
        if (flying) {
          rot = Math.max(-0.34, Math.min(0.24, Math.atan2(p.vy, Math.abs(p.vx) + 70) * 0.6)) * p.facing;
          if (p.flapFx > 0) ky *= 1 + 0.06 * (p.flapFx / 0.22);
        } else if (p.wag > 0) rot = Math.sin(t * 34) * 0.06;
        else if (p.grounded && p.skidding) rot = -p.facing * 0.1;
        else if (p.grounded && Math.abs(p.vx) > 140) rot = p.facing * 0.07 * Math.min(1, (Math.abs(p.vx) - 140) / 70);
      }

      // Rastro de imagens quando voa ou corre no P cheio.
      const trailOn = g.mode === 'playing' && !p.pipe && (flying || (p.pm >= 7 && Math.abs(p.vx) > 180) || p.star > 0);
      if (this.trailLevel !== g.level) { this.trail = []; this.trailLevel = g.level; }
      this.trail = this.trail || [];
      if (trailOn && (this.trailT === undefined || Math.abs(t - this.trailT) > 1 / 30)) {
        this.trailT = t;
        this.trail.unshift({ x: p.x, y: py, state, frame, facing, power: p.power, rot, star: p.star > 0 });
        if (this.trail.length > 5) this.trail.length = 5;
      } else if (!trailOn && this.trail.length && Math.abs(t - (this.trailT || 0)) > 1 / 30) { this.trailT = t; this.trail.pop(); }
      const c = this.c;
      if (this.trail.length > 1 && typeof c.save === 'function') {
        for (let i = this.trail.length - 1; i >= 1; i--) {
          const q = this.trail[i];
          c.save();
          c.globalAlpha = 0.34 * (1 - i / this.trail.length);
          this.transformed(q.x - cam - 1 + dim.w / 2, q.y + dim.h, dim.w / 2, dim.h, q.rot, 1, 1, ox => MarioSprites.drawMario(c, ox, -dim.h, { power: q.power, state: q.state, frame: q.frame, facing: q.facing, star: q.star }), q.rot !== 0);
          c.restore();
        }
      }

      if (p.star > 0 || (g.cheats && g.cheats.invincible)) {
        const k = Math.floor(t * 12);
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + i * 2.1;
          this.blit('sparkle', 8, 8, px + 8 + Math.cos(a) * 12 - 4, py + dim.h / 2 + Math.sin(a) * 12 - 4, HD.sparkle, (k + i) % 2 ? 8 : 6, (k + i) % 2 ? 8 : 6);
        }
      }
      if (p.tail > 0 && g.mode === 'playing') {
        const k = p.tail / 0.25;
        if (c.save) { c.save(); c.globalAlpha = 0.35 + 0.5 * k; }
        this.blit('swoosh', 40, 16, px + dim.w / 2 - 20, p.y + p.h - 15, HD.swoosh);
        if (c.save) c.restore();
      }
      if (!blink) {
        this.transformed(px + dim.w / 2, py + dim.h, dim.w / 2, dim.h, rot, kx, ky, ox => MarioSprites.drawMario(c, ox, -dim.h, {
          power: p.power, state, frame, facing, star: p.star > 0
        }), rot !== 0);
      }
      if (p.carry) this.sprite('shell', p.carry.x - cam, p.carry.y, { facing: p.facing });
    }

    /* ------------------------------- Mapa ------------------------------- */
    map(g, t) {
      const w = WORLDS[g.world], c = this.c, ox = MAP_X;
      const rich = typeof c.createLinearGradient === 'function' && typeof c.fill === 'function';
      if (rich) {
        c.fillStyle = HD.lin(c, 0, 0, 0, PH, [[0, '#1b2740'], [1, '#121a2c']]);
        c.fillRect(0, 0, W, PH);
      } else this.rect(0, 0, W, PH, '#1b2740');
      this.blit(`mapFrame-${g.world}`, W - 16, 208, 8, 8, gg => {
        gg.fillStyle = HD.lin(gg, 0, 0, 0, 208, [[0, '#fbe8b8'], [1, '#e8c98a']]);
        HD.rr(gg, 0, 0, W - 16, 208, 8);
        gg.fill();
        gg.fillStyle = HD.lin(gg, 0, 22, 0, 202, [[0, w.land], [1, shade(w.land, -0.18)]]);
        HD.rr(gg, 6, 22, W - 28, 180, 6);
        gg.fill();
        for (let i = 0; i < 70; i++) {
          gg.fillStyle = i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
          HD.ellipse(gg, 10 + HD.hash(i * 7) * (W - 36), 26 + HD.hash(i * 13) * 150, 2 + HD.hash(i) * 3, 1 + HD.hash(i * 3) * 1.5);
          gg.fill();
        }
        gg.fillStyle = HD.lin(gg, 0, 180, 0, 200, [[0, shade(w.sea, 0.15)], [1, shade(w.sea, -0.2)]]);
        HD.rr(gg, 8, 182, W - 32, 18, 4);
        gg.fill();
      });
      for (let x = 22; x < W - 30; x += 18) this.rect(x + (Math.floor(t * 2) % 2) * 3, 196, 8, 1.4, 'rgba(230,250,255,0.75)');
      this.text(`MUNDO ${g.world + 1} · ${w.name}`, 22, 13, '#2a3550', 10, 'left', 900);
      const tint = TREE_TINTS[g.world] || TREE_TINTS.default;
      for (const [x, y] of [[60, 70], [200, 150], [310, 120], [120, 60], [340, 160], [24, 120]]) this.blit('tree' + g.world, 18, 22, ox + x, y, gg => HD.tree(gg, tint));
      // Caminho
      if (rich) {
        c.save();
        c.lineCap = 'round';
        c.lineJoin = 'round';
        for (let pass = 0; pass < 2; pass++) {
          c.lineWidth = pass ? 5 : 8;
          for (let i = 1; i < MAP_NODES.length; i++) {
            const a = MAP_NODES[i - 1], b = MAP_NODES[i];
            c.strokeStyle = pass ? (g.isPassable(i - 1) ? '#fff6d6' : '#e7cf96') : 'rgba(80,60,30,0.45)';
            c.beginPath();
            c.moveTo(ox + a.x + 10, a.y + 10);
            c.lineTo(ox + b.x + 10, b.y + 10);
            c.stroke();
          }
        }
        c.restore();
      } else {
        for (let i = 1; i < MAP_NODES.length; i++) {
          const a = MAP_NODES[i - 1], b = MAP_NODES[i];
          if (a.y === b.y) this.rect(ox + Math.min(a.x, b.x) + 8, a.y + 7, Math.abs(b.x - a.x), 6, '#fff3c4');
          else this.rect(ox + a.x + 7, Math.min(a.y, b.y) + 8, 6, Math.abs(b.y - a.y), '#fff3c4');
        }
      }
      let reach = 0;
      while (reach < MAP_NODES.length - 1 && g.isPassable(reach)) reach++;
      MAP_NODES.forEach((n, i) => this.mapNode(g, n, i, i <= reach, t));
      let mx, my;
      if (g.mapAnim) {
        const a = MAP_NODES[g.mapAnim.from], b = MAP_NODES[g.mapAnim.to], k = Math.min(1, g.mapAnim.t);
        mx = a.x + (b.x - a.x) * k; my = a.y + (b.y - a.y) * k;
      } else { mx = MAP_NODES[g.mapPos].x; my = MAP_NODES[g.mapPos].y; }
      const big = g.savedPower !== 'small';
      this.blit('shadow', 32, 8, ox + mx - 2, my + 16, HD.shadow, 24, 6);
      MarioSprites.drawMario(c, Math.round(ox + mx + 2), Math.round(my - (big ? 22 : 12) - (g.mapAnim ? 0 : Math.abs(Math.sin(t * 4)) * 2)), {
        power: g.savedPower, state: g.mapAnim ? 'walk' : 'idle', frame: Math.floor(t * 8) % 3,
        facing: g.mapAnim && MAP_NODES[g.mapAnim.to].x < MAP_NODES[g.mapAnim.from].x ? -1 : 1, star: g.pendingStar > 0
      });
      const n = g.node;
      const label = n.kind === 'start' ? 'INÍCIO' : n.kind === 'toad' ? (g.toadOpened.includes(g.world) ? 'CASA DO TOAD (VISITADA)' : 'CASA DO TOAD') : g.stageName(g.world * 6 + n.slot).toUpperCase() + (g.isCompleted(g.world * 6 + n.slot) ? ' ✓' : '');
      this.text(label, W / 2, 193, '#fff', 8, 'center', 900);
      if (g.banner) {
        this.panel(W / 2 - 104, 82, 208, 52);
        this.text(g.banner.text, W / 2, 90, '#ffe27a', 15, 'center', 900);
        if (g.banner.sub) this.text(g.banner.sub, W / 2, 112, '#fff', 8, 'center');
      }
    }

    mapNode(g, n, i, open, t) {
      const x = MAP_X + n.x, y = n.y;
      if (n.kind === 'start') {
        this.blit('startNode', 30, 18, x - 5, y + 1, gg => {
          gg.fillStyle = 'rgba(0,0,0,0.25)';
          HD.rr(gg, 2, 3, 28, 15, 4);
          gg.fill();
          gg.fillStyle = HD.lin(gg, 0, 0, 0, 16, [[0, '#fff9e8'], [1, '#e9d6a8']]);
          HD.rr(gg, 0, 0, 28, 15, 4);
          gg.fill();
          gg.strokeStyle = '#2a3550';
          gg.lineWidth = 1;
          gg.stroke();
        });
        this.text('IN', x + 9, y + 4, '#2a3550', 8, 'center', 900);
        return;
      }
      if (n.kind === 'toad') {
        const done = g.toadOpened.includes(g.world);
        this.blit('house' + (done ? 'd' : ''), 26, 30, x - 3, y - 10, gg => HD.house(gg, done));
        return;
      }
      const stage = g.world * 6 + n.slot, done = g.isCompleted(stage);
      if (n.slot === 3) { this.blit('fort' + (done ? 'd' : ''), 24, 25, x - 2, y - 4, gg => HD.fortress(gg, done)); return; }
      if (n.slot === 5) {
        if (g.world === 7) this.blit('darkCastle', 28, 31, x - 4, y - 10, HD.darkCastle);
        else this.blit('airshipIcon', 28, 27, x - 4, y - 6 + Math.round(Math.sin(t * 2) * 2 * 2) / 2, HD.airship);
        return;
      }
      const key = done ? 'nodeDone' : open ? 'nodeOpen' : 'nodeLocked';
      const colors = done ? ['#ff7a5c', '#c8382a'] : open ? ['#ffd36b', '#e59a2c'] : ['#8a968a', '#5d685e'];
      this.blit(key, 28, 28, x - 4, y - 4, gg => {
        gg.fillStyle = 'rgba(0,0,0,0.3)';
        HD.rr(gg, 2, 3, 26, 25, 5);
        gg.fill();
        gg.fillStyle = HD.lin(gg, 0, 0, 0, 24, [[0, colors[0]], [1, colors[1]]]);
        HD.rr(gg, 0, 0, 25, 24, 5);
        gg.fill();
        gg.strokeStyle = '#2a3550';
        gg.lineWidth = 1.2;
        gg.stroke();
        gg.fillStyle = 'rgba(255,255,255,0.4)';
        HD.rr(gg, 3, 2, 19, 3, 1.5);
        gg.fill();
      });
      const label = done ? 'M' : ['1', '2', '3', '', '4'][n.slot];
      this.text(label, x + 8.5, y + 3, done ? '#fff1c9' : open ? '#3a2a10' : '#d7ddd4', 13, 'center', 900);
    }

    /* --------------------------- Casa do Toad --------------------------- */
    toadHouse(g, t) {
      const td = g.toad, c = this.c, ox = MAP_X;
      this.blit('toadRoom', W, PH, 0, 0, gg => {
        gg.fillStyle = HD.lin(gg, 0, 0, 0, 184, [[0, '#c98b54'], [1, '#a86a3a']]);
        gg.fillRect(0, 0, W, 184);
        for (let x = 0; x < W; x += 24) {
          gg.fillStyle = x % 48 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
          gg.fillRect(x, 0, 24, 184);
          gg.fillStyle = 'rgba(70,35,15,0.35)';
          gg.fillRect(x, 0, 1, 184);
        }
        gg.fillStyle = '#5a3416';
        HD.rr(gg, W / 2 - 50, 66, 100, 60, 6);
        gg.fill();
        gg.fillStyle = HD.lin(gg, 0, 70, 0, 122, [[0, '#9fd8ff'], [1, '#e8f6ff']]);
        HD.rr(gg, W / 2 - 45, 70, 90, 52, 4);
        gg.fill();
        gg.fillStyle = '#5a3416';
        gg.fillRect(W / 2 - 1.5, 70, 3, 52);
        gg.fillRect(W / 2 - 45, 94, 90, 3);
        gg.fillStyle = 'rgba(255,250,220,0.12)';
        HD.poly(gg, [[W / 2 - 45, 122], [W / 2 + 45, 122], [W / 2 + 90, 184], [W / 2 - 80, 184]]);
        gg.fill();
        gg.fillStyle = HD.lin(gg, 0, 184, 0, PH, [[0, '#7a4a28'], [1, '#4f2c14']]);
        gg.fillRect(0, 184, W, PH - 184);
        gg.fillStyle = 'rgba(255,220,170,0.35)';
        gg.fillRect(0, 184, W, 2);
        for (let x = 0; x < W; x += 40) { gg.fillStyle = 'rgba(0,0,0,0.25)'; gg.fillRect(x, 186, 1, PH - 186); }
      });
      this.panel(W / 2 - 84, 20, 168, 34);
      this.text('CASA DO TOAD', W / 2, 25, '#ffe27a', 11, 'center', 900);
      this.text(td && td.opened >= 0 ? `VOCÊ GANHOU: ${ITEM_NAMES[td.item].toUpperCase()}!` : 'ESCOLHA UM BAÚ', W / 2, 41, '#fff', 7, 'center');
      if (!td) return;
      const xs = [ox + 112, ox + 184, ox + 256];
      xs.forEach((x, i) => {
        const open = td.opened === i;
        this.blit(open ? 'chestOpenHD' : 'chestHD', 16, 16, x - 4, 160, gg => HD.chest(gg, open), 24, 24);
        if (open) {
          const rise = Math.min(1, (2 - td.timer) / 0.6) * 30;
          this.sprite(td.item, x, 142 - rise, { frame: Math.floor(t * 8) % 2 });
        }
      });
      if (td.opened < 0) {
        const cx = xs[td.cursor] + 8, bob = Math.sin(t * 6) * 2;
        if (typeof c.fill === 'function') {
          c.fillStyle = '#ffe27a';
          HD.poly(c, [[cx - 6, 132 + bob], [cx + 6, 132 + bob], [cx, 140 + bob]]);
          c.fill();
        } else this.rect(cx - 4, 132, 8, 6, '#ffe27a');
      }
      const mx = xs[td.opened >= 0 ? td.opened : td.cursor];
      const big = g.savedPower !== 'small';
      MarioSprites.drawMario(c, mx - 20, 184 - (big ? 28 : 16), { power: g.savedPower, state: 'idle', frame: 0, facing: 1 });
    }

    /* -------------------------------- HUD -------------------------------- */
    hud(g, t) {
      const c = this.c;
      this.blit('hudBar', W, 32, 0, PH, gg => {
        gg.fillStyle = HD.lin(gg, 0, 0, 0, 32, [[0, '#1c2948'], [1, '#0c1326']]);
        gg.fillRect(0, 0, W, 32);
        gg.fillStyle = 'rgba(255,230,160,0.5)';
        gg.fillRect(0, 0, W, 1);
        gg.fillStyle = HD.lin(gg, 0, 3, 0, 29, [[0, '#26365e'], [1, '#141e38']]);
        HD.rr(gg, 4, 3, W - 106, 26, 5);
        gg.fill();
        gg.strokeStyle = 'rgba(255,230,160,0.55)';
        gg.lineWidth = 1;
        gg.stroke();
      });
      const view = g.mode === 'paused' ? g.beforePause : g.mode;
      if (view === 'map' && g.invOpen) this.inventoryBar(g, t);
      else {
        this.text(`MUNDO ${g.world + 1}`, 10, 229, '#ffe27a', 7, 'left', 900);
        const p = g.player && g.inLevel ? g.player : null;
        const pm = p ? p.pm : 0;
        for (let i = 0; i < 6; i++) this.chevron(64 + i * 9, 229, i < pm, g.cheats && g.cheats.fly);
        const full = pm >= 7;
        this.blit('pbadge' + (full && Math.floor(t * 8) % 2 ? 'on' : 'off'), 16, 9, 120, 228.5, gg => {
          gg.fillStyle = full && Math.floor(t * 8) % 2 ? HD.lin(gg, 0, 0, 0, 9, [[0, '#ffe27a'], [1, '#f2a024']]) : '#2a3654';
          HD.rr(gg, 0, 0, 16, 9, 2.5);
          gg.fill();
        });
        this.text('P', 128, 229.5, full ? '#1a1a1a' : '#6f7c99', 7, 'center', 900);
        this.blit('hudCoin', 8, 12, 236, 227.5, gg => HD.coin(gg, 0), 6, 9);
        this.text('×' + String(g.coins).padStart(2, '0'), 244, 229, '#ffe27a', 7, 'left', 900);
        this.text('M×' + String(g.lives).padStart(2, '0'), 10, 240, '#fff', 7, 'left', 900);
        this.text(String(g.score).padStart(7, '0'), 64, 240, '#fff', 7, 'left', 900);
        const time = g.inLevel ? Math.ceil(g.time) : 0;
        this.clockIcon(236, 240.5);
        this.text(String(time).padStart(3, '0'), 245, 240, g.hurry && g.inLevel ? '#ff8a6a' : '#fff', 7, 'left', 900);
        const cheats = g.activeCheats ? g.activeCheats() : [];
        if (cheats.length) this.text('★ ' + cheats.length, 300, 234, '#9df07a', 7, 'left', 900);
      }
      for (let i = 0; i < 3; i++) {
        const x = W - 96 + i * 31;
        this.blit('cardSlot', 26, 26, x, 227, gg => {
          gg.fillStyle = HD.lin(gg, 0, 0, 0, 26, [[0, '#fff6dc'], [1, '#e2c88f']]);
          HD.rr(gg, 0, 0, 26, 26, 4);
          gg.fill();
          gg.fillStyle = HD.lin(gg, 0, 3, 0, 23, [[0, '#1d2a4a'], [1, '#0b1224']]);
          HD.rr(gg, 3, 3, 20, 20, 3);
          gg.fill();
        });
        if (g.cards[i]) this.sprite(g.cards[i], x + 5, 232);
      }
    }

    chevron(x, y, on, infinite) {
      this.blit('chev' + (on ? 'on' : 'off') + (infinite ? 'I' : ''), 8, 9, x, y, gg => {
        gg.fillStyle = on ? HD.lin(gg, 0, 0, 0, 9, [[0, infinite ? '#b6f7a0' : '#ffe27a'], [1, infinite ? '#4fc06a' : '#f29a24']]) : '#33405f';
        HD.poly(gg, [[0, 0], [4, 0], [8, 4.5], [4, 9], [0, 9], [4, 4.5]]);
        gg.fill();
      });
    }
    clockIcon(x, y) {
      this.blit('clock', 8, 8, x, y, gg => {
        gg.fillStyle = '#e8eef8';
        HD.circle(gg, 4, 4, 3.6);
        gg.fill();
        gg.strokeStyle = '#1c2948';
        gg.lineWidth = 0.8;
        gg.beginPath();
        gg.moveTo(4, 4);
        gg.lineTo(4, 1.6);
        gg.moveTo(4, 4);
        gg.lineTo(5.8, 4.8);
        gg.stroke();
      });
    }

    inventoryBar(g, t) {
      const items = g.inventory;
      const start = Math.max(0, Math.min(g.invCursor - 3, items.length - 8));
      this.text('ITENS', 10, 229, '#ffe27a', 7, 'left', 900);
      this.text(`${g.invCursor + 1}/${items.length}`, 10, 240, '#9fb1cc', 7, 'left', 900);
      for (let i = 0; i < 8; i++) {
        const idx = start + i, item = items[idx];
        const x = 52 + i * 32;
        const sel = idx === g.invCursor;
        this.blit('invSlot' + (sel ? 'S' : ''), 24, 24, x, 227, gg => {
          gg.fillStyle = sel ? HD.lin(gg, 0, 0, 0, 24, [[0, '#ffe27a'], [1, '#e59a2c']]) : '#2a3654';
          HD.rr(gg, 0, 0, 24, 24, 4);
          gg.fill();
        });
        if (item) this.sprite(item, x + 4, 231);
      }
    }
  }

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return `rgb(${r},${g},${b})`;
  }

  globalThis.MarioRenderer = MarioRenderer;
})();
