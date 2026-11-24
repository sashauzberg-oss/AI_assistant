// Nova: wires the chat UI to the AI, the offline commands and all the tools.
import { $, el, storage, getJson, sleep } from "./util.js";
import { applyIcons, setIcon } from "./icons.js";
import { renderMarkdown } from "./markdown.js";
import { parseCommand, isInstant } from "./commands.js";
import { MusicPlayer, PlayerView } from "./music.js";
import { ScreenSnipper, imageFromFile } from "./screen.js";
import { Voice } from "./voice.js";
import { Timers, chime } from "./timers.js";
import { createToolbox } from "./tools.js";
import { Conversation, NoKeyError } from "./ai.js";
import { PetBuddy, createPetPicker, PETS } from "./pets.js";
import { attachAutocorrect, loadCorrector } from "./autocorrect.js";

applyIcons();

const ui = {
  chat: $("#chat"),
  input: $("#input"),
  form: $("#composer"),
  send: $("#btn-send"),
  stop: $("#btn-stop"),
  mic: $("#btn-mic"),
  snip: $("#btn-snip"),
  attach: $("#btn-attach"),
  file: $("#file"),
  attachment: $("#attachment"),
  attachmentImg: $("#attachment-img"),
  status: $("#status"),
  screenBtn: $("#btn-screen"),
  handsFreeBtn: $("#btn-handsfree"),
  speakBtn: $("#btn-speak"),
  settings: $("#settings"),
};

const state = {
  ai: false,
  canConfigure: true,
  busy: false,
  attachment: null,
  abort: null,
  speak: storage.get("speak", false),
  speakWhenSpoken: storage.get("speakWhenSpoken", true),
  theme: storage.get("theme", "system"),
  lastAnswer: "",
  lastActivity: Date.now(),
};

// Set when running inside the Nova desktop app (see desktop/preload.cjs).
const desktop = window.novaDesktop || null;
let desktopSettings = null;
let windowVisible = true; // desktop: whether the Nova bar is on screen
if (desktop) {
  document.documentElement.classList.add("desktop");
  document.body.classList.add("desktop");
}

// What each snip mode asks the AI, and how it reads in the chat.
const LANGUAGE = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of((navigator.language || "en").split("-")[0]) || "English";
  } catch {
    return "English";
  }
})();
const SNIP_LABELS = { answer: "Answer this", text: "Copy the text from this", translate: "Translate this", explain: "Explain this" };
const SNIP_INSTRUCTIONS = {
  answer: "Answer the question in this screenshot.",
  text: "Transcribe all the text in this screenshot exactly as written, keeping the line breaks. Reply with only the text, without any introduction or comments.",
  translate: `Translate the text in this screenshot into ${LANGUAGE} (if it's already in ${LANGUAGE}, translate it into English). Reply with only the translation.`,
  explain: "Explain what this screenshot shows, simply and briefly.",
};

// The dictionary also helps Nova understand slightly misspelled commands ("plya jazz"),
// while leaving real words alone.
let dictionary = null;
loadCorrector().then((c) => (dictionary = c), () => {});
const parseOptions = { isWord: (word) => !!dictionary?.isKnown(word) };

const player = new MusicPlayer();
const pet = new PetBuddy(); // the pixel pet who answers everything
pet.isPlaying = () => player.status === "playing";
player.addEventListener("change", () => {
  if (pet.state === "idle" || pet.state === "dancing") pet.setState(pet.restingState());
});
new PlayerView(player, $("#player"));
const snipper = new ScreenSnipper();
const voice = new Voice();
const timers = new Timers($("#timers"));
const conversation = new Conversation();

// ---------------------------------------------------------------- theme

function setTheme(theme) {
  state.theme = theme;
  storage.set("theme", theme);
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  $("#settings-theme").value = theme;
}
setTheme(state.theme);

const units = () => (/^en-(US|LR|MM)$/i.test(navigator.language) ? "imperial" : "metric");

// ---------------------------------------------------------------- chat rendering

function scrollToBottom() {
  ui.chat.scrollTop = ui.chat.scrollHeight;
  // In the desktop strip the latest answer scrolls inside its own two-line bubble.
  const latest = desktop && ui.chat.querySelector(".msg.latest .body");
  if (latest) latest.scrollTop = latest.scrollHeight;
}

function addUserMessage(text, image, source) {
  const body = el("div", { class: "body" }, [
    image ? el("img", { src: image.dataUrl, alt: "Attached screenshot" }) : null,
    text,
    source === "voice" ? el("span", { class: "via", text: "🎤 said" }) : null,
    source === "hotkey" ? el("span", { class: "via", text: "✂️ snipped with the hotkey" }) : null,
  ]);
  ui.chat.append(el("div", { class: "msg user" }, [body]));
  scrollToBottom();
  return body;
}

