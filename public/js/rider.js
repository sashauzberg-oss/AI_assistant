// Your pet riding the mouse cursor ("get on"): it sits on the pointer while you move it,
// leans into the turns, and says things now and then ("Great view up here!", "Wheee!").
// In the browser it rides inside the page. In the desktop app it lives in a small
// see-through window that follows the cursor around the whole screen (public/rider.html).
import { PETS, drawPet } from "./pets.js";
import { petGeometry } from "./cutscene.js";

export const RIDE_LINES = {
  land: ["Hop! I'm on!", "Great view up here!", "All aboard!", "Let's ride!"],
  fast: ["Wheee!", "Wheeeee!", "Zoooom!", "Faster! Faster!", "Whoa, so fast!", "Yahoo!", "We're flying!"],
  stop: ["Whoa!", "Careful!", "Hey, warn me first!", "Phew!"],
  view: ["Great view up here!", "I can see everything from up here!", "Nice view!", "Where to next?", "Are we there yet?", "Comfy up here."],
  chatter: ["This is fun!", "Hold on tight!", "Left! No, right!", "Ooh, where are we going?", "Best. Ride. Ever.", "Beep beep!", "*hums a tune*"],
  wake: ["Huh? We're moving!", "I'm awake! I'm awake!", "Whoa, where are we?"],
  leave: ["Thanks for the ride!", "That was fun!", "Bye-bye, cursor!"],
  woozy: ["Slow down!", "Whoa, whoa, whoa!", "Not so fast!", "Easy there!"],
  dizzy: ["Everything's spinning…", "@_@", "I'm so dizzy…", "I see stars!", "Which way is up?", "The room is spinning!", "Blehhh…", "Too… fast…"],
  better: ["Phew… that's better.", "Okay… I'm okay!", "Can we go slower next time?", "Whoa. The world stopped spinning."],
};

/** The dizzy meter: full at `max`, dizzy from `start` until it drops to `end` (and at least `minSeconds`). */
export const DIZZY = { warn: 1.5, start: 2.6, end: 1, max: 5, minSeconds: 3 };

/**
 * Updates the dizzy meter for one frame. Riding fast fills it, shaking the mouse back and
 * forth fills it faster, and calm riding lets it wear off. Pure, so it can be tested.
 * Returns the new state, with `event` set to "warn", "start" or "end" when that happens.
 */
export function updateDizzy(state, { dt, speed, vx, now }) {
  let { level = 0, dizzy = false, since = 0, warned = false, lastDir = 0 } = state;
  let event = null;
  if (speed > 1100) level += (dt * (speed - 1100)) / 1000;
  const dir = Math.abs(vx) > 900 ? Math.sign(vx) : 0;
  if (dir && lastDir && dir !== lastDir) level += 0.35; // a shake
  if (dir) lastDir = dir;
  else if (speed < 300) lastDir = 0;
  if (speed < 600) level -= dt * (dizzy ? 0.6 : 0.4);
  else if (speed < 1100) level -= dt * 0.15;
  level = Math.max(0, Math.min(DIZZY.max, level));
  if (!dizzy && level >= DIZZY.start) {
    dizzy = true;
    since = now;
    event = "start";
  } else if (!dizzy && !warned && level >= DIZZY.warn) {
    warned = true;
    event = "warn";
  } else if (dizzy && level <= DIZZY.end && now - since > DIZZY.minSeconds * 1000) {
    dizzy = false;
    warned = false;
    event = "end";
  }
  if (!dizzy && level < 0.5) warned = false;
  return { level, dizzy, since, warned, lastDir, event };
}

/**
 * Where the pet sits, relative to the cursor's tip: astride the arrow, with the tip just
 * under its seat and its legs dangling down either side of the arrow.
 */
export const SEAT = { x: 3, y: 6 };
const SIZE = 48; // the pet on the cursor, in CSS pixels (its 16×16 sprite × 3)
const TAIL = ["WWWWo", "oWWWo", ".oWWo", "..oWo", "...oo", "....o"];
const LEG = ["oFo", "oFo", "oFo", "oFo", "oFo", "oPo", "ooo"]; // a dangling leg, F fur and P paw
const STAR = ["..o..", ".oYo.", "oYYYo", ".oYo.", "..o.."]; // a little star circling a dizzy head
const PX = SIZE / 16; // one pet pixel, in CSS pixels

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * What kind of line the pet says next, given how the ride is going (speeds in pixels
 * per second, times in milliseconds). Returns { kind } or null. Pure, so it can be tested.
 */
