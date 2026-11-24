// Nova's built-in generative music, made live with the Web Audio API.
// It needs no internet, so "music" always plays something, even offline.

const CHORDS = {
  I: [0, 4, 7, 11],
  ii: [2, 5, 9, 12],
  iii: [4, 7, 11, 14],
  IV: [5, 9, 12, 16],
  V: [7, 11, 14, 17],
  vi: [9, 12, 16, 19],
};
const PROGRESSIONS = [
  ["ii", "V", "I", "vi"],
  ["I", "vi", "ii", "V"],
  ["IV", "iii", "ii", "I"],
  ["vi", "IV", "I", "V"],
  ["I", "iii", "IV", "V"],
];
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16];

export const SYNTH_STYLES = {
  lofi: { name: "Lo-fi beats", bpm: 76, swing: 0.14, drums: true, pad: false, crackle: true, melody: 0.2, cutoff: 2600 },
  ambient: { name: "Ambient dreams", bpm: 54, swing: 0, drums: false, pad: true, crackle: false, melody: 0.07, cutoff: 5000 },
  upbeat: { name: "Upbeat groove", bpm: 112, swing: 0, drums: true, pad: false, crackle: false, melody: 0.28, cutoff: 9000 },
  piano: { name: "Gentle piano", bpm: 66, swing: 0, drums: false, pad: false, crackle: false, melody: 0.3, cutoff: 6000, arpeggio: true },
};

