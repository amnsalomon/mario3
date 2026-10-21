/* Toca as faixas em arquivo definidas em music-config.js, uma por momento do jogo.
 * Se um arquivo faltar ou não abrir, aquele momento volta para a trilha sintetizada. */
(() => {
  'use strict';

  class MarioTracks {
    constructor(files = {}, AudioClass = globalThis.Audio) {
      this.files = { ...files };
      this.AudioClass = AudioClass;
      this.audios = {};
      this.failed = new Set();
      this.current = null;
      this.volume = 0.45;
      this.blocked = false;
      this.pending = false;
      this.allowed = false;
    }

    has(theme) {
      return !!this.files[theme] && !this.failed.has(theme) && typeof this.AudioClass === 'function';
    }

    get(theme) {
      if (this.audios[theme]) return this.audios[theme];
      const a = new this.AudioClass(this.files[theme]);
      a.loop = true;
      a.preload = 'auto';
      a.volume = this.volume;
      a.addEventListener('error', () => {
        this.failed.add(theme);
        try { a.pause(); } catch {}
        if (this.current === theme) this.current = null;
      });
      this.audios[theme] = a;
      return a;
    }

    pauseAll(except = null) {
      for (const [name, a] of Object.entries(this.audios)) if (name !== except && !a.paused) a.pause();
    }

    // Devolve true quando este momento usa arquivo (a trilha sintetizada deve ficar em silêncio).
    update(theme, allowed, rate = 1) {
      this.allowed = allowed;
      if (!this.has(theme)) {
        this.pauseAll();
        this.current = null;
        return false;
      }
      const a = this.get(theme);
      if (this.current !== theme) {
        this.pauseAll(theme);
        this.current = theme;
        try { a.currentTime = 0; } catch {}
      }
      a.volume = this.volume;
      if (a.playbackRate !== rate) a.playbackRate = rate;
      if (!allowed) {
        if (!a.paused) a.pause();
        return true;
      }
      if (a.paused && !this.pending && !this.blocked) {
        this.pending = true;
        Promise.resolve(a.play())
          .then(() => { if (!this.allowed || this.current !== theme) a.pause(); })
          .catch(() => { this.blocked = true; })
          .finally(() => { this.pending = false; });
      }
      return true;
    }

    unlock() { this.blocked = false; }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, Number(v) || 0));
      for (const a of Object.values(this.audios)) a.volume = this.volume;
    }

    stop() {
      this.pauseAll();
      this.current = null;
    }
  }

  globalThis.MarioTracks = MarioTracks;
})();
