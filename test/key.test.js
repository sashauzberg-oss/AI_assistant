// Removing the API key in Settings, and what happens when a saved key stops working.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nova-key-"));
const envFile = path.join(dir, ".env");
let mock;
let server;
let url;

before(async () => {
  // A fake Anthropic API that rejects every key, like a key that was deleted.
  mock = http.createServer((req, res) => {
    req.resume();
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
  });
  mock.listen(0, "127.0.0.1");
  await once(mock, "listening");
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${mock.address().port}`;
  fs.writeFileSync(envFile, "HOME_CITY=Paris\nANTHROPIC_API_KEY=sk-ant-test-deleted-000000000000\nAI_EFFORT=low\n");
  const { startServer } = await import("../server.js");
  ({ server, url } = await startServer({ port: 0, host: "127.0.0.1", envFile, log: false }));
});

after(() => {
  server?.close();
  mock?.close();
});

const status = async () => (await (await fetch(`${url}/api/status`)).json()).ai;

test("a key that stopped working gets a friendly message (and the app falls back to offline)", async () => {
  const res = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], context: {} }),
  });
  const events = (await res.text())
    .split("\n\n")
    .map((chunk) => chunk.split("\n").find((l) => l.startsWith("data:")))
    .filter(Boolean)
    .map((line) => JSON.parse(line.slice(5)));
  const error = events.find((e) => e.type === "error")?.error;
  assert.equal(error?.code, "auth");
  assert.match(error.message, /doesn't work anymore/);
  assert.match(error.message, /remove it/);
});

test("only this computer can remove the key", async () => {
  const code = await new Promise((resolve, reject) => {
    const req = http.request(`${url}/api/config`, { method: "DELETE", headers: { Host: "evil.example" } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("error", reject);
    req.end();
  });
  assert.equal(code, 403);
  assert.equal(await status(), true, "still there");
});

test("'Remove key' forgets the saved key and leaves the rest of the settings file alone", async () => {
  assert.equal(await status(), true);
  const res = await fetch(`${url}/api/config`, { method: "DELETE" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ai: false });
  assert.equal(await status(), false, "offline mode now");
  const saved = fs.readFileSync(envFile, "utf8");
  assert.doesNotMatch(saved, /ANTHROPIC_API_KEY/);
  assert.match(saved, /HOME_CITY=Paris/);
  assert.match(saved, /AI_EFFORT=low/);
  const chat = await fetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) });
  assert.equal((await chat.json()).code, "no_key");
});
