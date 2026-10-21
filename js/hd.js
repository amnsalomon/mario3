/* Arte em alta definição desenhada por vetores (gradientes, luz e sombra) para cenários,
 * blocos, moedas, efeitos, mapa e interface. Tudo aqui é genérico e original deste projeto;
 * personagens e itens continuam com os desenhos em pixel art de sprites.js.
 * As funções recebem um contexto 2D já escalado para unidades lógicas (1 = 1 pixel do jogo). */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const hash = n => {
    let x = (Math.imul(n | 0, 374761393) + 1013904223) | 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  function lin(g, x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  }
  function rad(g, x, y, r0, r1, stops) {
    const gr = g.createRadialGradient(x, y, r0, x, y, r1);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  }
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.01, r), 0, TAU); }
  function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); }
  function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
  function bolt(g, x, y, r = 1.1) {
    g.fillStyle = rad(g, x - r * 0.3, y - r * 0.3, 0, r, [[0, '#ffffff'], [0.45, '#c9d2dc'], [1, '#5d6878']]);
    circle(g, x, y, r);
    g.fill();
  }

  /* ------------------------------- Blocos ------------------------------- */
  const GROUND = {
    grass: { top: ['#8fe05f', '#4daa3a'], blade: '#b8f28a', dark: '#2e6b2a', body: ['#d8a066', '#a9683a'], speck: '#8c5530', light: '#f3cf98' },
    giant: { top: ['#8fe05f', '#4daa3a'], blade: '#b8f28a', dark: '#2e6b2a', body: ['#d8a066', '#a9683a'], speck: '#8c5530', light: '#f3cf98' },
    sky: { top: ['#9be86c', '#55b444'], blade: '#c6f59a', dark: '#2e6b2a', body: ['#e2b07a', '#b67a48'], speck: '#94603a', light: '#f7dcae' },
    pipe: { top: ['#86d067', '#4b9a45'], blade: '#b6ef8d', dark: '#2e6331', body: ['#c7a47a', '#9a7650'], speck: '#7d5c3c', light: '#e6c79e' },
    desert: { top: ['#fbe3a2', '#eabf6c'], dark: '#b8863f', body: ['#f0cd86', '#d3a35a'], speck: '#bd8c48', light: '#fff0c8', ripple: true },
    sea: { top: ['#fbeab4', '#ebcd86'], dark: '#b39657', body: ['#f1dba2', '#d6b475'], speck: '#c29f62', light: '#fff4d2', ripple: true },
    water: { top: ['#e6d59c', '#cbb77b'], dark: '#7f6d44', body: ['#d2c088', '#a8935f'], speck: '#8f7b4f', light: '#f2e6bd', ripple: true },
    ice: { top: ['#ffffff', '#e2f3fb'], dark: '#86aec7', body: ['#d4ebf5', '#9fc6dc'], speck: '#87afc8', light: '#ffffff', snow: true },
    lava: { top: ['#7b5162', '#553646'], dark: '#241520', body: ['#4b3141', '#2c1b26'], speck: '#1c1118', light: '#8e6577', crack: true },
    tank: { top: ['#8a8496', '#625d70'], dark: '#2a2732', body: ['#4f4a5c', '#34303e'], speck: '#262330', light: '#a19bb0', plate: true }
  };

  function ground(g, theme, top, variant) {
    const p = GROUND[theme] || GROUND.grass;
    g.fillStyle = lin(g, 0, 0, 0, 16, [[0, p.body[0]], [1, p.body[1]]]);
    g.fillRect(0, 0, 16, 16);
    if (p.plate) {
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 0.5;
      g.strokeRect(0.25, 0.25, 15.5, 15.5);
      bolt(g, 2.5, 13.5, 0.8); bolt(g, 13.5, 13.5, 0.8);
    }
    for (let i = 0; i < 7; i++) {
      const x = 1 + hash(variant * 31 + i * 7) * 14, y = (top ? 6 : 1) + hash(variant * 17 + i * 3) * (top ? 9 : 14), r = 0.5 + hash(i * 13 + variant) * 0.8;
      g.fillStyle = p.speck;
      g.globalAlpha = 0.55;
      ellipse(g, x, y, r * 1.3, r);
      g.fill();
      g.fillStyle = p.light;
      g.globalAlpha = 0.45;
      ellipse(g, x - 0.3, y - 0.35, r * 0.6, r * 0.4);
      g.fill();
    }
    g.globalAlpha = 1;
    if (p.crack) {
      g.strokeStyle = '#ff7a2e';
      g.lineWidth = 0.6;
      g.shadowColor = '#ff8a3d';
      g.shadowBlur = 2;
      g.beginPath();
      const a = hash(variant) * 10;
      g.moveTo(2 + a * 0.5, top ? 6 : 1);
      g.lineTo(5 + a * 0.3, 9);
      g.lineTo(3 + a * 0.6, 15);
      g.stroke();
      g.shadowBlur = 0;
    }
    if (!top) return;
    // faixa de cima ondulada (período de 8 px para encaixar com o bloco vizinho)
    const wave = x => 4.4 + Math.sin((x / 8) * TAU) * 0.7;
    g.fillStyle = lin(g, 0, 0, 0, 5.5, [[0, p.top[0]], [1, p.top[1]]]);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(16, 0);
    for (let x = 16; x >= 0; x -= 1) g.lineTo(x, wave(x));
    g.closePath();
    g.fill();
    g.strokeStyle = p.dark;
    g.globalAlpha = 0.55;
    g.lineWidth = 0.7;
    g.beginPath();
    for (let x = 0; x <= 16; x += 1) x ? g.lineTo(x, wave(x) + 0.3) : g.moveTo(x, wave(x) + 0.3);
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(0, 0.5, 16, 0.6);
    if (p.blade) {
      g.fillStyle = p.blade;
      for (let i = 0; i < 6; i++) {
        const x = i * 2.7 + hash(variant + i) * 1.4;
        poly(g, [[x, 2.4], [x + 0.6, 0.2 + hash(i * 7 + variant) * 0.8], [x + 1.3, 2.4]]);
        g.fill();
      }
    }
    if (p.ripple) {
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 0.4;
      g.beginPath();
      g.moveTo(1, 2.6);
      g.quadraticCurveTo(4, 1.6, 7, 2.6);
      g.moveTo(9, 2.2);
      g.quadraticCurveTo(12, 1.2, 15, 2.2);
      g.stroke();
    }
    if (p.snow) {
      g.fillStyle = 'rgba(160,205,230,0.5)';
      for (let i = 0; i < 4; i++) { circle(g, 2 + i * 4 + hash(variant + i) * 2, 3.2, 0.5); g.fill(); }
    }
  }

  function brick(g) {
    g.fillStyle = '#6e3418';
    g.fillRect(0, 0, 16, 16);
    const rows = [[0, [[0, 8], [8, 8]]], [8, [[-4, 8], [4, 8], [12, 8]]]];
    for (const [y, bricks] of rows) for (const [x, w] of bricks) {
      const x0 = Math.max(0, x) + 0.45, x1 = Math.min(16, x + w) - 0.45;
      g.fillStyle = lin(g, 0, y, 0, y + 8, [[0, '#e2834a'], [1, '#b2562a']]);
      g.fillRect(x0, y + 0.45, x1 - x0, 7.1);
      g.fillStyle = 'rgba(255,214,170,0.75)';
      g.fillRect(x0, y + 0.45, x1 - x0, 0.8);
      g.fillStyle = 'rgba(70,25,8,0.45)';
      g.fillRect(x0, y + 6.75, x1 - x0, 0.8);
    }
  }

  const STONE = {
    castle: ['#a4abb8', '#6f7889', '#d6dbe3', '#4a5262'],
    bowser: ['#9a8f98', '#665b66', '#c9bcc4', '#3e343e'],
    underground: ['#6f8fb5', '#455f82', '#a7c0dc', '#2c3d58'],
    lava: ['#7d6f86', '#4f4459', '#a597ad', '#2e2636'],
    tank: ['#77778a', '#4b4b5c', '#a3a3b6', '#2b2b38'],
    pipe: ['#9aa6a0', '#66726c', '#c9d3cd', '#3f4944'],
    default: ['#a4abb8', '#6f7889', '#d6dbe3', '#4a5262']
  };
  function stone(g, theme, variant) {
    const [hi, lo, light, dark] = STONE[theme] || STONE.default;
    g.fillStyle = lin(g, 0, 0, 16, 16, [[0, hi], [1, lo]]);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = light;
    g.globalAlpha = 0.8;
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 0, 1, 16);
    g.fillStyle = dark;
    g.fillRect(0, 15, 16, 1);
    g.fillRect(15, 0, 1, 16);
    g.globalAlpha = 0.25;
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? dark : light;
      ellipse(g, 2 + hash(variant * 7 + i) * 12, 2 + hash(variant * 11 + i * 5) * 12, 1.2, 0.6);
      g.fill();
    }
    if (hash(variant * 3) > 0.6) {
      g.strokeStyle = dark;
      g.globalAlpha = 0.5;
      g.lineWidth = 0.4;
      g.beginPath();
      g.moveTo(4, 2);
      g.lineTo(6, 6);
      g.lineTo(5, 9);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function wood(g, airship) {
    const c = airship ? ['#b67b45', '#8a5530', '#4a2a16', '#e0a96f'] : ['#d9a35f', '#b07a3c', '#6b4220', '#f4cc8c'];
    for (let i = 0; i < 4; i++) {
      const y = i * 4;
      g.fillStyle = lin(g, 0, y, 0, y + 4, [[0, c[0]], [1, c[1]]]);
      g.fillRect(0, y, 16, 4);
      g.fillStyle = c[3];
      g.globalAlpha = 0.6;
      g.fillRect(0, y, 16, 0.5);
      g.globalAlpha = 1;
      g.fillStyle = c[2];
      g.fillRect(0, y + 3.5, 16, 0.5);
      g.strokeStyle = c[2];
      g.globalAlpha = 0.3;
      g.lineWidth = 0.3;
      g.beginPath();
      g.moveTo(1, y + 1.8);
      g.bezierCurveTo(5, y + 1.2, 9, y + 2.6, 15, y + 1.7);
      g.stroke();
      g.globalAlpha = 1;
      bolt(g, i % 2 ? 2 : 14, y + 2, 0.55);
    }
  }

  function ice(g) {
    g.fillStyle = lin(g, 0, 0, 16, 16, [[0, '#e9f8ff'], [0.5, '#a9dcf2'], [1, '#6fb3d8']]);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    poly(g, [[1, 1], [9, 1], [1, 9]]);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    poly(g, [[6, 15], [15, 6], [15, 9], [9, 15]]);
    g.fill();
    g.strokeStyle = 'rgba(40,90,130,0.6)';
    g.lineWidth = 0.6;
    g.strokeRect(0.3, 0.3, 15.4, 15.4);
  }

  function sand(g, frame) {
    g.fillStyle = lin(g, 0, 0, 0, 16, [[0, '#f6d78b'], [1, '#d9a95a']]);
    g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 12; i++) {
      const x = (hash(i * 13) * 16 + frame * 0.8 + i) % 16, y = (hash(i * 7) * 16 + frame * 1.5) % 16;
      g.fillStyle = i % 3 ? 'rgba(160,110,50,0.5)' : 'rgba(255,240,200,0.7)';
      circle(g, x, y, 0.45);
      g.fill();
    }
    g.fillStyle = 'rgba(255,245,210,0.6)';
    g.fillRect(0, 0, 16, 0.7);
  }

  function cloud(g) {
    const c = [[3, 6, 4], [8, 4.5, 5], [13, 6, 4]];
    g.fillStyle = 'rgba(80,120,170,0.25)';
    for (const [x, y, r] of c) { circle(g, x + 0.6, y + 1.4, r); g.fill(); }
    for (const [x, y, r] of c) {
      g.fillStyle = rad(g, x - r * 0.3, y - r * 0.4, 0, r * 1.2, [[0, '#ffffff'], [0.7, '#f3f8ff'], [1, '#cfe1f3']]);
      circle(g, x, y, r);
      g.fill();
    }
    g.fillStyle = lin(g, 0, 6, 0, 11, [[0, '#ffffff'], [1, '#d6e6f5']]);
    rr(g, 0, 5, 16, 5.5, 2.5);
    g.fill();
  }

  function platform(g) {
    g.fillStyle = lin(g, 0, 0, 0, 16, [[0, '#7ab8f2'], [1, '#3d74b8']]);
    rr(g, 0.4, 0.4, 15.2, 15.2, 2);
    g.fill();
    g.strokeStyle = '#1d3d66';
    g.lineWidth = 0.7;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(2, 1.5, 12, 1);
    for (const [x, y] of [[3, 4], [13, 4], [3, 12.5], [13, 12.5]]) bolt(g, x, y, 0.9);
  }

  function lava(g, frame) {
    g.fillStyle = lin(g, 0, 0, 0, 16, [[0, '#ffd166'], [0.25, '#ff8a2a'], [1, '#c2260f']]);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = 'rgba(255,240,170,0.85)';
    g.beginPath();
    g.moveTo(0, 0);
    for (let x = 0; x <= 16; x++) g.lineTo(x, 2 + Math.sin(((x + frame * 2) / 8) * TAU) * 1.1);
    g.lineTo(16, 0);
    g.closePath();
    g.fill();
    for (let i = 0; i < 3; i++) {
      const x = (hash(i * 9) * 16 + frame * 0.7) % 16, y = 6 + ((hash(i * 5) * 9 + frame * 1.3) % 9);
      g.fillStyle = 'rgba(255,220,120,0.7)';
      circle(g, x, y, 0.8 + hash(i) * 0.6);
      g.fill();
    }
  }

  function spike(g) {
    g.fillStyle = lin(g, 0, 13, 0, 16, [[0, '#7c8696'], [1, '#3b4352']]);
    g.fillRect(0, 13, 16, 3);
    for (let x = 0; x < 16; x += 8) {
      g.fillStyle = lin(g, x, 0, x + 8, 0, [[0, '#f4f7fb'], [0.5, '#a9b4c3'], [1, '#596273']]);
      poly(g, [[x + 0.3, 13], [x + 4, 1], [x + 7.7, 13]]);
      g.fill();
      g.strokeStyle = '#2b313c';
      g.lineWidth = 0.5;
      g.stroke();
    }
  }

  function cannon(g) {
    g.fillStyle = lin(g, 0, 0, 16, 0, [[0, '#262b36'], [0.35, '#59627a'], [1, '#1a1e27']]);
    rr(g, 0.5, 0.5, 15, 15, 2.5);
    g.fill();
    g.fillStyle = rad(g, 8, 8, 0.5, 5, [[0, '#000'], [0.7, '#11151c'], [1, '#3a4252']]);
    circle(g, 8, 8, 4.4);
    g.fill();
    g.strokeStyle = '#b8c2d4';
    g.lineWidth = 0.6;
    g.beginPath();
    g.arc(8, 8, 4.6, Math.PI * 1.1, Math.PI * 1.6);
    g.stroke();
    for (const [x, y] of [[2.5, 2.5], [13.5, 2.5], [2.5, 13.5], [13.5, 13.5]]) bolt(g, x, y, 0.8);
  }
  function cannonBase(g) {
    g.fillStyle = lin(g, 2, 0, 14, 0, [[0, '#1d222c'], [0.4, '#4d566b'], [1, '#161a22']]);
    g.fillRect(2.5, 0, 11, 16);
    g.fillStyle = lin(g, 0, 5, 0, 10, [[0, '#6b768d'], [1, '#2f3644']]);
    rr(g, 1, 5.5, 14, 4, 1);
    g.fill();
  }

  function pipe(g, part) {
    const body = part.includes('body'), left = part.includes('left');
    const offset = left ? 0 : -16;
    const grad = lin(g, offset, 0, offset + 32, 0, [[0, '#1f5a2a'], [0.18, '#5fbf54'], [0.32, '#b9f59a'], [0.5, '#5fbf54'], [0.85, '#2f7d36'], [1, '#174a20']]);
    if (body) {
      g.fillStyle = grad;
      g.fillRect(left ? 1.6 : 0, 0, left ? 14.4 : 14.4, 16);
      g.fillStyle = '#123d1a';
      g.fillRect(left ? 1.2 : 14.4, 0, 0.6, 16);
      return;
    }
    g.fillStyle = grad;
    rr(g, left ? 0 : -4, 0.5, 20, 7, 1.5);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, 1.2, 16, 0.8);
    g.fillStyle = '#123d1a';
    g.fillRect(0, 7.2, 16, 0.8);
    g.fillRect(left ? 0 : 15.4, 0.6, 0.6, 7);
    g.fillStyle = grad;
    g.fillRect(left ? 1.6 : 0, 8, 14.4, 8);
    g.fillStyle = '#123d1a';
    g.fillRect(left ? 1.2 : 14.4, 8, 0.6, 8);
  }

  function lift(g) {
    g.fillStyle = lin(g, 0, 0, 0, 8, [[0, '#f0b264'], [1, '#a8652c']]);
    rr(g, 0.3, 0.5, 15.4, 7, 1.5);
    g.fill();
    g.strokeStyle = '#5a3215';
    g.lineWidth = 0.6;
    g.stroke();
    g.fillStyle = 'rgba(255,240,200,0.6)';
    g.fillRect(1.5, 1.2, 13, 0.7);
    bolt(g, 3, 4.3, 0.8);
    bolt(g, 13, 4.3, 0.8);
  }

  function coin(g, frame) {
    const k = Math.abs(Math.cos((frame / 8) * Math.PI));
    const w = Math.max(0.8, 4 * k);
    g.fillStyle = '#9a5b0c';
    ellipse(g, 4, 6, w, 5.6);
    g.fill();
    g.fillStyle = lin(g, 4 - w, 0, 4 + w, 0, [[0, '#ffe58a'], [0.45, '#ffc93a'], [1, '#d48a12']]);
    ellipse(g, 4, 6, Math.max(0.6, w - 0.6), 5);
    g.fill();
    if (w > 1.5) {
      g.strokeStyle = 'rgba(150,90,10,0.6)';
      g.lineWidth = 0.45;
      ellipse(g, 4, 6, w - 1.6, 3.6);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      ellipse(g, 4 - w * 0.35, 3.6, w * 0.18, 1.3);
      g.fill();
    }
  }

  function chest(g, open) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(g, 8, 15.3, 7.5, 1);
    g.fill();
    g.fillStyle = lin(g, 0, 7, 0, 15, [[0, '#a8622e'], [1, '#6b3a18']]);
    rr(g, 1, 7, 14, 8, 1);
    g.fill();
    if (open) {
      g.fillStyle = rad(g, 8, 6, 0, 9, [[0, 'rgba(255,240,160,0.95)'], [1, 'rgba(255,220,120,0)']]);
      g.fillRect(0, -3, 16, 12);
      g.fillStyle = lin(g, 0, 1, 0, 6, [[0, '#7b4320'], [1, '#4a2510']]);
      rr(g, 1, 0.5, 14, 4.5, 1);
      g.fill();
      g.fillStyle = '#2a1408';
      g.fillRect(2, 7, 12, 1.3);
    } else {
      g.fillStyle = lin(g, 0, 2, 0, 8, [[0, '#c27a3c'], [1, '#8a4c20']]);
      rr(g, 1, 2.5, 14, 5.5, 2.5);
      g.fill();
    }
    g.fillStyle = lin(g, 0, 0, 0, 16, [[0, '#ffe58a'], [1, '#c98a1a']]);
    g.fillRect(3, open ? 1 : 2.8, 1.2, open ? 4 : 12);
    g.fillRect(11.8, open ? 1 : 2.8, 1.2, open ? 4 : 12);
    g.fillRect(3, 7, 1.2, 8);
    g.fillRect(11.8, 7, 1.2, 8);
    if (!open) { rr(g, 6.5, 6.3, 3, 3.4, 0.6); g.fill(); g.fillStyle = '#3a2208'; g.fillRect(7.7, 7.6, 0.6, 1.2); }
  }

  function orb(g, frame) {
    g.fillStyle = rad(g, 8, 8, 0, 9, [[0, 'rgba(255,230,140,0.6)'], [1, 'rgba(255,200,80,0)']]);
    circle(g, 8, 8, 9);
    g.fill();
    g.fillStyle = rad(g, 6, 5.5, 0.5, 7.5, [[0, '#ffffff'], [0.25, frame % 2 ? '#ffe58a' : '#ffd060'], [0.8, '#e08a1e'], [1, '#8a4a0c']]);
    circle(g, 8, 8, 6.5);
    g.fill();
  }

  function glow(g, r, inner, outer) {
    g.fillStyle = rad(g, r, r, 0, r, [[0, inner], [0.35, inner], [1, outer]]);
    circle(g, r, r, r);
    g.fill();
  }

  function fireball(g, mega) {
    const r = 8;
    g.fillStyle = rad(g, r, r, 0, r, [[0, 'rgba(255,250,210,1)'], [0.3, 'rgba(255,200,80,0.95)'], [0.6, 'rgba(255,110,40,0.55)'], [1, 'rgba(255,60,20,0)']]);
    circle(g, r, r, r);
    g.fill();
    if (mega) {
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 0.6;
      circle(g, r, r, 4.5);
      g.stroke();
    }
  }

  function flame(g) {
    g.fillStyle = rad(g, 16, 4, 0, 14, [[0, 'rgba(255,250,200,1)'], [0.35, 'rgba(255,190,70,0.95)'], [0.75, 'rgba(240,80,30,0.7)'], [1, 'rgba(200,30,10,0)']]);
    g.beginPath();
    g.moveTo(0, 4);
    g.bezierCurveTo(6, -1, 18, -1, 24, 4);
    g.bezierCurveTo(18, 9, 6, 9, 0, 4);
    g.fill();
  }

  function puff(g) {
    g.fillStyle = rad(g, 4, 4, 0, 4, [[0, 'rgba(255,255,255,0.95)'], [0.6, 'rgba(240,240,240,0.7)'], [1, 'rgba(230,230,230,0)']]);
    circle(g, 4, 4, 4);
    g.fill();
  }
  function dust(g) {
    g.fillStyle = rad(g, 3, 3, 0, 3, [[0, 'rgba(235,215,180,0.85)'], [1, 'rgba(210,180,140,0)']]);
    circle(g, 3, 3, 3);
    g.fill();
  }
  function sparkle(g) {
    g.fillStyle = rad(g, 4, 4, 0, 4, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,240,170,0.8)'], [1, 'rgba(255,220,120,0)']]);
    poly(g, [[4, 0], [4.8, 3.2], [8, 4], [4.8, 4.8], [4, 8], [3.2, 4.8], [0, 4], [3.2, 3.2]]);
    g.fill();
  }
  function shadow(g) {
    g.save();
    g.scale(1, 0.25);
    g.fillStyle = rad(g, 16, 16, 0, 16, [[0, 'rgba(0,0,0,0.38)'], [0.6, 'rgba(0,0,0,0.2)'], [1, 'rgba(0,0,0,0)']]);
    circle(g, 16, 16, 16);
    g.fill();
    g.restore();
  }
  function debris(g) {
    g.fillStyle = lin(g, 0, 0, 0, 5, [[0, '#e2834a'], [1, '#9a4a22']]);
    poly(g, [[0, 1], [4, 0], [5, 4], [1, 5]]);
    g.fill();
  }

  const BOX = [
    ['#ffcfa8', '#f29a6a', '#c46a3f'],
    ['#bfe6f7', '#7cc3e6', '#4a8db4'],
    ['#d6f2be', '#97d57a', '#5d9c46'],
    ['#ffe9a3', '#f5c84f', '#c4922a']
  ];
  function semiBox(g, w, h, color) {
    const [light, base, dark] = BOX[color % BOX.length];
    g.fillStyle = lin(g, 0, 0, 0, h, [[0, light], [0.15, base], [1, dark]]);
    rr(g, 0.5, 0.5, w - 1, h + 2, 2.5);
    g.fill();
    g.strokeStyle = '#1e2a3c';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    rr(g, 2.5, 2, w - 5, 1.6, 0.8);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(w - 4, 4, 2, h - 4);
    for (const x of [4, w - 5]) for (const y of [5, h - 4]) if (y > 4) bolt(g, x, y, 1.1);
  }

  /* --------------------------- Ícones do mapa --------------------------- */
  function tree(g, tint) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(g, 9, 20, 7, 1.6);
    g.fill();
    g.fillStyle = lin(g, 0, 0, 4, 0, [[0, '#7a4f2c'], [1, '#4f3018']]);
    g.fillRect(7.5, 12, 3, 8);
    g.fillStyle = rad(g, 6.5, 4.5, 1, 10, [[0, tint[0]], [0.6, tint[1]], [1, tint[2]]]);
    circle(g, 9, 8, 8);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    ellipse(g, 6.2, 4.6, 2.6, 1.6);
    g.fill();
  }
  function house(g, done) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(g, 13, 27, 11, 2);
    g.fill();
    g.fillStyle = lin(g, 0, 12, 0, 27, [[0, done ? '#d9d2c4' : '#fff1d0'], [1, done ? '#a69f92' : '#e2c48e']]);
    g.fillRect(4, 12, 18, 15);
    g.fillStyle = done ? '#7a7570' : lin(g, 0, 0, 0, 13, [[0, '#ef5b45'], [1, '#a92f22']]);
    poly(g, [[1, 13], [13, 2], [25, 13]]);
    g.fill();
    g.fillStyle = '#5a3a22';
    rr(g, 10.5, 18, 5, 9, 1.5);
    g.fill();
    g.fillStyle = done ? '#9ab' : '#bfe6ff';
    g.fillRect(5.5, 15, 3.5, 3.5);
    g.fillRect(17, 15, 3.5, 3.5);
    g.fillStyle = '#7a4f2c';
    g.fillRect(18, 4, 3, 6);
  }
  function fortress(g, done) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(g, 12, 23, 11, 2);
    g.fill();
    if (done) {
      g.fillStyle = '#8f8a82';
      for (const [x, y, w, h] of [[2, 16, 8, 7], [10, 13, 6, 10], [16, 17, 7, 6]]) { rr(g, x, y, w, h, 1); g.fill(); }
      return;
    }
    g.fillStyle = lin(g, 0, 4, 0, 23, [[0, '#e8dcc5'], [1, '#a9987c']]);
    g.fillRect(2, 8, 20, 15);
    for (let i = 0; i < 4; i++) g.fillRect(2 + i * 5.5, 4, 3.5, 4.5);
    g.fillStyle = '#2b2f3f';
    rr(g, 8.5, 14, 7, 9, 3);
    g.fill();
    g.fillStyle = '#ffd36b';
    g.fillRect(4.5, 11, 2, 2.5);
    g.fillRect(17.5, 11, 2, 2.5);
  }
  function airship(g) {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    ellipse(g, 14, 25, 11, 1.8);
    g.fill();
    g.fillStyle = lin(g, 0, 12, 0, 21, [[0, '#b77a45'], [1, '#6e4122']]);
    g.beginPath();
    g.moveTo(1, 13);
    g.lineTo(27, 13);
    g.quadraticCurveTo(25, 21, 18, 21);
    g.lineTo(9, 21);
    g.quadraticCurveTo(3, 21, 1, 13);
    g.fill();
    g.fillStyle = '#4a2a16';
    g.fillRect(12.5, 1, 1.6, 12);
    g.fillStyle = lin(g, 14, 2, 24, 2, [[0, '#ffffff'], [1, '#d9dde6']]);
    poly(g, [[14.3, 2], [24, 7], [14.3, 11]]);
    g.fill();
    g.fillStyle = '#1e2430';
    for (const x of [7, 12, 17, 22]) { circle(g, x, 16, 1); g.fill(); }
    g.fillStyle = '#c9d2dc';
    g.fillRect(0, 15, 2, 4);
  }
  function darkCastle(g) {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    ellipse(g, 14, 29, 13, 2);
    g.fill();
    g.fillStyle = lin(g, 0, 0, 0, 29, [[0, '#6b5878'], [1, '#2d2236']]);
    g.fillRect(3, 10, 22, 19);
    for (let i = 0; i < 5; i++) g.fillRect(3 + i * 4.6, 5, 3, 5);
    g.fillRect(10, 1, 8, 9);
    g.fillStyle = rad(g, 14, 22, 0, 6, [[0, '#ffd166'], [1, '#e0562f']]);
    rr(g, 10.5, 18, 7, 11, 3.5);
    g.fill();
  }

  globalThis.MarioHD = Object.freeze({
    TAU, hash, lin, rad, rr, circle, ellipse, poly, bolt,
    ground, brick, stone, wood, ice, sand, cloud, platform, lava, spike, cannon, cannonBase, pipe, lift,
    coin, chest, orb, glow, fireball, flame, puff, dust, sparkle, shadow, debris, semiBox,
    tree, house, fortress, airship, darkCastle
  });
})();
