// The fight scene: your pet battles another pet in an epic pixel fight of about ten
// seconds: a VS screen, health bars, a clash, a jump kick, a special attack, a combo,
// a super move and a K.O. The world is drawn on a small canvas and scaled up so it stays
// chunky pixel art; the fighting-game HUD and the big words are on top of it.
import { PETS, PET_KINDS, drawPet } from "./pets.js";
import { petGeometry } from "./cutscene.js";
import { h, clamp, rand, pick, sleep, fontsReady, speakLine, createAudio, silentSound, createTimeline, mountStage } from "./stage-kit.js";

const HIT_WORDS = ["POW!", "BAM!", "WHAM!", "BOOM!", "KAPOW!", "THWACK!", "ZAP!", "SMACK!"];
const HERO_AURA = "#ffd23f";
const SKY = ["#140b2e", "#2a1550", "#4f1f6b", "#8a2f78", "#d4507a", "#f58a5c", "#ffc46b"];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const CONFETTI = ["#ffd23f", "#ff7ab6", "#7cf4ff", "#a6ff7a", "#ffffff", "#ff8a3d"];

const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Who your pet fights: the animal asked for, or a random different one. */
export function chooseFoe(kind, requested, random = Math.random) {
  if (PETS[requested]) return requested;
  const others = PET_KINDS.filter((k) => k !== kind);
  return others[Math.floor(random() * others.length)];
}

/** The opponent's name: a pet of the same kind is your pet's shadow twin. */
export function foeName(kind, name, foe) {
  return foe === kind ? `Shadow ${name}` : PETS[foe]?.name || "Rival";
}

/** The size of the pixel world for a screen: `p` screen pixels per world pixel. */
export function fightLayout(width, height) {
  const tall = width < height;
  const p = Math.max(1, tall ? Math.round(width / 210) : Math.floor(Math.min(width / 240, height / 150)));
  const W = Math.ceil(width / p);
  const H = Math.ceil(height / p);
  const scale = clamp(Math.round(Math.min(W / 4.2, H / 2.4) / 16), 2, 6);
  return { p, W, H, S: 16 * scale, ground: Math.round(H * (tall ? 0.7 : 0.8)) };
}

// ---------------------------------------------------------------- pixel art

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};

/** The arena at sunset: dithered sky, a striped sun, mountains and a stone floor. */
function paintArena(W, H, ground) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(W, H);
  const sky = SKY.map(hex);
  for (let y = 0; y < ground; y++) {
    const f = (y / ground) * (sky.length - 1);
    const i = Math.floor(f);
    for (let x = 0; x < W; x++) {
      const c = sky[Math.min(sky.length - 1, f - i > (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16 ? i + 1 : i)];
      const o = (y * W + x) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  for (let n = 0; n < W * 0.3; n++) {
    ctx.globalAlpha = rand(0.35, 1);
    ctx.fillStyle = Math.random() < 0.75 ? "#ffffff" : "#ffe9a8";
    ctx.fillRect(Math.floor(rand(0, W)), Math.floor(rand(0, ground * 0.42)), 1, 1);
  }
  ctx.globalAlpha = 1;

  const r = Math.round(Math.min(W, H) * 0.25);
  const cx = Math.round(W / 2);
  const cy = Math.round(ground - H * 0.05);
  for (let dy = -r; dy <= r; dy++) {
    const f = (dy + r) / (2 * r);
    if (f > 0.5 && (dy + r) % 6 >= 6 - Math.floor((f - 0.5) * 9)) continue; // the stripes
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillStyle = mix("#fff3a8", "#ff5f6d", f);
    ctx.fillRect(cx - half, cy + dy, half * 2, 1);
  }

  const ridge = (base, amp, color, seed) => {
    ctx.fillStyle = color;
    for (let x = 0; x < W; x++) {
      const y = base - (Math.sin(x * 0.045 + seed) * amp + Math.sin(x * 0.13 + seed * 2) * amp * 0.45 + Math.sin(x * 0.31 + seed) * amp * 0.15);
      ctx.fillRect(x, Math.round(y), 1, ground - Math.round(y));
    }
  };
  ridge(ground - H * 0.17, H * 0.05, "#3a1747", rand(0, 9));
  ridge(ground - H * 0.07, H * 0.035, "#22102e", rand(0, 9));

  ctx.fillStyle = "#3d2b4f";
  ctx.fillRect(0, ground, W, H - ground);
  ctx.fillStyle = "#8a6aa0";
  ctx.fillRect(0, ground, W, 1);
  ctx.fillStyle = "#5b4370";
  ctx.fillRect(0, ground + 1, W, 1);
  ctx.fillStyle = "#2a1d38";
  for (let y = ground + 2, tall = 3, row = 0; y < H; y += tall + 1, tall = Math.min(tall + 1, 10), row++) {
    ctx.fillRect(0, y + tall, W, 1);
    const w = 14 + row * 5;
    for (let x = row % 2 ? -w / 2 : 0; x < W; x += w) ctx.fillRect(Math.round(x), y, 1, tall);
  }
  return canvas;
}

function tint(source, color) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 16, 16);
  return canvas;
}

