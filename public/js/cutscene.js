// The joke cutscene: the pet takes the stage at a comedy club, tells the joke into a
// microphone, the crowd laughs, and it puts on shades and drops the mic. All the art
// and sound are made in code, so it works offline. It runs over the page in the
// browser, and in its own full-screen window in the desktop app (public/cutscene.html).
import { PETS, drawPet } from "./pets.js";
import { h, clamp, rand, pick, sleep, fontsReady, speakLine, createAudio, silentSound, createTimeline, mountStage } from "./stage-kit.js";

// How high each pet's voice is: the pitch of the typing blips (Hz), and of the spoken voice.
const VOICE = {
  hamster: 980, bunny: 900, duck: 880, axolotl: 840, hedgehog: 820, unicorn: 800, frog: 760, cat: 760,
  penguin: 720, sheep: 700, fox: 680, octopus: 640, raccoon: 620, owl: 600, koala: 600, dog: 560,
  pig: 520, panda: 480, turtle: 460, dragon: 420, capybara: 420, shark: 400, bear: 360, lion: 340,
};

const INTROS = ["Ahem... is this thing on?", "Hello, hello! Great crowd tonight!", "Okay, okay, settle down!", "Thank you, thank you! Here's one for you."];
const LAUGHS = ["HA!", "HAHA!", "LOL", "HEHE", "HA HA HA", "HAHA", "LOL!", "HA!"];
const POP_COLORS = ["#ffd23f", "#ff7ab6", "#7cf4ff", "#ffffff", "#a6ff7a"];


/** Where a pet's eyes and mouth are (from its blink and talk pixels), and its fur colour. */
export function petGeometry(kind) {
  const pet = PETS[kind] || PETS.cat;
  const rows = pet.rows;
  const eyes = [];
  for (const [from, to] of [[0, 7], [8, 15]]) {
    const pixels = pet.blink.filter(([, c]) => c >= from && c <= to);
    if (!pixels.length) continue;
    let top = Math.min(...pixels.map(([r]) => r));
    let bottom = Math.max(...pixels.map(([r]) => r));
    const left = Math.min(...pixels.map(([, c]) => c));
    const right = Math.max(...pixels.map(([, c]) => c));
    // An eye is often taller than its blink line: take in the dark pixels right next to it.
    for (let r = Math.max(0, top - 1); r <= Math.min(15, bottom + 1); r++) {
      for (let c = left; c <= right; c++) {
        if ("kh".includes(rows[r][c])) {
          top = Math.min(top, r);
          bottom = Math.max(bottom, r);
        }
      }
    }
    eyes.push({ top, bottom, left, right });
  }
  const mouthRows = pet.talk.map(([r]) => r);
  const mouthCols = pet.talk.map(([, c]) => c);
  const mouth = { top: Math.min(...mouthRows), bottom: Math.max(...mouthRows), left: Math.min(...mouthCols), right: Math.max(...mouthCols) };
  const counts = {};
  for (const row of rows) for (const ch of row) if (ch !== "." && ch !== "o") counts[ch] = (counts[ch] || 0) + 1;
  const main = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return { eyes, mouth, fur: pet.palette[main] || "#cccccc", outline: pet.palette.o || "#1b1b2f" };
}

/** Sunglasses that fit a pet's eyes: one lens per eye, joined by a bridge. */
export function shadeLenses(geo) {
  return geo.eyes
    .map((e) => ({ top: e.top, bottom: Math.min(15, Math.max(e.bottom, e.top + 1)), left: Math.max(0, e.left - 1), right: Math.min(15, e.right + 1) }))
    .sort((a, b) => a.left - b.left);
}

/** Where the microphone goes, in sprite pixels: beside the mouth, held in front of the body. */
export function micSpot(geo) {
  return { x: clamp(geo.mouth.right + 3, 10, 12), y: clamp(geo.mouth.top - 1, 3, 7) };
}

// ---------------------------------------------------------------- pixel art

