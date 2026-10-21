/* Música escolhida pelo usuário: fica só neste dispositivo, nada é enviado. */
(() => {
  'use strict';

  class MarioLocalMusic {
    constructor(onError = () => {}) {
      this.audio = null;
      this.url = null;
      this.onError = onError;
      this.pending = false;
      this.blocked = false;
      this.allowed = false;
      this.volume = 0.45;
    }

    get active() { return !!this.audio; }

    load(file) {
      this.clear();
      this.url = URL.createObjectURL(file);
      const a = new Audio(this.url);
      this.audio = a;
      a.loop = true;
      a.volume = this.volume;
      a.addEventListener('error', () => {
        if (this.audio !== a) return;
        this.clear();
        this.onError('Não foi possível abrir esse áudio. Tente MP3, OGG ou WAV.');
      });
      this.blocked = false;
    }

    clear() {
      if (this.audio) {
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
      }
      if (this.url) URL.revokeObjectURL(this.url);
      this.audio = null;
      this.url = null;
      this.pending = false;
      this.allowed = false;
    }

    unlock() { this.blocked = false; }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, Number(v) || 0));
      if (this.audio) this.audio.volume = this.volume;
    }

    update(allowed) {
      this.allowed = allowed;
      const a = this.audio;
      if (!a) return;
      if (!allowed) { a.pause(); return; }
      if (!a.paused || this.pending || this.blocked) return;
      this.pending = true;
      Promise.resolve(a.play())
        .then(() => { if (this.audio === a && !this.allowed) a.pause(); })
        .catch(() => { if (this.audio === a) this.blocked = true; })
        .finally(() => { if (this.audio === a) this.pending = false; });
    }
  }

  globalThis.MarioLocalMusic = MarioLocalMusic;
})();
