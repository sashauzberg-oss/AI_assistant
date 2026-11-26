// Everything Nova can *do*. The AI calls these as tools, and the offline command
// handler calls the same functions, so both modes behave the same way.
import { el, getJson, isHttpUrl, storage, describeDuration, formatClock } from "./util.js";
import { icon } from "./icons.js";
import { calculate, formatNumber } from "./calc.js";
import { secondsUntil } from "./commands.js";
import { generatePassword, describeClosedTabs } from "./extras.js";
import { imageFromFile } from "./screen.js";
import { randomJoke, jokeText } from "./jokes.js";

/** Facts the user asked Nova to remember; sent to the AI with every request. */
export const memories = {
  all: () => storage.get("memories", []),
  texts: () => storage.get("memories", []).map((m) => m.text),
  save: (list) => storage.set("memories", list),
};

const HELP = `Here's what I can do. Just type or say it:

- **Music**: “music”, “play jazz”, “play Taylor Swift”, “lofi”, “next”, “pause”, “stop”, “volume 40”
- **Answer from your screen**: “answer this” (or press ✂️, or paste a screenshot with Ctrl+V)
- **Timers & alarms**: “timer 10 minutes”, “remind me in 20 minutes to stretch”, “alarm at 7:30 am”
- **Weather**: “weather”, “weather in Tokyo”
- **Look things up**: “who is Ada Lovelace”, “define serendipity”, “what's 15% of 80”
- **Snip modes**: “copy the text from my screen”, “translate this”, “explain this”
- **Clipboard**: “summarize my clipboard”, “fix the grammar in what I copied”, “copy that” (copies my last answer)
- **Memory**: “remember that my name is Sam”, “what do you remember”, “forget my name”
- **Convert**: “10 km to miles”, “350 f to c”, “$50 to euros”, “how many ounces in a pound”
- **Focus**: “pomodoro”, “focus for 50 minutes” (timer plus focus music), “start stopwatch”
- **Passwords**: “generate a password”, “make a 24 character password”
- **Notes**: “note buy milk”, “show my notes”, “delete note 2”
- **Web & apps**: “open YouTube”, “search best pizza near me”, “cat videos on YouTube”, and in the desktop app “open Spotify” or “open calculator”
- **Your pet**: click the pet next to the typing bar, or say “switch to a dog”, “be a penguin”, “call yourself Pixel”
- **Tabs** (desktop app on Windows): “close all my tabs”, “close all my chrome tabs”
- **Fun**: “tell me a joke”, “fight scene” (or “fight a dragon”), “get on” (your pet rides your cursor; “get off” to stop), “flip a coin”, “roll a dice”
- **Hands-free** (browser): turn on the 📡 button and say “Nova, …”`;

// ---------- input validation (tool inputs come from the model; check them before acting) ----------

function validate(input, spec) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "Input must be an object.";
  for (const [key, rule] of Object.entries(spec)) {
    const value = input[key];
    if (value === undefined || value === null) {
      if (rule.required) return `Missing "${key}".`;
      continue;
    }
    if (rule.type === "string" && typeof value !== "string") return `"${key}" must be a string.`;
    if (rule.type === "integer" && !Number.isInteger(value)) return `"${key}" must be a whole number.`;
    if (rule.type === "number" && !Number.isFinite(value)) return `"${key}" must be a number.`;
    if (rule.type === "boolean" && typeof value !== "boolean") return `"${key}" must be true or false.`;
    if (rule.enum && !rule.enum.includes(value)) return `"${key}" must be one of: ${rule.enum.join(", ")}.`;
    if (rule.min !== undefined && value < rule.min) return `"${key}" must be at least ${rule.min}.`;
    if (rule.max !== undefined && value > rule.max) return `"${key}" must be at most ${rule.max}.`;
  }
  return null;
}