/** An assistant message that can hold streamed text, status lines and cards, in order. */
function addAssistantMessage() {
  const body = el("div", { class: "body" });
  const statusLine = el("div", { class: "status" }, [el("span", { class: "dots", html: "<i></i><i></i><i></i>" }), el("span", { text: "Thinking…" })]);
  body.append(statusLine);
  ui.chat.querySelector(".msg.latest")?.classList.remove("latest");
  ui.chat.append(el("div", { class: "msg assistant latest" }, [pet.sprite({ className: "avatar" }), body]));
  scrollToBottom();

  let segment = null;
  let segmentText = "";
  let fullText = "";
  let frame = null;

  // New content goes above the status line while it's showing, at the end once it's gone.
  const place = (node) => (statusLine.isConnected ? body.insertBefore(node, statusLine) : body.append(node));
  body.getMarkdown = () => fullText; // the answer as written, for "open the full answer"
  const newSegment = () => {
    segment = el("div", { class: "text" });
    segmentText = "";
    place(segment);
  };
  const flush = () => {
    frame = null;
    if (segment) segment.innerHTML = renderMarkdown(segmentText);
    scrollToBottom();
  };

  return {
    appendText(delta) {
      if (!segment) newSegment();
      segmentText += delta;
      fullText += delta;
      frame ??= requestAnimationFrame(flush);
    },
    setText(text) {
      newSegment();
      segmentText = text;
      fullText += (fullText ? "\n\n" : "") + text;
      flush();
    },
    resetRound() {
      // the server is retrying this turn: drop the partial text it streamed
      if (segment) {
        fullText = fullText.slice(0, fullText.length - segmentText.length);
        segment.remove();
        segment = null;
      }
    },
    newRound() {
      if (segment && segmentText.trim()) {
        fullText += "\n\n";
        segment = null;
      }
    },
    setStatus(text) {
      statusLine.hidden = !text;
      if (text) statusLine.lastChild.textContent = text;
      scrollToBottom();
    },
    addCard(node) {
      place(node);
      segment = null; // later text goes below the card
      scrollToBottom();
    },
    addImage(dataUrl) {
      this.addCard(el("div", { class: "card image-card" }, [el("img", { src: dataUrl, alt: "Screenshot Nova looked at" })]));
    },
    addSources(sources) {
      if (!sources.length) return;
      place(
        el(
          "div",
          { class: "sources" },
          sources.slice(0, 6).map((s) => el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", title: s.title || s.url, text: s.title || new URL(s.url).hostname })),
        ),
      );
    },
    error(text) {
      place(el("div", { class: "text error-text", text }));
    },
    done() {
      if (frame) cancelAnimationFrame(frame);
      flush();
      statusLine.remove();
      body.dataset.done = "1";
      if (desktop) body.scrollTop = 0; // read the finished answer from the start
    },
    get text() {
      return fullText;
    },
  };
}

function showWelcome() {
  if (desktop) {
    ui.chat.replaceChildren(); // the desktop bar starts as just the typing bar
    return;
  }
  const chips = ["music", "answer this", "play some jazz", "weather", "timer 5 minutes", "tell me a joke", "change pet", "what can you do?"];
  const { name, sound, animal } = pet.persona;
  ui.chat.replaceChildren(
    el("div", { class: "welcome" }, [
      pet.sprite({ live: true }),
      el("div", { class: "welcome-bubble" }, [
        el("p", {}, [
          el("strong", { text: `${sound} I'm ${name}, your pixel ${animal}! ` }),
          "Ask me anything, or tell me what to do. I can play music, answer questions on your screen, set timers, check the weather and much more.",
        ]),
      ]),
      el(
        "div",
        { class: "chips" },
        chips.map((c) => el("button", { class: "chip", type: "button", text: c, onclick: () => submit(c, "text") })),
      ),
      desktopSettings?.labels.snip
        ? el("div", { class: "desktop-tip" }, [
            "Tip: press ",
            el("kbd", { text: desktopSettings.labels.snip }),
            " in any app to snip a question and get the answer right next to it.",
          ])
        : null,
      state.ai
        ? null
        : el("div", {
            class: "offline-note",
            html: "Running in <b>offline mode</b>: built-in commands work, but to answer <i>anything</i> (and read your screen) add an Anthropic API key in <a href='#' data-open-settings>Settings</a>.",
          }),
    ]),
  );
}

function speakIfWanted(text, source) {
  if (!text) return;
  if (state.speak || (source === "voice" && state.speakWhenSpoken)) voice.speak(text);
}

// ---------------------------------------------------------------- status & settings

function renderStatus() {
  document.body.classList.toggle("offline", !state.ai);
  if (desktop) {
    ui.input.placeholder = state.ai ? `Ask ${pet.name} anything…` : "Offline: add an API key in ⚙ to ask anything";
  }
  ui.status.textContent = state.ai ? "AI ready" : "Offline mode";
  ui.status.className = `pill ${state.ai ? "ok" : "off"}`;
  ui.status.title = state.ai ? "Connected to Claude" : "Add an API key in Settings to unlock the AI";
  $("#settings-ai-status").textContent = state.ai
    ? "Nova is connected to Claude. Paste a new key to replace the current one."
    : "No API key yet. Nova works offline for built-in commands; add a key to answer anything and read your screen.";
}

async function refreshStatus() {
  try {
    const s = await getJson("/api/status");
    state.ai = s.ai;
    state.canConfigure = s.canConfigure;
  } catch {
    state.ai = false;
  }
  renderStatus();
}

const settingsOpenHooks = [];
function openSettings() {
  settingsOpenHooks.forEach((hook) => hook());
  $("#settings-city").value = storage.get("homeCity", "");
  renderMemoryCount();
  $("#settings-speak").checked = state.speak;
  $("#settings-speak-voice").checked = state.speakWhenSpoken;
  $("#settings-key-msg").textContent = "";
  $("#settings-key").disabled = !state.canConfigure;
  $("#settings-save-key").disabled = !state.canConfigure;
  if (!state.canConfigure) $("#settings-key-msg").textContent = "The key can only be changed on the computer running Nova.";
  if (desktop) {
    desktop.keepOpen(true);
    desktop.resize(780); // make room for the dialog
  }
  ui.settings.showModal();
}

$("#btn-settings").addEventListener("click", openSettings);
ui.status.addEventListener("click", openSettings);
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-open-settings]")) {
    e.preventDefault();
    openSettings();
  }
});

$("#settings-save-key").addEventListener("click", async () => {
  const msg = $("#settings-key-msg");
  const apiKey = $("#settings-key").value.trim();
  if (!apiKey) return;
  msg.className = "small";
  msg.textContent = "Checking the key…";
  try {
    const res = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't save the key.");
    $("#settings-key").value = "";
    msg.className = "small msg-ok";
    msg.textContent = "Saved! Nova's AI is ready.";
    await refreshStatus();
    if (ui.chat.querySelector(".welcome")) showWelcome();
  } catch (err) {
    msg.className = "small msg-err";
    msg.textContent = err.message;
  }
});