const midiToFreq = (n) => 440 * 2 ** ((n - 69) / 12);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class Synth {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.playing = false;
    this.timer = null;
  }

  get analyser() {
    return this._analyser || null;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this._analyser = ctx.createAnalyser();
    this._analyser.fftSize = 128;
    this.master.connect(this._analyser);
    this._analyser.connect(ctx.destination);

    // Reverb send with a generated impulse response.
    this.reverb = ctx.createConvolver();
    const seconds = 2.8;
    const impulse = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    }
    this.reverb.buffer = impulse;
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.35;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const n = this.noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
  }

  setVolume(value) {
    this.volume = value;
    if (this.master) this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
  }

  async start(styleName = "lofi") {
    this.init();
    this.stop();
    const ctx = this.ctx;
    if (ctx.state === "suspended") await ctx.resume();
    this.style = SYNTH_STYLES[styleName] || SYNTH_STYLES.lofi;

    // Each session gets its own bus so stopping fades cleanly without cutting the next one.
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = this.style.cutoff;
    bus.connect(tone);
    tone.connect(this.master);
    this.bus = bus;
    this.wet = ctx.createGain(); // per-session reverb send
    this.wet.connect(this.reverb);

    if (this.style.crackle) this.startCrackle(bus);

    this.root = 48 + pick([0, 2, 3, 5, 7, 9]);
    this.progression = pick(PROGRESSIONS);
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.playing = true;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
    if (this.bus && this.ctx) {
      const { bus, wet } = this;
      const now = this.ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(0, now + 0.4);
      wet.gain.setTargetAtTime(0, now, 0.1);
      setTimeout(() => {
        bus.disconnect();
        wet.disconnect();
      }, 600);
      this.crackle?.stop(now + 0.5);
    }
    this.bus = null;
    this.wet = null;
    this.crackle = null;
  }

  startCrackle(bus) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 3200;
    band.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.018;
    src.connect(band);
    band.connect(gain);
    gain.connect(bus);
    src.start();
    this.crackle = src;
  }

  schedule() {
    const sixteenth = 60 / this.style.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  playStep(step, time, sixteenth) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const style = this.style;
    const swing = s % 4 === 2 ? style.swing * sixteenth : 0;
    const t = time + swing;

    // Every 8 bars, sometimes move to a new progression or key for variety.
    if (s === 0 && bar > 0 && bar % 8 === 0) {
      if (Math.random() < 0.5) this.progression = pick(PROGRESSIONS);
      if (Math.random() < 0.25) this.root = 48 + pick([0, 2, 3, 5, 7, 9]);
    }
    const barsPerChord = style.pad ? 2 : 1;
    const chord = CHORDS[this.progression[Math.floor(bar / barsPerChord) % this.progression.length]];
    const beat = sixteenth * 4;

    if (s === 0 && bar % barsPerChord === 0) {
      if (style.pad) this.pad(chord, t, beat * 4 * barsPerChord);
      else this.keys(chord, t, beat * (style.drums ? 3.5 : 4));
    }
    if (style.arpeggio && s % 4 === 2) {
      // Broken-chord arpeggio
      const note = chord[(Math.floor(s / 4) + bar) % chord.length];
      this.pluck(this.root + 12 + note, t, beat * 1.5, 0.07);
    }

    if (!style.pad) {
      if (s === 0) this.bass(this.root - 12 + chord[0], t, beat * 1.6);
      if (s === 10 && Math.random() < 0.6) this.bass(this.root - 12 + chord[Math.random() < 0.5 ? 0 : 2], t, beat * 0.9);
    } else if (s === 0 && bar % barsPerChord === 0) {
      this.bass(this.root - 12 + chord[0], t, beat * 4 * barsPerChord, 0.12);
    }

    if (style.drums) {
      if (s === 0 || s === 8 || (s === 11 && Math.random() < 0.35)) this.kick(t);
      if (s === 4 || s === 12) this.snare(t);
      if (s % 2 === 0 && Math.random() < 0.92) this.hat(t, s % 4 === 0 ? 0.11 : 0.07);
      if (style.bpm > 100 && s % 2 === 1 && Math.random() < 0.3) this.hat(t, 0.04);
    }

    if (s % 2 === 0 && Math.random() < style.melody) {
      const note = this.root + 24 + pick(PENTATONIC);
      if (style.pad) this.bell(note, t, beat * 3);
      else this.pluck(note, t, beat * (Math.random() < 0.5 ? 1 : 2), 0.06);
    }
  }

  voice({ freq, type = "sine", time, duration, gain = 0.1, attack = 0.01, release = 0.3, detune = 0, toReverb = 0.3 }) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(gain, time + attack);
    env.gain.setTargetAtTime(gain * 0.6, time + attack, duration / 3);
    env.gain.setTargetAtTime(0.0001, time + duration, release / 3);
    osc.connect(env);
    env.connect(this.bus);
    if (toReverb) {
      const send = ctx.createGain();
      send.gain.value = toReverb;
      env.connect(send);
      send.connect(this.wet);
    }
    osc.start(time);
    osc.stop(time + duration + release * 2);
  }

  keys(chord, time, duration) {
    chord.forEach((offset, i) => {
      const freq = midiToFreq(this.root + 12 + offset);
      const t = time + i * 0.018; // slight strum
      this.voice({ freq, type: "sine", time: t, duration, gain: 0.06, attack: 0.012, release: 0.6 });
      this.voice({ freq: freq * 2, type: "triangle", time: t, duration: duration * 0.4, gain: 0.012, attack: 0.005, release: 0.3 });
    });
  }

  pad(chord, time, duration) {
    chord.forEach((offset) => {
      const freq = midiToFreq(this.root + 12 + offset);
      for (const detune of [-7, 7]) {
        this.voice({ freq, type: "sawtooth", time, duration, gain: 0.014, attack: 1.8, release: 2.5, detune, toReverb: 0.8 });
      }
    });
  }

  bass(note, time, duration, gain = 0.16) {
    this.voice({ freq: midiToFreq(note), type: "sine", time, duration, gain, attack: 0.02, release: 0.2, toReverb: 0 });
  }

  pluck(note, time, duration, gain) {
    this.voice({ freq: midiToFreq(note), type: "triangle", time, duration, gain, attack: 0.008, release: 0.5, toReverb: 0.5 });
  }

  bell(note, time, duration) {
    this.voice({ freq: midiToFreq(note), type: "sine", time, duration, gain: 0.05, attack: 0.01, release: 2.5, toReverb: 0.9 });
  }

  kick(time) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    env.gain.setValueAtTime(0.55, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.38);
    osc.connect(env);
    env.connect(this.bus);
    osc.start(time);
    osc.stop(time + 0.4);
  }

  noiseHit(time, { gain, duration, type, freq }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.bus);
    src.start(time, Math.random() * 0.5);
    src.stop(time + duration + 0.05);
  }

  snare(time) {
    this.noiseHit(time, { gain: 0.22, duration: 0.18, type: "highpass", freq: 1200 });
    this.voice({ freq: 190, type: "triangle", time, duration: 0.05, gain: 0.08, attack: 0.002, release: 0.08, toReverb: 0.2 });
  }

  hat(time, gain) {
    this.noiseHit(time, { gain, duration: 0.045, type: "highpass", freq: 7500 });
  }
}