/** A pet's frames: idle, blinking (hurt) and yelling, plus a white one for hit flashes. */
function spriteFrames(kind, aura, shadow = false) {
  const make = (opts) => {
    const canvas = document.createElement("canvas");
    drawPet(canvas, kind, opts);
    if (!shadow) return canvas;
    const dark = document.createElement("canvas"); // the shadow twin: same pet, other colours
    dark.width = dark.height = 16;
    const ctx = dark.getContext("2d");
    ctx.filter = "hue-rotate(180deg) saturate(1.4) brightness(0.75)";
    ctx.drawImage(canvas, 0, 0);
    return dark;
  };
  const idle = make({});
  return { idle, blink: make({ blink: true }), yell: make({ talk: true }), white: tint(idle, "#ffffff"), aura: tint(idle, aura) };
}

function face(kind, { talk = false, mirror = false, shadow = false } = {}) {
  const frames = spriteFrames(kind, "#000", shadow);
  const canvas = h("canvas");
  canvas.width = canvas.height = 16;
  canvas.getContext("2d").drawImage(talk ? frames.yell : frames.idle, 0, 0);
  if (mirror) canvas.style.transform = "scaleX(-1)";
  return canvas;
}

// ---------------------------------------------------------------- sound

function createFightSound() {
  const audio = createAudio();
  if (!audio) return silentSound();
  const { ctx, master, at, tone, hiss, warble, pulse } = audio;
  const lead = pulse(0.25);
  const square = pulse(0.5);
  const midi = (n) => 440 * 2 ** ((n - 69) / 12);

  const punch = () => {
    tone({ from: 180, to: 60, dur: 0.12, peak: 0.55 });
    hiss({ type: "lowpass", freq: 1500, dur: 0.07, peak: 0.45 });
  };
  const metal = (t, peak = 0.03, dur = 0.6) => {
    const gain = ctx.createGain();
    audio.envelope(gain.gain, t, peak, 0.002, dur);
    gain.connect(audio.filter("highpass", 5000)).connect(master);
    for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = f * 2.6;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  };

  return {
    punch,
    heavy() {
      tone({ from: 140, to: 40, dur: 0.3, peak: 0.8 });
      hiss({ type: "lowpass", freq: 900, dur: 0.2, peak: 0.6 });
      hiss({ type: "highpass", freq: 4000, dur: 0.15, peak: 0.2 });
    },
    clash() {
      punch();
      metal(at(), 0.05, 0.7);
      hiss({ type: "highpass", freq: 3000, dur: 0.35, peak: 0.25 });
    },
    whoosh() {
      hiss({ freq: 500, to: 2500, dur: 0.2, peak: 0.25, q: 0.9 });
    },
    boom() {
      tone({ from: 80, to: 30, dur: 0.9, peak: 0.7 });
      hiss({ type: "lowpass", freq: 300, dur: 0.8, peak: 0.5 });
    },
    slam() {
      tone({ from: 200, to: 60, dur: 0.3, peak: 0.6 });
      hiss({ type: "highpass", freq: 3000, dur: 0.45, peak: 0.22 });
      metal(at(), 0.03, 0.5);
    },
    charge(dur = 0.6) {
      warble({ from: 220, rise: 5, dur, peak: 0.07, vibrato: 18, depth: 25, type: "sawtooth" });
      hiss({ freq: 400, to: 3000, dur, peak: 0.12, attack: dur * 0.8 });
    },
    pew() {
      tone({ wave: square, from: 1500, to: 250, dur: 0.25, peak: 0.1 });
      hiss({ freq: 2000, to: 600, dur: 0.2, peak: 0.12 });
    },
    explosion() {
      hiss({ type: "lowpass", freq: 900, to: 160, dur: 1.3, peak: 0.9 });
      tone({ from: 70, to: 28, dur: 1.0, peak: 0.8, attack: 0.003 });
    },
    thud() {
      tone({ from: 100, to: 40, dur: 0.25, peak: 0.6 });
      hiss({ type: "lowpass", freq: 600, dur: 0.12, peak: 0.4 });
    },
    growl() {
      warble({ from: 110, rise: 0.8, dur: 0.35, peak: 0.08, vibrato: 30, depth: 20, type: "sawtooth" });
    },
    dive() {
      tone({ from: 1800, to: 300, dur: 0.32, peak: 0.1 });
    },
    beam(dur = 1) {
      warble({ from: 160, rise: 1.3, dur, peak: 0.12, vibrato: 40, depth: 12, type: "sawtooth" });
      warble({ from: 322, rise: 1.3, dur, peak: 0.05, vibrato: 37, depth: 20, type: "square" });
      hiss({ freq: 1200, dur, peak: 0.25, attack: 0.05 });
    },
    twinkle() {
      tone({ type: "triangle", from: 2093, dur: 0.2, peak: 0.08 });
      tone({ type: "triangle", from: 2637, t: at(0.07), dur: 0.3, peak: 0.07 });
    },
    bell() {
      for (let k = 0; k < 3; k++) {
        tone({ type: "triangle", from: 880, t: at(k * 0.28), dur: 0.9, peak: 0.25 });
        tone({ from: 2210, t: at(k * 0.28), dur: 0.5, peak: 0.07 });
      }
    },
    fanfare() {
      [72, 76, 79, 84].forEach((n, i) => tone({ wave: lead, from: midi(n), t: at(i * 0.11), dur: 0.12, peak: 0.12, attack: 0.003 }));
      for (const n of [72, 76, 79, 84]) tone({ wave: lead, from: midi(n), t: at(0.46), dur: 0.9, peak: 0.07, attack: 0.01 });
      tone({ type: "triangle", from: midi(48), t: at(0.46), dur: 0.9, peak: 0.3 });
    },
    /** A short chiptune battle loop (A minor, 160 bpm), all made here. Returns { stop }. */
    music() {
      const out = ctx.createGain();
      out.gain.value = 0.16;
      out.connect(master);
      const step = 60 / 160 / 4;
      const t0 = at(0.02);
      const chords = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [52, 56, 59, 64]]; // Am F G E
      const bass = [45, 41, 43, 40];
      const arp = [0, 1, 2, 3, 2, 1, 2, 3];
      for (let half = 0; half < 16; half++) {
        for (let s = 0; s < 8; s++) {
          const t = t0 + (half * 8 + s) * step;
          const chord = chords[half % 4];
          tone({ wave: lead, from: midi(chord[arp[s]] + (half >= 8 ? 12 : 0)), t, dur: step * 0.9, peak: 0.12, attack: 0.003, out });
          if (s !== 1 && s !== 4) tone({ type: "triangle", from: midi(bass[half % 4] + (s === 7 ? 12 : 0)), t, dur: step * 0.85, peak: 0.4, out });
          if (s === 0 || s === 6) tone({ from: 150, to: 45, t, dur: 0.12, peak: 0.6, out });
          if (s === 4) {
            hiss({ t, freq: 1800, dur: 0.12, peak: 0.35, out });
            tone({ from: 220, to: 180, t, dur: 0.08, peak: 0.2, out });
          }
          if (s % 2 === 0) hiss({ t, type: "highpass", freq: 8000, dur: 0.03, peak: 0.1, out });
        }
      }
      return { stop: () => out.gain.setTargetAtTime(0, ctx.currentTime, 0.05) };
    },
    hush: audio.hush,
    close: audio.close,
  };
}