const SPECS = {
  play_music: { query: { type: "string", required: true } },
  music_control: {
    action: { type: "string", required: true, enum: ["pause", "resume", "stop", "next", "volume"] },
    volume: { type: "integer", min: 0, max: 100 },
  },
  capture_screen: {},
  set_timer: { seconds: { type: "integer", min: 1, max: 7 * 86400 }, at: { type: "string" }, label: { type: "string" } },
  cancel_timers: { label: { type: "string" } },
  get_current_time: {},
  get_weather: { location: { type: "string", required: true } },
  open_url: { url: { type: "string", required: true }, label: { type: "string" } },
  notes: {
    action: { type: "string", required: true, enum: ["add", "list", "remove", "clear"] },
    text: { type: "string" },
    index: { type: "integer", min: 1 },
  },
  copy_to_clipboard: { text: { type: "string", required: true } },
  set_theme: { theme: { type: "string", required: true, enum: ["light", "dark", "system"] } },
  read_clipboard: {},
  memory: {
    action: { type: "string", required: true, enum: ["add", "remove", "list"] },
    text: { type: "string" },
    index: { type: "integer", min: 1 },
  },
  convert_currency: { amount: { type: "number", required: true }, from: { type: "string", required: true }, to: { type: "string", required: true } },
  generate_password: { length: { type: "integer", min: 8, max: 128 }, symbols: { type: "boolean" } },
  open_app: { name: { type: "string", required: true } },
  tell_joke: { setup: { type: "string", required: true }, punchline: { type: "string", required: true } },
  fight_scene: { opponent: { type: "string" } },
  ride_cursor: { action: { type: "string", required: true, enum: ["on", "off"] } },
};

// ---------- cards ----------

function card({ iconHtml, img, title, sub, action, className = "" }) {
  const visual = img
    ? el("div", { class: "card-icon" }, [el("img", { src: img, alt: "", referrerpolicy: "no-referrer" })])
    : el("div", { class: "card-icon", html: iconHtml || "" });
  return el("div", { class: `card ${className}` }, [
    visual,
    el("div", { class: "card-main" }, [el("div", { class: "card-title", text: title }), sub ? el("div", { class: "card-sub", text: sub }) : null]),
    action ? el("a", { class: "card-action", href: action.href, target: "_blank", rel: "noopener noreferrer", text: action.label }) : null,
  ]);
}

function musicCard(item, blocked) {
  return card({
    img: item.art,
    iconHtml: icon("music"),
    title: item.title,
    sub: blocked ? "Press ▶ in the player to start (your browser blocked autoplay)" : `${item.badge ? `${item.badge} · ` : ""}${item.subtitle || ""}`,
    action: item.kind === "preview" && item.link ? { href: item.link, label: "Full song" } : null,
  });
}

function weatherCard(w) {
  const days = w.daily.slice(0, 4).map((d, i) => {
    const name = i === 0 ? "Today" : new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
    return el("div", {}, [el("b", { text: name }), `${d.icon} ${d.high}° / ${d.low}°`, d.rainChance != null ? el("div", { class: "muted", text: `💧 ${d.rainChance}%` }) : null]);
  });
  return el("div", { class: "card weather" }, [
    el("div", { class: "weather-now" }, [
      el("div", { class: "big", text: w.current.isDay ? w.current.icon : w.current.icon.replace("☀️", "🌙") }),
      el("div", {}, [el("div", { class: "temp", text: `${w.current.temperature}${w.tempUnit}` }), el("div", { class: "muted", text: w.current.text })]),
      el("div", { class: "card-main" }, [
        el("div", { class: "card-title", text: w.location }),
        el("div", { class: "card-sub", text: `Feels like ${w.current.feelsLike}° · Humidity ${w.current.humidity}% · Wind ${w.current.wind} ${w.windUnit}` }),
      ]),
    ]),
    el("div", { class: "weather-days" }, days),
  ]);
}

function notesCard(notes) {
  if (!notes.length) return card({ iconHtml: "📝", title: "No notes yet", sub: "Say “note …” to add one." });
  return el("div", { class: "card", style: "display:block" }, [
    el("div", { class: "card-title", text: `📝 Your notes (${notes.length})` }),
    el("ol", { class: "notes-list" }, notes.map((n) => el("li", { text: n.text }))),
  ]);
}

function linkCard(url, title, sub) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // not a URL
  }
  return card({ iconHtml: icon("external"), title: title || host, sub: sub || host, action: { href: url, label: "Open" } });
}

// ---------- the toolbox ----------