function setSpeak(on) {
  state.speak = on;
  storage.set("speak", on);
  ui.speakBtn.setAttribute("aria-pressed", String(on));
  setIcon(ui.speakBtn, on ? "volume" : "mute");
  if (!on) voice.stopSpeaking();
}
setSpeak(state.speak);
ui.speakBtn.addEventListener("click", () => setSpeak(!state.speak));
$("#settings-speak").addEventListener("change", (e) => setSpeak(e.target.checked));
$("#settings-speak-voice").addEventListener("change", (e) => {
  state.speakWhenSpoken = e.target.checked;
  storage.set("speakWhenSpoken", e.target.checked);
});
$("#settings-theme").addEventListener("change", (e) => setTheme(e.target.value));
$("#settings-city").addEventListener("change", (e) => storage.set("homeCity", e.target.value.trim()));
function renderMemoryCount() {
  const count = storage.get("memories", []).length;
  $("#settings-memories").textContent = count
    ? `Nova remembers ${count} thing${count === 1 ? "" : "s"} about you. Say “what do you remember” to see them.`
    : "Nova hasn't been asked to remember anything yet. Say “remember that …”.";
  $("#settings-clear-memories").hidden = !count;
}
$("#settings-clear-memories").addEventListener("click", () => {
  storage.set("memories", []);
  renderMemoryCount();
});
ui.settings.addEventListener("close", () => {
  if (!desktop) return;
  desktop.keepOpen(false);
  fitBar();
  ui.input.focus();
});

// ---------------------------------------------------------------- attachments & screen capture

function setAttachment(image) {
  state.attachment = image;
  ui.attachment.hidden = !image;
  if (image) ui.attachmentImg.src = image.dataUrl;
  else ui.attachmentImg.removeAttribute("src");
}
$("#attachment-remove").addEventListener("click", () => setAttachment(null));

async function attachFile(file) {
  if (!file?.type.startsWith("image/")) return;
  try {
    setAttachment(await imageFromFile(file));
    ui.input.focus();
  } catch {
    systemNote("That image couldn't be read.");
  }
}

ui.attach.addEventListener("click", () => {
  desktop?.keepOpen(true); // the file dialog takes focus; don't hide the bar
  ui.file.click();
});
ui.file.addEventListener("cancel", () => desktop?.keepOpen(false));
window.addEventListener("focus", () => {
  if (!ui.settings.open) desktop?.keepOpen(false);
});
ui.file.addEventListener("change", () => {
  attachFile(ui.file.files[0]);
  ui.file.value = "";
});
document.addEventListener("paste", (e) => {
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
  if (file) {
    e.preventDefault();
    attachFile(file);
  }
});
for (const type of ["dragenter", "dragover"]) {
  document.addEventListener(type, (e) => {
    if ([...(e.dataTransfer?.items || [])].some((i) => i.kind === "file")) {
      e.preventDefault();
      ui.form.classList.add("drag");
    }
  });
}
document.addEventListener("dragleave", (e) => {
  if (!e.relatedTarget) ui.form.classList.remove("drag");
});
document.addEventListener("drop", (e) => {
  ui.form.classList.remove("drag");
  const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith("image/"));
  if (file) {
    e.preventDefault();
    attachFile(file);
  }
});

function systemNote(text) {
  const msg = addAssistantMessage();
  msg.setText(text);
  msg.done();
  return msg;
}

function captureError(err) {
  if (err?.name === "NotAllowedError") return "Screen sharing was cancelled or blocked.";
  return err?.message || "Couldn't capture the screen.";
}

/**
 * Capture the screen for a question.
 * - If a screen is linked, grab it instantly (no picker). Typed requests get the crop overlay;
 *   voice or background requests send the whole screen.
 * - Otherwise the browser's picker must open from a click, so when we're not inside one
 *   (voice, or the AI asking mid-answer), show a button for the user to press.
 */
async function captureScreen({ interactive, ui: msg, fromTool = false, mode } = {}) {
  if (desktop) return desktop.snip(mode); // native snipping overlay, no share picker needed (result includes the mode)
  const crop = interactive ?? !document.hidden;
  if (snipper.linked) return snipper.capture({ interactive: crop });
  if (fromTool || !navigator.userActivation?.isActive) {
    return new Promise((resolve) => {
      const share = el("button", { class: "card-action", type: "button", text: "Share screen" });
      const skip = el("button", { class: "btn", type: "button", text: "Skip" });
      const node = el("div", { class: "card" }, [
        el("div", { class: "card-icon", text: "📸" }),
        el("div", { class: "card-main" }, [
          el("div", { class: "card-title", text: "Nova wants to see your screen" }),
          el("div", { class: "card-sub", text: "Pick the window or tab that shows the question." }),
        ]),
        skip,
        share,
      ]);
      const done = (value) => {
        node.remove();
        resolve(value);
      };
      share.addEventListener("click", () => snipper.capture({ interactive: true }).then(done, (err) => {
        systemNote(captureError(err));
        done(null);
      }));
      skip.addEventListener("click", () => done(null));
      if (msg?.addCard) msg.addCard(node);
      else {
        ui.chat.append(node);
        scrollToBottom();
      }
    });
  }
  return snipper.capture({ interactive: crop });
}

ui.snip.addEventListener("click", async () => {
  try {
    const image = desktop ? await desktop.snip() : await snipper.capture({ interactive: true });
    if (image?.mode && image.mode !== "answer") {
      // Copy text / Translate / Explain picked in the snip toolbar: run it right away.
      await askAboutSnip(image, image.mode, "text");
      return;
    }
    if (image) {
      setAttachment(image);
      ui.input.focus();
    }
  } catch (err) {
    systemNote(captureError(err));
  }
});

