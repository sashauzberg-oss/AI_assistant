// Nova: wires the chat UI to the AI, the offline commands and all the tools.
import { $, el, storage, getJson } from "./util.js";
import { applyIcons, setIcon } from "./icons.js";
import { renderMarkdown } from "./markdown.js";
import { parseCommand, isInstant } from "./commands.js";
import { MusicPlayer, PlayerView } from "./music.js";
import { ScreenSnipper, imageFromFile } from "./screen.js";
import { Voice } from "./voice.js";
import { Timers, chime } from "./timers.js";
import { createToolbox } from "./tools.js";
import { Conversation, NoKeyError } from "./ai.js";

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
};

const player = new MusicPlayer();
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
}

function addUserMessage(text, image, source) {
  const body = el("div", { class: "body" }, [
    image ? el("img", { src: image.dataUrl, alt: "Attached screenshot" }) : null,
    text,
    source === "voice" ? el("span", { class: "via", text: "🎤 said" }) : null,
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
  ui.chat.append(el("div", { class: "msg assistant" }, [el("span", { class: "orb avatar", "aria-hidden": "true" }), body]));
  scrollToBottom();

  let segment = null;
  let segmentText = "";
  let fullText = "";
  let frame = null;

  // New content goes above the status line while it's showing, at the end once it's gone.
  const place = (node) => (statusLine.isConnected ? body.insertBefore(node, statusLine) : body.append(node));
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
    },
    get text() {
      return fullText;
    },
  };
}

function showWelcome() {
  const chips = ["music", "answer this", "play some jazz", "weather", "timer 5 minutes", "tell me a joke", "what can you do?"];
  ui.chat.replaceChildren(
    el("div", { class: "welcome" }, [
      el("div", { class: "orb", "aria-hidden": "true" }),
      el("h1", { text: "Hi, I'm Nova" }),
      el("p", { text: "Ask me anything, or tell me what to do. I can play music, answer questions on your screen, set timers, check the weather and much more." }),
      el(
        "div",
        { class: "chips" },
        chips.map((c) => el("button", { class: "chip", type: "button", text: c, onclick: () => submit(c, "text") })),
      ),
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

function openSettings() {
  $("#settings-speak").checked = state.speak;
  $("#settings-speak-voice").checked = state.speakWhenSpoken;
  $("#settings-key-msg").textContent = "";
  $("#settings-key").disabled = !state.canConfigure;
  $("#settings-save-key").disabled = !state.canConfigure;
  if (!state.canConfigure) $("#settings-key-msg").textContent = "The key can only be changed on the computer running Nova.";
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

ui.attach.addEventListener("click", () => ui.file.click());
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
async function captureScreen({ interactive, ui: msg, fromTool = false } = {}) {
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
    const image = await snipper.capture({ interactive: true });
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
if (!snipper.supported) ui.screenBtn.hidden = true;

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
if (!voice.supported) {
  ui.mic.hidden = true;
  ui.handsFreeBtn.hidden = true;
}

// ---------------------------------------------------------------- timers

timers.addEventListener("done", (e) => {
  const text = `⏰ Time's up: **${e.detail.label}**`;
  systemNote(text);
  voice.speak(`Time's up: ${e.detail.label}`);
});

// ---------------------------------------------------------------- tools

const toolbox = createToolbox({ player, timers, voice, captureScreen, setTheme, units });

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

async function runAI(text, image, source) {
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
  const sources = [];
  try {
    const result = await conversation.send(content, {
      signal: abort.signal,
      onText: (delta) => {
        msg.setStatus("");
        msg.appendText(delta);
      },
      onStatus: (s) => msg.setStatus(s),
      onReset: () => msg.resetRound(),
      onRound: () => {
        msg.newRound();
        msg.setStatus("Thinking…");
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
    speakIfWanted(msg.text, source);
  } catch (err) {
    msg.done();
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
  } finally {
    state.abort = null;
    setBusy(false);
  }
}

async function runOffline(text, image, source, command = parseCommand(text)) {
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
  if (reply) msg.setText(reply);
  msg.done();
  speakIfWanted(reply, source);
}

async function submit(rawText, source = "text") {
  const text = String(rawText || "").trim();
  let image = state.attachment;
  if (!text && !image) return;

  const command = text ? parseCommand(text) : null;

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
    const userBody = addUserMessage(text, null, source);
    try {
      image = await captureScreen({ interactive: source !== "voice" && !document.hidden });
    } catch (err) {
      systemNote(captureError(err));
      return;
    }
    if (!image) {
      systemNote("No screenshot taken. Try again, or paste one with Ctrl+V.");
      return;
    }
    userBody.prepend(el("img", { src: image.dataUrl, alt: "Screenshot" }));
    await runAI(text, image, source);
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
ui.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    submit(ui.input.value, "text");
  }
});
ui.form.addEventListener("submit", (e) => {
  e.preventDefault();
  submit(ui.input.value, "text");
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

// ---------------------------------------------------------------- start

if (window.matchMedia("(max-width: 520px)").matches) ui.input.placeholder = "Ask Nova anything…";
renderScreenButton();
renderVoiceButtons();
await refreshStatus();
showWelcome();
ui.input.focus();

// For automated tests and the browser console.
window.nova = { submit, player, timers, conversation, snipper, voice };