export function createToolbox({ player, timers, voice, captureScreen, setTheme, units, pet, getLastAnswer = () => "", openPetPicker = () => {}, performJoke = async () => {}, performFight = async () => null, rideCursor = async () => "unavailable" }) {
  const desktop = window.novaDesktop || null;
  const notes = {
    all: () => storage.get("notes", []),
    save: (list) => storage.set("notes", list),
  };

  async function locate() {
    if (!navigator.geolocation) throw new Error("Location isn't available in this browser.");
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => reject(new Error("I couldn't get your location. Tell me a city instead, like “weather in Paris”.")),
        { timeout: 10000, maximumAge: 600000 },
      ),
    );
  }

  async function weather(location) {
    const params = new URLSearchParams({ units: units() });
    const place = location || storage.get("homeCity", "");
    if (place) params.set("q", place);
    else {
      const { lat, lon } = await locate();
      params.set("lat", lat.toFixed(3));
      params.set("lon", lon.toFixed(3));
    }
    const data = await getJson(`/api/weather?${params}`);
    if (data.error) throw new Error(data.error);
    return data;
  }

  async function openUrl(url, label, ui) {
    if (!isHttpUrl(url)) return { content: "That isn't a valid web address.", isError: true };
    let win = null;
    if (window.novaDesktop) {
      win = await window.novaDesktop.openExternal(url); // opens in the default browser
    } else {
      win = window.open(url, "_blank");
      if (win) win.opener = null;
    }
    ui.addCard(linkCard(url, label));
    return {
      content: win ? `Opened ${url} in a new tab.` : `The browser blocked the pop-up, so a link to ${url} is shown for the user to click.`,
      reply: win ? `Opened **${label || url}** in a new tab.` : "Here's the link (your browser blocked the pop-up):",
    };
  }

  function addTimer(seconds, label, ui) {
    const timer = timers.add({ seconds, label });
    const endsAt = new Date(timer.end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    ui.addCard(card({ iconHtml: icon("clock"), title: timer.label, sub: `${describeDuration(seconds)} · rings at ${endsAt}` }));
    return {
      content: `Timer "${timer.label}" set for ${describeDuration(seconds)}; it rings at ${endsAt}.`,
      reply: `⏰ Timer set: **${timer.label}**, ${describeDuration(seconds)} (rings at ${endsAt}).`,
    };
  }

  function notesAction({ action, text, index }, ui) {
    const list = notes.all();
    if (action === "add") {
      if (!text?.trim()) return { content: "Nothing to add.", isError: true };
      list.push({ text: text.trim().slice(0, 500), at: Date.now() });
      notes.save(list);
      ui.addCard(notesCard(list));
      return { content: `Added note #${list.length}: ${text.trim()}`, reply: `📝 Noted: “${text.trim()}”` };
    }
    if (action === "remove") {
      if (!index || index > list.length) return { content: `There is no note #${index}. The user has ${list.length} notes.`, isError: true };
      const [removed] = list.splice(index - 1, 1);
      notes.save(list);
      ui.addCard(notesCard(list));
      return { content: `Removed note #${index}: ${removed.text}`, reply: `Removed “${removed.text}”.` };
    }
    if (action === "clear") {
      notes.save([]);
      return { content: "All notes cleared.", reply: "All notes cleared. 🧹" };
    }
    ui.addCard(notesCard(list));
    return {
      content: list.length ? list.map((n, i) => `${i + 1}. ${n.text}`).join("\n") : "The user has no notes.",
      reply: list.length ? "" : "You don't have any notes yet.",
    };
  }

  async function copyText(text, ui) {
    try {
      await navigator.clipboard.writeText(text);
      return { content: "Copied to the clipboard.", reply: "Copied to your clipboard. 📋" };
    } catch {
      const button = el("button", { class: "card-action", type: "button", text: "Copy" });
      button.addEventListener("click", () => navigator.clipboard.writeText(text).then(() => (button.textContent = "Copied!")));
      const node = card({ iconHtml: "📋", title: "Ready to copy", sub: text.slice(0, 140) + (text.length > 140 ? "…" : "") });
      node.append(button);
      ui.addCard(node);
      return { content: "The browser needs a click to copy; a Copy button is shown to the user.", reply: "Click **Copy** to put it on your clipboard:" };
    }
  }

  async function writeClipboard(text) {
    if (desktop) return desktop.copy(text);
    await navigator.clipboard.writeText(text);
    return true;
  }

  async function readClipboard() {
    if (desktop) return desktop.readClipboard();
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) return { image: await imageFromFile(await item.getType(type)) };
      }
    } catch {
      // fall back to text
    }
    return { text: await navigator.clipboard.readText() };
  }

  function passwordCard(password) {
    const value = el("code", { class: "password", text: password });
    const copy = el("button", { class: "card-action", type: "button", text: "Copy" });
    copy.addEventListener("click", async () => {
      await writeClipboard(value.textContent);
      copy.textContent = "Copied!";
      setTimeout(() => (copy.textContent = "Copy"), 1500);
    });
    const again = el("button", { class: "btn", type: "button", text: "New" });
    again.addEventListener("click", () => (value.textContent = generatePassword({ length: password.length, symbols: /[^A-Za-z0-9]/.test(password) })));
    return el("div", { class: "card" }, [el("div", { class: "card-icon", text: "🔑" }), el("div", { class: "card-main" }, [value]), again, copy]);
  }

  async function convertCurrency(amount, from, to) {
    const params = new URLSearchParams({ amount: String(amount), from: from.toUpperCase(), to: to.toUpperCase() });
    const data = await getJson(`/api/currency?${params}`);
    if (data.error) throw new Error(data.error);
    return data;
  }

  const money = (value, code) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(value);
    } catch {
      return `${formatNumber(value)} ${code}`;
    }
  };

  function memoryAction({ action, text, index }) {
    const list = memories.all();
    if (action === "add") {
      if (!text?.trim()) return { content: "Nothing to remember.", isError: true };
      list.push({ text: text.trim().slice(0, 300), at: Date.now() });
      memories.save(list.slice(-50));
      return { content: `Saved memory #${list.length}: ${text.trim()}`, reply: `🧠 Got it, I'll remember that ${text.trim()}.` };
    }
    if (action === "remove") {
      if (!index || index > list.length) return { content: `There is no memory #${index}.`, isError: true };
      const [removed] = list.splice(index - 1, 1);
      memories.save(list);
      return { content: `Forgot: ${removed.text}`, reply: `Forgotten: “${removed.text}”.` };
    }
    return {
      content: list.length ? list.map((m, i) => `${i + 1}. ${m.text}`).join("\n") : "No memories saved.",
      reply: list.length ? `Here's what I remember:\n\n${list.map((m) => `- ${m.text}`).join("\n")}` : "I haven't been asked to remember anything yet. Try “remember that …”.",
    };
  }

  function startFocus(seconds, ui) {
    timers.add({ seconds, label: "Focus", kind: "focus" });
    ui.addCard(card({ iconHtml: "🍅", title: "Focus session", sub: `${describeDuration(seconds)} · focus music on · I'll chime when it's break time` }));
    player.play("focus").then((r) => r.ok && player.current && ui.addCard(musicCard(player.current, r.blocked)));
    return `🍅 Focus session started: **${describeDuration(seconds)}**. Put your phone away, I've got the music.`;
  }

  /** Put a joke on stage (the cutscene), then show it in the chat. */
  async function tellJoke(joke, ui) {
    try {
      await performJoke(joke);
    } catch {
      // the show couldn't run; the joke still goes in the chat
    }
    ui.setText(jokeText(joke));
  }

  /** The fight scene; afterwards the result goes in the chat. */
  async function fightScene(foe, ui) {
    let result = null;
    try {
      result = await performFight(foe);
    } catch {
      // the show couldn't run
    }
    if (!result) return "The fight couldn't start. Try again in a moment.";
    const rival = `**${result.foeName}**${result.animal ? ` the ${result.animal}` : ""}`;
    const text = `⚔️ **${pet?.name || "Your pet"}** beat ${rival} with a super move! 🏆`;
    ui.setText(text);
    return { text, result };
  }

  /** "get on" / "get off": the pet rides the mouse cursor. Returns the reply. */
  async function ride(on) {
    const status = await rideCursor(on);
    const name = pet?.name || "Your pet";
    const sound = pet ? `${pet.persona.sound} ` : "";
    const where = desktop ? "anywhere on your screen" : "around this page";
    return (
      {
        on: `${sound}Hop! I'm riding your cursor. Take me ${where}! Say **get off** (or click my empty spot) to bring me back.`,
        already: "I'm already riding your cursor! Wheee!",
        "no-cursor": "There's no cursor to ride on a touch screen. Try it on a computer with a mouse or touchpad!",
        off: "Thanks for the ride! 🐾",
        "not-riding": `${name} is right here! Say **get on** and I'll hop onto your cursor.`,
      }[status] || "I couldn't get on the cursor this time."
    );
  }

  /** "close all my tabs" (desktop app). Asks first when the request wasn't typed exactly. */
  async function closeTabs(browser, ui, { confirm = false } = {}) {
    if (!desktop?.closeTabs) return "From a web page I can't close your other tabs (browsers don't allow that), but the Nova desktop app on Windows can.";
    const go = async () => describeClosedTabs(await desktop.closeTabs({ browser }));
    if (!confirm) return go();
    const yes = el("button", { class: "card-action", type: "button", text: "Close them" });
    const no = el("button", { class: "btn", type: "button", text: "Cancel" });
    const node = el("div", { class: "card" }, [el("div", { class: "card-icon", text: "🗂️" }), el("div", { class: "card-main" }, [el("div", { class: "card-title", text: `Close all your ${browser ? `${browser} ` : "browser "}tabs?` })]), no, yes]);
    yes.addEventListener("click", async () => {
      yes.disabled = no.disabled = true;
      node.querySelector(".card-title").textContent = "Closing…";
      ui.setText(await go());
      node.remove();
    });
    no.addEventListener("click", () => {
      node.remove();
      ui.setText("Okay, I left your tabs alone.");
    });
    ui.addCard(node);
    return "Do you want me to close all your tabs? Click **Close them** to go ahead.";
  }

  function nextJoke() {
    const recent = storage.get("recentJokes", []);
    const joke = randomJoke(recent);
    storage.set("recentJokes", [...recent, joke.index].slice(-20));
    return joke;
  }

  async function openApp(name, ui) {
    if (!desktop) return { content: "Opening apps only works in the Nova desktop app.", isError: true };
    const result = await desktop.openApp(name);
    if (!result?.ok) return { content: result?.error || `Couldn't open ${name}.`, isError: true };
    ui.addCard(card({ iconHtml: "🚀", title: result.name, sub: "Opened on your computer" }));
    return { content: `Opened ${result.name}.`, reply: `🚀 Opened **${result.name}**.` };
  }

  const tools = {
    async play_music({ query }, ui) {
      const result = await player.play(query);
      if (result.ok && player.current) ui.addCard(musicCard(player.current, result.blocked));
      return {
        content: result.message + (result.blocked ? " The browser blocked autoplay, so the user must press play in the player bar." : ""),
        isError: !result.ok,
      };
    },

    async music_control({ action, volume }, ui) {
      if (action === "pause") return { content: await player.pause() };
      if (action === "resume") return { content: (await player.resume()).message };
      if (action === "stop") return { content: player.stop() };
      if (action === "next") {
        const result = await player.next();
        if (player.current) ui.addCard(musicCard(player.current));
        return { content: result.message };
      }
      if (volume === undefined) return { content: "Give a volume from 0 to 100.", isError: true };
      player.setVolume(volume / 100);
      return { content: `Volume set to ${volume}%.` };
    },

    async capture_screen(_input, ui) {
      const image = await captureScreen({ fromTool: true, ui });
      if (!image) return { content: "The user cancelled the screenshot or didn't share a screen.", isError: true };
      ui.addImage(image.dataUrl);
      return {
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
          { type: "text", text: "Here is the screenshot." },
        ],
      };
    },

    async set_timer({ seconds, at, label }, ui) {
      let secs = seconds;
      if (!secs && at) {
        const m = at.match(/^(\d{1,2}):(\d{2})$/);
        if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return { content: '"at" must look like 07:30 or 19:45.', isError: true };
        const target = new Date();
        target.setHours(Number(m[1]), Number(m[2]), 0, 0);
        if (target <= new Date()) target.setDate(target.getDate() + 1);
        secs = Math.round((target - Date.now()) / 1000);
      }
      if (!secs) return { content: 'Give either "seconds" or "at".', isError: true };
      return addTimer(secs, label || (at ? "Alarm" : "Timer"), ui);
    },

    async cancel_timers({ label }) {
      const count = timers.cancelMatching(label || "");
      return { content: count ? `Cancelled ${count} timer${count === 1 ? "" : "s"}.` : "There were no matching timers." };
    },

    async get_current_time() {
      const now = new Date();
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return { content: `${now.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })} (${zone})` };
    },

    async get_weather({ location }, ui) {
      try {
        const w = await weather(location.trim());
        ui.addCard(weatherCard(w));
        const days = w.daily.map((d) => `${d.date}: ${d.text}, ${d.high}/${d.low}${w.tempUnit}${d.rainChance != null ? `, ${d.rainChance}% rain` : ""}`).join("; ");
        return {
          content: `${w.location}: ${w.current.temperature}${w.tempUnit} (feels like ${w.current.feelsLike}), ${w.current.text}, humidity ${w.current.humidity}%, wind ${w.current.wind} ${w.windUnit}. Forecast: ${days}.`,
        };
      } catch (err) {
        return { content: err.message, isError: true };
      }
    },

    async open_url({ url, label }, ui) {
      return openUrl(url, label, ui);
    },

    async notes(input, ui) {
      return notesAction(input, ui);
    },

    async copy_to_clipboard({ text }, ui) {
      return copyText(text, ui);
    },

    async set_theme({ theme }) {
      setTheme(theme);
      return { content: `Theme set to ${theme}.` };
    },

    async read_clipboard(_input, ui) {
      const clip = await readClipboard();
      if (clip?.image) {
        ui.addImage(clip.image.dataUrl);
        return {
          content: [
            { type: "image", source: { type: "base64", media_type: clip.image.mediaType, data: clip.image.data } },
            { type: "text", text: "This image is on the user's clipboard." },
          ],
        };
      }
      const text = (clip?.text || "").slice(0, 50000);
      if (!text.trim()) return { content: "The clipboard is empty." };
      ui.addCard(card({ iconHtml: "📋", title: "Read your clipboard", sub: `${text.slice(0, 90).replace(/\s+/g, " ")}${text.length > 90 ? "…" : ""}` }));
      return { content: `Clipboard contents:\n\n${text}` };
    },

    async memory(input) {
      return memoryAction(input);
    },

    async convert_currency({ amount, from, to }, ui) {
      try {
        const r = await convertCurrency(amount, from, to);
        ui.addCard(card({ iconHtml: "💱", title: `${money(r.amount, r.from)} = ${money(r.result, r.to)}`, sub: `1 ${r.from} = ${formatNumber(r.rate)} ${r.to} · rate from ${r.date}` }));
        return { content: `${r.amount} ${r.from} = ${r.result.toFixed(2)} ${r.to} (rate ${r.rate}, ${r.date}).` };
      } catch (err) {
        return { content: err.message, isError: true };
      }
    },

    async generate_password({ length = 16, symbols = true }, ui) {
      ui.addCard(passwordCard(generatePassword({ length, symbols })));
      return { content: `Generated a ${length}-character password and showed it to the user with a Copy button. It was not shared with you.` };
    },

    async open_app({ name }, ui) {
      return openApp(name, ui);
    },

    async tell_joke({ setup, punchline }, ui) {
      const joke = { setup: setup.trim().slice(0, 300), punchline: punchline.trim().slice(0, 300) };
      if (!joke.setup || !joke.punchline) return { content: "Give both a setup and a punchline.", isError: true };
      await tellJoke(joke, ui);
      return { content: "Done: the joke was performed on stage and is shown in the chat. Reply with only a short sign-off; don't repeat the joke." };
    },

    async ride_cursor({ action }) {
      const reply = await ride(action === "on");
      return { content: `${reply}\n(That message was shown to the user. Reply with just a few words.)` };
    },

    async fight_scene({ opponent }, ui) {
      const outcome = await fightScene((opponent || "").trim().toLowerCase(), ui);
      if (typeof outcome === "string") return { content: outcome, isError: true };
      return { content: `Done: the fight scene played and ${pet?.name || "the pet"} beat ${outcome.result.foeName}. The result is shown in the chat. Reply with only a short victory line; don't describe the fight.` };
    },
  };

  /** Run a tool the AI asked for. Returns { content, isError }. */
  async function run(name, input, ui) {
    const tool = tools[name];
    if (!tool) return { content: `Unknown tool: ${name}`, isError: true };
    const problem = validate(input, SPECS[name] || {});
    if (problem) return { content: JSON.stringify({ INVALID_INPUT: problem }), isError: true };
    try {
      const result = await tool(input, ui);
      return { content: result.content, isError: !!result.isError };
    } catch (err) {
      return { content: `Error: ${err.message}`, isError: true };
    }
  }

  /** Handle an offline command. Returns a Markdown reply. */
  async function command(cmd, ui) {
    const a = cmd.args || {};
    switch (cmd.name) {
      case "help":
        return HELP;
      case "greet":
        return `${pet ? `${pet.persona.sound} ` : ""}Hi! What can I do for you? Try “music”, “weather”, or “answer this”.`;
      case "thanks":
        return "Anytime! 😊";
      case "how_are_you":
        return "I'm running smoothly, thanks for asking! How can I help?";
      case "about":
        return pet
          ? `${pet.persona.sound} I'm **${pet.name}**, your pixel ${pet.persona.animal} and personal assistant. I can play music, read your screen, set timers, check the weather and a lot more. Click me to pick another pet, or type **help** to see everything.`
          : "I'm **Nova**, your personal assistant. Type **help** to see everything.";
      case "pet": {
        if (!pet?.setKind(a.kind)) return "I don't know that animal yet.";
        return `${pet.persona.sound} Ta-da! I'm **${pet.name}** the ${pet.persona.animal} now.`;
      }
      case "pet_picker":
        openPetPicker();
        return "Pick a pet! Click one of the animals, and give me a name if you like.";
      case "pet_name":
        pet?.setName(a.name);
        return `${pet ? pet.persona.sound : ""} I love it! Call me **${a.name.trim().slice(0, 24)}**.`;
      case "music_play": {
        const result = await player.play(a.query || "");
        if (result.ok && player.current) ui.addCard(musicCard(player.current, result.blocked));
        if (!result.ok) return result.message;
        const item = player.current;
        const what = item.kind === "preview" ? `“${item.title}” by ${item.subtitle}` : item.title;
        return `🎵 Playing **${what}**.${result.message.includes("offline") ? " (The internet sources didn't answer, so this is my built-in music.)" : ""}`;
      }
      case "music_control": {
        if (a.action === "volume") {
          const value = a.volume ?? Math.round(player.volume * 100) + a.delta;
          player.setVolume(Math.max(0, Math.min(100, value)) / 100);
          return `🔊 Volume ${Math.round(player.volume * 100)}%.`;
        }
        if (a.action === "stop") {
          if (player.status === "idle") return "Nothing is playing.";
          player.stop();
          return "⏹️ Stopped.";
        }
        if (a.action === "pause") {
          await player.pause();
          return "⏸️ Paused.";
        }
        if (a.action === "resume") {
          const r = await player.resume();
          if (player.current && player.status !== "idle") ui.addCard(musicCard(player.current, player.status === "blocked"));
          return r.ok ? "▶️ Playing." : r.message;
        }
        const r = await player.next();
        if (player.current) ui.addCard(musicCard(player.current));
        return r.ok ? "⏭️ Next up." : r.message;
      }
      case "copy_last": {
        const last = getLastAnswer();
        if (!last) return "There's nothing to copy yet.";
        try {
          await writeClipboard(last);
          return "📋 Copied my last answer to your clipboard.";
        } catch {
          return copyText(last, ui).then((r) => r.reply);
        }
      }
      case "stopwatch": {
        if (a.action === "start") {
          timers.startStopwatch();
          return "⏱️ Stopwatch running. Say “stop stopwatch” to stop it.";
        }
        if (a.action === "reset") {
          timers.resetStopwatch();
          return "Stopwatch reset.";
        }
        const elapsed = timers.stopStopwatch();
        return elapsed ? `⏱️ Stopped at **${formatClock(elapsed)}**.` : "The stopwatch isn't running. Say “start stopwatch”.";
      }
      case "focus":
        return startFocus(a.seconds, ui);
      case "password":
        ui.addCard(passwordCard(generatePassword({ length: a.length, symbols: a.symbols })));
        return "Here's a fresh password. It never leaves your computer.";
      case "convert": {
        if (a.kind === "unit") {
          return `**${formatNumber(a.value)} ${a.fromName}** = **${formatNumber(Number(a.result.toPrecision(7)))} ${a.toName}**`;
        }
        try {
          const r = await convertCurrency(a.amount, a.from, a.to);
          return `💱 **${money(r.amount, r.from)} = ${money(r.result, r.to)}**\n\n1 ${r.from} = ${formatNumber(r.rate)} ${r.to} (rate from ${r.date})`;
        } catch (err) {
          return err.message;
        }
      }
      case "memory_add":
        return memoryAction({ action: "add", text: a.text }).reply;
      case "memory_list":
        return memoryAction({ action: "list" }).reply;
      case "memory_clear":
        memories.save([]);
        return "🧹 I've forgotten everything you asked me to remember.";
      case "memory_forget": {
        const list = memories.all();
        const words = a.text.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !["my", "the", "that", "about"].includes(w));
        const index = list.findIndex((m) => words.some((w) => m.text.toLowerCase().includes(w)));
        if (index === -1) return "I couldn't find that in my memory. Say “what do you remember” to see everything.";
        return memoryAction({ action: "remove", index: index + 1 }).reply;
      }
      case "youtube":
        return (await openUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(a.query)}`, `YouTube: ${a.query}`, ui)).reply;
      case "open": {
        const looksLikeSite = /\.|^https?:/.test(a.name) || ["youtube", "google", "gmail", "maps", "google maps", "wikipedia", "reddit", "amazon", "github", "x", "twitter", "facebook", "instagram"].includes(a.name);
        if (desktop && !looksLikeSite) {
          const result = await openApp(a.name, ui);
          if (!result.isError) return result.reply;
        }
        return (await openUrl(a.url, a.name, ui)).reply;
      }
      case "search":
        return (await openUrl(`https://www.google.com/search?q=${encodeURIComponent(a.query)}`, `Search: ${a.query}`, ui)).reply;
      case "timer":
        return addTimer(a.seconds, a.label, ui).reply;
      case "alarm": {
        const seconds = secondsUntil(a.hours, a.minutes, a.meridiem);
        return addTimer(seconds, a.label, ui).reply;
      }
      case "cancel_timers": {
        const n = timers.cancelMatching("");
        return n ? `Cancelled ${n} timer${n === 1 ? "" : "s"}.` : "You don't have any timers running.";
      }
      case "list_timers": {
        const list = timers.active();
        if (!list.length) return "No timers running.";
        return list.map((t) => `- **${t.label}**: ${describeDuration((t.end - Date.now()) / 1000)} left`).join("\n");
      }
      case "time":
        return `🕒 It's **${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}**.`;
      case "date":
        return `📅 Today is **${new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}**.`;
      case "weather": {
        try {
          const w = await weather(a.location);
          ui.addCard(weatherCard(w));
          return `It's ${w.current.temperature}${w.tempUnit} and ${w.current.text.toLowerCase()} in ${w.location}.`;
        } catch (err) {
          return err.message;
        }
      }
      case "joke":
        await tellJoke(nextJoke(), ui);
        return "";
      case "ride":
        return ride(a.on);
      case "close_tabs":
        // typed exactly: just do it (it can be undone); a guess or a voice command asks first
        return closeTabs(a.browser, ui, { confirm: !!cmd.understood || cmd.source === "voice" });
      case "fight": {
        const outcome = await fightScene(a.foe, ui);
        return typeof outcome === "string" ? outcome : "";
      }
      case "coin":
        return `🪙 **${Math.random() < 0.5 ? "Heads" : "Tails"}**!`;
      case "dice": {
        const rolls = Array.from({ length: a.count }, () => 1 + Math.floor(Math.random() * a.sides));
        return `🎲 ${rolls.join(", ")}${rolls.length > 1 ? ` (total ${rolls.reduce((x, y) => x + y, 0)})` : ""}`;
      }
      case "random": {
        const [lo, hi] = a.min <= a.max ? [a.min, a.max] : [a.max, a.min];
        return `🔢 **${lo + Math.floor(Math.random() * (hi - lo + 1))}**`;
      }
      case "note_add":
        return notesAction({ action: "add", text: a.text }, ui).reply;
      case "note_list":
        return notesAction({ action: "list" }, ui).reply;
      case "note_clear":
        return notesAction({ action: "clear" }, ui).reply;
      case "note_remove":
      {
        const result = notesAction({ action: "remove", index: a.index }, ui);
        return result.reply || result.content;
      }
      case "theme":
        setTheme(a.theme);
        return a.theme === "dark" ? "🌙 Dark mode on." : "☀️ Light mode on.";
      case "say":
        voice.speak(a.text);
        return a.text;
      case "define": {
        try {
          const d = await getJson(`/api/define?word=${encodeURIComponent(a.word)}`);
          if (d.error) return d.error;
          const lines = d.meanings.map(
            (m) => `*${m.partOfSpeech}*\n${m.definitions.map((x, i) => `${i + 1}. ${x.definition}${x.example ? ` (“${x.example}”)` : ""}`).join("\n")}`,
          );
          return `**${d.word}** ${d.phonetic ? `\`${d.phonetic}\`` : ""}\n\n${lines.join("\n\n")}`;
        } catch (err) {
          return err.message;
        }
      }
      case "calc":
        try {
          return `🧮 **${formatNumber(calculate(a.expression))}**`;
        } catch (err) {
          return `I couldn't calculate that: ${err.message}.`;
        }
      case "wiki": {
        try {
          const w = await getJson(`/api/wiki?q=${encodeURIComponent(a.query)}`);
          if (w.error) return w.error;
          ui.addCard(card({ img: w.thumbnail, iconHtml: "📚", title: w.title, sub: w.description || "Wikipedia", action: { href: w.url, label: "Read" } }));
          return w.extract;
        } catch (err) {
          return err.message;
        }
      }
      default:
        return null;
    }
  }

  return { run, command, help: HELP };
}