function renderScreenButton() {
  ui.screenBtn.setAttribute("aria-pressed", String(snipper.linked));
  ui.screenBtn.title = snipper.linked
    ? "Screen linked: “answer this” grabs it instantly. Click to stop sharing."
    : "Link a screen so “answer this” works instantly, even by voice";
}
snipper.addEventListener("change", renderScreenButton);
ui.screenBtn.addEventListener("click", async () => {
  if (snipper.linked) return snipper.unlink();
  try {
    await snipper.link();
    systemNote("🖥️ Screen linked. Now just say or type **answer this** whenever a question is on that screen.");
  } catch (err) {
    systemNote(captureError(err));
  }
});
if (!snipper.supported || desktop) ui.screenBtn.hidden = true; // the desktop app snips natively

// ---------------------------------------------------------------- voice

function renderVoiceButtons() {
  ui.handsFreeBtn.setAttribute("aria-pressed", String(voice.handsFree));
  document.body.classList.toggle("listening", voice.handsFree || !!voice.oneShot);
}

ui.mic.addEventListener("click", async () => {
  if (voice.oneShot) return voice.stopListening();
  if (!voice.supported) return systemNote("Voice input isn't supported in this browser. Try Chrome or Edge.");
  ui.mic.classList.add("recording");
  renderVoiceButtons();
  try {
    const text = await voice.listenOnce((interim) => (ui.input.value = interim));
    ui.input.value = "";
    if (text) submit(text, "voice");
  } catch (err) {
    systemNote(err.message);
  } finally {
    ui.mic.classList.remove("recording");
    renderVoiceButtons();
  }
});

ui.handsFreeBtn.addEventListener("click", () => {
  try {
    if (voice.handsFree) {
      voice.stopHandsFree();
    } else {
      voice.startHandsFree();
      systemNote("👂 Hands-free is on. Start with **“Nova”**, like “Nova, play some jazz” or “Nova, answer this”.");
    }
  } catch (err) {
    systemNote(err.message);
  }
  renderVoiceButtons();
});
voice.addEventListener("command", (e) => submit(e.detail, "voice"));
voice.addEventListener("wake", () => chime(1)); // a chime, not speech, so the mic doesn't hear it
voice.addEventListener("change", renderVoiceButtons);
voice.addEventListener("error", (e) => {
  systemNote(e.detail);
  renderVoiceButtons();
});
// Electron has no speech recognition service, so voice input is a browser-only feature.
if (!voice.supported || desktop) {
  ui.mic.hidden = true;
  ui.handsFreeBtn.hidden = true;
}

// ---------------------------------------------------------------- timers

timers.addEventListener("done", (e) => {
  if (e.detail.kind === "focus") {
    if (player.status === "playing") player.pause();
    systemNote("🍅 Focus session done! Take a 5-minute break. Say **pomodoro** when you're ready for another round.");
    voice.speak("Focus session done. Time for a break!");
    return;
  }
  const text = `⏰ Time's up: **${e.detail.label}**`;
  systemNote(text);
  voice.speak(`Time's up: ${e.detail.label}`);
});

// ---------------------------------------------------------------- tools

const toolbox = createToolbox({
  player,
  timers,
  voice,
  captureScreen,
  setTheme,
  units,
  pet,
  getLastAnswer: () => state.lastAnswer,
  openPetPicker: () => togglePetPicker(true),
});

// ---------------------------------------------------------------- sending

function setBusy(busy) {
  state.busy = busy;
  document.body.classList.toggle("busy", busy);
  ui.send.hidden = busy;
  ui.stop.hidden = !busy;
}

ui.stop.addEventListener("click", () => state.abort?.abort());

function collectSources(content) {
  const seen = new Set();
  const sources = [];
  for (const block of content || []) {
    for (const c of block.citations || []) {
      if (c.url && !seen.has(c.url)) {
        seen.add(c.url);
        sources.push({ url: c.url, title: c.title });
      }
    }
  }
  return sources;
}

/** Throttled forwarding of an answer's progress to the desktop answer bubble. */
function createMirror(send) {
  let pending = {};
  let timer = null;
  const flush = () => {
    timer = null;
    if (pending.text !== undefined) pending.html = renderMarkdown(pending.text);
    send(pending);
    pending = {};
  };
  return (update) => {
    Object.assign(pending, update);
    if (update.done) {
      clearTimeout(timer);
      flush();
    } else {
      timer ??= setTimeout(flush, 60);
    }
  };
}

async function runAI(text, image, source, mirror = null) {
  const msg = addAssistantMessage();
  const content = image
    ? [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
        { type: "text", text: text || "Answer the question in this screenshot." },
      ]
    : text;
  const abort = new AbortController();
  state.abort = abort;
  setBusy(true);
  pet.setState("thinking");
  const sources = [];
  try {
    const result = await conversation.send(content, {
      signal: abort.signal,
      onText: (delta) => {
        msg.setStatus("");
        msg.appendText(delta);
        if (pet.state !== "talking") pet.setState("talking");
        mirror?.({ text: msg.text });
      },
      onStatus: (s) => {
        msg.setStatus(s);
        mirror?.({ status: s });
      },
      onReset: () => msg.resetRound(),
      onRound: () => {
        msg.newRound();
        msg.setStatus("Thinking…");
        pet.setState("thinking");
      },
      runTool: async (name, input) => {
        const result = await toolbox.run(name, input, msg);
        msg.setStatus("Thinking…");
        return result;
      },
    });
    if (result.refused) {
      msg.setText("Sorry, I can't help with that one.");
    } else if (result.message) {
      sources.push(...collectSources(result.message.content));
    }
    if (!msg.text.trim() && !result.refused) msg.setText(result.note || "Done.");
    msg.addSources(sources);
    msg.done();
    pet.setState("happy", 1400);
    mirror?.({ text: msg.text, done: true });
    if (!result.refused) state.lastAnswer = msg.text;
    speakIfWanted(msg.text, source);
    if (desktop && !windowVisible && source !== "hotkey") notifyAnswer(msg.text);
    return result.refused ? null : msg.text;
  } catch (err) {
    msg.done();
    pet.setState(pet.restingState());
    mirror?.({ error: err.name === "AbortError" ? "Stopped." : err.message, done: true });
    if (err.name === "AbortError") {
      msg.error("Stopped.");
    } else if (err instanceof NoKeyError) {
      state.ai = false;
      renderStatus();
      msg.error("The AI isn't set up yet, so I answered with my offline skills.");
      await runOffline(text, image, source);
    } else {
      msg.error(err.message);
    }
    return null;
  } finally {
    state.abort = null;
    setBusy(false);
  }
}

