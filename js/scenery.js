/* Cenários de fundo em alta definição, em camadas com parallax.
 * Cada camada é uma faixa desenhada uma vez (vetores, gradientes, luz) e depois só copiada. */
(() => {
  'use strict';

  const { lin, rad, rr, circle, ellipse, poly, hash, TAU } = MarioHD;
  const W = MarioCore.W, PH = 224;

  const SKIES = {
    day: [[0, '#3a94e4'], [0.55, '#87c9f2'], [1, '#dcf3fd']],
    desert: [[0, '#ee9a52'], [0.5, '#f6cd86'], [1, '#fdf0cb']],
    sea: [[0, '#2c8bd8'], [0.6, '#88cef3'], [1, '#e3f6ff']],
    ice: [[0, '#79acd9'], [0.6, '#c5e4f5'], [1, '#f4fbff']],
    sky: [[0, '#4fa2ea'], [0.6, '#aadcf7'], [1, '#fff4dc']],
    airship: [[0, '#202c5a'], [0.5, '#594d8e'], [1, '#f2ab80']],
    tank: [[0, '#19132d'], [0.6, '#48223f'], [1, '#a5462f']],
    lava: [[0, '#110a1d'], [0.55, '#3e1430'], [1, '#b3381f']],
    cave: [[0, '#0a1120'], [1, '#18233a']],
    castle: [[0, '#0d1220'], [1, '#1d2336']]
  };

  // Desenha uma forma em várias posições para que a faixa repita sem emenda.
  const wrap = (w, x, r, fn) => { fn(x); if (x - r < 0) fn(x + w); if (x + r > w) fn(x - w); };

  class MarioScenery {
    constructor(renderer) { this.r = renderer; }

    // Céu pré-renderizado: copiar uma imagem é bem mais barato que um gradiente de tela inteira.
    sky(stops, water = null) {
      const key = 'sky-' + stops.map(s => s[1]).join() + (water ? '-w' + water.top : '');
      this.fixed(() => this.r.blit(key, W, PH, 0, 0, g => {
        g.fillStyle = lin(g, 0, 0, 0, PH, stops);
        g.fillRect(0, 0, W, PH);
        if (water) {
          g.fillStyle = lin(g, 0, water.top, 0, PH, water.stops);
          g.fillRect(0, water.top, W, PH - water.top);
        }
      }, W, PH, true));
    }
    sun(x, y, r, color = 'rgba(255,248,214,0.9)') {
      this.r.blit('sun' + r + color, r * 4, r * 4, x - r * 2, y - r * 2, g => {
        g.fillStyle = rad(g, r * 2, r * 2, 0, r * 2, [[0, color], [0.25, color], [0.3, 'rgba(255,240,190,0.35)'], [1, 'rgba(255,240,190,0)']]);
        circle(g, r * 2, r * 2, r * 2);
        g.fill();
      });
    }
    // Faixa repetida com parallax.
    layer(key, w, h, y, cam, factor, paint, drift = 0) {
      const off = (((cam * factor + drift) % w) + w) % w;
      for (let x = -off; x < W; x += w) this.r.blit(key, w, h, Math.floor(x), y, paint);
    }

    cloudShape(key, w, h, tint = ['#ffffff', '#e9f2fb', '#c6d9ee']) {
      return g => {
        const blobs = [[0.22, 0.62, 0.22], [0.42, 0.42, 0.28], [0.64, 0.5, 0.25], [0.82, 0.66, 0.18]];
        g.fillStyle = 'rgba(70,110,160,0.18)';
        const R = (by, br) => Math.min(br * w * 0.72, by * h + h * 0.18 - 1);
        const Y = by => by * h + h * 0.18;
        for (const [bx, by, br] of blobs) { circle(g, bx * w + 1.5, Y(by) + 2, R(by, br)); g.fill(); }
        for (const [bx, by, br] of blobs) {
          const r = R(by, br);
          g.fillStyle = rad(g, bx * w - r * 0.35, Y(by) - r * 0.45, 0, r * 1.4, [[0, tint[0]], [0.65, tint[1]], [1, tint[2]]]);
          circle(g, bx * w, Y(by), r);
          g.fill();
        }
        g.fillStyle = lin(g, 0, h * 0.5, 0, h, [[0, tint[0]], [1, tint[2]]]);
        rr(g, w * 0.08, h * 0.55, w * 0.84, h * 0.35, h * 0.17);
        g.fill();
      };
    }
    clouds(cam, t, factor, y0, count, drift = 3, tint) {
      const span = W + 160;
      for (let i = 0; i < count; i++) {
        const big = i % 3 === 0, w = big ? 84 : 58, h = big ? 40 : 28;
        const base = hash(i * 97) * span;
        const x = ((base - cam * factor - t * drift * (0.6 + hash(i) * 0.6)) % span + span) % span - 100;
        const y = y0 + hash(i * 31) * 40;
        this.r.blit(`cloud-${w}-${tint ? tint[2] : ''}`, w, h, Math.floor(x), Math.floor(y), this.cloudShape('c', w, h, tint));
      }
    }

    // camY < 0 quando a câmera sobe para o céu: o fundo desce mais devagar (parallax vertical).
    draw(l, cam, t, camY = 0) {
      const c = this.r.c, s = this.r.scale || 1;
      this.vy = camY < 0 && typeof c.save === 'function' ? Math.round(-camY * 0.45 * s) / s : 0;
      if (this.vy) { c.save(); c.translate(0, this.vy); }
      this.theme(l, cam, t);
      if (this.vy) {
        c.restore();
        const k = Math.min(1, -camY / 192);
        c.save();
        c.globalAlpha = 0.45 * k;
        this.r.blit('altitude', W, PH, 0, 0, g => {
          g.fillStyle = lin(g, 0, 0, 0, PH, [[0, 'rgba(24,60,150,0.9)'], [0.6, 'rgba(70,130,220,0.25)'], [1, 'rgba(120,180,240,0)']]);
          g.fillRect(0, 0, W, PH);
        });
        c.restore();
      }
      this.vy = 0;
    }
    // Desenha sem o deslocamento vertical (céu e bordas ficam presos à tela).
    fixed(fn) {
      if (!this.vy) return fn();
      const c = this.r.c;
      c.save();
      c.translate(0, -this.vy);
      fn();
      c.restore();
    }
    theme(l, cam, t) {
      const theme = l.theme;
      if (theme === 'underground') return this.cave(cam, t);
      if (theme === 'castle' || theme === 'bowser') return this.castle(cam, t, theme === 'bowser');
      if (theme === 'lava') return this.darkLand(cam, t);
      if (theme === 'tank') return this.tank(cam, t);
      if (theme === 'water') return this.underwater(l, cam, t);
      if (theme === 'desert') return this.desert(cam, t);
      if (theme === 'sea') return this.sea(cam, t);
      if (theme === 'ice') return this.ice(cam, t);
      if (theme === 'airship') return this.airship(cam, t);
      if (theme === 'sky') return this.cloudWorld(cam, t);
      return this.overworld(cam, t, theme);
    }

    farHills(cam, key, colors, base, h, factor) {
      const w = 640;
      this.layer(key, w, h, base - h, cam, factor, g => {
        g.fillStyle = lin(g, 0, 0, 0, h, [[0, colors[0]], [1, colors[1]]]);
        g.beginPath();
        g.moveTo(0, h);
        const peaks = 7;
        for (let i = 0; i <= peaks; i++) {
          const x = (i / peaks) * w, top = h * (0.15 + hash(i * 13 + key.length) * 0.45);
          const px = x - w / peaks / 2;
          g.quadraticCurveTo(px, top, x, h * (0.45 + hash(i * 7) * 0.2));
        }
        g.lineTo(w, h);
        g.closePath();
        g.fill();
      });
    }

    overworld(cam, t, theme) {
      this.sky(SKIES.day);
      this.sun(W - 70, 38, 14);
      this.farHills(cam, 'far-' + theme, ['#a7d3e6', '#c4e6f2'], 182, 92, 0.06);
      this.clouds(cam, t, 0.12, 14, 6);
      const giant = theme === 'giant';
      const hw = 720, hh = giant ? 150 : 112;
      this.layer('hills-' + theme, hw, hh, 204 - hh, cam, 0.22, g => {
        const hills = giant
          ? [[90, 120, 140, '#7fcf7c', '#4e9f57'], [330, 150, 170, '#94dd8c', '#5aae60'], [560, 110, 130, '#7fcf7c', '#4e9f57']]
          : [[70, 70, 90, '#8fd98a', '#56a95d'], [210, 95, 105, '#7ccd7a', '#4a9a52'], [380, 60, 80, '#9fe39a', '#62b366'], [540, 85, 100, '#7ccd7a', '#4a9a52'], [670, 64, 76, '#8fd98a', '#56a95d']];
        for (const [cx, rw, rh, c0, c1] of hills) wrap(hw, cx, rw, x => {
          g.fillStyle = lin(g, 0, hh - rh, 0, hh, [[0, c0], [1, c1]]);
          ellipse(g, x, hh, rw, rh);
          g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.35)';
          g.lineWidth = 1.2;
          g.beginPath();
          g.ellipse(x, hh, rw - 2, rh - 2, 0, Math.PI * 1.15, Math.PI * 1.45);
          g.stroke();
          g.fillStyle = 'rgba(40,110,60,0.18)';
          for (let k = 0; k < 6; k++) { ellipse(g, x - rw * 0.5 + hash(cx + k) * rw, hh - rh * (0.25 + hash(k * 3 + cx) * 0.5), 3, 1.6); g.fill(); }
        });
      });
      if (theme === 'pipe') {
        this.layer('bgpipes', 480, 120, 84, cam, 0.35, g => {
          for (const [x, h] of [[40, 100], [150, 70], [250, 110], [360, 84], [440, 60]]) wrap(480, x, 20, xx => {
            const grad = lin(g, xx - 16, 0, xx + 16, 0, [[0, '#2a6b45'], [0.3, '#6fbf8a'], [0.5, '#9ad9ae'], [1, '#235c3a']]);
            g.fillStyle = grad;
            g.fillRect(xx - 13, 120 - h + 8, 26, h);
            rr(g, xx - 16, 120 - h, 32, 10, 2);
            g.fill();
            g.fillStyle = 'rgba(0,0,0,0.18)';
            g.fillRect(xx - 13, 120 - h + 10, 26, 2);
          });
        });
      } else {
        this.layer('panels-' + theme, 560, giant ? 120 : 80, giant ? 78 : 118, cam, 0.38, g => {
          const H = giant ? 120 : 80, k = giant ? 1.5 : 1;
          const boards = [[60, 46, 59, '#bfe4ef', '#8cc3d6'], [100, 34, 40, '#f6d2c4', '#e2a891'], [300, 40, 50, '#d8f0c4', '#a6d38c'], [335, 30, 34, '#ffe6a6', '#efc163'], [470, 44, 62, '#bfe4ef', '#8cc3d6']];
          for (const [bx, bw0, bh0, c0, c1] of boards) {
            const bw = bw0 * k, bh = bh0 * k;
            wrap(560, bx, bw, x => {
              g.fillStyle = 'rgba(30,50,60,0.25)';
              rr(g, x + 4, H - bh + 4, bw, bh, 3);
              g.fill();
              g.fillStyle = lin(g, 0, H - bh, 0, H, [[0, c0], [1, c1]]);
              rr(g, x, H - bh, bw, bh, 3);
              g.fill();
              g.strokeStyle = '#2a3a4c';
              g.lineWidth = 1;
              g.stroke();
              g.fillStyle = 'rgba(255,255,255,0.6)';
              g.fillRect(x + 3, H - bh + 2.5, bw - 6, 1.6);
              for (const xx of [x + 4.5, x + bw - 4.5]) for (const yy of [H - bh + 6, H - 5]) MarioHD.bolt(g, xx, yy, 1.1);
            });
          }
        });
      }
      this.bushes(cam, giant);
    }

    bushes(cam, giant) {
      const w = 480, s = giant ? 1.4 : 1, h = Math.round(24 * s);
      this.layer('bushes' + (giant ? 'g' : ''), w, h, 193 - h, cam, 0.55, g => {
        for (const bx of [30, 140, 260, 380]) wrap(w, bx, 40 * s, x => {
          for (const [dx, r] of [[-14, 8.5], [14, 8.5], [0, 11]]) {
            const cy = h - r * s * 0.9;
            g.fillStyle = rad(g, x + dx * s - 3, cy - r * s * 0.5, 1, r * s * 1.3, [[0, '#a9ec74'], [0.6, '#5fbf45'], [1, '#2f7d32']]);
            circle(g, x + dx * s, cy, r * s);
            g.fill();
          }
        });
      });
    }

    cloudWorld(cam, t) {
      this.sky(SKIES.sky);
      this.sun(70, 40, 16);
      this.clouds(cam, t, 0.1, 10, 7, 4);
      for (const [key, w, h, factor, tint] of [['bankFar', 640, 70, 0.15, ['#ffffff', '#e8f1fb', '#bcd3ea']], ['bankNear', 560, 52, 0.4, ['#ffffff', '#f4f8ff', '#d3e3f3']]]) {
        this.layer(key, w, h, PH - h + 8, cam, factor, g => {
          for (let i = 0; i < 9; i++) {
            const x = (i / 9) * w, r = h * (0.45 + hash(i * 5 + w) * 0.35);
            wrap(w, x, r, xx => {
              g.fillStyle = rad(g, xx - r * 0.3, h - r * 0.8, 0, r * 1.3, [[0, tint[0]], [0.6, tint[1]], [1, tint[2]]]);
              circle(g, xx, h - r * 0.35, r);
              g.fill();
            });
          }
          g.fillStyle = tint[1];
          g.fillRect(0, h * 0.75, w, h);
        });
      }
    }

    desert(cam, t) {
      this.sky(SKIES.desert);
      this.sun(W - 90, 46, 20, 'rgba(255,250,225,0.95)');
      this.farHills(cam, 'dunesFar', ['#f0c37c', '#e6ad62'], 190, 60, 0.08);
      this.layer('pyramids', 560, 104, 96, cam, 0.22, g => {
        for (const [px, s] of [[110, 1], [300, 0.7], [450, 0.85]]) wrap(560, px, 90 * s, x => {
          const h = 100 * s, half = 86 * s;
          g.fillStyle = lin(g, x - half, 0, x, 0, [[0, '#f3cf8d'], [1, '#e2ae63']]);
          poly(g, [[x - half, 104], [x, 104 - h], [x, 104]]);
          g.fill();
          g.fillStyle = lin(g, x, 0, x + half, 0, [[0, '#c48a47'], [1, '#a46d35']]);
          poly(g, [[x, 104 - h], [x + half, 104], [x, 104]]);
          g.fill();
          g.strokeStyle = 'rgba(120,80,40,0.25)';
          g.lineWidth = 0.6;
          for (let k = 1; k < 8; k++) {
            const yy = 104 - h + (h * k) / 8, w2 = (half * k) / 8;
            g.beginPath();
            g.moveTo(x - w2, yy);
            g.lineTo(x + w2, yy);
            g.stroke();
          }
        });
      });
      this.layer('cacti', 420, 56, 142, cam, 0.5, g => {
        for (const [cx, s] of [[40, 1], [190, 0.8], [320, 1.1]]) wrap(420, cx, 20, x => {
          const green = lin(g, x - 4 * s, 0, x + 4 * s, 0, [[0, '#4e8a3c'], [0.4, '#86c05f'], [1, '#3a6d2e']]);
          g.fillStyle = green;
          rr(g, x - 4 * s, 56 - 50 * s, 8 * s, 50 * s, 4 * s);
          g.fill();
          rr(g, x - 13 * s, 56 - 34 * s, 6 * s, 16 * s, 3 * s);
          g.fill();
          rr(g, x - 13 * s, 56 - 22 * s, 10 * s, 5 * s, 2.5 * s);
          g.fill();
          rr(g, x + 7 * s, 56 - 42 * s, 6 * s, 18 * s, 3 * s);
          g.fill();
          rr(g, x + 3 * s, 56 - 28 * s, 10 * s, 5 * s, 2.5 * s);
          g.fill();
          g.strokeStyle = 'rgba(30,70,30,0.35)';
          g.lineWidth = 0.5;
          g.beginPath();
          g.moveTo(x, 56 - 48 * s);
          g.lineTo(x, 56);
          g.stroke();
        });
      });
    }

    sea(cam, t) {
      this.sky(SKIES.sea);
      this.sun(W - 110, 50, 16);
      this.clouds(cam, t, 0.1, 10, 5);
      const top = 150;
      this.r.blit('ocean', W, PH - top, 0, top, gg => { gg.fillStyle = lin(gg, 0, 0, 0, PH - top, [[0, '#4aa3d9'], [1, '#1d5f9a']]); gg.fillRect(0, 0, W, PH - top); }, W, PH - top, true);
      this.layer('islands', 600, 40, top - 34, cam, 0.12, gg => {
        for (const [ix, iw] of [[120, 70], [380, 100], [520, 50]]) wrap(600, ix, iw, x => {
          gg.fillStyle = lin(gg, 0, 14, 0, 40, [[0, '#62b57a'], [1, '#2f7a52']]);
          ellipse(gg, x, 40, iw, 26);
          gg.fill();
          gg.strokeStyle = '#6b4a2a';
          gg.lineWidth = 1.6;
          gg.beginPath();
          gg.moveTo(x + 6, 18);
          gg.quadraticCurveTo(x + 10, 6, x + 4, 0);
          gg.stroke();
          gg.fillStyle = '#3f9a52';
          for (const a of [-2.6, -1.9, -1.2, -0.5]) { gg.beginPath(); gg.ellipse(x + 4 + Math.cos(a) * 6, Math.sin(a) * 3 + 2, 7, 1.8, a, 0, TAU); gg.fill(); }
        });
      });
      for (let i = 0; i < 26; i++) {
        const x = ((i * 53 - cam * 0.35 + Math.sin(t + i) * 6) % (W + 40) + W + 40) % (W + 40) - 20;
        const y = top + 6 + (i % 7) * 10;
        this.r.rect(x, y, 10 + (i % 3) * 4, 1, 'rgba(220,245,255,0.55)');
      }
      this.r.rect(0, top, W, 1.5, 'rgba(255,255,255,0.8)');
    }

    underwater(l, cam, t) {
      const top = l.water ? l.water.top : 56, g = this.r.c;
      this.sky(SKIES.sea, { top, stops: [[0, '#2b84cc'], [1, '#0a2f5e']] });
      if (typeof g.createLinearGradient === 'function') {
        g.save();
        g.globalAlpha = 0.09;
        g.fillStyle = '#e8fbff';
        for (let i = 0; i < 5; i++) {
          const x = ((i * 120 - cam * 0.2) % (W + 160) + W + 160) % (W + 160) - 80 + Math.sin(t * 0.6 + i) * 12;
          poly(g, [[x, top], [x + 30, top], [x + 90, PH], [x + 40, PH]]);
          g.fill();
        }
        g.restore();
      }
      this.layer('reefFar', 560, 110, PH - 110, cam, 0.15, gg => {
        for (const [rx, rw, rh] of [[80, 70, 90], [260, 90, 70], [450, 60, 100]]) wrap(560, rx, rw, x => {
          gg.fillStyle = lin(gg, 0, 110 - rh, 0, 110, [[0, '#2f6fa8'], [1, '#1a4a7a']]);
          ellipse(gg, x, 110, rw, rh);
          gg.fill();
        });
      });
      this.layer('weeds', 420, 70, PH - 70, cam, 0.35, gg => {
        for (let i = 0; i < 10; i++) {
          const x = 20 + i * 42 + hash(i) * 10, h = 30 + hash(i * 5) * 36;
          wrap(420, x, 12, xx => {
            gg.strokeStyle = i % 3 === 0 ? '#e0708a' : '#3fae74';
            gg.lineWidth = i % 3 === 0 ? 2 : 3;
            gg.lineCap = 'round';
            gg.beginPath();
            gg.moveTo(xx, 70);
            gg.bezierCurveTo(xx - 8, 70 - h * 0.4, xx + 8, 70 - h * 0.7, xx - 2, 70 - h);
            gg.stroke();
          });
        }
      });
      for (let i = 0; i < 16; i++) {
        const x = ((i * 37 - cam * 0.4) % (W + 20) + W + 20) % (W + 20), span = PH - top;
        const y = top + (((i * 47 - t * 16) % span) + span) % span;
        this.r.blit('bubble', 6, 6, x, y, gg => {
          gg.strokeStyle = 'rgba(220,250,255,0.8)';
          gg.lineWidth = 0.6;
          circle(gg, 3, 3, 2.4);
          gg.stroke();
          gg.fillStyle = 'rgba(255,255,255,0.7)';
          circle(gg, 2.2, 2.2, 0.7);
          gg.fill();
        });
      }
    }

    ice(cam, t) {
      this.sky(SKIES.ice);
      this.sun(80, 40, 12, 'rgba(255,255,255,0.85)');
      this.layer('snowPeaks', 640, 120, 80, cam, 0.08, g => {
        for (const [px, pw, ph] of [[90, 120, 110], [300, 150, 90], [520, 110, 118]]) wrap(640, px, pw, x => {
          g.fillStyle = lin(g, x - pw, 0, x + pw, 0, [[0, '#e9f4fb'], [0.5, '#bcd8ea'], [1, '#8fb5d0']]);
          poly(g, [[x - pw, 120], [x, 120 - ph], [x + pw, 120]]);
          g.fill();
          g.fillStyle = '#ffffff';
          poly(g, [[x - pw * 0.28, 120 - ph * 0.72], [x, 120 - ph], [x + pw * 0.28, 120 - ph * 0.72], [x + pw * 0.1, 120 - ph * 0.66], [x - pw * 0.05, 120 - ph * 0.74]]);
          g.fill();
        });
      });
      this.layer('iceSpires', 480, 90, 110, cam, 0.3, g => {
        for (const [sx, sh] of [[60, 70], [90, 50], [260, 86], [290, 60], [400, 64]]) wrap(480, sx, 16, x => {
          g.fillStyle = lin(g, x - 10, 0, x + 10, 0, [[0, 'rgba(210,240,255,0.85)'], [0.5, 'rgba(160,215,245,0.85)'], [1, 'rgba(110,170,215,0.85)']]);
          poly(g, [[x - 10, 90], [x - 3, 90 - sh], [x + 4, 90 - sh * 0.8], [x + 10, 90]]);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,0.7)';
          poly(g, [[x - 6, 90], [x - 3, 90 - sh], [x - 1, 90 - sh * 0.9], [x - 3, 90]]);
          g.fill();
        });
      });
      this.bushes(cam, false);
      for (let i = 0; i < 40; i++) {
        const x = ((hash(i) * W + t * (8 + (i % 5) * 3) - cam * 0.5) % W + W) % W;
        const y = ((hash(i * 7) * PH + t * (14 + (i % 4) * 6)) % PH);
        this.r.rect(x, y, 1.4, 1.4, 'rgba(255,255,255,0.85)');
      }
    }

    airship(cam, t) {
      this.sky(SKIES.airship);
      for (let i = 0; i < 30; i++) this.r.rect(hash(i * 3) * W, hash(i * 5) * 80, 1, 1, 'rgba(255,255,255,0.7)');
      this.clouds(cam, t, 0.3, 30, 7, 26, ['#f6d6e6', '#d6b2cf', '#8e7aa8']);
      this.layer('duskBank', 560, 60, PH - 52, cam, 0.5, g => {
        for (let i = 0; i < 8; i++) {
          const x = (i / 8) * 560, r = 22 + hash(i * 3) * 16;
          wrap(560, x, r, xx => {
            g.fillStyle = rad(g, xx - r * 0.3, 60 - r, 0, r * 1.3, [[0, '#f7c9b4'], [0.6, '#c99ab6'], [1, '#7b6a9c']]);
            circle(g, xx, 60 - r * 0.4, r);
            g.fill();
          });
        }
        g.fillStyle = '#9a85b5';
        g.fillRect(0, 48, 560, 12);
      }, t * 40);
    }

    tank(cam, t) {
      this.sky(SKIES.tank);
      this.farHills(cam, 'tankHills', ['#2c1f36', '#1a1222'], 196, 70, 0.1);
      for (let i = 0; i < 4; i++) {
        const x = ((i * 150 - cam * 0.2) % (W + 150) + W + 150) % (W + 150) - 60;
        this.r.blit('smoke', 40, 90, x, 60, g => {
          for (let k = 0; k < 6; k++) {
            g.fillStyle = `rgba(60,50,70,${0.35 - k * 0.04})`;
            circle(g, 20 + Math.sin(k) * 6, 85 - k * 14, 8 + k * 2);
            g.fill();
          }
        });
      }
      this.r.rect(0, 190, W, 34, 'rgba(30,20,30,0.5)');
    }

    darkLand(cam, t) {
      this.sky(SKIES.lava);
      for (let i = 0; i < 40; i++) this.r.rect(hash(i * 3) * W, hash(i * 9) * 90, 1, 1, 'rgba(230,210,255,0.7)');
      this.layer('volcanoes', 640, 110, 90, cam, 0.12, g => {
        for (const [vx, vw, vh] of [[120, 130, 100], [400, 160, 80], [560, 90, 70]]) wrap(640, vx, vw, x => {
          g.fillStyle = lin(g, 0, 110 - vh, 0, 110, [[0, '#3a2440'], [1, '#160e1c']]);
          poly(g, [[x - vw, 110], [x - 14, 110 - vh], [x + 14, 110 - vh], [x + vw, 110]]);
          g.fill();
          g.fillStyle = rad(g, x, 110 - vh, 0, 30, [[0, 'rgba(255,170,60,0.9)'], [1, 'rgba(255,80,30,0)']]);
          circle(g, x, 110 - vh, 30);
          g.fill();
          g.strokeStyle = 'rgba(255,110,40,0.85)';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x - 6, 110 - vh + 2);
          g.bezierCurveTo(x - 20, 110 - vh * 0.6, x - 4, 110 - vh * 0.4, x - 26, 110);
          g.stroke();
        });
      });
      for (let i = 0; i < 18; i++) {
        const x = ((hash(i * 11) * W - cam * 0.3 + Math.sin(t * 2 + i) * 6) % W + W) % W;
        const y = PH - (((t * (20 + (i % 5) * 8) + hash(i) * PH) % PH));
        this.r.blit('ember', 4, 4, x, y, g => MarioHD.glow(g, 2, 'rgba(255,200,90,0.95)', 'rgba(255,90,30,0)'));
      }
      const g = this.r.c;
      if (typeof g.createLinearGradient === 'function') {
        g.fillStyle = lin(g, 0, 170, 0, PH, [[0, 'rgba(160,40,30,0)'], [1, 'rgba(160,40,30,0.45)']]);
        g.fillRect(0, 170, W, PH - 170);
      }
    }

    cave(cam, t) {
      this.layer('caveWall', 256, PH, 0, cam, 0.12, g => {
        g.fillStyle = lin(g, 0, 0, 0, PH, SKIES.cave);
        g.fillRect(0, 0, 256, PH);
        for (let y = 0; y < PH; y += 24) for (let x = 0; x < 256; x += 32) {
          const xx = x + ((y / 24) % 2 ? 16 : 0);
          for (const ox of [xx, xx - 256]) {
            g.fillStyle = lin(g, 0, y, 0, y + 24, [[0, '#24365a'], [1, '#162440']]);
            rr(g, ox + 1, y + 1, 30, 22, 3);
            g.fill();
            g.fillStyle = 'rgba(160,190,230,0.18)';
            g.fillRect(ox + 3, y + 2, 26, 1.2);
          }
        }
        for (const [cx, cy] of [[60, 60], [190, 140]]) {
          g.fillStyle = rad(g, cx, cy, 0, 18, [[0, 'rgba(120,220,255,0.35)'], [1, 'rgba(120,220,255,0)']]);
          circle(g, cx, cy, 18);
          g.fill();
          g.fillStyle = lin(g, cx - 4, 0, cx + 4, 0, [[0, '#9fe9ff'], [1, '#3a9ccc']]);
          poly(g, [[cx - 4, cy + 6], [cx - 1, cy - 8], [cx + 4, cy + 6]]);
          g.fill();
        }
      });
      this.vignette();
    }

    castle(cam, t, bowser) {
      this.layer('castleWall' + (bowser ? 'B' : ''), 224, PH, 0, cam, 0.15, g => {
        g.fillStyle = lin(g, 0, 0, 0, PH, SKIES.castle);
        g.fillRect(0, 0, 224, PH);
        for (let y = 0; y < PH; y += 20) for (let x = 0; x < 224; x += 28) {
          const xx = x + ((y / 20) % 2 ? 14 : 0);
          for (const ox of [xx, xx - 224]) {
            g.fillStyle = lin(g, 0, y, 0, y + 20, bowser ? [[0, '#3d3040'], [1, '#2a2030']] : [[0, '#2e3650'], [1, '#202740']]);
            rr(g, ox + 1, y + 1, 26, 18, 2);
            g.fill();
            g.fillStyle = 'rgba(200,210,240,0.12)';
            g.fillRect(ox + 3, y + 2, 22, 1);
          }
        }
        for (const wx of [56, 168]) {
          g.fillStyle = '#0a0e1a';
          rr(g, wx - 15, 30, 30, 100, 15);
          g.fill();
          g.fillStyle = lin(g, 0, 30, 0, 130, [[0, '#2b3d73'], [1, '#121a35']]);
          rr(g, wx - 12, 33, 24, 94, 12);
          g.fill();
          g.fillStyle = rad(g, wx + 4, 52, 0, 6, [[0, '#fffbe6'], [1, 'rgba(255,250,220,0)']]);
          circle(g, wx + 4, 52, 6);
          g.fill();
          g.fillStyle = '#0a0e1a';
          g.fillRect(wx - 1, 33, 2, 94);
          g.fillRect(wx - 12, 78, 24, 2);
        }
      });
      // tochas com chama animada e luz
      const off = (((cam * 0.15) % 112) + 112) % 112;
      for (let x = -off; x < W + 40; x += 112) {
        this.r.blit('torchGlow', 60, 60, x - 30, 64, g => MarioHD.glow(g, 30, 'rgba(255,170,70,0.35)', 'rgba(255,120,40,0)'));
        this.r.rect(x - 2, 92, 4, 14, '#6b4a3a');
        const f = Math.floor(t * 10) % 3;
        this.r.blit('flame' + f, 10, 16, x - 5, 76, g => {
          const sway = [0, 1.2, -1][f];
          g.fillStyle = MarioHD.rad(g, 5, 11, 0, 9, [[0, '#fff6c2'], [0.4, '#ffbf3d'], [1, 'rgba(255,90,30,0)']]);
          g.beginPath();
          g.moveTo(5 + sway, 0);
          g.bezierCurveTo(10, 7, 9, 14, 5, 16);
          g.bezierCurveTo(1, 14, 0, 7, 5 + sway, 0);
          g.fill();
        });
      }
      if (bowser) {
        const g = this.r.c;
        if (typeof g.createLinearGradient === 'function') {
          g.fillStyle = lin(g, 0, 130, 0, PH, [[0, 'rgba(255,80,30,0)'], [1, 'rgba(255,80,30,0.35)']]);
          g.fillRect(0, 130, W, PH - 130);
        }
      }
      this.vignette();
    }

    // Escurece só as bordas (mais barato que uma camada de tela inteira).
    vignette() {
      const edge = (key, w, h, x, y, x0, y0, x1, y1) => this.r.blit(key, w, h, x, y, g => {
        g.fillStyle = lin(g, x0, y0, x1, y1, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);
        g.fillRect(0, 0, w, h);
      });
      this.fixed(() => {
        edge('vigL', 56, PH, 0, 0, 0, 0, 56, 0);
        edge('vigR', 56, PH, W - 56, 0, 56, 0, 0, 0);
        edge('vigT', W, 36, 0, 0, 0, 0, 0, 36);
      });
    }

    ground(l, tx, ty, x, y) {
      const above = l.tiles[ty - 1] ? l.tiles[ty - 1][tx] : 0;
      const top = above !== 1;
      const variant = (tx * 3 + ty * 5) % 13;
      this.r.blit(`ground-${l.theme}-${top ? 1 : 0}-${variant}`, 16, 16, x, y, g => MarioHD.ground(g, l.theme, top, variant));
    }
  }

  globalThis.MarioScenery = MarioScenery;
})();
