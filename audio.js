'use strict';

/* Tiny synthesized sound bank. No audio files, samples, or network requests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SignalRushAudio = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  class SoundBank {
    constructor() {
      this.enabled = true;
      this.context = null;
    }

    unlock() {
      if (!this.enabled) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!this.context) this.context = new AudioContext();
        if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      } catch (_) {
        this.context = null;
      }
    }

    setEnabled(enabled) {
      this.enabled = enabled;
      if (enabled) this.unlock();
    }

    tone(frequency, duration, options = {}) {
      if (!this.enabled || !this.context) return;
      const context = this.context;
      if (context.state !== 'running') return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + (options.delay || 0);
      oscillator.type = options.type || 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(options.volume || 0.045, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }

    play(name) {
      if (name === 'signal') {
        this.tone(620, 0.09, { type: 'triangle', endFrequency: 940, volume: 0.035 });
      } else if (name === 'bonus') {
        this.tone(720, 0.12, { type: 'sine', endFrequency: 1180, volume: 0.045 });
        this.tone(1080, 0.15, { delay: 0.07, volume: 0.03 });
      } else if (name === 'miss') {
        this.tone(150, 0.12, { type: 'square', endFrequency: 85, volume: 0.018 });
      } else if (name === 'noise') {
        this.tone(190, 0.24, { type: 'sawtooth', endFrequency: 55, volume: 0.025 });
      } else if (name === 'start') {
        this.tone(420, 0.1, { type: 'triangle', endFrequency: 630, volume: 0.03 });
        this.tone(630, 0.14, { delay: 0.09, type: 'triangle', endFrequency: 880, volume: 0.035 });
      } else if (name === 'pause') {
        this.tone(460, 0.13, { endFrequency: 260, volume: 0.025 });
      } else if (name === 'resume') {
        this.tone(260, 0.13, { endFrequency: 460, volume: 0.025 });
      } else if (name === 'finish') {
        [520, 660, 880].forEach((frequency, index) => this.tone(frequency, 0.22, { delay: index * 0.1, type: 'triangle', volume: 0.03 }));
      }
    }
  }

  return { SoundBank };
});
