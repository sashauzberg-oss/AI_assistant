// Claude integration: system prompt, tool definitions and the streaming /api/chat handler.
//
// The browser owns the conversation history and runs the tool loop, because every
// custom tool (music, timers, screen capture, ...) executes in the user's browser.
// Each POST to /api/chat is one Messages API call, streamed back as server-sent events.
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = process.env.AI_EFFORT || "medium";

const SYSTEM_PROMPT = `You are Nova, a friendly and capable AI assistant that runs in a web app on the user's computer. You can talk about anything, and you can also control the app through tools:
- play_music / music_control: the built-in music player (radio stations for any genre or mood, 30-second previews for specific artists and songs, and offline generated music as a fallback).
- capture_screen: takes a screenshot of the user's screen, or of a region they select.
- set_timer / cancel_timers, get_current_time, get_weather, notes, open_url, copy_to_clipboard, set_theme.
- web_search / web_fetch: look things up online.

How to behave:
- Act instead of explaining. When a tool can do what the user asked, call it right away rather than describing how they could do it themselves. "music" or "play something" means call play_music. Never claim you can't play music, set timers, open websites, or see the screen: you can.
- When the user says "answer this", "solve this", "what's this", or otherwise points at something on their screen, read the attached screenshot (call capture_screen if no image is attached). Find the question and answer it directly: lead with the answer (for multiple choice, give the letter and the option text), then add a short explanation. If several questions are visible, answer each one. If the image is unreadable or contains no question, say what you see and ask what they need.
- Keep replies short and conversational, since they may be read aloud. A few sentences is usually right; go longer only when the user asks for detail or the task needs it (code, writing, step-by-step math).
- The app renders basic Markdown (bold, italics, lists, headings, links, code blocks) but not LaTeX. Write math in plain text or Unicode, such as x², √2, ≤, π.
- After a tool runs, confirm in a few words. The app already shows a card with the details, so don't repeat them.
- Use web_search for news, live scores, prices, recent events, or any fact you're unsure of. Don't invent facts.`;

// Tools that run in the browser. The browser validates each input before running it.
const CLIENT_TOOLS = [
  {
    name: "play_music",
    description:
      "Play music in the app's built-in player. Handles genres and moods ('jazz', 'chill', 'focus', 'christmas', 'workout'), artists or songs ('Daft Punk', 'Bohemian Rhapsody by Queen', which plays a queue of 30-second previews), and named radio stations. Pass an empty query for general background music.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to play: a genre, mood, artist, song or station. Empty string for general background music.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "music_control",
    description: "Control the music player: pause, resume, stop, skip to the next track or station, or set the volume.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["pause", "resume", "stop", "next", "volume"] },
        volume: { type: "integer", minimum: 0, maximum: 100, description: "Volume percentage, only for action 'volume'." },
      },
      required: ["action"],
    },
  },
  {
    name: "capture_screen",
    description:
      "Take a screenshot of the user's screen (they may drag to select a region) and return it as an image. Use it when the user refers to something on their screen and no image is attached. The user may be asked to pick a window to share.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "set_timer",
    description:
      "Start a countdown timer or reminder. An alarm sounds and a notification appears when it ends. Give either 'seconds' from now or 'at', a 24-hour local clock time such as '07:30'.",
    input_schema: {
      type: "object",
      properties: {
        seconds: { type: "integer", minimum: 1, description: "Duration in seconds." },
        at: { type: "string", description: "Local time in 24-hour HH:MM format, for alarms and 'remind me at ...'." },
        label: { type: "string", description: "Short label shown when the timer ends, such as 'Pasta' or 'Call mom'." },
      },
    },
  },
  {
    name: "cancel_timers",
    description: "Cancel running timers. With a label, cancels only timers whose label contains it; otherwise cancels all of them.",
    input_schema: {
      type: "object",
      properties: { label: { type: "string" } },
    },
  },
  {
    name: "get_current_time",
    description: "Get the user's current local date, time and time zone.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_weather",
    description: "Get current weather and a 4-day forecast. Use an empty location for the user's current location.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name such as 'Paris' or 'Austin, Texas'. Empty string for the user's location." },
      },
      required: ["location"],
    },
  },
  {
    name: "open_url",
    description:
      "Open a web page for the user in a new tab, such as YouTube search results, Google Maps directions, or a site they named. If the browser blocks the pop-up, a clickable link is shown instead.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full http(s) URL." },
        label: { type: "string", description: "Short description of the page." },
      },
      required: ["url"],
    },
  },
  {
    name: "notes",
    description: "Manage the user's saved notes and to-do list, which persist in this browser.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["add", "list", "remove", "clear"] },
        text: { type: "string", description: "Note text, for 'add'." },
        index: { type: "integer", minimum: 1, description: "1-based note number, for 'remove'." },
      },
      required: ["action"],
    },
  },
  {
    name: "copy_to_clipboard",
    description: "Copy text to the user's clipboard so they can paste it elsewhere.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "set_theme",
    description: "Switch the app between light and dark mode, or follow the system setting.",
    input_schema: {
      type: "object",
      properties: { theme: { type: "string", enum: ["light", "dark", "system"] } },
      required: ["theme"],
    },
  },
].map((tool) => ({ ...tool, eager_input_streaming: true }));

