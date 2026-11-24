// Everything Nova can *do*. The AI calls these as tools, and the offline command
// handler calls the same functions, so both modes behave the same way.
import { el, getJson, isHttpUrl, storage, describeDuration } from "./util.js";
import { icon } from "./icons.js";
import { calculate, formatNumber } from "./calc.js";
import { secondsUntil } from "./commands.js";

const JOKES = [
  "Why don't scientists trust atoms? Because they make up everything.",
  "I told my computer I needed a break, and it said: no problem, I'll go to sleep.",
  "Why did the scarecrow win an award? He was outstanding in his field.",
  "What do you call a fake noodle? An impasta.",
  "Why don't skeletons fight each other? They don't have the guts.",
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "Why did the bicycle fall over? It was two tired.",
  "What do you call a bear with no teeth? A gummy bear.",
  "Why can't you give Elsa a balloon? Because she'll let it go.",
  "How does a penguin build its house? Igloos it together.",
  "Why did the math book look sad? It had too many problems.",
  "What did the ocean say to the beach? Nothing, it just waved.",
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "I used to hate facial hair, but then it grew on me.",
  "What's orange and sounds like a parrot? A carrot.",
  "Why did the coffee file a police report? It got mugged.",
  "How do you organize a space party? You planet.",
  "Why was the stadium so cool? It was filled with fans.",
  "What do you call cheese that isn't yours? Nacho cheese.",
  "Why did the golfer bring two pairs of pants? In case he got a hole in one.",
  "I only know 25 letters of the alphabet. I don't know y.",
  "What did one wall say to the other? I'll meet you at the corner.",
  "Why don't eggs tell jokes? They'd crack each other up.",
  "What do you call a sleeping dinosaur? A dino-snore.",
  "Why did the cookie go to the doctor? It was feeling crumbly.",
  "Parallel lines have so much in common. It's a shame they'll never meet.",
  "Why did the tomato blush? It saw the salad dressing.",
  "What kind of music do mummies like? Wrap music.",
];

const HELP = `Here's what I can do. Just type or say it:

- **Music**: “music”, “play jazz”, “play Taylor Swift”, “lofi”, “next”, “pause”, “stop”, “volume 40”
- **Answer from your screen**: “answer this” (or press ✂️, or paste a screenshot with Ctrl+V)
- **Timers & alarms**: “timer 10 minutes”, “remind me in 20 minutes to stretch”, “alarm at 7:30 am”
- **Weather**: “weather”, “weather in Tokyo”
- **Look things up**: “who is Ada Lovelace”, “define serendipity”, “what's 15% of 80”
- **Notes**: “note buy milk”, “show my notes”, “delete note 2”
- **Web**: “open YouTube”, “search best pizza near me”, “cat videos on YouTube”
- **Fun**: “tell me a joke”, “flip a coin”, “roll a dice”
- **Hands-free**: turn on the 📡 button and say “Nova, …”`;

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

export function createToolbox({ player, timers, voice, captureScreen, setTheme, units }) {
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
    if (location) params.set("q", location);
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
        return "Hi! 👋 What can I do for you? Try “music”, “weather”, or “answer this”.";
      case "thanks":
        return "Anytime! 😊";
      case "how_are_you":
        return "I'm running smoothly, thanks for asking! How can I help?";
      case "about":
        return "I'm **Nova**, your personal assistant. I can play music, read your screen, set timers, check the weather and a lot more. Type **help** to see everything.";
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
      case "youtube":
        return (await openUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(a.query)}`, `YouTube: ${a.query}`, ui)).reply;
      case "open":
        return (await openUrl(a.url, a.name, ui)).reply;
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
        return `😄 ${JOKES[Math.floor(Math.random() * JOKES.length)]}`;
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