// ---------------------------------------------------------------- the scene

/**
 * Plays the fight scene in `root` and resolves with { skipped } once it's over.
 * Click, Esc, Enter or Space skips it.
 */
export async function playFightScene({ kind = "cat", name = "", foe = "", foeName: rivalName = "", speak = false, root = document.body } = {}) {
  const heroKind = PETS[kind] ? kind : "cat";
  const foeKind = chooseFoe(heroKind, foe);
  const heroName = (String(name || "").trim().slice(0, 24) || PETS[heroKind].name).toUpperCase();
  const twin = foeKind === heroKind;
  const villain = (String(rivalName || "").trim().slice(0, 30) || foeName(heroKind, heroName, foeKind)).toUpperCase();
  const foeAura = twin ? "#b06cff" : petGeometry(foeKind).fur;

  await Promise.race([fontsReady(), sleep(700)]);

  // ----- the stage
  const stage = h("div", "fs");
  const world = h("canvas", "fs-world");
  const fx = h("div", "fs-fx");
  const hudSide = (side, kindOf, label, mirror) => {
    const hp = h("i", "fs-hp");
    const lag = h("i", "fs-lag");
    const root = h("div", `fs-fighter ${side}`, [h("div", "fs-face", [face(kindOf, { mirror, shadow: side === "right" && twin })]), h("div", "fs-info", [h("span", "fs-name", [label]), h("div", "fs-bar", [lag, hp])])]);
    return { root, hp, lag };
  };
  const hud = { left: hudSide("left", heroKind, heroName, false), right: hudSide("right", foeKind, villain, true) };
  const combo = h("div", "fs-combo");
  const bandL = h("div", "fs-band left", [face(heroKind, { talk: true }), h("span", "fs-band-name", [heroName])]);
  const bandR = h("div", "fs-band right", [face(foeKind, { talk: true, mirror: true, shadow: twin }), h("span", "fs-band-name", [villain])]);
  bandL.style.setProperty("--band", petGeometry(heroKind).fur);
  bandR.style.setProperty("--band", foeAura);
  const skipButton = h("button", "cs-skip", ["skip ▸"]);
  skipButton.type = "button";
  stage.append(
    world,
    h("div", "fs-vignette"),
    h("div", "fs-hud", [hud.left.root, h("div", "fs-vs", ["VS"]), hud.right.root]),
    combo,
    fx,
    h("div", "fs-intro", [bandL, bandR, h("div", "fs-vs-big", ["VS"])]),
    skipButton,
  );
  stage.setAttribute("role", "dialog");
  stage.setAttribute("aria-label", `${heroName} fights ${villain}`);

  const timeline = createTimeline();
  const sfx = createFightSound();
  let music = null;
  const skip = () => {
    if (timeline.skip()) sfx.hush();
  };
  const unmount = mountStage(root, stage, skip);

  const L = fightLayout(stage.clientWidth || window.innerWidth, stage.clientHeight || window.innerHeight);
  const { W, H, S, ground } = L;
  world.width = W;
  world.height = H;
  world.style.width = `${W * L.p}px`;
  world.style.height = `${H * L.p}px`;
  const ctx = world.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const PAD = 10; // the arena is painted bigger than the screen, so shaking never shows its edge
  const arena = paintArena(W + PAD * 2, H + PAD * 2, ground + PAD);

  const actor = (kindOf, facing, aura, shadow, side) => ({ side, facing, frames: spriteFrames(kindOf, aura, shadow), x: 0, y: 0, rot: 0, sx: 1, sy: 1, flash: 0, auraOn: 0, frame: "idle", faceUntil: 0, nextBlink: rand(1, 3), visible: true });
  const hero = actor(heroKind, 1, HERO_AURA, false, "left");
  const rival = actor(foeKind, -1, foeAura, twin, "right");
  const homeL = Math.round(W * 0.27);
  const homeR = Math.round(W * 0.73);
  hero.x = homeL;
  rival.x = homeR;
  const hp = { left: 100, right: 100 };

  // ----- the world's moving parts
  const particles = [];
  const impacts = [];
  const shots = [];
  let beam = null;
  let shake = 0;
  let flash = 0;
  let dim = 0;
  let freeze = 0; // hit-stop: the fighters pause for a split second on big hits
  let clock = 0;
  const anims = new Set();

  const animate = (seconds, step, ease = (t) => t) =>
    timeline.defer((done) => {
      const anim = { start: clock, seconds, step, ease, done };
      anims.add(anim);
      return () => anims.delete(anim);
    });
  const pause = (seconds) => animate(seconds, () => {});
  const until = (test) =>
    timeline.defer((done) => {
      const anim = { start: clock, seconds: Infinity, step: () => test() && (anims.delete(anim), done()), ease: (t) => t, done };
      anims.add(anim);
      return () => anims.delete(anim);
    });

  function spray(x, y, { n = 12, colors = ["#ffffff", "#ffd23f"], speed = [40, 120], life = [0.25, 0.6], gravity = 160, size = [1, 2], angle = [0, Math.PI * 2] } = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(angle[0], angle[1]);
      const v = rand(speed[0], speed[1]);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(life[0], life[1]), age: 0, color: pick(colors), size: Math.round(rand(size[0], size[1])), gravity });
    }
  }
  const dust = (a, n = 8) => spray(a.x, ground - 1, { n, colors: ["#cdb8dd", "#9a83ad", "#ffffff"], speed: [15, 50], angle: [Math.PI * 1.05, Math.PI * 1.95], gravity: 40, life: [0.3, 0.6] });
  const impact = (x, y, r = 10) => impacts.push({ x, y, r, age: 0, life: 0.16 });
  const setFace = (a, frame, seconds) => {
    a.frame = frame;
    a.faceUntil = clock + seconds;
  };

  function move(a, toX, seconds, { hop = 0, toY = a.y, tilt = 0, ease = easeInOut } = {}) {
    const fromX = a.x;
    const fromY = a.y;
    return animate(seconds, (e, t) => {
      a.x = fromX + (toX - fromX) * e;
      a.y = fromY + (toY - fromY) * e - hop * Math.sin(Math.PI * t);
      a.rot = tilt * Math.sin(Math.PI * t);
    }, ease);
  }
  const squash = (a) =>
    animate(0.16, (e, t) => {
      const k = Math.sin(Math.PI * t);
      a.sy = 1 - 0.2 * k;
      a.sx = 1 + 0.2 * k;
    });

  // ----- words on screen (world position -> screen position)
  function pop(text, x, y, { size = 1, color = "#ffffff", className = "", tilt = rand(-14, 14) } = {}) {
    const node = h("span", `fs-pop ${className}`.trim(), [text]);
    node.style.left = `${Math.round(clamp(x, 10, W - 10) * L.p)}px`;
    node.style.top = `${Math.round(clamp(y, 8, H - 8) * L.p)}px`;
    node.style.fontSize = `${Math.round(clamp(S * L.p * 0.15 * size, 12, 64))}px`;
    node.style.color = color;
    node.style.setProperty("--tilt", `${tilt.toFixed(1)}deg`);
    node.addEventListener("animationend", () => node.remove());
    fx.append(node);
  }
  function banner(text, className = "", seconds = 0.75) {
    const node = h("div", `fs-banner ${className}`.trim(), [text]);
    fx.append(node);
    if (!className.includes("stay")) timeline.later(() => node.remove(), seconds * 1000);
    return node;
  }
  function zoom(x, y, amount = 1.06) {
    world.style.transformOrigin = `${Math.round(x * L.p)}px ${Math.round(y * L.p)}px`;
    world.style.transform = `scale(${amount})`;
    timeline.later(() => (world.style.transform = ""), 160);
  }
  function renderHp(side) {
    const bar = hud[side];
    const value = hp[side];
    bar.hp.style.width = `${value}%`;
    bar.lag.style.width = `${value}%`;
    bar.root.classList.toggle("mid", value <= 50 && value > 25);
    bar.root.classList.toggle("low", value <= 25);
  }
  let comboCount = 0;
  function showCombo(count) {
    comboCount = count;
    combo.textContent = count ? `${count} HIT${count > 1 ? "S" : ""}!` : "";
    combo.classList.remove("show");
    void combo.offsetWidth;
    if (count) combo.classList.add("show");
  }

  /** One fighter lands a hit on the other. */
  function hit(target, { dmg, dir, knock = 8, big = false, word = pick(HIT_WORDS), wordAt = 0, number = true, at } = {}) {
    const x = at?.x ?? target.x - dir * S * 0.32;
    const y = at?.y ?? ground + target.y - S * 0.55;
    target.flash = 1;
    setFace(target, "blink", 0.4);
    impact(x, y, big ? 18 : 11);
    spray(x, y, { n: big ? 28 : 14, colors: ["#ffffff", "#ffd23f", "#ff8a3d"], speed: [50, big ? 210 : 130] });
    shake = Math.max(shake, big ? 6 : 3);
    freeze = big ? 0.14 : 0.07;
    if (big) zoom(x, y, 1.07);
    if (big) sfx.heavy();
    else sfx.punch();
    hp[target.side] = Math.max(0, hp[target.side] - dmg);
    renderHp(target.side);
    if (word) pop(word, x + wordAt * S * 0.55 + rand(-S * 0.1, S * 0.1), y - S * rand(0.3, 0.55), { size: big ? 1.5 : 1.1, color: pick(["#ffd23f", "#ffffff", "#7cf4ff", "#ff7ab6"]) });
    if (number) pop(`-${dmg}`, target.x + dir * S * rand(0.2, 0.5), ground + target.y - S * rand(1.05, 1.25), { size: 0.75, color: "#ff5a5a", className: "dmg", tilt: 0 });
    if (knock) {
      const fromX = target.x;
      const toX = clamp(fromX + dir * knock, S * 0.55, W - S * 0.55); // stay on screen
      animate(0.18, (e) => (target.x = fromX + (toX - fromX) * e), easeOut).catch(() => {});
    }
  }

  // ----- drawing
  function drawActor(a) {
    if (!a.visible) return;
    const x = Math.round(a.x);
    const bob = a.y === 0 && a.frame === "idle" && Math.floor(clock * 3) % 2 ? 1 : 0;
    const feet = Math.round(ground + a.y) + bob;
    const air = clamp(-a.y / (S * 1.5), 0, 1);
    const sw = Math.round(S * 0.62 * (1 - air * 0.6));
    ctx.fillStyle = "rgba(10, 4, 20, 0.45)";
    ctx.fillRect(x - Math.round(sw / 2), ground - 1, sw, 2);
    ctx.fillRect(x - Math.round(sw / 2) + 2, ground + 1, Math.max(0, sw - 4), 1);
    ctx.save();
    ctx.translate(x, feet);
    ctx.scale(a.sx, a.sy);
    ctx.translate(0, -S / 2);
    ctx.rotate(a.rot);
    ctx.scale(a.facing, 1);
    if (a.auraOn > 0) {
      ctx.globalAlpha = a.auraOn * (0.55 + 0.45 * Math.sin(clock * 32));
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.drawImage(a.frames.aura, -S / 2 + dx, -S / 2 + dy, S, S);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(a.frames[a.frame] || a.frames.idle, -S / 2, -S / 2, S, S);
    if (a.flash > 0) {
      ctx.globalAlpha = Math.min(1, a.flash);
      ctx.drawImage(a.frames.white, -S / 2, -S / 2, S, S);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function disc(x, y, r, color) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(Math.round(x) - half, Math.round(y) + dy, half * 2 + 1, 1);
    }
  }
  function render() {
    const quake = Math.min(shake, PAD - 1);
    const ox = quake > 0.3 ? Math.round(rand(-quake, quake)) : 0;
    const oy = quake > 0.3 ? Math.round(rand(-quake, quake)) : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#06030f";
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, ox, oy);
    ctx.drawImage(arena, -PAD, -PAD);
    if (dim > 0) {
      ctx.fillStyle = `rgba(6, 3, 15, ${dim})`;
      ctx.fillRect(-10, -10, W + 20, H + 20);
    }
    if (beam) {
      const half = Math.round(beam.h / 2);
      ctx.fillStyle = beam.color;
      ctx.fillRect(Math.round(beam.x), Math.round(beam.y) - half - (Math.random() < 0.5 ? 1 : 0), W, half * 2 + 1);
      ctx.fillStyle = "#ffffff";
      const core = Math.max(1, Math.round(half * 0.45));
      ctx.fillRect(Math.round(beam.x), Math.round(beam.y) - core, W, core * 2 + 1);
      disc(beam.x, beam.y, half + 2, beam.color);
      disc(beam.x, beam.y, core + 1, "#ffffff");
    }
    for (const a of [rival, hero]) drawActor(a);
    for (const s of shots) {
      disc(s.x, s.y, s.r + 1, s.color);
      disc(s.x, s.y, Math.max(1, s.r - 2), "#ffffff");
    }
    for (const p of impacts) {
      const k = p.age / p.life;
      const r = Math.round(p.r * (0.6 + 0.6 * k));
      ctx.fillStyle = k < 0.5 ? "#ffffff" : "#ffd23f";
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
        for (let t = Math.round(r * 0.35); t < r; t++) ctx.fillRect(Math.round(p.x + dx * t), Math.round(p.y + dy * t), t < r * 0.7 ? 2 : 1, t < r * 0.7 ? 2 : 1);
      }
      disc(p.x, p.y, Math.max(1, Math.round(r * 0.3)), "#ffffff");
    }
    for (const p of particles) {
      ctx.globalAlpha = clamp(1 - (p.age / p.life) ** 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    if (flash > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, flash)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  let last = performance.now();
  let raf = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (freeze > 0) freeze -= dt;
    else {
      clock += dt;
      for (const a of [...anims]) {
        const t = a.seconds === Infinity ? 0 : a.seconds <= 0 ? 1 : clamp((clock - a.start) / a.seconds, 0, 1);
        a.step(a.ease(t), t);
        if (t >= 1 && anims.has(a)) {
          anims.delete(a);
          a.done();
        }
      }
      for (const a of [hero, rival]) {
        if (a.faceUntil && clock > a.faceUntil) {
          a.frame = "idle";
          a.faceUntil = 0;
        }
        if (a.frame === "idle" && clock > a.nextBlink) {
          setFace(a, "blink", 0.14);
          a.nextBlink = clock + rand(1.8, 3.5);
        }
      }
      for (const s of shots) {
        s.x += s.vx * dt;
        spray(s.x - Math.sign(s.vx) * s.r, s.y, { n: 1, colors: [s.color, "#ffffff"], speed: [5, 25], gravity: 0, life: [0.15, 0.3] });
      }
    }
    for (const a of [hero, rival]) a.flash = Math.max(0, a.flash - dt * 6);
    for (const p of particles) {
      p.age += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].age > particles[i].life) particles.splice(i, 1);
    for (const p of impacts) p.age += dt;
    for (let i = impacts.length - 1; i >= 0; i--) if (impacts[i].age > impacts[i].life) impacts.splice(i, 1);
    shake = shake > 0.3 ? shake * Math.pow(0.004, dt) : 0;
    flash = Math.max(0, flash - dt * 3);
    render();
    if (!timeline.stopped || stage.isConnected) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const announce = (line) => speak && speakLine(line, 0.6, 0.95);

  // ----- the fight
  async function perform() {
    stage.classList.add("on");
    sfx.boom();
    await pause(0.2);
    stage.classList.add("intro");
    sfx.whoosh();
    await pause(0.3);
    sfx.slam();
    await pause(0.85);
    stage.classList.add("arena");
    sfx.whoosh();
    await pause(0.3);
    banner("ROUND 1", "round", 0.6);
    announce("Round one!");
    await pause(0.6);
    banner("FIGHT!", "fight", 0.6);
    announce("Fight!");
    sfx.clash();
    music = sfx.music();
    await pause(0.3);

    // 1. they charge at each other and clash in the middle
    sfx.whoosh();
    dust(hero);
    dust(rival);
    setFace(hero, "yell", 0.5);
    setFace(rival, "yell", 0.5);
    await Promise.all([move(hero, W / 2 - S * 0.42, 0.36, { tilt: 0.3, ease: easeIn }), move(rival, W / 2 + S * 0.42, 0.36, { tilt: -0.3, ease: easeIn })]);
    impact(W / 2, ground - S * 0.55, 20);
    spray(W / 2, ground - S * 0.55, { n: 30, colors: ["#ffffff", HERO_AURA, foeAura], speed: [60, 200] });
    sfx.clash();
    shake = 5;
    freeze = 0.12;
    zoom(W / 2, ground - S * 0.55);
    pop("CLASH!", W / 2, ground - S * 1.3, { size: 1.4, color: "#ffffff", tilt: -4 });
    await Promise.all([move(hero, homeL + S * 0.15, 0.3, { hop: 8, ease: easeOut }), move(rival, homeR - S * 0.15, 0.3, { hop: 8, ease: easeOut })]);
    await pause(0.12);

    // 2. a flying kick
    sfx.whoosh();
    setFace(hero, "yell", 0.6);
    await move(hero, rival.x - S * 0.78, 0.42, { hop: S * 0.9, tilt: 0.5 });
    hit(rival, { dmg: 16, dir: 1, knock: S * 0.35, word: "KICK!" });
    squash(hero).catch(() => {});
    dust(hero, 5);
    await pause(0.12);
    await Promise.all([move(hero, homeL + S * 0.3, 0.3, { hop: 8, tilt: -0.15 }), move(rival, homeR, 0.3, { hop: 5 })]);

    // 3. the rival's special attack: an energy ball (dodged, most of the time)
    rival.auraOn = 0.01;
    setFace(rival, "yell", 0.9);
    sfx.charge(0.55);
    await animate(0.55, (e) => {
      rival.auraOn = e;
      if (Math.random() < 0.6) spray(rival.x + rand(-S * 0.4, S * 0.4), ground - rand(0, S * 0.3), { n: 1, colors: [foeAura, "#ffffff"], speed: [20, 60], angle: [Math.PI * 1.4, Math.PI * 1.6], gravity: -40, life: [0.3, 0.5] });
    });
    const shot = { x: rival.x - S * 0.45, y: ground - S * 0.45, vx: -W * 1.1, r: Math.max(3, Math.round(S * 0.1)), color: foeAura };
    shots.push(shot);
    sfx.pew();
    rival.x += 3;
    pop(pick(["HI-YAH!", "TAKE THIS!", "YAAH!", "HYAH!"]), rival.x, ground - S * 1.25, { size: 0.8, color: foeAura, tilt: 6 });
    await until(() => shot.x < hero.x + S * 1.35);
    rival.auraOn = 0;
    if (Math.random() < 0.6) {
      sfx.whoosh();
      setFace(hero, "yell", 0.5);
      pop("MISS!", hero.x, ground - S * 2.05, { size: 0.9, color: "#7cf4ff", tilt: 0 });
      await move(hero, hero.x, 0.5, { hop: S * 1.15 });
      squash(hero).catch(() => {});
      await until(() => shot.x < -20);
      shots.length = 0;
    } else {
      await until(() => shot.x < hero.x + S * 0.3);
      shots.length = 0;
      hit(hero, { dmg: 12, dir: -1, knock: S * 0.3, at: { x: shot.x, y: shot.y }, word: "ZAP!" });
      spray(shot.x, shot.y, { n: 20, colors: [foeAura, "#ffffff"], speed: [40, 150] });
      await pause(0.3);
    }

    // 4. a combo, finished with an uppercut
    sfx.whoosh();
    await move(hero, rival.x - S * 0.72, 0.2, { tilt: 0.3, ease: easeIn });
    for (let i = 0; i < 4; i++) {
      const fromX = hero.x;
      setFace(hero, "yell", 0.15);
      await animate(0.07, (e, t) => (hero.x = fromX + 5 * Math.sin(Math.PI * t)));
      hit(rival, { dmg: 6 + i, dir: 1, knock: 3, word: i % 2 ? "" : HIT_WORDS[(i * 3) % HIT_WORDS.length], wordAt: i ? 0.8 : -0.6, number: false });
      showCombo(i + 1);
      await pause(0.13);
    }
    setFace(hero, "yell", 0.4);
    await move(hero, hero.x + 4, 0.1, { hop: 10 });
    hit(rival, { dmg: 10, dir: 1, knock: 0, big: true, word: "UPPERCUT!", number: false });
    showCombo(5);
    pop("-40", rival.x + S * 0.4, ground - S * 1.3, { size: 1, color: "#ff5a5a", className: "dmg", tilt: 0 }); // the whole combo
    const launchX = rival.x;
    const landX = Math.min(launchX + S * 0.55, W - S * 0.6);
    await animate(0.65, (e, t) => {
      rival.x = launchX + (landX - launchX) * e;
      rival.y = -S * 1.35 * Math.sin(Math.PI * t);
      rival.rot = -Math.PI * 2 * t;
    });
    rival.y = 0;
    rival.rot = 0;
    sfx.thud();
    shake = 4;
    dust(rival, 12);
    squash(rival).catch(() => {});
    await move(hero, homeL + S * 0.4, 0.28, { hop: 6, tilt: -0.15 });
    showCombo(0);

    // 5. the rival gets back up, angry, and tackles
    setFace(rival, "yell", 0.6);
    pop("!", rival.x, ground - S * 1.35, { size: 1.6, color: "#ff5a5a", tilt: 0 });
    sfx.growl();
    await pause(0.3);
    sfx.whoosh();
    dust(rival);
    await move(rival, hero.x + S * 0.7, 0.22, { tilt: -0.35, ease: easeIn });
    hit(hero, { dmg: 20, dir: -1, knock: S * 0.5, big: true, word: "OUCH!" });
    await pause(0.12);
    await move(rival, homeR, 0.32, { hop: 8, tilt: 0.15 });
    await pause(0.2);

    // 6. the super move
    setFace(hero, "yell", 2);
    sfx.charge(0.9);
    const cut = h("div", "fs-cutin", [face(heroKind, { talk: true }), h("span", "fs-cutin-text", ["SUPER MOVE!"])]);
    fx.append(cut);
    timeline.later(() => cut.remove(), 1000);
    await animate(0.25, (e) => (dim = 0.6 * e));
    await animate(0.75, (e) => {
      hero.auraOn = e;
      if (Math.random() < 0.7) spray(hero.x + rand(-S * 0.5, S * 0.5), ground - rand(0, S * 0.2), { n: 1, colors: [HERO_AURA, "#ffffff", "#ff8a3d"], speed: [30, 80], angle: [Math.PI * 1.4, Math.PI * 1.6], gravity: -60, life: [0.3, 0.6] });
    });
    const exit = { x: W - 6, y: Math.round(H * 0.16) };
    const flyAway = async (seconds) => {
      const fromX = rival.x;
      setFace(rival, "blink", seconds + 1);
      await animate(seconds, (e) => {
        rival.x = fromX + (exit.x + S - fromX) * e;
        rival.y = -(ground - exit.y) * e;
        rival.rot = -Math.PI * 5 * e;
        rival.sx = rival.sy = 1 - 0.7 * e;
      }, easeOut);
      rival.visible = false;
      impact(exit.x - 4, exit.y, 6);
      sfx.twinkle();
    };
    if (Math.random() < 0.5) {
      // a meteor dive from the sky
      sfx.whoosh();
      await move(hero, hero.x, 0.3, { toY: -(H + S), ease: easeIn });
      await pause(0.2);
      const startX = rival.x - S * 2.3;
      hero.x = startX;
      sfx.dive();
      await animate(0.3, (e) => {
        hero.x = startX + (rival.x - S * 0.35 - startX) * e;
        hero.y = -(H + S) * (1 - e);
        hero.rot = 0.6;
        spray(hero.x, ground + hero.y - S * 0.5, { n: 3, colors: [HERO_AURA, "#ff8a3d", "#ffffff"], speed: [10, 40], gravity: 0, life: [0.2, 0.4] });
      }, easeIn);
      hero.y = 0;
      hero.rot = 0;
      flash = 1;
      sfx.explosion();
      hit(rival, { dmg: hp.right, dir: 1, knock: 0, big: true, word: "KABOOM!" });
      spray(rival.x, ground - S * 0.4, { n: 50, colors: [HERO_AURA, "#ff8a3d", "#ff5a5a", "#ffffff"], speed: [60, 260], life: [0.4, 0.9] });
      shake = 10;
      squash(hero).catch(() => {});
      await flyAway(0.85);
    } else {
      // a giant energy beam
      sfx.beam(1.05);
      beam = { x: hero.x + S * 0.35, y: ground - S * 0.5, h: 0, color: HERO_AURA };
      await animate(0.14, (e) => (beam.h = S * 0.55 * e));
      flash = 0.8;
      hit(rival, { dmg: hp.right, dir: 1, knock: 0, big: true, word: "KABOOM!" });
      shake = 7;
      const riding = flyAway(0.8);
      await animate(0.8, () => {
        beam.h = S * 0.55 * (1 + 0.12 * Math.sin(clock * 60));
        spray(rand(beam.x, W), beam.y + rand(-beam.h / 2, beam.h / 2), { n: 2, colors: ["#ffffff", HERO_AURA], speed: [20, 80], gravity: 0, life: [0.15, 0.35] });
        shake = Math.max(shake, 2);
      });
      await riding;
      await animate(0.16, (e) => (beam.h = S * 0.55 * (1 - e)));
      beam = null;
    }
    hero.auraOn = 0;
    animate(0.3, (e) => (dim = 0.6 * (1 - e))).catch(() => {});

    // 7. K.O.
    music?.stop();
    sfx.bell();
    const ko = banner("K.O.!", "ko stay");
    announce("K.O.!");
    await pause(0.8);
    ko.classList.add("gone");

    // 8. victory
    setFace(hero, "yell", 3);
    await move(hero, W / 2, 0.35, { hop: 10 });
    banner(`${heroName} WINS!`, "wins stay");
    announce(`${heroName} wins!`);
    sfx.fanfare();
    for (let i = 0; i < 70; i++) {
      particles.push({ x: rand(0, W), y: rand(-H * 0.4, -2), vx: rand(-12, 12), vy: rand(20, 55), life: rand(1.4, 2.4), age: 0, color: pick(CONFETTI), size: 1 + (Math.random() < 0.3 ? 1 : 0), gravity: 12 });
    }
    for (let i = 0; i < 2; i++) {
      await move(hero, W / 2, 0.3, { hop: S * 0.35 });
      squash(hero).catch(() => {});
      await pause(0.1);
    }
    await pause(0.55);
  }

  try {
    await perform();
  } catch (err) {
    if (err !== timeline.SKIP) console.error(err);
  } finally {
    timeline.stop();
    music?.stop();
    unmount();
    if (speak) {
      try {
        speechSynthesis.cancel();
      } catch {
        // no speech
      }
    }
    stage.classList.add("out");
    await sleep(timeline.skipped ? 220 : 340);
    cancelAnimationFrame(raf);
    stage.remove();
    sfx.close();
  }
  return { skipped: timeline.skipped, foe: foeKind };
}