const MIC = [".ooo.", "oGgGo", "ogGgo", ".ooo.", ".oro.", ".oko.", ".oko.", ".oko.", "..o.."];
const MIC_COLORS = { o: "#15121f", g: "#f0f0f6", G: "#a5a5bb", r: "#e8336b", k: "#45415a" };
const PAW = ["oFFFo", "oFFFo", ".ooo."];
// Speech bubble tails: the white column/row overlaps the bubble's outline so they join up.
const TAIL_SIDE = ["Wo....", "WWo...", "WWWo..", "WWWWo.", "oooooo"];
const TAIL_DOWN = ["WWWWo", "oWWWo", ".oWWo", "..oWo", "...oo", "....o"];
const TAIL_COLORS = { W: "#ffffff", o: "#1d1830" };
const FAN_HEADS = [
  ["..............", "..............", "..............", "..............", ".....####.....", "....######....", "...########...", "...########...", "...########...", "....######....", ".....####....."],
  ["..............", "..............", "...#......#...", "...##....##...", "...########...", "...########...", "...########...", "...########...", "...########...", "....######....", ".....####....."],
  ["....#....#....", "...##....##...", "...##....##...", "...##....##...", "....######....", "...########...", "...########...", "...########...", "...########...", "....######....", ".....####....."],
  ["..............", "..............", "..##......##..", "..###....###..", "...########...", "...########...", "...########...", "...########...", "...########...", "....######....", ".....####....."],
  ["..............", "......##......", ".....####.....", "......##......", "....######....", "...########...", "...########...", "...########...", "...########...", "....######....", ".....####....."],
];
const FAN_BODY = ["..##########..", ".############.", "##############", "##############", "##############"];

function paint(canvas, rows, colors) {
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!colors[ch]) return;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

/** A crowd member's silhouette, with a rim of stage light along the top. */
function paintFan(canvas, head, fill, rim) {
  const rows = [...head, ...FAN_BODY];
  paint(canvas, rows, { "#": fill });
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = rim;
  for (let x = 0; x < rows[0].length; x++) {
    const y = rows.findIndex((row) => row[x] === "#");
    if (y >= 0 && y < head.length) ctx.fillRect(x, y, 1, 1);
  }
}

function paintShades(canvas, lenses) {
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#121018";
  for (const l of lenses) ctx.fillRect(l.left, l.top, l.right - l.left + 1, l.bottom - l.top + 1);
  if (lenses.length === 2 && lenses[1].left - lenses[0].right > 1) {
    ctx.fillRect(lenses[0].right + 1, lenses[0].top, lenses[1].left - lenses[0].right - 1, 1);
  }
  ctx.fillStyle = "#ffffff";
  for (const l of lenses) {
    ctx.fillRect(l.left + 1, l.top, 1, 1);
    if (l.right - l.left >= 3 && l.bottom > l.top) ctx.fillRect(l.left + 2, l.top + 1, 1, 1);
  }
}

/** A repeating tile of dark red bricks for the club's back wall. */
function brickTile() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#24101c";
  ctx.fillRect(0, 0, 32, 16);
  const shades = ["#5e2234", "#6a2a3c", "#552031", "#73303f"];
  const bricks = [[0, 0], [16, 0], [8, 8], [24, 8]];
  bricks.forEach(([left, top], i) => {
    for (const shift of [0, -32]) {
      ctx.fillStyle = shades[i];
      ctx.fillRect(left + shift + 1, top + 1, 15, 7);
      ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
      ctx.fillRect(left + shift + 1, top + 1, 15, 1);
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx.fillRect(left + shift + 4 + i * 2, top + 4, 2, 1);
    }
  });
  return canvas.toDataURL();
}

// ---------------------------------------------------------------- sound (Web Audio, made live)