/** Desktop: the bar was put away while Nova was answering, so tell the user it's ready. */
function notifyAnswer(text) {
  try {
    const note = new Notification("Nova answered", { body: text.replace(/[*_`#>]/g, "").slice(0, 160) });
    note.onclick = () => desktop.show();
  } catch {
    // notifications unavailable
  }
}

/** Send a snip to the AI in one of the snip modes; "Copy text" puts the result on the clipboard. */
async function askAboutSnip(image, mode, source, { label, mirror } = {}) {
  ui.chat.querySelector(".welcome")?.remove();
  addUserMessage(label || SNIP_LABELS[mode] || SNIP_LABELS.answer, image, source);
  mirror?.({ pet: { name: pet.name, frames: pet.frames() } });
  if (!state.ai) {
    const text = "To read snips I need my AI brain. Open settings (⚙) and paste an Anthropic API key.";
    mirror?.({ text, done: true });
    await runOffline("answer this", image, source);
    return;
  }
  const answer = await runAI(SNIP_INSTRUCTIONS[mode] || SNIP_INSTRUCTIONS.answer, image, source, mirror);
  if (answer && mode === "text") {
    try {
      if (desktop) await desktop.copy(answer);
      else await navigator.clipboard.writeText(answer);
      mirror?.({ copied: true });
      // Add the note to the same answer, so the copied text stays in view.
      ui.chat.querySelector(".msg.latest .body")?.append(el("div", { class: "copied-note", text: "📋 Copied to your clipboard" }));
    } catch {
      systemNote("Couldn't copy automatically. Say **copy that** to copy it.");
    }
  }
}

async function runOffline(text, image, source, command = parseCommand(text, parseOptions)) {
  const msg = addAssistantMessage();
  let reply;
  if (image || command?.name === "answer_screen") {
    reply =
      "To answer questions from your screen I need my AI brain. Open **Settings** (the sliders icon) and paste an Anthropic API key. It takes a minute, and then I can answer anything.";
  } else if (command) {
    try {
      reply = await toolbox.command(command, msg);
    } catch (err) {
      reply = `Something went wrong: ${err.message}`;
    }
  }
  if (reply === null || reply === undefined) {
    const q = encodeURIComponent(text);
    reply = `I'm in offline mode, so I only know built-in commands (type **help** to see them). Add an Anthropic API key in Settings and I can answer anything.\n\nMeanwhile, here's a [web search for “${text}”](https://www.google.com/search?q=${q}).`;
  }
  if (reply && command?.understood) reply += `\n\n_(I took that as “${command.understood}”.)_`;
  if (reply) msg.setText(reply);
  msg.done();
  if (pet.state !== "happy") pet.setState("talking", 900);
  if (reply && command?.name !== "copy_last") state.lastAnswer = reply;
  speakIfWanted(reply, source);
}

async function submit(rawText, source = "text") {
  const text = String(rawText || "").trim();
  let image = state.attachment;
  if (!text && !image) return;

  const command = text ? parseCommand(text, parseOptions) : null;
  state.lastActivity = Date.now();
  if (pet.state === "sleeping") pet.setState(pet.restingState());

  // Music controls etc. work instantly, even while the AI is busy answering.
  if (state.busy && !isInstant(command)) {
    if (source === "voice") voice.speak("One moment, I'm still working on the last request.");
    return;
  }

  ui.chat.querySelector(".welcome")?.remove();
  ui.input.value = "";
  autoGrow();
  setAttachment(null);
  voice.stopSpeaking();

  if (command?.name === "clear") {
    conversation.reset();
    showWelcome();
    return;
  }

  // "answer this": grab the screen first (this runs inside the key press or click, so the
  // browser allows the share picker), then send the picture with the question.
  if (command?.name === "answer_screen" && !image && state.ai) {
    let shot;
    try {
      shot = await captureScreen({ interactive: source !== "voice" && !document.hidden, mode: command.args?.mode });
    } catch (err) {
      systemNote(captureError(err));
      return;
    }
    if (!shot) {
      systemNote("No screenshot taken. Try again, or paste one with Ctrl+V.");
      return;
    }
    const mode = shot.mode || command.args?.mode || "answer";
    if (mode === "text" || mode !== (command.args?.mode || "answer")) {
      await askAboutSnip(shot, mode, source, { label: text });
    } else {
      addUserMessage(text, shot, source);
      await runAI(text, shot, source);
    }
    return;
  }

  addUserMessage(text, image, source);
  if (isInstant(command) && !image) return runOffline(text, null, source, command);
  if (state.ai) return runAI(text, image, source);
  return runOffline(text, image, source, command);
}

// ---------------------------------------------------------------- composer

function autoGrow() {
  ui.input.style.height = "auto";
  ui.input.style.height = `${Math.min(ui.input.scrollHeight, 180)}px`;
}
ui.input.addEventListener("input", autoGrow);

// ---------------------------------------------------------------- auto-correct

const acHint = $("#ac-hint");
let acHintTimer = null;
const learnedWords = new Set(storage.get("learnedWords", []).map((w) => w.toLowerCase()));
// On unless turned off in Settings; it only ever touches English text.
const autocorrectOn = () => storage.get("autocorrect", true);
const autocorrect = attachAutocorrect(ui.input, {
  enabled: autocorrectOn,
  // Never "fix" words you've undone before, or your pet's name.
  protect: (word) => {
    const w = word.toLowerCase();
    return learnedWords.has(w) || pet.name.toLowerCase().split(/\s+/).includes(w) || Object.values(PETS).some((p) => p.name.toLowerCase() === w);
  },
  onCorrect: (fix) => {
    acHint.textContent = `${fix.original} → ${fix.replacement} ↶`;
    acHint.hidden = false;
    clearTimeout(acHintTimer);
    acHintTimer = setTimeout(() => (acHint.hidden = true), 4000);
  },
  onRevert: () => (acHint.hidden = true),
  onUndo: (fix) => {
    learnedWords.add(fix.original.toLowerCase());
    storage.set("learnedWords", [...learnedWords].slice(-500));
    acHint.hidden = true;
    ui.input.focus();
  },
});
acHint.addEventListener("mousedown", (e) => e.preventDefault()); // keep the caret in the text box
acHint.addEventListener("click", () => autocorrect.undo());
$("#settings-autocorrect").checked = autocorrectOn();
$("#settings-autocorrect").addEventListener("change", (e) => storage.set("autocorrect", e.target.checked));

function send() {
  autocorrect.flush(); // fix the last word too
  acHint.hidden = true;
  submit(ui.input.value, "text");
}
ui.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send();
  }
});
ui.form.addEventListener("submit", (e) => {
  e.preventDefault();
  send();
});

$("#btn-new").addEventListener("click", () => {
  state.abort?.abort();
  conversation.reset();
  showWelcome();
  ui.input.focus();
});

ui.chat.addEventListener("click", (e) => {
  const button = e.target.closest(".copy-code");
  if (!button) return;
  navigator.clipboard.writeText(button.previousElementSibling.textContent).then(() => {
    button.textContent = "Copied";
    setTimeout(() => (button.textContent = "Copy"), 1500);
  });
});

// Keyboard shortcut: Ctrl/Cmd + Shift + S snips the screen.
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    ui.snip.click();
  }
});

