// Speech in and out with the browser's built-in Web Speech API (best in Chrome and Edge).
import { toSpeech } from "./markdown.js";

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
// Speech recognizers often hear "Nova" as one of these.
const WAKE_RE = /^(.*?)\b(?:hey |ok |okay )?(nova|nover|novah|noah|nolva)\b[,.!?\s]*/i;

export class Voice extends EventTarget {
  constructor() {
    super();
    this.supported = !!Recognition;
    this.ttsSupported = "speechSynthesis" in window;
    this.handsFree = false;
    this.oneShot = null;
    this.continuous = null;
    this.awaitingUntil = 0;
    if (this.ttsSupported) {
      this.pickVoice();
      speechSynthesis.addEventListener?.("voiceschanged", () => this.pickVoice());
    }
  }

  pickVoice() {
    const voices = speechSynthesis.getVoices();
    const lang = (navigator.language || "en-US").toLowerCase();
    const base = lang.split("-")[0];
    const score = (v) =>
      (v.lang.toLowerCase() === lang ? 4 : v.lang.toLowerCase().startsWith(base) ? 2 : 0) +
      (/natural|neural|google|premium|enhanced/i.test(v.name) ? 2 : 0) +
      (v.localService ? 0 : 1);
    this.voice = voices.sort((a, b) => score(b) - score(a))[0] || null;
  }

  createRecognizer(continuous) {
    const rec = new Recognition();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = continuous;
    rec.maxAlternatives = 1;
    return rec;
  }

  /** Listen for one sentence. Resolves with the transcript ("" if nothing was heard). */
  listenOnce(onInterim) {
    if (!this.supported) return Promise.reject(new Error("Voice input needs Chrome, Edge or Safari."));
    this.stopSpeaking();
    const resumeHandsFree = this.handsFree;
    if (resumeHandsFree) this.pauseHandsFree();
    return new Promise((resolve, reject) => {
      const rec = this.createRecognizer(false);
      this.oneShot = rec;
      let finalText = "";
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        onInterim?.(finalText + interim);
      };
      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        this.oneShot = null;
        reject(new Error(e.error === "not-allowed" ? "Microphone access was blocked. Allow it in the address bar." : `Voice input error: ${e.error}`));
      };
      rec.onend = () => {
        this.oneShot = null;
        if (resumeHandsFree && this.handsFree) this.resumeHandsFree();
        resolve(finalText.trim());
      };
      rec.start();
    });
  }

  stopListening() {
    this.oneShot?.stop();
  }

  /** Always-on listening. Phrases that start with the wake word "Nova" become commands. */
  startHandsFree() {
    if (!this.supported) throw new Error("Hands-free mode needs Chrome, Edge or Safari.");
    this.handsFree = true;
    this.resumeHandsFree();
  }

  stopHandsFree() {
    this.handsFree = false;
    this.pauseHandsFree();
  }

  pauseHandsFree() {
    const rec = this.continuous;
    this.continuous = null;
    if (rec) {
      rec.onend = null;
      rec.abort();
    }
  }

  resumeHandsFree() {
    if (!this.handsFree || this.continuous) return;
    const rec = this.createRecognizer(true);
    this.continuous = rec;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.handlePhrase(r[0].transcript.trim());
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.handsFree = false;
        this.dispatchEvent(new CustomEvent("error", { detail: "Microphone access was blocked. Allow it in the address bar." }));
      }
    };
    rec.onend = () => {
      // Browsers stop recognition after a while; restart it while hands-free is on.
      this.continuous = null;
      if (this.handsFree) setTimeout(() => this.resumeHandsFree(), 300);
      else this.dispatchEvent(new Event("change"));
    };
    try {
      rec.start();
    } catch {
      this.continuous = null;
    }
    this.dispatchEvent(new Event("change"));
  }

  handlePhrase(text) {
    if (!text) return;
    if (Date.now() < this.awaitingUntil) {
      this.awaitingUntil = 0;
      this.dispatchEvent(new CustomEvent("command", { detail: text.replace(WAKE_RE, "") || text }));
      return;
    }
    const m = text.match(WAKE_RE);
    if (!m) return;
    const command = text.slice(m.index + m[0].length).trim();
    if (command) {
      this.dispatchEvent(new CustomEvent("command", { detail: command }));
    } else {
      this.awaitingUntil = Date.now() + 8000; // "Nova" ... (pause) ... "play some jazz"
      this.dispatchEvent(new Event("wake"));
    }
  }

  speak(markdown) {
    if (!this.ttsSupported) return;
    this.stopSpeaking();
    let text = toSpeech(markdown);
    if (!text) return;
    if (text.length > 1200) text = `${text.slice(0, 1200).replace(/[^.!?]*$/, "")} The rest is on screen.`;
    // Chrome cuts off long utterances, so speak sentence by sentence.
    const chunks = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
    for (const chunk of chunks) {
      const u = new SpeechSynthesisUtterance(chunk.trim());
      if (this.voice) u.voice = this.voice;
      u.rate = 1.03;
      speechSynthesis.speak(u);
    }
  }

  stopSpeaking() {
    if (this.ttsSupported) speechSynthesis.cancel();
  }
}
