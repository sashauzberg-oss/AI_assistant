// Shared pieces of Nova's cutscenes (the joke show and the fight scene): little helpers,
// sound made live with Web Audio, and timing the user can cut short.

export const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function h(tag, className, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

export function fontsReady() {
  if (!document.fonts?.load) return Promise.resolve();
  return Promise.all([document.fonts.load('700 24px "Pixelify Sans"'), document.fonts.load('16px "Press Start 2P"')]).catch(() => {});
}

/** Say a line with the computer's voice (when the user has spoken answers turned on). */
export function speakLine(text, pitch = 1, rate = 1.02) {
  return new Promise((resolve) => {
    try {
      const line = text.replace(/\*[^*]*\*/g, " ").trim();
      if (!window.speechSynthesis || !line) return resolve();
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.pitch = pitch;
      utterance.rate = rate;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

/** Sound effects that do nothing, for when there's no audio. */
export const silentSound = () => new Proxy({}, { get: () => () => {} });

/**
 * The building blocks for a scene's sound effects, or null when there's no audio:
 * tones, filtered noise, a warble, applause, and a "crowd" bus with a little room reverb.
 */
export function createAudio() {
  let ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return null;
  }
  ctx.resume?.().catch(() => {});

  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  // A little room reverb, so crowds sound like they're in a room.
  const room = ctx.createConvolver();
  const length = Math.floor(ctx.sampleRate * 1.3);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  room.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  room.connect(wet).connect(master);
  const crowdBus = ctx.createGain();
  crowdBus.connect(master);
  crowdBus.connect(room);

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

  const at = (offset = 0) => ctx.currentTime + 0.01 + offset;
  const noise = () => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  };
  const filter = (type, freq, q = 1) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  const envelope = (param, t, peak, attack, dur) => {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + dur);
  };

  function tone({ type = "sine", wave, from, to = from, t = at(), dur = 0.2, peak = 0.3, attack = 0.005, out = master }) {
    const osc = ctx.createOscillator();
    if (wave) osc.setPeriodicWave(wave);
    else osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = ctx.createGain();
    envelope(gain.gain, t, peak, attack, dur);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function hiss({ t = at(), dur = 0.2, peak = 0.2, type = "bandpass", freq = 1000, to, q = 1, attack = 0.005, out = master }) {
    const src = noise();
    const f = filter(type, freq, q);
    if (to) {
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(to, t + dur);
    }
    const gain = ctx.createGain();
    envelope(gain.gain, t, peak, attack, dur);
    src.connect(f).connect(gain).connect(out);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  function warble({ t = at(), from, peak, dur, rise = 1.07, vibrato = 8, depth = 18, type = "sine", out = master }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(from * rise, t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = vibrato;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = depth;
    lfo.connect(lfoGain).connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + dur * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(out);
    for (const node of [osc, lfo]) {
      node.start(t);
      node.stop(t + dur + 0.05);
    }
  }

  /** Clapping: a burst of tiny noise clicks, rendered into a buffer. */
  function applause(dur = 2, level = 0.25, offset = 0) {
    const rate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, Math.floor(rate * dur), rate);
    const data = buffer.getChannelData(0);
    const claps = Math.floor(dur * 75);
    for (let k = 0; k < claps; k++) {
      const pos = Math.random();
      const fade = Math.min(1, pos / 0.12) * Math.min(1, (1 - pos) / 0.35);
      if (Math.random() > fade) continue;
      const start = Math.floor(pos * (data.length - 900));
      const len = 250 + Math.floor(Math.random() * 500);
      const amp = rand(0.3, 1);
      for (let i = 0; i < len; i++) data[start + i] += (Math.random() * 2 - 1) * amp * Math.exp((-6 * i) / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(filter("highpass", 700)).connect(gain).connect(crowdBus);
    src.start(at(offset));
  }

  /** A chiptune pulse wave (duty 0.125, 0.25 or 0.5), like an old game console's. */
  function pulse(duty = 0.25) {
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * 2;
    return ctx.createPeriodicWave(real, imag);
  }

  return {
    ctx,
    master,
    crowdBus,
    at,
    noise,
    filter,
    envelope,
    tone,
    hiss,
    warble,
    applause,
    pulse,
    hush() {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    },
    close() {
      ctx.close().catch(() => {});
    },
  };
}

/**
 * Timing for a scene that the user can cut short. `wait`, and anything made with `defer`,
 * reject with `SKIP` once the scene is skipped, which ends the scene's script.
 */
export function createTimeline() {
  const SKIP = Symbol("skip");
  const pending = new Set();
  const timers = new Set();
  let stopped = false;
  let skipped = false;
  const defer = (register) =>
    new Promise((resolve, reject) => {
      if (stopped) return reject(SKIP);
      const entry = { reject };
      entry.cancel = register((value) => {
        pending.delete(entry);
        resolve(value);
      });
      pending.add(entry);
    });
  return {
    SKIP,
    defer,
    wait: (ms) =>
      defer((done) => {
        const timer = setTimeout(done, ms);
        return () => clearTimeout(timer);
      }),
    later(fn, ms) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!stopped) fn();
      }, ms);
      timers.add(timer);
    },
    skip() {
      if (stopped) return false;
      stopped = true;
      skipped = true;
      for (const entry of pending) {
        entry.cancel?.();
        entry.reject(SKIP);
      }
      pending.clear();
      return true;
    },
    stop() {
      stopped = true;
      for (const timer of timers) clearTimeout(timer);
    },
    get stopped() {
      return stopped;
    },
    get skipped() {
      return skipped;
    },
  };
}

/**
 * Puts a scene on screen: click, Esc, Enter or Space calls `onSkip`. Returns a function
 * that takes the listeners off again and gives focus back to where it was.
 */
export function mountStage(root, stage, onSkip) {
  const previousFocus = document.activeElement;
  const onKey = (e) => {
    if (!["Escape", "Enter", " "].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    onSkip();
  };
  stage.addEventListener("click", onSkip);
  window.addEventListener("keydown", onKey, true);
  root.append(stage);
  stage.querySelector(".cs-skip")?.focus({ preventScroll: true });
  stage.getBoundingClientRect(); // start from the hidden state so the fade-in runs
  return () => {
    window.removeEventListener("keydown", onKey, true);
    if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
  };
}
