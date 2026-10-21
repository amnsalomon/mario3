/* Liga o jogo à página: controles, interface, som, música em arquivo e salvamento. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const { MarioGame, MAP_NODES } = MarioCore;
  const game = new MarioGame();
  const renderer = new MarioRenderer(canvas);
  const audio = new MarioAudio();
  const tracks = new MarioTracks(globalThis.MARIO_MUSIC_FILES || {});
  const localMusic = new MarioLocalMusic(message => {
    $('musicFileStatus').textContent = message;
    $('resetMusic').hidden = true;
  });

  const SAVE = 'mario3-adventure-v1';
  const LABELS = { mushroom: 'Cogumelo', leaf: 'Folha', flower: 'Flor de fogo', star: 'Estrela' };
  const POWER_NAMES = { small: 'Mario', big: 'Super Mario', raccoon: 'Mario Guaxinim', fire: 'Mario de Fogo' };
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
    ArrowUp: 'up', KeyW: 'up', KeyZ: 'jump', Space: 'jump', KeyK: 'jump', KeyX: 'run', ShiftLeft: 'run',
    ShiftRight: 'run', KeyJ: 'run', Enter: 'start', NumpadEnter: 'start'
  };
  const keys = {}, touch = {}, tapped = new Set();
  let soundOn = true, musicOn = true, saved = null, last = 0, acc = 0, uiSig = '', padStart = false;
  let confirmUntil = 0, resumeAfterHelp = false;

  try {
    const raw = JSON.parse(localStorage.getItem(SAVE));
    if (raw && new MarioGame().loadSave(raw)) saved = raw;
  } catch { saved = null; }
  const startVolume = Number($('volume').value) / 100;
  audio.setVolume(startVolume);
  tracks.setVolume(startVolume);
  localMusic.setVolume(startVolume);

  function persist() {
    if (game.mode === 'title') return;
    try {
      saved = game.exportSave();
      localStorage.setItem(SAVE, JSON.stringify(saved));
    } catch { /* armazenamento indisponível */ }
  }
  const focusGame = () => canvas.focus({ preventScroll: true });
  function unlock() { audio.unlock(); localMusic.unlock(); tracks.unlock(); }
  function clearInput() {
    for (const k of Object.keys(keys)) delete keys[k];
    for (const k of Object.keys(touch)) delete touch[k];
    tapped.clear();
  }

  /* ----------------------------- Ações ----------------------------- */
  function primaryAction() {
    unlock();
    const mode = game.mode;
    if (mode === 'paused') { game.resume(); clearInput(); }
    else if (mode === 'gameover') { game.continueGame(); persist(); }
    else if (mode === 'title' || mode === 'victory') {
      if (saved && !saved.finished && mode === 'title' && Date.now() > confirmUntil) {
        confirmUntil = Date.now() + 4000;
        uiSig = '';
        return;
      }
      confirmUntil = 0;
      game.newGame();
      persist();
    }
    focusGame();
  }
  function continueSaved() {
    unlock();
    if (saved && game.loadSave(saved)) { clearInput(); focusGame(); }
  }
  function endGame() { game.endGame(); persist(); uiSig = ''; }
  function togglePause() {
    if (game.mode === 'paused') game.resume();
    else game.pause();
    clearInput();
  }
  function toggleSound() {
    soundOn = !soundOn;
    audio.setEnabled(soundOn);
    $('sound').textContent = soundOn ? 'Som ligado' : 'Som desligado';
    $('sound').setAttribute('aria-pressed', soundOn);
    if (soundOn) unlock();
  }
  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $('screen').requestFullscreen();
    } catch { $('status').textContent = 'Tela cheia indisponível neste navegador.'; }
  }

  $('start').onclick = primaryAction;
  $('continue').onclick = continueSaved;
  $('end').onclick = endGame;
  $('pause').onclick = togglePause;
  $('sound').onclick = toggleSound;
  $('full').onclick = toggleFull;
  $('prev').onclick = () => { unlock(); game.mapMove(-1); };
  $('next').onclick = () => { unlock(); game.mapMove(1); };
  $('enter').onclick = () => { unlock(); game.mapEnter(); persist(); };
  $('music').onclick = () => {
    musicOn = !musicOn;
    $('music').textContent = musicOn ? 'Música ligada' : 'Música desligada';
    $('music').setAttribute('aria-pressed', musicOn);
    unlock();
  };
  $('volume').oninput = e => {
    const v = Number(e.target.value) / 100;
    audio.setVolume(v);
    tracks.setVolume(v);
    localMusic.setVolume(v);
  };
  $('volume').onchange = focusGame;
  $('musicFile').onchange = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    localMusic.load(file);
    $('musicFileStatus').textContent = 'Sua trilha: ' + file.name + ' · disponível nesta sessão';
    $('resetMusic').hidden = false;
    unlock();
  };
  $('resetMusic').onclick = () => {
    localMusic.clear();
    $('musicFile').value = '';
    $('musicFileStatus').textContent = 'Trilha do jogo restaurada.';
    $('resetMusic').hidden = true;
    unlock();
  };
  $('help').onclick = () => {
    resumeAfterHelp = game.mode !== 'paused' && game.mode !== 'title';
    game.pause();
    clearInput();
    $('instructions').showModal();
  };
  $('closeHelp').onclick = () => $('instructions').close();
  $('instructions').addEventListener('close', () => {
    if (resumeAfterHelp) game.resume();
    clearInput();
    focusGame();
  });

  // Depois de clicar em qualquer botão da página, o teclado volta para o jogo.
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.id === 'help' || b.closest('dialog') || b.closest('details')) return;
    focusGame();
  });
  window.addEventListener('pointerdown', unlock, { passive: true });

  /* ---------------------------- Teclado ---------------------------- */
  window.addEventListener('keydown', e => {
    if ($('instructions').open) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' && e.target.type !== 'range') return;
    if (tag === 'INPUT' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) return;
    if (tag === 'BUTTON' && ['Enter', 'Space', 'NumpadEnter'].includes(e.code)) return;
    if (KEYMAP[e.code] || ['KeyP', 'Escape', 'KeyM', 'KeyF'].includes(e.code)) e.preventDefault();
    unlock();
    if (e.repeat) return;
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
    if (e.code === 'KeyM') { toggleSound(); return; }
    if (e.code === 'KeyF') { toggleFull(); return; }
    const action = KEYMAP[e.code];
    if (game.mode === 'title' && ['start', 'jump'].includes(action)) { if (saved && !saved.finished) continueSaved(); else primaryAction(); return; }
    if (game.mode === 'paused' && action === 'start') { togglePause(); return; }
    if (game.mode === 'victory' && action === 'start') return;
    if (game.mode === 'playing' && action === 'start') { togglePause(); return; }
    if (action) { keys[e.code] = true; tapped.add(action); }
  });
  window.addEventListener('keyup', e => { delete keys[e.code]; });

  /* --------------------------- Toque --------------------------- */
  for (const b of document.querySelectorAll('[data-key]')) {
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      unlock();
      const key = b.dataset.key;
      if (key === 'start' && ['playing', 'paused'].includes(game.mode)) { togglePause(); return; }
      if (key === 'start' && game.mode === 'title') { if (saved && !saved.finished) continueSaved(); else primaryAction(); return; }
      try { b.setPointerCapture(e.pointerId); } catch {}
      touch[e.pointerId] = key;
      tapped.add(key);
    });
    for (const evt of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(evt, e => { delete touch[e.pointerId]; });
  }

  /* ------------------------ Entrada combinada ------------------------ */
  function input() {
    const i = {};
    for (const k in keys) if (keys[k]) i[KEYMAP[k]] = true;
    for (const a of tapped) i[a] = true;
    for (const k of Object.values(touch)) i[k] = true;
    try {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      const p = pads.find(Boolean);
      if (p) {
        const btn = n => !!(p.buttons[n] && p.buttons[n].pressed);
        i.left = i.left || p.axes[0] < -0.4 || btn(14);
        i.right = i.right || p.axes[0] > 0.4 || btn(15);
        i.down = i.down || p.axes[1] > 0.5 || btn(13);
        i.up = i.up || p.axes[1] < -0.5 || btn(12);
        i.jump = i.jump || btn(0);
        i.run = i.run || btn(1) || btn(2);
        const start = btn(9);
        if (start && !padStart) {
          unlock();
          if (['playing', 'paused'].includes(game.mode)) togglePause();
          else if (game.mode === 'title') { if (saved && !saved.finished) continueSaved(); else primaryAction(); }
          else i.start = true;
        }
        padStart = start;
      }
    } catch { /* gamepad indisponível */ }
    i.move = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    return i;
  }

  /* ------------------------------ Música ------------------------------ */
  function updateMusic() {
    const theme = game.music;
    const hidden = document.hidden || $('instructions').open;
    const ducking = audio.duckUntil > ((audio.context && audio.context.currentTime) || 0);
    const allowed = soundOn && musicOn && !hidden && game.mode !== 'paused' && !ducking;
    const hurry = game.hurry && game.inLevel;
    audio.setTheme(theme);
    audio.setTempo(hurry ? 1.3 : 1);
    audio.setPaused(game.mode === 'paused' || document.hidden);
    if (localMusic.active) {
      tracks.stop();
      audio.setMusicEnabled(false);
      localMusic.update(allowed);
    } else {
      const usesFile = tracks.update(theme, allowed, hurry ? 1.25 : 1);
      audio.setMusicEnabled(musicOn && !usesFile);
    }
    audio.update();
  }

  /* ---------------------------- Interface ---------------------------- */
  function nodeLabel() {
    const n = game.node;
    if (n.kind === 'start') return 'Início';
    if (n.kind === 'toad') return game.toadOpened.includes(game.world) ? 'Casa do Toad (visitada)' : 'Casa do Toad';
    const s = game.world * 6 + n.slot;
    return game.stageName(s) + (game.isCompleted(s) ? ' (concluída)' : '');
  }
  function canEnter() {
    const n = game.node;
    if (game.mode !== 'map' || game.mapAnim) return false;
    if (n.kind === 'stage') return !game.isCompleted(game.world * 6 + n.slot);
    return n.kind === 'toad' && !game.toadOpened.includes(game.world);
  }
  function updateUI() {
    const mode = game.mode, view = mode === 'paused' ? game.beforePause : mode;
    const confirming = Date.now() < confirmUntil;
    const sig = [mode, view, game.world, game.mapPos, !!game.mapAnim, game.lives, game.player && game.player.power, game.savedPower,
      game.inventory.join(), game.toadOpened.join(), game.completed.join(), !!saved, confirming, game.pendingStar, game.invOpen, game.stage].join('|');
    if (sig === uiSig) return;
    uiSig = sig;
    $('world').textContent = 'MUNDO ' + (game.world + 1);
    $('mapbar').hidden = mode !== 'map';
    $('prev').disabled = game.mapPos === 0;
    $('next').disabled = game.mapPos >= MAP_NODES.length - 1 || !game.isPassable(game.mapPos);
    $('enter').disabled = !canEnter();
    $('enter').textContent = game.node.kind === 'toad' ? 'Abrir a casa' : 'Entrar';
    const overlayModes = ['title', 'paused', 'gameover', 'victory'];
    $('overlay').hidden = !overlayModes.includes(mode);
    const title = $('overlayTitle');
    const hasSave = !!saved && !saved.finished;
    if (mode === 'title') title.innerHTML = 'SUPER<br><span>MARIO</span><br>BROS. 3';
    else title.textContent = { paused: 'PAUSA', gameover: 'GAME OVER', victory: 'VOCÊ VENCEU!' }[mode] || '';
    $('overlayEyebrow').textContent = mode === 'title' ? '48 FASES · 8 MUNDOS' : mode === 'gameover' ? `MUNDO ${game.world + 1}` : '';
    $('overlayText').textContent = {
      title: confirming ? 'Isso apaga o progresso salvo. Clique de novo para confirmar.' : 'Uma nova aventura com alma de cartucho.',
      paused: 'Respire. O Reino dos Cogumelos pode esperar.',
      gameover: `Continue do início do Mundo ${game.world + 1} com 4 vidas. As fases do mundo reabrem; fortalezas destruídas continuam destruídas.`,
      victory: 'Oito mundos explorados. Uma aventura para recordar.'
    }[mode] || '';
    $('start').textContent = mode === 'paused' ? 'Continuar aventura' : mode === 'gameover' ? 'Continuar' : mode === 'victory' ? 'Nova aventura'
      : confirming ? 'Apagar e começar' : hasSave ? 'Novo jogo' : 'Começar aventura';
    $('continue').hidden = mode !== 'title' || !hasSave;
    $('end').hidden = mode !== 'gameover';
    const statuses = {
      map: `Mundo ${game.world + 1} · ${nodeLabel()} · ← → anda, Z entra, X abre os itens`,
      toad: 'Casa do Toad · ← → escolhe um baú, Z abre',
      playing: `${game.stageName(game.stage)} · ${POWER_NAMES[game.player ? game.player.power : 'small']}`,
      clear: 'Fase concluída!', dying: 'Mais uma tentativa…', paused: 'Jogo pausado', victory: 'Aventura concluída',
      gameover: 'Fim de jogo', title: hasSave ? 'Progresso salvo encontrado' : 'Pronto para jogar'
    };
    $('status').textContent = statuses[mode] || '';
    const items = $('items');
    items.replaceChildren();
    game.inventory.forEach((item, index) => {
      const b = document.createElement('button');
      b.textContent = LABELS[item];
      b.disabled = !game.canUseItem(index);
      b.title = b.disabled ? 'Não faz efeito na forma atual' : 'Usar antes da fase';
      b.onclick = () => { game.useItem(index); persist(); };
      items.append(b);
    });
  }

  window.addEventListener('blur', () => { if (['playing', 'map', 'toad'].includes(game.mode)) game.pause(); clearInput(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (['playing', 'map', 'toad'].includes(game.mode)) game.pause(); clearInput(); persist(); }
    last = 0;
  });
  window.addEventListener('pagehide', persist);

  const PERSIST_ON = new Set(['map', 'clear', 'worldClear', 'victory', 'gameover', 'save', 'enterStage', 'enterToad']);
  function frame(now) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    acc += dt;
    const i = input();
    let stepped = false;
    while (acc >= 1 / 60) { game.step(1 / 60, i); acc -= 1 / 60; stepped = true; }
    if (stepped) tapped.clear();
    let dirty = false;
    for (const e of game.takeEvents()) {
      if (Object.hasOwn(MarioAudio.effects, e.type)) audio.effect(e.type);
      if (PERSIST_ON.has(e.type)) dirty = true;
    }
    if (dirty) persist();
    updateMusic();
    renderer.draw(game, now / 1000);
    updateUI();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