// ---------------------------------------------------------------- desktop app

const MODIFIER_LABELS = { CommandOrControl: "Ctrl", Control: "Ctrl", Alt: "Alt", Shift: "Shift", Super: "Win" };
const MAC_LABELS = { CommandOrControl: "⌘", Control: "⌃", Alt: "⌥", Shift: "⇧" };
const KEY_NAMES = {
  Space: "Space", Enter: "Enter", Tab: "Tab", Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]",
  Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", ArrowUp: "Up", ArrowDown: "Down",
  ArrowLeft: "Left", ArrowRight: "Right", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
  Insert: "Insert", Delete: "Delete", PrintScreen: "PrintScreen",
};

function formatAccelerator(accel) {
  if (!accel) return "";
  const mac = desktop?.platform === "darwin";
  return accel
    .split("+")
    .map((part) => (mac ? MAC_LABELS[part] : MODIFIER_LABELS[part]) || part)
    .join(mac ? "" : "+");
}

/** Turns a key press into an Electron accelerator like "CommandOrControl+Shift+Space". */
function acceleratorFromEvent(e) {
  const mac = desktop?.platform === "darwin";
  const mods = [];
  if (mac ? e.metaKey : e.ctrlKey) mods.push("CommandOrControl");
  if (mac && e.ctrlKey) mods.push("Control");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (!mac && e.metaKey) mods.push("Super");
  let key = null;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (/^F\d{1,2}$/.test(e.code)) key = e.code;
  else key = KEY_NAMES[e.code] || null;
  if (!key) return null; // only modifier keys so far
  if (!mods.length && !/^F\d+$/.test(key) && key !== "PrintScreen") return { error: "Add Ctrl, Alt or Shift to the shortcut." };
  return { accel: [...mods, key].join("+") };
}

function setupDesktop() {
  $("#settings-desktop").hidden = false;
  const msg = $("#hotkeys-msg");
  const fields = { snip: $("#hotkey-snip"), toggle: $("#hotkey-toggle") };

  const fill = (hotkeys) => {
    for (const [name, input] of Object.entries(fields)) {
      input.dataset.accel = hotkeys[name] || "";
      input.value = formatAccelerator(hotkeys[name]) || "None";
    }
  };
  for (const input of Object.values(fields)) {
    input.addEventListener("focus", () => input.classList.add("recording"));
    input.addEventListener("blur", () => input.classList.remove("recording"));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Tab" || e.key === "Escape") return; // keep normal focus moves and closing the dialog
      e.preventDefault();
      if ((e.key === "Backspace" || e.key === "Delete") && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        input.dataset.accel = "";
        input.value = "None";
        return;
      }
      const result = acceleratorFromEvent(e);
      if (!result) return;
      if (result.error) {
        msg.className = "small msg-err";
        msg.textContent = result.error;
        return;
      }
      input.dataset.accel = result.accel;
      input.value = formatAccelerator(result.accel);
      msg.textContent = "";
    });
  }
  $("#hotkeys-save").addEventListener("click", async () => {
    const result = await desktop.setHotkeys({ snip: fields.snip.dataset.accel, toggle: fields.toggle.dataset.accel });
    const problems = Object.values(result.errors || {});
    msg.className = `small ${problems.length ? "msg-err" : "msg-ok"}`;
    msg.textContent = problems.length ? problems.join(" ") : "Shortcuts saved.";
    if (!problems.length) {
      desktopSettings = await desktop.getSettings();
      if (ui.chat.querySelector(".welcome")) showWelcome();
    }
  });
  $("#hotkeys-reset").addEventListener("click", () => fill(desktopSettings.defaults));
  $("#login-row").hidden = !desktopSettings.canOpenAtLogin;
  $("#settings-login").addEventListener("change", async (e) => {
    e.target.checked = await desktop.setOpenAtLogin(e.target.checked);
  });
  ui.settings.addEventListener("close", () => (msg.textContent = ""));
  settingsOpenHooks.push(() => {
    fill(desktopSettings.hotkeys);
    $("#settings-login").checked = desktopSettings.openAtLogin;
  });

  // The global hotkey: the desktop app sends the snip here; the answer streams into the
  // chat and into the bubble next to the snip.
  desktop.onAskImage(async ({ image, mode = "answer" }) => {
    for (let i = 0; i < 600 && state.busy; i++) await sleep(100); // let a running answer finish first
    state.lastActivity = Date.now();
    await askAboutSnip(image, mode, "hotkey", { mirror: createMirror(desktop.popupUpdate) });
  });
}