export function nextLine({ now, speed, fastFor, peak, idleFor, lastLine, nextChatter, saidView, sleeping }) {
  if (sleeping) return speed > 60 ? { kind: "wake" } : null;
  if (idleFor > 40000) return { kind: "sleep" };
  const quiet = now - lastLine;
  if (speed > 1200 && fastFor > 120 && quiet > 2200) return { kind: "fast" };
  if (peak > 1500 && speed < 80 && quiet > 2500) return { kind: "stop" };
  if (idleFor > 4500 && !saidView && quiet > 5000) return { kind: "view" };
  if (speed > 60 && quiet > nextChatter) return { kind: "chatter" };
  return null;
}

export class PetRider {
  /**
   * follow "page": rides the cursor inside this page. follow "window": stays put in its
   * window (the desktop app moves the window) and gets the cursor's speed from motion().
   */
  constructor({ kind = "cat", name = "", sound = "", root = document.body, follow = "page", cursor = null } = {}) {
    this.follow = follow;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "rider-pet";
    this.trail = document.createElement("i");
    this.trail.className = "rider-trail";
    // The legs hang down on either side of the arrow, so the pet sits astride the cursor.
    this.legs = ["left", "right"].map((side) => {
      const leg = document.createElement("canvas");
      leg.className = `rider-leg ${side}`;
      return leg;
    });
    // Dizzy: swirly eyes over the pet's eyes, and stars going round its head.
    this.eyes = document.createElement("div");
    this.eyes.className = "rider-eyes";
    this.stars = [0, 1, 2].map(() => {
      const star = document.createElement("canvas");
      star.className = "rider-star";
      paint(star, STAR, { o: "#1d1830", Y: "#ffd23f" });
      return star;
    });
    this.body = document.createElement("div");
    this.body.className = "rider-body";
    this.body.append(this.trail, ...this.legs, this.canvas, this.eyes, ...this.stars); // legs behind the body
    document.fonts?.load('8px "Press Start 2P"').catch(() => {});
    this.text = document.createElement("span");
    const tail = document.createElement("canvas");
    tail.className = "rider-tail";
    paint(tail, TAIL, { W: "#ffffff", o: "#1d1830" });
    this.bubble = document.createElement("div");
    this.bubble.className = "rider-bubble";
    this.bubble.append(this.text, tail);
    this.el = document.createElement("div");
    this.el.className = `rider ${follow}`;
    this.el.setAttribute("aria-hidden", "true");
    this.el.append(this.bubble, this.body);
    root.append(this.el);
    this.setPet({ kind, name, sound });

    const now = performance.now();
    Object.assign(this, {
      x: cursor?.x ?? window.innerWidth / 2, // where the cursor was last seen
      y: cursor?.y ?? window.innerHeight / 2,
      rawVx: 0,
      rawVy: 0,
      vx: 0,
      vy: 0,
      lastInput: 0,
      lastMove: now,
      fastFor: 0,
      peak: 0,
      lastLine: now,
      nextChatter: 9000 + Math.random() * 6000,
      saidView: false,
      sleeping: false,
      bubbleUntil: 0,
      talkUntil: 0,
      nextBlink: now + 2000,
      blinkUntil: 0,
      tilt: 0,
      clock: 0,
      flight: null, // climbing on or flying back: { from, to, start, ms, done }
      lastFrame: "",
      dizzy: { level: 0, dizzy: false },
      nextDizzyLine: 0,
    });
    if (follow === "page") {
      this.onMove = (e) => {
        if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
        const t = e.timeStamp;
        if (this.lastInput && t > this.lastInput) {
          const dt = (t - this.lastInput) / 1000;
          this.rawVx = (e.clientX - this.x) / dt;
          this.rawVy = (e.clientY - this.y) / dt;
        }
        this.lastInput = t;
        this.x = e.clientX;
        this.y = e.clientY;
      };
      window.addEventListener("pointermove", this.onMove, { passive: true });
      this.onLeave = (e) => {
        if (!e.relatedTarget) this.el.classList.add("waiting");
      };
      this.onEnter = () => this.el.classList.remove("waiting");
      document.addEventListener("mouseout", this.onLeave);
      document.addEventListener("mouseover", this.onEnter);
    }
    this.last = now;
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  setPet({ kind, name, sound }) {
    this.kind = PETS[kind] ? kind : "cat";
    this.name = name || PETS[this.kind].name;
    this.sound = sound || PETS[this.kind].sound;
    this.lastFrame = "";
    const { fur, outline } = furOf(this.kind);
    for (const leg of this.legs) paint(leg, LEG, { o: outline, F: fur, P: shade(fur, 0.72) });
    // swirly "@" eyes, each on a patch of the face so the real eye doesn't show through
    const geo = petGeometry(this.kind);
    const pet = PETS[this.kind];
    this.eyes.replaceChildren(
      ...geo.eyes.map((eye) => {
        const node = document.createElement("i");
        node.className = "rider-eye";
        const beside = pet.rows[eye.top]?.[eye.left - 1];
        node.style.background = beside && beside !== "." && beside !== "o" ? pet.palette[beside] : fur;
        node.style.left = `${eye.left * PX - 1}px`;
        node.style.top = `${eye.top * PX - 1}px`;
        node.style.width = `${(eye.right - eye.left + 1) * PX + 2}px`;
        node.style.height = `${Math.max(2, eye.bottom - eye.top + 1) * PX + 2}px`;
        const swirl = document.createElement("span");
        swirl.textContent = "@";
        swirl.style.color = outline;
        node.append(swirl);
        return node;
      }),
    );
  }

  /** The cursor's speed, from the desktop app (pixels per second). */
  motion(vx, vy) {
    this.rawVx = Number(vx) || 0;
    this.rawVy = Number(vy) || 0;
    this.lastInput = performance.now();
  }

  say(text, ms = 2300) {
    const now = performance.now();
    this.text.textContent = text;
    this.bubble.classList.add("show");
    this.el.classList.toggle("sleepy", text.startsWith("Zz"));
    this.bubbleUntil = ms === Infinity ? Infinity : now + ms;
    this.talkUntil = now + Math.min(1400, 250 + text.length * 55);
    this.lastLine = now;
  }

  /** Page mode: hop from `from` (where the pet was) onto the cursor. */
  climb(from) {
    return new Promise((resolve) => {
      this.flight = { from, to: null, start: performance.now(), ms: 650, done: resolve };
    }).then(() => this.land());
  }

  /** Landing on the cursor: a little squash, and something to say. */
  land() {
    this.canvas.classList.remove("landing");
    void this.canvas.offsetWidth;
    this.canvas.classList.add("landing");
    setTimeout(() => this.say(pick(RIDE_LINES.land)), 180);
  }

  /** Get off: fly back to `to` (page mode), or hop up and fade away. Resolves when gone. */
  leave(to = null) {
    this.say(pick(RIDE_LINES.leave), 1600);
    return new Promise((resolve) => {
      if (this.follow === "page" && to) {
        setTimeout(() => {
          this.flight = { from: { x: this.x + SEAT.x, y: this.y + SEAT.y }, to, start: performance.now(), ms: 550, done: resolve };
        }, 500);
      } else {
        setTimeout(() => {
          this.el.classList.add("leaving");
          setTimeout(resolve, 520);
        }, 600);
      }
    }).then(() => this.destroy());
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    if (this.onMove) window.removeEventListener("pointermove", this.onMove);
    if (this.onLeave) document.removeEventListener("mouseout", this.onLeave);
    if (this.onEnter) document.removeEventListener("mouseover", this.onEnter);
    this.el.remove();
  }

  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.clock += dt;
    // No news from the cursor for a moment means it has stopped.
    if (t - this.lastInput > 70) {
      this.rawVx = 0;
      this.rawVy = 0;
    }
    const k = Math.min(1, dt * 10);
    this.vx += (this.rawVx - this.vx) * k;
    this.vy += (this.rawVy - this.vy) * k;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 60) {
      this.lastMove = t;
      this.saidView = false;
    }
    this.fastFor = speed > 1200 ? this.fastFor + dt * 1000 : 0;
    this.peak = Math.max(speed, this.peak * Math.pow(0.02, dt));

