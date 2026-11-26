// Runs the real server against a fake Anthropic API, to check the streaming /api/chat
// endpoint end to end: request shape, text streaming, tool calls, retries and fallbacks.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

const sse = (events) => events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
const start = (id = "msg_test") => ({
  type: "message_start",
  message: { id, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 12, output_tokens: 1 } },
});
const end = (stop_reason) => [
  { type: "message_delta", delta: { stop_reason, stop_sequence: null }, usage: { output_tokens: 30 } },
  { type: "message_stop" },
];
const textBlock = (index, text) => [
  { type: "content_block_start", index, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index, delta: { type: "text_delta", text } },
  { type: "content_block_stop", index },
];
const toolBlock = (index, id, name, json) => [
  { type: "content_block_start", index, content_block: { type: "tool_use", id, name, input: {} } },
  ...json.map((partial_json) => ({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json } })),
  { type: "content_block_stop", index },
];
const thinkingBlock = (index) => [
  { type: "content_block_start", index, content_block: { type: "thinking", thinking: "", signature: "" } },
  { type: "content_block_delta", index, delta: { type: "signature_delta", signature: "sig123" } },
  { type: "content_block_stop", index },
];

const scripts = {
  music: () => sse([start(), ...textBlock(0, "Sure, "), ...toolBlock(1, "toolu_1", "play_music", ['{"query": "ja', 'zz"}']), ...end("tool_use")]),
  // First attempt sends tool JSON the SDK can't parse; the server should retry.
  broken: (attempt) =>
    attempt === 1
      ? sse([start(), ...toolBlock(0, "toolu_x", "play_music", ['{"query": ]]]']), ...end("tool_use")])
      : sse([start(), ...textBlock(0, "Recovered."), ...end("end_turn")]),
  // A mid-output fallback: the declined partial's thinking and tool call must be dropped.
  fallback: () =>
    sse([
      start(),
      ...thinkingBlock(0),
      ...textBlock(1, "Partial "),
      ...toolBlock(2, "toolu_declined", "open_url", ['{"url": "https://example.com"}']),
      { type: "content_block_start", index: 3, content_block: { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-5" } } },
      { type: "content_block_stop", index: 3 },
      ...textBlock(4, "answer."),
      ...end("end_turn"),
    ]),
};

let mock;
let app;
let appUrl;
const requests = [];
let attempts = 0;

before(async () => {
  mock = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const json = JSON.parse(body || "{}");
    requests.push({ url: req.url, headers: req.headers, body: json });
    const last = json.messages?.at(-1)?.content;
    const scenario = typeof last === "string" ? last : "music";
    attempts++;
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end(scripts[scenario](attempts));
  });
  mock.listen(0, "127.0.0.1");
  await once(mock, "listening");

  const port = 30000 + Math.floor(Math.random() * 20000);
  appUrl = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", ANTHROPIC_API_KEY: "sk-ant-test-key-000000000000", ANTHROPIC_BASE_URL: `http://127.0.0.1:${mock.address().port}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  app.stdout.on("data", (d) => (output += d));
  app.stderr.on("data", (d) => (output += d));
  for (let i = 0; i < 100 && !output.includes("running at"); i++) await new Promise((r) => setTimeout(r, 50));
  assert.match(output, /running at/);
});

after(() => {
  app?.kill();
  mock?.close();
});

async function chat(content, extraContext = {}) {
  const res = await fetch(`${appUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content }], context: { date: "Tuesday, November 24, 2026", timezone: "Europe/Berlin", locale: "en-US", ...extraContext } }),
  });
  assert.equal(res.status, 200);
  const text = await res.text();
  return text
    .split("\n\n")
    .map((chunk) => chunk.split("\n").find((l) => l.startsWith("data:")))
    .filter(Boolean)
    .map((line) => JSON.parse(line.slice(5)));
}

test("status reports the AI as available", async () => {
  const status = await (await fetch(`${appUrl}/api/status`)).json();
  assert.equal(status.ai, true);
  assert.equal(status.model, "claude-opus-5-5");
});

test("streams text and returns tool calls for the browser to run", async () => {
  attempts = 0;
  const events = await chat("music");
  const text = events.filter((e) => e.type === "text").map((e) => e.text).join("");
  assert.equal(text, "Sure, ");
  assert.ok(events.some((e) => e.type === "status" && e.text === "Finding music…"));
  const done = events.find((e) => e.type === "done");
  assert.equal(done.message.stop_reason, "tool_use");
  const tool = done.message.content.find((b) => b.type === "tool_use");
  assert.deepEqual(tool.input, { query: "jazz" });

  const req = requests.at(-1);
  assert.match(req.url, /^\/v1\/messages/);
  assert.match(req.headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
  assert.equal(req.body.model, "claude-opus-5-5");
  assert.equal(req.body.fallbacks, "default");
  assert.equal(req.body.stream, true);
  assert.deepEqual(req.body.thinking, { type: "adaptive" });
  assert.ok(req.body.tools.some((t) => t.type === "web_search_20260209"));
  assert.ok(req.body.tools.filter((t) => !t.type).every((t) => t.eager_input_streaming === true));
  assert.ok(req.body.tools.some((t) => t.name === "tell_joke"), "jokes go on stage");
  assert.match(req.body.system.at(-1).text, /November 24, 2026/);
});

test("retries when a tool input can't be parsed", async () => {
  attempts = 0;
  const events = await chat("broken");
  assert.ok(events.some((e) => e.type === "reset"));
  const done = events.find((e) => e.type === "done");
  assert.equal(done.message.content[0].text, "Recovered.");
  assert.equal(attempts, 2);
});

test("drops the declined model's thinking and tool calls after a fallback", async () => {
  attempts = 0;
  const events = await chat("fallback");
  const done = events.find((e) => e.type === "done");
  const types = done.message.content.map((b) => b.type);
  assert.deepEqual(types, ["text", "fallback", "text"]);
  assert.equal(done.message.model, "claude-opus-5");
});

test("rejects an empty conversation", async () => {
  const res = await fetch(`${appUrl}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(res.status, 400);
});

test("desktop requests get the open_app tool, browser requests don't", async () => {
  await chat("music");
  assert.ok(!requests.at(-1).body.tools.some((t) => t.name === "open_app"));
  await chat("music", { desktop: true });
  assert.ok(requests.at(-1).body.tools.some((t) => t.name === "open_app"));
});

test("memories and home city are added to the system prompt", async () => {
  await chat("music", { memories: ["My name is Sam", 42, "I like jazz"], homeCity: "Chicago" });
  const extra = requests.at(-1).body.system.at(-1).text;
  assert.match(extra, /1\. My name is Sam\n2\. I like jazz/);
  assert.match(extra, /home city: Chicago/);
});

test("refuses requests addressed to another host name (DNS rebinding)", async () => {
  // fetch() won't send a custom Host header, so use a raw request.
  const status = await new Promise((resolve, reject) => {
    const req = http.request(`${appUrl}/api/status`, { headers: { Host: "evil.example" } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("error", reject);
    req.end();
  });
  assert.equal(status, 403);
});

test("the AI is told which pixel pet it is playing", async () => {
  await chat("music", { pet: { kind: "fox", animal: "fox", name: "Ember", sound: "Yip!" } });
  assert.match(requests.at(-1).body.system.at(-1).text, /Ember, the user's cute pixel-art fox/);
  await chat("music", { pet: { animal: "griffin", name: "Sparkle" } });
  assert.doesNotMatch(requests.at(-1).body.system.at(-1).text, /Sparkle/);
});