// ---------------------------------------------------------------- the pet next to the typing bar

const petLabel = el("span", { class: "pet-label" });
const petDock = el("button", { class: "pet-dock", type: "button" }, [pet.sprite({ live: true }), petLabel]);
const petPicker = createPetPicker(pet);
pet.dock(petDock);

function renderPet() {
  petLabel.textContent = pet.name.toUpperCase();
  petDock.title = `${pet.name} the ${pet.pet.animal}: click to choose another pet`;
  if (desktop) renderStatus();
  else ui.input.placeholder = window.innerWidth < 520 ? `Ask ${pet.name} anything…` : `Ask ${pet.name} anything… try “music” or “answer this”`;
  if (ui.chat.querySelector(".welcome")) showWelcome();
}
pet.addEventListener("change", renderPet);
renderPet();

function togglePetPicker(force) {
  petPicker.hidden = force === undefined ? !petPicker.hidden : !force;
  if (!petPicker.hidden) petPicker.querySelector('[aria-pressed="true"]')?.focus();
}
petDock.addEventListener("click", () => togglePetPicker());

// In the browser, the pet sits to the left of the typing bar.
if (!desktop) {
  const main = el("div", { class: "composer-main" });
  ui.form.prepend(petDock, main);
  main.append(petPicker, ui.attachment, ui.form.querySelector(".composer-row"));
  $(".brand .orb")?.replaceWith(pet.sprite());
}

// The pet dozes off when nothing has happened for a while.
setInterval(() => {
  if (!state.busy && pet.state === "idle" && Date.now() - state.lastActivity > 3 * 60 * 1000) pet.setState("sleeping");
}, 15000);
ui.input.addEventListener("input", () => {
  state.lastActivity = Date.now();
  if (pet.state === "sleeping") pet.setState(pet.restingState());
});

// ---------------------------------------------------------------- desktop: the floating bar

// Under the bar there is only a slim strip (at most 50px): the pet's latest answer in a
// two-line speech bubble, plus compact music controls and timers.
let strip = null;
let answerDismissed = false;

/** Rearrange the page into a Spotlight-style bar with a slim strip underneath. */
function setupBar() {
  const appEl = $(".app");
  const row = ui.form.querySelector(".composer-row");
  const pin = el("button", { class: "icon-btn", type: "button", "data-icon": "pin", "aria-pressed": String(!!desktopSettings.pinned) });
  const renderPin = () => {
    const on = pin.getAttribute("aria-pressed") === "true";
    pin.title = on ? "Pinned: Nova stays open when you click elsewhere" : "Pin Nova so it stays open when you click elsewhere";
  };
  pin.addEventListener("click", async () => {
    const on = await desktop.setPinned(pin.getAttribute("aria-pressed") !== "true");
    pin.setAttribute("aria-pressed", String(on));
    renderPin();
  });
  renderPin();
  row.prepend(el("span", { class: "grip", title: "Drag to move Nova", "aria-hidden": "true" }));
  row.append(pin, $("#btn-settings"));

  const open = el("button", { class: "icon-btn small", type: "button", "data-icon": "expand", title: "Open the full answer" });
  open.addEventListener("click", () => {
    const text = latestAnswerText();
    if (text) desktop.showAnswer({ html: renderMarkdown(text), text, pet: { name: pet.name, frames: pet.frames() } });
  });
  const dismiss = el("button", { class: "icon-btn small", type: "button", "data-icon": "x", title: "Hide this answer" });
  dismiss.addEventListener("click", () => {
    answerDismissed = true;
    renderStrip();
    ui.input.focus();
  });
  // The answer shows as a one-line ticker; the full chat stays in the page (hidden) for history.
  const track = el("div", { class: "ticker-track" });
  const ticker = el("div", { class: "ticker", title: "Hover to pause, scroll to move, ⤢ to open the whole answer" }, [track]);
  const answer = el("div", { class: "strip-answer" }, [ticker, ui.chat, el("div", { class: "strip-tools" }, [open, dismiss])]);
  const side = el("div", { class: "strip-side" }, [$("#player"), $("#timers")]);
  strip = el("section", { class: "strip", hidden: true }, [answer, side]);
  strip.answer = answer;
  strip.side = side;
  strip.ticker = ticker;
  strip.track = track;
  setupTicker();

  // The pet picker takes the typing row's place while it's open, so the bar doesn't grow.
  ui.form.insertBefore(petPicker, row);
  appEl.replaceChildren(ui.form, strip);
  // The pet sits next to the bar, outside the frame.
  const wrap = el("div", { class: "bar-wrap" });
  appEl.before(wrap);
  wrap.append(petDock, appEl);
  applyIcons(appEl);

  // A new message shows the strip again; music and timers show their compact controls.
  new MutationObserver(() => {
    if (ui.chat.querySelector(".msg.latest")) answerDismissed = false;
    renderStrip();
  }).observe(ui.chat, { childList: true });
  // Streaming text and new cards update the ticker.
  new MutationObserver(() => scheduleTicker()).observe(ui.chat, { childList: true, subtree: true, characterData: true });
  new MutationObserver(() => renderStrip()).observe($("#timers"), { childList: true });
  player.addEventListener("change", () => renderStrip());
  new MutationObserver(() => renderStrip()).observe(petPicker, { attributes: true, attributeFilter: ["hidden"] });

  // The window grows and shrinks with the content.
  new ResizeObserver(() => fitBar()).observe(wrap);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || ui.settings.open || e.defaultPrevented) return;
    if (ui.input.value) {
      ui.input.value = "";
      autoGrow();
    } else if (!petPicker.hidden) {
      petPicker.hidden = true;
    } else {
      desktop.hide();
    }
  });
  desktop.onShown(() => {
    // Coming back after a while: start from just the bar.
    if (Date.now() - state.lastActivity > 5 * 60 * 1000 && !state.busy) {
      answerDismissed = true;
      renderStrip();
    }
    ui.input.focus();
    ui.input.select();
    fitBar();
  });
  desktop.onVisibility((visible) => (windowVisible = visible));
  timers.isHidden = () => !windowVisible;
  renderStrip();
}