    // ----- getting dizzy
    this.dizzy = updateDizzy(this.dizzy, { dt, speed, vx: this.vx, now: t });
    const { dizzy } = this.dizzy;
    if (this.dizzy.event === "start") {
      this.sleeping = false;
      this.say(pick(RIDE_LINES.dizzy), 2600);
      this.nextDizzyLine = t + 2800 + Math.random() * 1500;
    } else if (this.dizzy.event === "warn") {
      this.say(pick(RIDE_LINES.woozy), 1600);
    } else if (this.dizzy.event === "end") {
      this.say(pick(RIDE_LINES.better));
    } else if (dizzy && t > this.nextDizzyLine) {
      this.say(pick(RIDE_LINES.dizzy), 2400);
      this.nextDizzyLine = t + 2800 + Math.random() * 1500;
    }
    this.el.classList.toggle("dizzy", dizzy);

    // ----- what to say
    const next = this.flight || dizzy || this.dizzy.event
      ? null
      : nextLine({ now: t, speed, fastFor: this.fastFor, peak: this.peak, idleFor: t - this.lastMove, lastLine: this.lastLine, nextChatter: this.nextChatter, saidView: this.saidView, sleeping: this.sleeping });
    if (next?.kind === "sleep") {
      this.sleeping = true;
      this.say("Zzz…", Infinity);
    } else if (next?.kind === "wake") {
      this.sleeping = false;
      this.say(pick(RIDE_LINES.wake));
    } else if (next) {
      if (next.kind === "view") this.saidView = true;
      if (next.kind === "stop") this.peak = 0;
      if (next.kind === "chatter") this.nextChatter = 9000 + Math.random() * 7000;
      this.say(next.kind === "chatter" && Math.random() < 0.25 ? this.sound : pick(RIDE_LINES[next.kind]));
    }
    if (t > this.bubbleUntil) this.bubble.classList.remove("show");

