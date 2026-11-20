// ============================================================
// Core Studio-Grade Audio Engine for ChunkTrainer
// Combining snd-lib (tactile UI) & Tone.js (musical feedback)
// ============================================================

class AudioEngine {
  constructor() {
    this.soundEnabled = true;
    this.masterVolume = 0.8;
    this.unlocked = false;
    this.unlockPromise = null;
    this._lastChimeAt = 0;
    this._lastActionSoundAt = 0;
    this.listeners = new Set();

    // Internal components
    this.snd = null;
    this.tone = null;
    this.limiter = null;
    this.reverb = null;
    this.marimba = null;
    this.webAudioCtx = null;

    this.initPreferences();
    this.setupAutoUnlock();
  }

  initPreferences() {
    try {
      const storedEnabled = localStorage.getItem('soundEnabled');
      if (storedEnabled !== null) {
        this.soundEnabled = storedEnabled === 'true';
      }
      const storedVol = localStorage.getItem('masterVolume');
      if (storedVol !== null) {
        const parsed = parseFloat(storedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.masterVolume = parsed;
        }
      }
    } catch (e) {
      console.warn('localStorage audio preferences unavailable:', e);
    }
  }

  setupAutoUnlock() {
    if (typeof window === 'undefined') return;

    const unlockHandler = async () => {
      await this.unlock();
    };

    ['pointerdown', 'click', 'keydown', 'touchstart'].forEach((event) => {
      window.addEventListener(event, unlockHandler, { once: true, passive: true });
    });
  }

  async unlock() {
    if (this.unlocked) return;
    if (this.unlockPromise) return this.unlockPromise;

    this.unlockPromise = (async () => {
      try {
        // 1. Initialize Tone.js first (creates master AudioContext without duplicates)
        if (typeof window !== 'undefined' && window.Tone) {
          this.tone = window.Tone;
          if (this.tone.context.state !== 'running') {
            await this.tone.start();
          }

          // Master Limiter(-2) & Subtle Reverb to avoid clipping
          this.limiter = new this.tone.Limiter(-2).toDestination();
          this.reverb = new this.tone.Reverb({ decay: 1.2, preDelay: 0.01, wet: 0.18 }).connect(this.limiter);
          await this.reverb.generate();

          // Warm Marimba-style PolySynth
          this.marimba = new this.tone.PolySynth(this.tone.Synth, {
            oscillator: { type: 'triangle' },
            envelope: {
              attack: 0.002,
              decay: 0.32,
              sustain: 0.02,
              release: 0.28,
            },
            volume: -3,
          }).connect(this.reverb);

          this.applyVolumeToTone();
        } else if (typeof window !== 'undefined') {
          // Fallback only if Tone.js is unavailable
          const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
          if (AudioCtxClass && !this.webAudioCtx) {
            this.webAudioCtx = new AudioCtxClass();
            if (this.webAudioCtx.state === 'suspended') {
              await this.webAudioCtx.resume();
            }
          }
        }

        // 2. Initialize snd-lib with local audio sprite
        if (typeof window !== 'undefined' && window.Snd) {
          if (window.Snd.KIT_INFO && window.Snd.KIT_INFO['01']) {
            window.Snd.KIT_INFO['01'].audioSrc = new URL('../assets/sounds/01/audioSprite.mp3', import.meta.url).href;
          }
          this.snd = new window.Snd({
            kit: window.Snd.KITS?.SND01 || '01',
          });
          if (typeof this.snd.load === 'function' && window.Snd.KITS?.SND01) {
            await this.snd.load(window.Snd.KITS.SND01).catch((err) => {
              console.warn('Local snd-lib load notice:', err);
            });
          }
          if (this.snd) {
            this.snd._masterVolume = this.soundEnabled ? this.masterVolume : 0;
          }
        }

        this.unlocked = true;
      } catch (err) {
        console.warn('AudioEngine unlock delayed:', err);
      }
    })();

    return this.unlockPromise;
  }

