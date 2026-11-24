// Nova: an AI assistant web app. Run with `npm start`, then open http://localhost:3000
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { handleChat, MODEL } from "./lib/assistant.js";
import * as services from "./lib/services.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(here, ".env");

try {
  process.loadEnvFile(ENV_FILE);
} catch {
  // No .env file: fine, the key can come from the environment or the Settings dialog.
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
  client ??= new Anthropic();
  return client;
}

function isLoopback(req) {
  const addr = req.socket.remoteAddress || "";
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function saveKeyToEnvFile(key) {
  let text = "";
  try {
    text = fs.readFileSync(ENV_FILE, "utf8");
  } catch {
    // creating it
  }
  const line = `ANTHROPIC_API_KEY=${key}`;
  text = /^ANTHROPIC_API_KEY=.*$/m.test(text)
    ? text.replace(/^ANTHROPIC_API_KEY=.*$/m, line)
    : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`;
  fs.writeFileSync(ENV_FILE, text, { mode: 0o600 });
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "40mb" }));
app.use(express.static(path.join(here, "public")));

app.get("/api/status", (req, res) => {
  res.json({ ai: !!getClient(), model: MODEL, canConfigure: isLoopback(req) });
});

app.post("/api/config", async (req, res) => {
  if (!isLoopback(req)) {
    res.status(403).json({ error: "The API key can only be changed from this computer." });
    return;
  }
  const key = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
  if (!/^[A-Za-z0-9_\-]{20,300}$/.test(key)) {
    res.status(400).json({ error: "That doesn't look like an Anthropic API key." });
    return;
  }
  try {
    await new Anthropic({ apiKey: key }).models.list({ limit: 1 });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(400).json({ error: "Anthropic rejected that key. Double-check it and try again." });
      return;
    }
    if (!(err instanceof Anthropic.APIConnectionError)) {
      res.status(400).json({ error: `Couldn't verify the key: ${err.message}` });
      return;
    }
    // Offline right now: save the key anyway, it will be used once the connection is back.
  }
  saveKeyToEnvFile(key);
  process.env.ANTHROPIC_API_KEY = key;
  client = null;
  res.json({ ai: true });
});

app.post("/api/chat", async (req, res) => {
  const anthropic = getClient();
  if (!anthropic) {
    res.status(503).json({ error: "No Anthropic API key is configured.", code: "no_key" });
    return;
  }
  await handleChat(anthropic, req.body, res);
});

// Small JSON helpers for the free web services.
function route(handler) {
  return async (req, res) => {
    try {
      res.json(await handler(req));
    } catch (err) {
      console.error(`[${req.path}]`, err.message);
      res.status(502).json({ error: "That service isn't reachable right now. Check your internet connection." });
    }
  };
}

const text = (value, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");

app.get(
  "/api/weather",
  route((req) =>
    services.weather({
      q: text(req.query.q),
      lat: req.query.lat !== undefined ? Number(req.query.lat) : NaN,
      lon: req.query.lon !== undefined ? Number(req.query.lon) : NaN,
      units: req.query.units === "imperial" ? "imperial" : "metric",
    }),
  ),
);
app.get("/api/wiki", route((req) => (text(req.query.q) ? services.wiki(text(req.query.q)) : { error: "Nothing to look up." })));
app.get("/api/define", route((req) => (text(req.query.word, 60) ? services.define(text(req.query.word, 60)) : { error: "No word given." })));
app.get("/api/music/songs", route((req) => (text(req.query.q) ? services.songs(text(req.query.q)) : { tracks: [] })));
app.get("/api/music/radio", route((req) => (text(req.query.q) ? services.radio(text(req.query.q, 80)) : { stations: [] })));

app.listen(PORT, HOST, () => {
  const shown = HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST;
  console.log(`\n  Nova is running at http://${shown}:${PORT}\n`);
  console.log(
    getClient()
      ? `  AI brain: ${MODEL}`
      : "  AI brain: off (offline commands only). Add your Anthropic API key in Settings or in .env to unlock everything.",
  );
  console.log("");
});