    // ----- the pet's face
    if (t > this.nextBlink) {
      this.blinkUntil = t + 150;
      this.nextBlink = t + 1800 + Math.random() * 3000;
    }
    const blink = this.sleeping || t < this.blinkUntil;
    const talk = !this.sleeping && (t < this.talkUntil ? Math.floor(this.clock * 9) % 2 === 0 : speed > 1200 && !dizzy);
    const key = `${this.kind}|${blink}|${talk}`;
    if (key !== this.lastFrame) {
      this.lastFrame = key;
      drawPet(this.canvas, this.kind, { blink, talk });
    }

    // ----- leaning into the ride, bouncing along, speed lines when it's fast
    this.tilt += (clamp(-this.vx / 2600, -0.4, 0.4) - this.tilt) * k;
    const bounce = speed > 150 ? -Math.abs(Math.sin(this.clock * 18)) * Math.min(3, speed / 400) : Math.floor(this.clock * 1.6) % 2 ? -1 : 0;
    // dizzy: a woozy sway from side to side
    const sway = dizzy ? Math.sin(this.clock * 5.5) : 0;
    this.body.style.transform = `translate(${(sway * 2).toFixed(1)}px, ${bounce.toFixed(1)}px) rotate(${(this.tilt + sway * 0.28).toFixed(3)}rad)`;
    if (dizzy) {
      this.stars.forEach((star, i) => {
        const a = this.clock * 5 + (i * Math.PI * 2) / 3;
        const front = Math.sin(a) > 0;
        star.style.transform = `translate(${(SIZE / 2 - 6 + Math.cos(a) * 19).toFixed(1)}px, ${(-6 + Math.sin(a) * 4).toFixed(1)}px) scale(${front ? 1 : 0.75})`;
        star.style.zIndex = front ? "3" : "0";
      });
    }
    this.trail.style.opacity = clamp((speed - 600) / 900, 0, 1).toFixed(2);
    // legs: a lazy dangle, or kicking like a jockey when you get going
    const kick = dizzy ? Math.sin(this.clock * 3) * 5 : speed > 150 ? Math.sin(this.clock * 16) * 22 : Math.sin(this.clock * 2.2) * 8;
    this.legs[0].style.transform = `rotate(${(-6 + kick).toFixed(1)}deg)`;
    this.legs[1].style.transform = `rotate(${(6 - kick).toFixed(1)}deg)`;
    this.trail.classList.toggle("right", this.vx < 0);

    // ----- where the pet is (page mode; in the desktop app the window moves instead)
    if (this.follow === "page") {
      let x = this.x + SEAT.x;
      let y = this.y + SEAT.y;
      if (this.flight) {
        const f = this.flight;
        const p = Math.min(1, (t - f.start) / f.ms);
        const to = f.to || { x, y };
        const e = ease(p);
        x = f.from.x + (to.x - f.from.x) * e;
        y = f.from.y + (to.y - f.from.y) * e - 90 * Math.sin(Math.PI * p);
        if (p >= 1) {
          this.flight = null;
          f.done();
        }
      }
      this.el.style.transform = `translate(${Math.round(x - SIZE / 2)}px, ${Math.round(y - SIZE)}px)`;
      // keep the speech bubble on screen
      if (this.bubble.classList.contains("show")) {
        const w = this.bubble.offsetWidth;
        const shift = clamp(x - w / 2, 8, window.innerWidth - w - 8) - (x - w / 2);
        this.bubble.style.setProperty("--shift", `${Math.round(shift)}px`);
      }
    }
    this.raf = requestAnimationFrame((time) => this.frame(time));
  }
}

/** A pet's main fur colour and outline, for its legs. */
function furOf(kind) {
  const pet = PETS[kind];
  const counts = {};
  for (const row of pet.rows) for (const ch of row) if (ch !== "." && ch !== "o") counts[ch] = (counts[ch] || 0) + 1;
  const main = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return { fur: pet.palette[main] || "#cccccc", outline: pet.palette.o || "#1b1b2f" };
}

function shade(color, k) {
  const n = parseInt(color.slice(1), 16);
  return `rgb(${[16, 8, 0].map((b) => Math.round(((n >> b) & 255) * k)).join(",")})`;
}

function paint(canvas, rows, colors) {
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext("2d");
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (!colors[ch]) return;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(x, y, 1, 1);
    }),
  );
}
