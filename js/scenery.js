/* Cenários em camadas desenhados por código, sem imagens externas.
 * Cada forma repetida (nuvem, colina, arbusto, painel, chão) é desenhada uma vez numa
 * imagem em cache e depois apenas copiada a cada quadro. */
(() => {
  'use strict';

  class MarioScenery {
    constructor(renderer) {
      this.r = renderer;
    }

    // Desenha uma forma em cache (ou direto, se o contexto não suportar imagens).
    shape(key, w, h, x, y, paint) {
      this.r.blit(key, w, h, x, y, paint);
    }

    static oval(b, x, y, w, h, c) {
      for (let row = 0; row < h; row++) {
        const f = Math.sqrt(Math.max(0, 1 - ((row + 0.5 - h / 2) / (h / 2)) ** 2));
        const span = Math.max(1, Math.round(w * f));
        b(x + Math.floor((w - span) / 2), y + row, span, 1, c);
      }
    }

    cloud(x, y, scale = 1) {
      this.shape('cloud' + scale, 36 * scale, 21 * scale, x, y, (b) => {
        const q = (xx, yy, w, h, c) => b(xx * scale, yy * scale, w * scale, h * scale, c);
        q(3, 5, 30, 12, '#152a3e'); q(8, 1, 17, 20, '#152a3e'); q(1, 9, 34, 6, '#152a3e');
        q(4, 6, 28, 10, '#fffbe9'); q(9, 2, 15, 17, '#fffbe9'); q(2, 10, 32, 4, '#fffbe9');
        q(5, 16, 26, 2, '#c6e4ef'); q(13, 7, 2, 5, '#172741'); q(20, 7, 2, 5, '#172741');
        q(13, 7, 1, 1, '#fff'); q(20, 7, 1, 1, '#fff');
      });
    }

    hill(x, base, w, h, c) {
      this.shape(`hill${w}x${h}${c}`, w, h * 2, x, base - h, (b) => {
        MarioScenery.oval(b, 0, 0, w, h * 2, '#244d48');
        MarioScenery.oval(b, 2, 2, w - 4, h * 2 - 3, c);
        MarioScenery.oval(b, Math.round(w * 0.3), 15, 4, 10, '#b8e98f');
        b(Math.round(w * 0.5) - 6, 25, 2, 6, '#244d48');
        b(Math.round(w * 0.5) + 3, 25, 2, 6, '#244d48');
      });
    }

    bush(x, y, scale = 1) {
      this.shape('bush' + scale, 40 * scale, 24 * scale, x, y - 4 * scale, (b) => {
        const q = (xx, yy, w, h, c) => b(xx * scale, yy * scale, w * scale, h * scale, c);
        for (let i = 0; i < 3; i++) {
          MarioScenery.oval(q, i * 11, 4 - (i % 2) * 4, 18, 19, '#193f33');
          MarioScenery.oval(q, i * 11 + 1, 5 - (i % 2) * 4, 16, 17, '#71ca49');
          q(i * 11 + 5, 7 - (i % 2) * 4, 5, 2, '#b1ed6a');
        }
        q(3, 19, 34, 2, '#3a8c38');
      });
    }

    panel(x, y, w, h, color) {
      this.shape(`panel${w}x${h}${color}`, w + 4, h + 4, x, y, (b) => {
        b(4, 4, w, h, '#354745'); b(0, 0, w, h, '#202b3d'); b(1, 1, w - 2, h - 2, color); b(2, 2, w - 4, 2, '#ffffff90');
        b(w - 3, 3, 2, h - 5, '#00000028');
        for (const xx of [4, w - 6]) for (const yy of [4, h - 6]) { b(xx, yy, 2, 2, '#314351'); b(xx, yy, 1, 1, '#f3f1d8'); }
      });
    }

    pipeDecor(x, y, h) {
      this.shape('bgpipe' + h, 32, h, x, y, (b) => {
        b(0, 0, 32, 10, '#2f6b4f'); b(2, 10, 28, h - 10, '#3f8a63'); b(5, 10, 5, h - 10, '#68b083'); b(1, 1, 30, 3, '#68b083');
      });
    }

    draw(l, cam, t) {
      const b = this.r.rect.bind(this.r), theme = l.theme;
      const dark = ['castle', 'bowser', 'underground'].includes(theme);
      if (dark) return this.dungeon(l, cam, t, theme);
      if (theme === 'lava' || theme === 'tank') return this.darkLand(l, cam, t, theme);
      if (theme === 'water') return this.underwater(l, cam, t);
      const sky = { airship: '#697fad', ice: '#a5d9f0', desert: '#f6d79a', sea: '#7fc7ea', sky: '#9bd6f0' }[theme] || '#8ecfea';
      b(0, 0, 384, 224, sky);
      if (theme === 'desert') {
        for (let i = -1; i < 5; i++) {
          const x = Math.floor(i * 123 - ((cam * 0.2) % 123));
          this.shape('pyr', 145, 72, x, 121, (q) => { for (let y = 0; y < 72; y++) { q(70 - y, y, y * 2 + 1, 1, '#e4b270'); q(70, y, y, 1, '#c38f57'); } });
        }
        for (let i = -1; i < 6; i++) {
          const x = Math.floor(i * 88 - ((cam * 0.4) % 88));
          this.shape('cactus', 20, 36, x - 8, 157, (q) => {
            q(8, 1, 5, 34, '#649249'); q(0, 12, 9, 4, '#649249'); q(0, 5, 4, 10, '#649249'); q(12, 9, 7, 4, '#649249'); q(16, 0, 3, 13, '#649249'); q(9, 2, 1, 31, '#a3bf69');
          });
        }
        return;
      }
      for (let i = -1; i < 5; i++) this.cloud(Math.floor(i * 116 - ((cam * 0.12) % 116)), 22 + (Math.abs(i) % 3) * 17);
      if (theme === 'airship') {
        for (let i = -1; i < 4; i++) this.cloud(Math.floor(i * 145 - ((cam * 0.4) % 145)), 151 + (i % 2) * 19, 1.5);
        return;
      }
      if (theme === 'sky') {
        for (let i = -1; i < 5; i++) this.cloud(Math.floor(i * 96 - ((cam * 0.3) % 96)), 174 + (i % 2) * 8, 1.5);
        return;
      }
      if (theme === 'sea') {
        b(0, 150, 384, 74, '#3d8fc4');
        for (let i = 0; i < 24; i++) b(((i * 41 - cam * 0.3) % 400 + 400) % 400 - 8, 156 + (i % 5) * 12, 10, 1, '#9ad6f0');
        for (let i = -1; i < 4; i++) {
          const x = Math.floor(i * 150 - ((cam * 0.15) % 150));
          this.shape('island', 90, 30, x + 20, 128, (q) => { MarioScenery.oval(q, 0, 0, 90, 44, '#2f7a5a'); MarioScenery.oval(q, 6, 4, 78, 36, '#58b07a'); });
        }
        b(0, 150, 384, 2, '#d9f3ff');
        return;
      }
      if (theme === 'ice') {
        for (let i = -1; i < 5; i++) {
          const x = Math.floor(i * 108 - ((cam * 0.25) % 108));
          this.hill(x, 194, 72, 100, '#d8eff2');
          b(x + 23, 108, 4, 37, '#b4d8e6');
          b(x + 44, 143, 3, 44, '#a4c8df');
        }
        for (let i = 0; i < 28; i++) b((i * 37 + t * 6) % 384, (i * 29 + t * 12) % 192, 1, 2, '#fff');
        return;
      }
      const giant = theme === 'giant';
      for (let i = -1; i < 4; i++) {
        const x = Math.floor(i * 145 - ((cam * 0.18) % 145));
        if (giant) { this.hill(x + 10, 214, 110, 130, '#83cf8b'); }
        else { this.hill(x + 35, 197, 69, 88, '#83cf8b'); this.hill(x, 202, 55, 58, '#9fdfa1'); }
      }
      if (theme === 'pipe') {
        for (let i = -1; i < 5; i++) this.pipeDecor(Math.floor(i * 120 - ((cam * 0.35) % 120)) + 40, 120 + (i % 2) * 24, 104);
      } else {
        // Painéis aparafusados lembram os cenários de teatro do terceiro jogo.
        for (let i = -1; i < 4; i++) {
          const x = Math.floor(i * 164 - ((cam * 0.35) % 164));
          if (giant) { this.panel(x + 40, 100, 70, 98, '#a9d2df'); this.panel(x + 104, 136, 52, 62, '#efc5b5'); }
          else { this.panel(x + 60, 139, 46, 59, '#a9d2df'); this.panel(x + 100, 158, 34, 40, '#efc5b5'); }
        }
      }
      for (let i = -1; i < 7; i++) this.bush(Math.floor(i * 76 - ((cam * 0.55) % 76)) * (giant ? 1 : 1), giant ? 160 : 176, giant ? 1.5 : 1);
    }

    dungeon(l, cam, t, theme) {
      const b = this.r.rect.bind(this.r);
      b(0, 0, 384, 224, theme === 'underground' ? '#0d1424' : '#10172e');
      const brick = theme === 'underground' ? ['#1d2b45', '#2c3d5c', '#121a2c'] : ['#263047', '#3c4660', '#171f34'];
      this.shape('wall-' + theme, 448, 192, -Math.floor((cam * 0.1) % 32) - 32, 0, (q) => {
        for (let y = 0; y < 192; y += 16) for (let x = 0; x < 448; x += 32) {
          const xx = x + (y % 32 ? 16 : 0);
          q(xx, y, 31, 15, brick[0]); q(xx + 1, y + 1, 29, 1, brick[1]); q(xx + 30, y + 2, 1, 12, brick[2]);
        }
      });
      if (theme === 'underground') return;
      for (let i = -1; i < 5; i++) {
        const x = Math.floor(i * 112 - ((cam * 0.18) % 112));
        this.shape('window', 27, 130, x + 24, 30, (q) => {
          q(0, 12, 27, 118, '#11182c'); MarioScenery.oval(q, 0, 0, 27, 29, '#11182c');
          q(10, 5, 2, 123, '#384259'); q(0, 48, 27, 2, '#384259'); q(0, 89, 27, 2, '#384259');
        });
        for (const xx of [x + 8, x + 67]) {
          b(xx, 84, 5, 14, '#9c7466');
          this.shape('torch' + (t % 1 < 0.5 ? 'a' : 'b'), 9, 12, xx - 2, 74, (q) => { MarioScenery.oval(q, 0, 0, 9, 12, t % 1 < 0.5 ? '#ff942f' : '#ffbf49'); MarioScenery.oval(q, 2, 3, 4, 8, '#fff2a2'); });
        }
      }
    }

    darkLand(l, cam, t, theme) {
      const b = this.r.rect.bind(this.r);
      b(0, 0, 384, 224, '#241c33');
      for (let y = 0; y < 120; y += 8) b(0, y, 384, 8, y < 40 ? '#2a1f3b' : y < 80 ? '#33223f' : '#3f2541');
      for (let i = 0; i < 30; i++) b((i * 53) % 384, (i * 31) % 90, 1, 1, '#d9c7ff');
      for (let i = -1; i < 4; i++) {
        const x = Math.floor(i * 160 - ((cam * 0.15) % 160));
        this.shape('volcano', 150, 90, x, 110, (q) => {
          for (let y = 0; y < 90; y++) q(60 - y * 0.8, y, 30 + y * 1.6, 1, '#1a1426');
          q(56, 0, 38, 3, '#e0562f'); q(62, 3, 26, 2, '#ff9a3d');
        });
      }
      b(0, 196, 384, 28, theme === 'tank' ? '#2b2431' : '#3a1c1c');
      if (theme === 'lava') for (let x = 0; x < 384; x += 6) b(x, 198 + Math.sin(x * 0.3 + t * 4) * 1.5, 4, 2, '#e0562f');
    }

    underwater(l, cam, t) {
      const b = this.r.rect.bind(this.r), top = l.water ? l.water.top : 56;
      b(0, 0, 384, top, '#9ad8f2');
      b(0, top, 384, 224 - top, '#3c96d5');
      for (let i = -1; i < 9; i++) {
        const x = Math.floor(i * 56 - ((cam * 0.25) % 56));
        this.shape('rock', 50, 100, x, 128 + (i % 2) * 15, (q) => {
          MarioScenery.oval(q, 0, 0, 50, 100, '#367eb3');
          for (let j = 0; j < 3; j++) { const xx = 6 + j * 13; q(xx, 35 - j * 5, 3, 34, '#2c927a'); q(xx - 5, 43 - j * 5, 7, 3, '#52bd84'); q(xx + 2, 38 - j * 5, 5, 3, '#52bd84'); }
        });
      }
      for (let i = 0; i < 15; i++) {
        const x = ((i * 37 - cam * 0.4) % 400 + 400) % 400, y = top + (((i * 47 - t * 12) % (180 - top)) + (180 - top)) % (180 - top);
        b(x, y, 3, 1, '#b2edff'); b(x - 1, y + 1, 1, 2, '#b2edff'); b(x + 3, y + 1, 1, 2, '#b2edff'); b(x, y + 3, 3, 1, '#7ac9e9');
      }
      for (let x = 0; x < 384; x += 16) b(x - ((cam * 0.6) % 16), top - 2, 10, 2, '#dcf7ff');
    }

    ground(l, tx, ty, x, y) {
      const above = l.tiles[ty - 1] ? l.tiles[ty - 1][tx] : 0;
      const top = above !== 1;
      const theme = l.theme;
      const pal = {
        desert: ['#efd089', '#ffe6a2', '#f0ce7f', '#d6a865', '#263735'],
        sea: ['#efd8a0', '#fff0c0', '#f7e0a6', '#d2a868', '#263735'],
        water: ['#d9c48c', '#efe0a8', '#e7d49a', '#b89a62', '#2b4a5c'],
        lava: ['#5c3a46', '#8c5a5f', '#7a4a52', '#3f2630', '#160f1d'],
        tank: ['#4a4552', '#6d6779', '#5e5869', '#332f3b', '#16131d'],
        ice: ['#d9eef5', '#ffffff', '#eaf6fa', '#9cc4d6', '#33526a'],
        pipe: ['#c9b48a', '#9fd27a', '#e1f2bd', '#a68a5c', '#263735'],
        sky: ['#edba80', '#f6dca2', '#fff0bd', '#d89a66', '#263735']
      }[theme] || ['#edba80', '#f6dca2', '#fff0bd', '#d89a66', '#263735'];
      const variant = (tx * 3 + ty * 5) % 13;
      this.shape(`ground-${theme}-${top ? 1 : 0}-${variant}`, 16, 16, x, y, (b) => {
        b(0, 0, 16, 16, pal[0]);
        for (let i = 0; i < 16; i += 4) b(i, (i + variant) % 13, 2, 1, pal[3]);
        if (top) {
          b(0, 0, 16, 1, pal[4]);
          b(0, 1, 16, 3, pal[1]);
          b(0, 4, 16, 1, '#765843');
          for (let i = 0; i < 16; i += 4) { b(i, 2, 2, 1, pal[2]); b(i + 1, 5, 1, 2, pal[3]); }
        } else {
          for (let i = -12; i < 16; i += 8) for (let j = 0; j < 16; j++) if (i + j >= 0 && i + j < 16) b(i + j, j, 1, 1, pal[3]);
        }
      });
    }
  }

  globalThis.MarioScenery = MarioScenery;
})();