function createSound() {
  const audio = createAudio();
  if (!audio) return silentSound();
  const { ctx, master, crowdBus, at, noise, filter, envelope, tone, hiss, warble, applause } = audio;
  const soft = ctx.createBiquadFilter(); // takes the edge off the chiptune blips
  soft.type = "lowpass";
  soft.frequency.value = 2800;
  soft.connect(master);

  /** A crowd laughing: a few dozen "ha-ha" voices (buzz through vowel filters, with breath). */
  function laugh(dur = 4) {
    const t0 = at();
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(1, t0 + 0.3);
    out.gain.setValueAtTime(1, t0 + dur - 1.5);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(crowdBus);
    for (let v = 0; v < 22; v++) {
      const deep = v % 3 === 0;
      const hee = v % 4 === 1; // some laugh "hee hee" instead of "ha ha"
      const f0 = deep ? rand(95, 150) : rand(180, 330);
      const start = t0 + rand(0, 0.7);
      const end = t0 + dur - rand(0.2, 1.4);
      const syllable = 1 / rand(4.2, 6.6);
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      const voice = ctx.createGain();
      voice.gain.value = 0;
      const f1 = filter("bandpass", hee ? rand(300, 420) : rand(650, 900), 5);
      const f2 = filter("bandpass", hee ? rand(2000, 2500) : rand(1050, 1400), 7);
      const level = ctx.createGain();
      level.gain.value = rand(0.06, 0.13);
      osc.connect(voice);
      voice.connect(f1).connect(level);
      voice.connect(f2).connect(level);
      level.connect(out);
      const breath = noise();
      const breathGain = ctx.createGain();
      breathGain.gain.value = 0;
      breath.connect(filter("bandpass", rand(1200, 2200), 1.2)).connect(breathGain).connect(level);
      let t = start;
      let i = 0;
      while (t < end) {
        const len = syllable * rand(0.85, 1.15);
        const pitch = f0 * (1 + 0.3 * Math.exp(-i / 5)) * rand(0.95, 1.05);
        osc.frequency.setValueAtTime(pitch * 1.06, t);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.88, t + len * 0.7);
        breathGain.gain.setValueAtTime(0, t);
        breathGain.gain.linearRampToValueAtTime(0.5, t + 0.02);
        breathGain.gain.linearRampToValueAtTime(0, t + 0.06);
        voice.gain.setValueAtTime(0, t + 0.02);
        voice.gain.linearRampToValueAtTime(1, t + 0.05);
        voice.gain.linearRampToValueAtTime(0, t + len * 0.75);
        t += len;
        i++;
        if (Math.random() < 0.12) t += rand(0.2, 0.45); // catching a breath
      }
      osc.start(start);
      osc.stop(end + 0.2);
      breath.start(start, Math.random());
      breath.stop(end + 0.2);
    }
  }

  return {
    blip(base = 600) {
      tone({ type: "square", from: base * rand(0.92, 1.12), dur: 0.05, peak: 0.035, out: soft });
    },
    hop() {
      tone({ type: "square", from: 280, to: 560, dur: 0.09, peak: 0.05, out: soft });
    },
    tap() {
      tone({ from: 150, to: 55, dur: 0.14, peak: 0.5 });
      hiss({ type: "lowpass", freq: 1800, dur: 0.04, peak: 0.25 });
    },
    feedback() {
      warble({ t: at(0.05), from: 2950, peak: 0.04, dur: 0.55, vibrato: 7, depth: 14 });
    },
    swish() {
      hiss({ type: "bandpass", freq: 350, to: 1100, dur: 0.95, peak: 0.16, attack: 0.35, q: 0.8 });
    },
    clunk() {
      hiss({ type: "lowpass", freq: 900, dur: 0.09, peak: 0.5 });
      tone({ from: 70, to: 45, dur: 0.16, peak: 0.45 });
    },
    rimshot() {
      const t = at();
      for (const [offset, f] of [[0, 230], [0.15, 165]]) {
        tone({ t: t + offset, from: f * 1.5, to: f * 0.75, dur: 0.22, peak: 0.55 });
        hiss({ t: t + offset, freq: 2500, dur: 0.03, peak: 0.2 });
      }
      const crash = t + 0.32;
      hiss({ t: crash, type: "highpass", freq: 6500, dur: 1.1, peak: 0.22, attack: 0.002 });
      const metal = ctx.createGain();
      envelope(metal.gain, crash, 0.035, 0.002, 0.8);
      metal.connect(filter("highpass", 7000)).connect(master);
      for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = f * 2.2;
        osc.connect(metal);
        osc.start(crash);
        osc.stop(crash + 0.85);
      }
    },
    laugh,
    applause,
    whoosh() {
      hiss({ freq: 2400, to: 500, dur: 0.32, peak: 0.2, q: 1.4 });
    },
    ting() {
      tone({ type: "triangle", from: 1760, dur: 0.25, peak: 0.08 });
      tone({ type: "triangle", from: 2637, t: at(0.06), dur: 0.3, peak: 0.06 });
    },
    thud() {
      tone({ from: 120, to: 36, dur: 0.7, peak: 0.9, attack: 0.003 });
      hiss({ type: "lowpass", freq: 450, dur: 0.25, peak: 0.7, attack: 0.002 });
      warble({ t: at(0.18), from: 3300, peak: 0.03, dur: 0.6, rise: 1.06 });
    },
    whistle(offset = 0) {
      const t = at(offset);
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(2500, t + 0.25);
      osc.frequency.exponentialRampToValueAtTime(2000, t + 0.55);
      const gain = ctx.createGain();
      envelope(gain.gain, t, 0.05, 0.05, 0.6);
      osc.connect(gain).connect(crowdBus);
      osc.start(t);
      osc.stop(t + 0.65);
    },
    hush: audio.hush,
    close: audio.close,
  };
}

