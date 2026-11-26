// Talks to the server's /api/chat endpoint (one Claude call per request, streamed as
// server-sent events) and runs the tool loop here in the browser, where the tools live.

import { storage } from "./util.js";
import { PETS } from "./pets.js";

export class NoKeyError extends Error {}
/** The saved key was rejected (deleted or turned off at Anthropic). */
export class BadKeyError extends NoKeyError {}

function clientContext() {
  return {
    date: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
    homeCity: storage.get("homeCity", ""),
    memories: storage.get("memories", []).map((m) => m.text),
    desktop: !!window.novaDesktop,
    pet: (() => {
      const kind = PETS[storage.get("petKind", "cat")] ? storage.get("petKind", "cat") : "cat";
      return { kind, animal: PETS[kind].animal, name: storage.get("petName", "") || PETS[kind].name, sound: PETS[kind].sound };
    })(),
  };
}

/** One streamed model turn. Resolves with { content, stop_reason, stop_details }. */
async function streamTurn(messages, { onEvent, signal }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context: clientContext() }),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.code === "no_key") throw new NoKeyError(data.error);
    throw new Error(data.error || `The server returned ${res.status}.`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = chunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      const event = JSON.parse(data);
      if (event.type === "error") {
        const message = event.error?.message || "The AI request failed.";
        throw event.error?.code === "auth" ? new BadKeyError(message) : new Error(message);
      }
      if (event.type === "done") final = event.message;
      else onEvent(event);
    }
  }
  if (!final) throw new Error("The connection ended before the answer finished.");
  return final;
}

export class Conversation {
  constructor() {
    this.history = []; // Claude-format messages, appended to and never edited
  }

  reset() {
    this.history = [];
  }

  /**
   * Sends one user turn and keeps going until Claude is done with its tool calls.
   * callbacks: onText(delta), onStatus(text), onReset(), onRound(), runTool(name, input) -> { content, isError }
   */
  async send(content, { onText, onStatus, onReset, onRound, runTool, signal }) {
    const checkpoint = this.history.length;
    this.history.push({ role: "user", content });
    try {
      for (let round = 0; round < 15; round++) {
        if (round > 0) onRound?.();
        const message = await streamTurn(this.history, {
          signal,
          onEvent: (event) => {
            if (event.type === "text") onText(event.text);
            else if (event.type === "status") onStatus(event.text);
            else if (event.type === "reset") onReset();
          },
        });

        if (message.stop_reason === "refusal") {
          // Roll the conversation back so the declined turn doesn't linger in the history.
          this.history.length = checkpoint;
          return { refused: true, message };
        }

        this.history.push({ role: "assistant", content: message.content });
        if (message.stop_reason === "pause_turn") continue; // a long server-side search: let it continue

        const toolUses = message.content.filter((b) => b.type === "tool_use");
        if (!toolUses.length) return { message };

        // Every tool_use needs a tool_result in the next user message, all in one message.
        const results = [];
        for (const use of toolUses) {
          if (message.stop_reason !== "tool_use") {
            results.push({
              type: "tool_result",
              tool_use_id: use.id,
              is_error: true,
              content: "Not run: the response was cut off before this tool call was complete.",
            });
            continue;
          }
          const result = await runTool(use.name, use.input);
          results.push({ type: "tool_result", tool_use_id: use.id, content: result.content, ...(result.isError ? { is_error: true } : {}) });
        }
        this.history.push({ role: "user", content: results });
      }
      return { message: null, note: "Stopped after many steps." };
    } catch (err) {
      this.history.length = checkpoint; // keep the history valid (no dangling tool calls)
      throw err;
    }
  }
}
