// Countdown timers, reminders and alarms. They survive a page reload.
import { el, storage, formatClock } from "./util.js";
import { icon } from "./icons.js";

let alarmCtx = null;

/** A short, friendly chime made with the Web Audio API. */
export function chime(repeats = 3) {
  try {
    alarmCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    alarmCtx.resume();
    const start = alarmCtx.currentTime + 0.05;
    for (let r = 0; r < repeats; r++) {
      [880, 1175, 1568].forEach((freq, i) => {
        const t = start + r * 0.9 + i * 0.14;
        const osc = alarmCtx.createOscillator();
        const gain = alarmCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        osc.connect(gain).connect(alarmCtx.destination);
        osc.start(t);
        osc.stop(t + 0.55);
      });
    }
  } catch {
    // audio unavailable
  }
}

export class Timers extends EventTarget {
  constructor(container) {
    super();
    this.container = container;
    const now = Date.now();
    this.list = storage.get("timers", []).filter((t) => t.end > now);
    this.tick = null;
    this.render();
    this.ensureTicking();
  }

  save() {
    storage.set("timers", this.list.filter((t) => !t.done));
  }

  add({ seconds, label = "Timer" }) {
    const timer = {
      id: Math.random().toString(36).slice(2),
      label: String(label || "Timer").slice(0, 80),
      end: Date.now() + seconds * 1000,
      total: seconds,
    };
    this.list.push(timer);
    this.save();
    this.render();
    this.ensureTicking();
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    return timer;
  }

  cancel(id) {
    this.list = this.list.filter((t) => t.id !== id);
    this.save();
    this.render();
  }

  cancelMatching(label = "") {
    const needle = label.toLowerCase();
    const before = this.list.length;
    this.list = this.list.filter((t) => (needle ? !t.label.toLowerCase().includes(needle) : false));
    this.save();
    this.render();
    return before - this.list.length;
  }

  active() {
    return this.list.filter((t) => !t.done);
  }

  ensureTicking() {
    if (this.tick || !this.list.length) return;
    this.tick = setInterval(() => this.update(), 250);
  }

  update() {
    const now = Date.now();
    for (const t of this.list) {
      if (!t.done && t.end <= now) {
        t.done = true;
        this.save();
        this.ring(t);
      }
    }
    if (!this.list.length) {
      clearInterval(this.tick);
      this.tick = null;
    }
    this.renderTimes();
  }

  ring(timer) {
    chime(3);
    this.dispatchEvent(new CustomEvent("done", { detail: timer }));
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      try {
        new Notification("⏰ Nova", { body: `Time's up: ${timer.label}` });
      } catch {
        // notifications not available here
      }
    }
    // Leave the finished chip up for a moment, then clear it.
    setTimeout(() => this.cancel(timer.id), 15000);
  }

  render() {
    this.container.replaceChildren(
      ...this.list.map((t) =>
        el("div", { class: `timer${t.done ? " done" : ""}`, "data-id": t.id }, [
          el("span", { html: icon("clock"), class: "timer-icon", "aria-hidden": "true" }),
          el("span", { text: t.label }),
          el("b", { class: "timer-time" }),
          el("button", {
            class: "icon-btn small",
            type: "button",
            title: "Cancel timer",
            html: icon("x"),
            onclick: () => this.cancel(t.id),
          }),
        ]),
      ),
    );
    this.renderTimes();
  }

  renderTimes() {
    const now = Date.now();
    for (const t of this.list) {
      const node = this.container.querySelector(`[data-id="${t.id}"]`);
      if (!node) continue;
      node.classList.toggle("done", !!t.done);
      node.querySelector(".timer-time").textContent = t.done ? "Done!" : formatClock((t.end - now) / 1000);
    }
  }
}