function latestAnswerText() {
  const body = ui.chat.querySelector(".msg.latest .body");
  return (body?.getMarkdown?.() || "").trim();
}

function renderStrip() {
  if (!strip) return;
  const hasAnswer = !!ui.chat.querySelector(".msg.latest") && !answerDismissed;
  const hasPlayer = !$("#player").hidden;
  const hasTimers = !!$("#timers").children.length;
  strip.answer.hidden = !hasAnswer;
  strip.side.hidden = !hasPlayer && !hasTimers;
  strip.hidden = !hasAnswer && !hasPlayer && !hasTimers;
  ui.form.querySelector(".composer-row").hidden = !petPicker.hidden;
  scheduleTicker();
  fitBar();
}

// ---------------------------------------------------------------- the one-line answer ticker

let tickerTimer = null;
let tickerOffset = 0;
let tickerHold = 0; // pause (ms timestamp) at the start/end, or after a manual scroll
let tickerHover = false;

function scheduleTicker() {
  if (!strip || tickerTimer) return;
  tickerTimer = setTimeout(() => {
    tickerTimer = null;
    renderTicker();
  }, 60);
}

/** Markdown -> one plain line ("· " between paragraphs and list items). */
function oneLine(markdown) {
  return markdown
    .replace(/```[\s\S]*?(```|$)/g, " [code] ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*([-*+•]|\d+[.)])\s+/gm, "")
    .replace(/^\s*#+\s*/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\|/g, " ")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("  ·  ");
}

function renderTicker() {
  const body = ui.chat.querySelector(".msg.latest .body");
  if (!body) return;
  const chips = [...body.querySelectorAll(".card")].filter((c) => !c.classList.contains("image-card")).map((card) => {
    const password = card.querySelector(".password");
    const action = card.querySelector(".card-action");
    const label = password ? `🔑 ${password.textContent}` : (card.querySelector(".card-title")?.textContent || "").trim();
    const chip = el("button", { class: "tick-chip", type: "button", text: password ? `${label}  📋` : label, title: action ? action.textContent : label });
    if (action) chip.addEventListener("click", () => action.click());
    else chip.disabled = true;
    return chip;
  });
  const status = body.querySelector(".status:not([hidden])");
  const text = oneLine(body.getMarkdown?.() || "") || (status?.isConnected ? status.textContent : "");
  const done = body.dataset.done === "1";
  const signature = `${chips.map((c) => c.textContent).join("|")}#${text}#${done}`;
  if (signature === strip.track.dataset.signature) return;
  const wasDone = strip.track.dataset.done === "1";
  strip.track.dataset.signature = signature;
  strip.track.dataset.done = done ? "1" : "";
  strip.track.replaceChildren(...chips, el("span", { class: "tick-text", text }));
  strip.ticker.classList.toggle("thinking", !text && !chips.length);
  if (done && !wasDone) {
    // Finished: start from the beginning, pause, then scroll through.
    tickerOffset = 0;
    tickerHold = Date.now() + 1800;
  }
  moveTicker();
}

function tickerMax() {
  const style = getComputedStyle(strip.ticker);
  const visible = strip.ticker.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  return Math.max(0, strip.track.scrollWidth - visible);
}

function moveTicker() {
  strip.track.style.transform = `translateX(${-Math.round(tickerOffset)}px)`;
}

function setupTicker() {
  let lastFrame = performance.now();
  const step = (now) => {
    const dt = Math.min(100, now - lastFrame);
    lastFrame = now;
    requestAnimationFrame(step);
    if (!strip || strip.answer.hidden) return;
    const max = tickerMax();
    if (max <= 0) {
      if (tickerOffset) {
        tickerOffset = 0;
        moveTicker();
      }
      return;
    }
    if (strip.track.dataset.done !== "1") {
      tickerOffset = max; // while answering, show the newest words
      moveTicker();
      return;
    }
    if (tickerHover || Date.now() < tickerHold) return;
    if (tickerOffset >= max) {
      // Reached the end: wait, then jump back to the start.
      tickerOffset = 0;
      tickerHold = Date.now() + 2200;
    } else {
      tickerOffset = Math.min(max, tickerOffset + (dt / 1000) * 45);
      if (tickerOffset >= max) tickerHold = Date.now() + 2200;
    }
    moveTicker();
  };
  requestAnimationFrame(step);
  strip.ticker.addEventListener("mouseenter", () => (tickerHover = true));
  strip.ticker.addEventListener("mouseleave", () => (tickerHover = false));
  strip.ticker.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      tickerOffset = Math.max(0, Math.min(tickerMax(), tickerOffset + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)));
      tickerHold = Date.now() + 4000;
      moveTicker();
    },
    { passive: false },
  );
}

function fitBar() {
  if (!desktop || ui.settings.open) return;
  const wrap = $(".bar-wrap") || $(".app");
  const margin = 28; // the transparent space around the bar (and the pet) for shadows
  desktop.resize(Math.ceil(wrap.getBoundingClientRect().height) + margin);
}

// ---------------------------------------------------------------- start

renderScreenButton();
renderVoiceButtons();
await refreshStatus();
if (desktop) {
  desktopSettings = await desktop.getSettings();
  setupDesktop();
  setupBar();
  renderStatus();
}
showWelcome();
ui.input.focus();
desktop?.ready();

// For automated tests and the browser console.
window.nova = { submit, player, timers, conversation, snipper, voice, pet };