const SERVER_TOOLS = [
  { type: "web_search_20260209", name: "web_search", max_uses: 5 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
];

export const TOOLS = [...CLIENT_TOOLS, ...SERVER_TOOLS];

const TOOL_STATUS = {
  play_music: "Finding music…",
  music_control: "Controlling the player…",
  capture_screen: "Looking at your screen…",
  set_timer: "Setting a timer…",
  cancel_timers: "Cancelling timers…",
  get_current_time: "Checking the time…",
  get_weather: "Checking the weather…",
  open_url: "Opening a page…",
  notes: "Updating notes…",
  copy_to_clipboard: "Copying…",
  set_theme: "Changing the theme…",
};

function clean(value, max) {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").slice(0, max) : "";
}

function buildSystem(context = {}) {
  const lines = [];
  const date = clean(context.date, 80);
  const timezone = clean(context.timezone, 80);
  const locale = clean(context.locale, 20);
  if (date) lines.push(`Today's date: ${date}.`);
  if (timezone) lines.push(`User's time zone: ${timezone}.`);
  if (locale) lines.push(`User's locale: ${locale}.`);
  const system = [{ type: "text", text: SYSTEM_PROMPT }];
  if (lines.length) system.push({ type: "text", text: lines.join(" ") });
  return system;
}

// After a mid-output fallback, the blocks the declined model produced before the last
// `fallback` block must not be echoed back except text and paired server-tool blocks.
// Their tool calls were never meant to run, so drop them here before the browser sees them.
export function effectiveContent(content) {
  const boundary = content.findLastIndex((block) => block.type === "fallback");
  if (boundary === -1) return content;
  const before = content.slice(0, boundary);
  const useIds = new Set(before.filter((b) => b.type === "server_tool_use").map((b) => b.id));
  const resultIds = new Set(
    before.filter((b) => b.type !== "tool_result" && b.type.endsWith("_tool_result")).map((b) => b.tool_use_id),
  );
  const kept = before.filter((block) => {
    if (block.type === "text") return true;
    if (block.type === "server_tool_use") return resultIds.has(block.id);
    if (block.type.endsWith("_tool_result")) return useIds.has(block.tool_use_id) && resultIds.has(block.tool_use_id);
    return false; // thinking, redacted_thinking, tool_use and other model-internal blocks
  });
  return [...kept, ...content.slice(boundary)];
}

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return { message: "Your Anthropic API key was rejected. Check it in Settings (gear icon).", code: "auth" };
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return { message: "This API key doesn't have access to that model.", code: "permission" };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { message: "Rate limited by the API. Wait a moment and try again.", code: "rate_limit" };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return { message: `The API rejected the request: ${err.message}`, code: "bad_request" };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { message: "Couldn't reach the Anthropic API. Check your internet connection.", code: "connection" };
  }
  if (err instanceof Anthropic.APIError) {
    return { message: `API error${err.status ? ` ${err.status}` : ""}: ${err.message}`, code: "api" };
  }
  return { message: err?.message || "Something went wrong.", code: "unknown" };
}

export async function handleChat(client, body, res) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) {
    res.status(400).json({ error: "messages must be a non-empty array" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const heartbeat = setInterval(() => !res.writableEnded && res.write(": ping\n\n"), 15000);

  let current = null;
  let clientGone = false;
  res.on("close", () => {
    clientGone = true;
    current?.abort();
  });

  const params = {
    model: MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT },
    cache_control: { type: "ephemeral" },
    system: buildSystem(body.context),
    tools: TOOLS,
    messages,
  };

  try {
    for (let attempt = 0; ; attempt++) {
      const stream = client.beta.messages.stream(params);
      current = stream;
      stream.on("text", (delta) => send({ type: "text", text: delta }));
      stream.on("streamEvent", (event) => {
        if (event.type !== "content_block_start") return;
        const block = event.content_block;
        if (block.type === "server_tool_use") {
          send({ type: "status", text: block.name === "web_fetch" ? "Reading a web page…" : "Searching the web…" });
        } else if (block.type === "tool_use") {
          send({ type: "status", text: TOOL_STATUS[block.name] || "Working…" });
        } else if (block.type === "thinking") {
          send({ type: "status", text: "Thinking…" });
        }
      });

      try {
        const message = await stream.finalMessage();
        send({
          type: "done",
          message: {
            content: effectiveContent(message.content),
            stop_reason: message.stop_reason,
            stop_details: message.stop_details ?? null,
            model: message.model,
          },
        });
        break;
      } catch (err) {
        if (clientGone) break;
        // A tool input that could not be parsed, or a connection dropped mid-stream:
        // re-issue the same request (the browser clears the partial text on "reset").
        if (!(err instanceof Anthropic.APIError) && attempt < 2) {
          send({ type: "reset" });
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    if (!clientGone) {
      console.error("[chat]", err?.message || err);
      send({ type: "error", error: describeError(err) });
    }
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
}