// ---------------------------------------------------------------- the show

/**
 * Plays the joke cutscene in `root` and resolves with { skipped } once it's over.
 * Click, Esc, Enter or Space skips it.
 */
export async function playJokeShow({ kind = "cat", name = "", setup = "", punchline = "", speak = false, root = document.body } = {}) {
  const petKind = PETS[kind] ? kind : "cat";
  const pet = PETS[petKind];
  const star = String(name || "").trim().slice(0, 24) || pet.name;
  const lines = { setup: String(setup || "").trim().slice(0, 400), punchline: String(punchline || "").trim().slice(0, 400) };
  if (!lines.setup && !lines.punchline) return { skipped: false };

  await Promise.race([fontsReady(), sleep(700)]);

  const geo = petGeometry(petKind);
  const lenses = shadeLenses(geo);
  const mic = micSpot(geo);
  const voice = VOICE[petKind] || 600;

  // ----- build the stage
  const petCanvas = h("canvas", "cs-pet");
  const shades = h("canvas", "cs-shades");
  paintShades(shades, lenses);
  const micCanvas = paint(h("canvas", "cs-mic"), MIC, MIC_COLORS);
  const paw = paint(h("canvas", "cs-paw"), PAW, { o: geo.outline, F: geo.fur });
  const glint = h("i", "cs-glint");
  if (lenses[0]) {
    glint.style.setProperty("--gx", lenses[0].left);
    glint.style.setProperty("--gy", lenses[0].top);
  }
  const body = h("div", "cs-body", [petCanvas, shades, glint]);
  // The mic and the paw holding it sit outside the pose wrapper, so the mic falls straight down.
  const performer = h("div", "cs-performer", [h("div", "cs-shadow"), h("div", "cs-pose", [body]), micCanvas, paw, h("i", "cs-dust left"), h("i", "cs-dust right")]);
  performer.style.setProperty("--mx", mic.x);
  performer.style.setProperty("--my", mic.y);

  const bubbleText = h("div", "cs-bubble-text");
  const bubble = h("div", "cs-bubble", [bubbleText, paint(h("canvas", "cs-tail side"), TAIL_SIDE, TAIL_COLORS), paint(h("canvas", "cs-tail down"), TAIL_DOWN, TAIL_COLORS)]);
  bubbleText.setAttribute("aria-live", "polite");

  const wall = h("div", "cs-wall");
  wall.style.backgroundImage = `url(${brickTile()})`;
  const sign = h("div", "cs-sign", [h("span", "cs-sign-small", ["NOVA COMEDY CLUB"]), h("span", "cs-sign-big", [`${star.toUpperCase()} LIVE!`])]);
  const backRow = h("div", "cs-crowd back");
  const frontRow = h("div", "cs-crowd front");
  const fx = h("div", "cs-fx");
  const skipButton = h("button", "cs-skip", ["skip ▸"]);
  skipButton.type = "button";
  const stage = h("div", "cs", [
    wall,
    h("div", "cs-vignette"),
    sign,
    h("div", "cs-floor"),
    h("div", "cs-dark"),
    h("div", "cs-spot"),
    h("div", "cs-pool"),
    performer,
    backRow,
    frontRow,
    bubble,
    fx,
    h("div", "cs-title", ["MIC DROP!"]),
    h("div", "cs-curtain left"),
    h("div", "cs-curtain right"),
    h("div", "cs-valance"),
    skipButton,
  ]);
  stage.setAttribute("role", "dialog");
  stage.setAttribute("aria-label", `${star} tells a joke`);

  let unit = 16;
  function buildCrowd(width) {
    backRow.replaceChildren();
    frontRow.replaceChildren();
    const rows = [
      { el: backRow, cu: Math.max(2, Math.round(unit * 0.32)), fill: "#1d1534", rim: "#5d4b90", lift: 3, gap: 0.8 },
      { el: frontRow, cu: Math.max(3, Math.round(unit * 0.42)), fill: "#0d0918", rim: "#4a3a7a", lift: -4, gap: 0.85 },
    ];
    for (const row of rows) {
      const fanWidth = 14 * row.cu;
      const count = Math.ceil(width / (fanWidth * row.gap)) + 1;
      const spacing = width / Math.max(1, count - 1);
      for (let i = 0; i < count; i++) {
        const fan = h("canvas", "cs-fan");
        paintFan(fan, pick(FAN_HEADS), row.fill, row.rim);
        fan.style.width = `${fanWidth}px`;
        fan.style.height = `${16 * row.cu}px`;
        fan.style.left = `${Math.round(i * spacing - fanWidth / 2 + rand(-1.5, 1.5) * row.cu + (row.el === backRow ? spacing / 2 : 0))}px`;
        fan.style.bottom = `${Math.round((row.lift + rand(0, 1.2)) * row.cu)}px`;
        fan.style.setProperty("--cu", `${row.cu}px`);
        fan.style.setProperty("--d", `${-rand(0, 0.4).toFixed(2)}s`);
        row.el.append(fan);
      }
    }
  }
  function layout() {
    const width = stage.clientWidth || window.innerWidth;
    const height = stage.clientHeight || window.innerHeight;
    const tall = width < height * 1.15;
    unit = Math.max(4, Math.floor((tall ? Math.min(height * 0.34, width * 0.6) : Math.min(height * 0.5, width * 0.36)) / 16));
    stage.classList.toggle("tall", tall);
    stage.style.setProperty("--u", `${unit}px`);
    stage.style.setProperty("--bp", `${Math.max(3, Math.round(unit / 8))}px`);
    stage.style.setProperty("--shift", tall ? "0px" : `${unit * 3}px`);
    stage.style.setProperty("--floor", tall ? "22vh" : "26vh");
    performer.style.setProperty("--fall", `${unit * (10.5 - mic.y)}px`); // lands lying at the pet's feet
    buildCrowd(width);
  }

  // ----- timing that the user can cut short
  const timeline = createTimeline();
  const { SKIP, wait, later } = timeline;
  const sfx = createSound();
  const skip = () => {
    if (timeline.skip()) sfx.hush();
  };

  // ----- the pet's face: talking, laughing and blinking
  let talking = false;
  let giggling = false;
  let shadesOn = false;
  let tick = 0;
  let blinkUntil = 0;
  let nextBlink = performance.now() + 1500;
  let lastFrame = "";
  const animate = () => {
    tick++;
    const now = performance.now();
    if (now > nextBlink) {
      blinkUntil = now + 160;
      nextBlink = now + 1800 + Math.random() * 2600;
    }
    const blink = !shadesOn && now < blinkUntil;
    const talk = talking ? tick % 3 !== 0 : giggling ? tick % 2 === 0 : false;
    const key = `${blink}|${talk}`;
    if (key === lastFrame) return;
    lastFrame = key;
    drawPet(petCanvas, petKind, { blink, talk });
  };
  const loop = setInterval(animate, 90);
  animate();

  // ----- little helpers for the show
  const where = () => {
    const box = performer.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    return { left: box.left - stageBox.left, top: box.top - stageBox.top, right: box.right - stageBox.left, width: stageBox.width, height: stageBox.height };
  };
  function pop(text, { x, y, size = unit * 0.8, color = "#ffffff", tilt = rand(-10, 10), className = "" }) {
    const node = h("span", `cs-pop ${className}`.trim(), [text]);
    node.style.left = `${Math.round(x)}px`;
    node.style.top = `${Math.round(y)}px`;
    node.style.fontSize = `${Math.max(10, Math.round(size))}px`;
    node.style.color = color;
    node.style.setProperty("--tilt", `${tilt.toFixed(1)}deg`);
    node.addEventListener("animationend", () => node.remove());
    fx.append(node);
  }
  function laughter(ms) {
    const { width, height } = where();
    const end = performance.now() + ms;
    const spawn = () => {
      if (performance.now() > end) return;
      pop(pick(LAUGHS), {
        x: rand(0.08, 0.82) * width,
        y: height - rand(0.1, 0.3) * height,
        size: unit * rand(0.55, 1.05),
        color: pick(POP_COLORS),
      });
      later(spawn, rand(110, 230));
    };
    spawn();
  }
  function sparkles() {
    const box = where();
    for (let i = 0; i < 9; i++) {
      const star = h("i", "cs-star");
      star.style.left = `${Math.round(box.left + rand(-0.15, 1.1) * unit * 16)}px`;
      star.style.top = `${Math.round(box.top + rand(-0.2, 0.7) * unit * 16)}px`;
      star.style.setProperty("--s", `${Math.round(unit * rand(0.5, 1))}px`);
      star.style.animationDelay = `${rand(0, 0.6).toFixed(2)}s`;
      star.addEventListener("animationend", () => star.remove());
      fx.append(star);
    }
  }
  async function say(text, { quick = false, hold } = {}) {
    bubble.classList.toggle("long", text.length > 110);
    // The whole line is laid out from the start (the untyped part invisible), so the bubble doesn't jump.
    const typed = h("span");
    const rest = h("span", "cs-untyped", [text]);
    bubbleText.replaceChildren(typed, rest);
    bubble.classList.add("show");
    await wait(160);
    talking = true;
    const spoken = speak ? speakLine(text, clamp(voice / 600, 0.6, 1.8)) : null;
    const chars = [...text];
    const per = clamp(Math.round((quick ? 1800 : 3200) / chars.length), 16, quick ? 32 : 44);
    let letters = 0;
    for (const [i, ch] of chars.entries()) {
      typed.textContent += ch;
      rest.textContent = chars.slice(i + 1).join("");
      if (!speak && /[\p{L}\p{N}]/u.test(ch) && letters++ % 2 === 0) sfx.blip(voice);
      await wait(per + (/[,;:]/.test(ch) ? 110 : /[.!?…]/.test(ch) ? 200 : 0));
    }
    talking = false;
    if (spoken) await Promise.race([spoken, wait(9000)]);
    await wait(hold ?? (quick ? 450 : clamp(700 + chars.length * 16, 1100, 2400)));
  }
  async function hush() {
    bubble.classList.remove("show");
    await wait(170);
  }

  async function perform() {
    stage.classList.add("on");
    await wait(500);
    sfx.swish();
    stage.classList.add("open");
    await wait(900);
    sfx.clunk();
    stage.classList.add("lit");
    await wait(350);

    // the star hops on from the side, to applause
    stage.classList.add("enter", "cheer");
    sfx.applause(1.8, 0.22);
    for (let i = 0; i < 3; i++) later(() => sfx.hop(), i * 300);
    await wait(950);
    stage.classList.remove("cheer");
    stage.classList.add("idle");
    await wait(200);

    // mic check
    for (let i = 0; i < 2; i++) {
      stage.classList.add("tap");
      sfx.tap();
      const box = where();
      pop("TAP", { x: box.left + (mic.x + 5) * unit, y: box.top + (mic.y - 1 - i) * unit, size: unit * 0.55, tilt: 8 });
      await wait(120);
      stage.classList.remove("tap");
      await wait(220);
    }
    sfx.feedback();
    await say(pick(INTROS), { quick: true });

    // the joke
    if (lines.setup) await say(lines.setup);
    if (lines.punchline) await say(lines.punchline, { hold: 450 });
    sfx.rimshot();
    const box = where();
    pop("BA-DUM TSS!", { x: Math.min(box.right + unit * 0.5, box.width - unit * 7), y: box.top + unit * 2, size: unit * 0.6, color: "#ffd23f", tilt: -6 });
    await wait(650);

    // the crowd goes wild
    stage.classList.remove("idle");
    stage.classList.add("laughing");
    giggling = true;
    sfx.laugh(4.4);
    sfx.applause(4.2, 0.26, 0.4);
    laughter(3400);
    await wait(1300);
    await hush();
    await wait(150);

    // the cool pose: shades on, then the mic drop
    sfx.whoosh();
    stage.classList.add("shades");
    shadesOn = true;
    await wait(500);
    sfx.ting();
    giggling = false;
    stage.classList.add("pose");
    await wait(550);
    stage.classList.add("drop");
    await wait(420);
    sfx.thud();
    stage.classList.add("dropped", "shake");
    sfx.applause(2.6, 0.3, 0.15);
    sfx.whistle(0.3);
    sfx.whistle(0.85);
    sparkles();
    await wait(2100);

    // curtain
    sfx.swish();
    stage.classList.remove("open", "lit", "laughing");
    await wait(1100);
  }

  window.addEventListener("resize", layout);
  const unmount = mountStage(root, stage, skip);
  layout();

  try {
    await perform();
  } catch (err) {
    if (err !== SKIP) console.error(err);
  } finally {
    timeline.stop();
    clearInterval(loop);
    window.removeEventListener("resize", layout);
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
    stage.remove();
    sfx.close();
  }
  return { skipped: timeline.skipped };
}