  applyVolumeToTone() {
    if (!this.tone || !this.tone.getDestination) return;
    const dest = this.tone.getDestination();
    if (!this.soundEnabled || this.masterVolume <= 0.001) {
      dest.mute = true;
    } else {
      dest.mute = false;
      // Volume scaling from linear 0..1 to dB (-40 to 0)
      const db = this.tone.gainToDb(Math.max(0.01, this.masterVolume));
      dest.volume.rampTo(db, 0.05);
    }
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = Boolean(enabled);
    try {
      localStorage.setItem('soundEnabled', String(this.soundEnabled));
    } catch {}

    if (this.snd) {
      this.snd._masterVolume = this.soundEnabled ? this.masterVolume : 0;
      if (typeof this.snd.mute === 'function' && typeof this.snd.unmute === 'function') {
        if (this.soundEnabled) this.snd.unmute();
        else this.snd.mute();
      }
    }
    this.applyVolumeToTone();
    this.notify();
  }

  setMasterVolume(vol) {
    const clamped = Math.max(0, Math.min(1, parseFloat(vol) || 0));
    this.masterVolume = clamped;
    try {
      localStorage.setItem('masterVolume', String(clamped));
    } catch {}

    if (this.snd) {
      this.snd._masterVolume = this.soundEnabled ? clamped : 0;
    }
    this.applyVolumeToTone();
    this.notify();
  }

  toggleSound() {
    this.setSoundEnabled(!this.soundEnabled);
    if (this.soundEnabled) {
      this.playTap();
    }
    return this.soundEnabled;
  }

  get enabled() {
    return this.soundEnabled;
  }

  get volume() {
    return this.masterVolume;
  }

  isEnabled() {
    return this.soundEnabled;
  }

  getVolume() {
    return this.masterVolume;
  }

  onPreferenceChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener({ enabled: this.soundEnabled, volume: this.masterVolume });
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Helper for pure Web Audio oscillator fallback
  getNativeAudioCtx() {
    if (this.tone && this.tone.context?.rawContext) {
      return this.tone.context.rawContext;
    }
    if (!this.webAudioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) this.webAudioCtx = new AudioCtxClass();
    }
    return this.webAudioCtx;
  }

  // Gentle, non-intrusive two-tone audio alarm ("تيت تيت") for scheduled reviews
  async playReviewChime(force = false) {
    if (!this.soundEnabled && !force) return;
    const nowMs = Date.now();
    if (nowMs - this._lastChimeAt < 700) return;
    this._lastChimeAt = nowMs;
    this._lastActionSoundAt = nowMs;
    await this.unlock();

    const ctx = this.getNativeAudioCtx();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const baseGain = 0.08 * (this.masterVolume || 0.8);

      // Tone 1: ~880 Hz (A5), duration ~110ms
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.linearRampToValueAtTime(baseGain, now + 0.012);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.115);

      // 70ms gap -> Tone 2 starts at now + 0.11 + 0.07 = now + 0.18s
      const tone2Start = now + 0.18;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, tone2Start); // ~987 Hz (B5)
      gain2.gain.setValueAtTime(0.0001, tone2Start);
      gain2.gain.linearRampToValueAtTime(baseGain, tone2Start + 0.012);
      gain2.gain.exponentialRampToValueAtTime(0.0001, tone2Start + 0.11);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(tone2Start);
      osc2.stop(tone2Start + 0.115);
    } catch (err) {
      console.warn('Review chime synthesis error:', err);
    }
  }

  // ============================================================
  // LAYER 1: Micro-Interactions (snd-lib & Tone.js)
  // ============================================================

  // Clean subtle tap for buttons and navigation
  playTap() {
    if (!this.soundEnabled) return;
    if (Date.now() - this._lastActionSoundAt < 80) return;
    this.unlock();

    if (this.snd && window.Snd?.SOUNDS?.TAP) {
      try {
        this.snd.play(window.Snd.SOUNDS.TAP);
        return;
      } catch {}
    }

    // Direct Web Audio fallback: clean subtle pop
    const ctx = this.getNativeAudioCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.025);
      gain.gain.setValueAtTime(0.08 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }

  // Crisp switch feedback
  playToggle(isOn = true) {
    if (!this.soundEnabled) return;
    this._lastActionSoundAt = Date.now();
    this.unlock();

    if (this.snd && window.Snd?.SOUNDS) {
      try {
        const soundKey = isOn ? window.Snd.SOUNDS.TOGGLE_ON : window.Snd.SOUNDS.TOGGLE_OFF;
        if (soundKey) {
          this.snd.play(soundKey);
          return;
        }
      } catch {}
    }

    // Web Audio fallback
    const ctx = this.getNativeAudioCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const startFreq = isOn ? 440 : 620;
      const endFreq = isOn ? 680 : 380;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.04);
      gain.gain.setValueAtTime(0.12 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {}
  }

  // Ultra-short, soft percussive pop (15ms): 'up' = 580Hz, 'down' = 420Hz
  playStepper(direction = 'up') {
    if (!this.soundEnabled) return;
    this._lastActionSoundAt = Date.now();
    this.unlock();

    const freq = direction === 'down' ? 420 : 580;
    const ctx = this.getNativeAudioCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.15 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.016);
    } catch {}
  }

  // Low, muted wooden thud (150Hz -> 90Hz filtered triangle wave)
  playSoftError() {
    if (!this.soundEnabled) return;
    this._lastActionSoundAt = Date.now();
    this.unlock();

    const ctx = this.getNativeAudioCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, now);

      gain.gain.setValueAtTime(0.25 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }

  // ============================================================
  // LAYER 2: Active Workout & Rest Timer
  // ============================================================

  // Subtle wooden/glass tick during the final 3 seconds (3, 2, 1)
  playCountdownTick(secondsLeft = 3) {
    if (!this.soundEnabled) return;
    this._lastActionSoundAt = Date.now();
    this.unlock();

    const ctx = this.getNativeAudioCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // Pitch goes slightly higher on final seconds for excitement
      const freq = secondsLeft === 1 ? 1400 : secondsLeft === 2 ? 1100 : 900;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.012);

      gain.gain.setValueAtTime(0.18 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.014);
    } catch {}
  }

  // Energetic, crisp double-chime (SND.SOUNDS.NOTIFICATION + G5 -> C6 marimba accent)
  playRestComplete() {
    if (!this.soundEnabled) return;
    this._lastActionSoundAt = Date.now();
    this.unlock();

    if (this.snd && window.Snd?.SOUNDS?.NOTIFICATION) {
      try {
        this.snd.play(window.Snd.SOUNDS.NOTIFICATION);
      } catch {}
    }

    if (this.marimba && this.tone) {
      try {
        const now = this.tone.now();
        this.marimba.triggerAttackRelease('G5', '16n', now);
        this.marimba.triggerAttackRelease('C6', '8n', now + 0.12);
        return;
      } catch {}
    }

    // Direct Web Audio fallback chime
    const ctx = this.getNativeAudioCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [
        { f: 783.99, t: 0 },
        { f: 1046.5, t: 0.12 },
      ].forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.f, now + note.t);
        gain.gain.setValueAtTime(0.2 * this.masterVolume, now + note.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + note.t);
        osc.stop(now + note.t + 0.28);
      });
    } catch {}
  }

  // Warm marimba-like PolySynth note ascending major pentatonic scale (C5, D5, E5, G5, A5, C6)
  playSetComplete(setIndex = 0) {
    if (!this.soundEnabled) return;
    this._lastActionSoundAt = Date.now();
    this.unlock();

    const scale = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'];
    const note = scale[Math.abs(Number(setIndex) || 0) % scale.length];

    if (this.marimba && this.tone) {
      try {
        this.marimba.triggerAttackRelease(note, '8n');
        return;
      } catch {}
    }

    // Web Audio fallback
    const freqMap = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5 };
    const freq = freqMap[note] || 523.25;
    const ctx = this.getNativeAudioCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.22 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    } catch {}
  }

  // Alias for step completion in practice wizard (steps 1 to 6)
  playStepComplete(stepIndex = 1) {
    this.playSetComplete(stepIndex - 1);
  }

  // ============================================================
  // LAYER 3: Tiered Achievements & Milestones
  // ============================================================

  // Clean 2-note harmonic confirmation (E5 + B5)
  playExerciseComplete() {
    if (!this.soundEnabled) return;
    this._lastActionSoundAt = Date.now();
    this.unlock();

    if (this.marimba && this.tone) {
      try {
        this.marimba.triggerAttackRelease(['E5', 'B5'], '8n');
        return;
      } catch {}
    }

    const ctx = this.getNativeAudioCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [659.25, 987.77].forEach((f) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(0.18 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.55);
      });
    } catch {}
  }

  // Alias for chunk stage completion
  playChunkComplete() {
    this.playExerciseComplete();
  }

  // Rich, uplifting 4-note ascending marimba arpeggio (C5 -> E5 -> G5 -> C6) with warm decay
  playWorkoutComplete() {
    if (!this.soundEnabled) return;
    this._lastActionSoundAt = Date.now();
    this.unlock();

    const notes = ['C5', 'E5', 'G5', 'C6'];

    if (this.marimba && this.tone) {
      try {
        const now = this.tone.now();
        notes.forEach((note, idx) => {
          this.marimba.triggerAttackRelease(note, '4n', now + idx * 0.09, 0.85);
        });
        return;
      } catch {}
    }

    const freqMap = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5 };
    const ctx = this.getNativeAudioCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      notes.forEach((note, idx) => {
        const t = now + idx * 0.09;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freqMap[note], t);
        gain.gain.setValueAtTime(0.24 * this.masterVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.65);
      });
    } catch {}
  }

  // Alias for session / review queue complete
  playSessionComplete() {
    this.playWorkoutComplete();
  }

  // Triumphant, sparkling chord flourish (F5 -> A5 -> C6 -> E6 -> G6 rapid shimmer)
  playNewPR() {
    if (!this.soundEnabled) return;
    this._lastActionSoundAt = Date.now();
    this.unlock();

    // snd celebration sound if available
    if (this.snd && window.Snd?.SOUNDS?.CELEBRATION) {
      try {
        this.snd.play(window.Snd.SOUNDS.CELEBRATION);
      } catch {}
    }

    const notes = ['F5', 'A5', 'C6', 'E6', 'G6'];

    if (this.marimba && this.tone) {
      try {
        const now = this.tone.now();
        notes.forEach((note, idx) => {
          this.marimba.triggerAttackRelease(note, '4n', now + idx * 0.065, 0.9);
        });
        // Extra sparkling high resonance
        this.marimba.triggerAttackRelease('C7', '2n', now + 0.38, 0.7);
        return;
      } catch {}
    }

    const freqMap = { F5: 698.46, A5: 880.0, C6: 1046.5, E6: 1318.51, G6: 1567.98, C7: 2093.0 };
    const ctx = this.getNativeAudioCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      notes.forEach((note, idx) => {
        const t = now + idx * 0.065;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freqMap[note], t);
        gain.gain.setValueAtTime(0.25 * this.masterVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.8);
      });
      // Final sparkle
      const finalT = now + 0.38;
      const fOsc = ctx.createOscillator();
      const fGain = ctx.createGain();
      fOsc.type = 'triangle';
      fOsc.frequency.setValueAtTime(freqMap['C7'], finalT);
      fGain.gain.setValueAtTime(0.2 * this.masterVolume, finalT);
      fGain.gain.exponentialRampToValueAtTime(0.0001, finalT + 0.9);
      fOsc.connect(fGain);
      fGain.connect(ctx.destination);
      fOsc.start(finalT);
      fOsc.stop(finalT + 0.95);
    } catch {}
  }
}

// Singleton export
export const audioEngine = new AudioEngine();
