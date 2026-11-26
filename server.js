// Nova: an AI assistant web app. Run with `npm start`, then open http://localhost:3000
// The desktop app (desktop/main.js) starts this same server inside Electron.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { handleChat, getModel } from "./lib/assistant.js";
import * as services from "./lib/services.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function isLoopback(req) {
  const addr = req.socket.remoteAddress || "";
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * Starts the Nova server.
 * envFile: where the API key is read from and saved to.
 * Resolves with { server, port, url }.
 */
export async function startServer({
  port = Number(process.env.PORT) || 3000,
  host = process.env.HOST || "127.0.0.1",
  envFile = path.join(here, ".env"),
  log = true,
} = {}) {
  try {
    process.loadEnvFile(envFile); // never overrides variables that are already set
  } catch {
    // No .env file: fine, the key can come from the environment or the Settings dialog.
  }

  let client = null;
  const getClient = () => {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
    client ??= new Anthropic();
    return client;
  };

  const saveKeyToEnvFile = (key) => {
    let text = "";
    try {
      text = fs.readFileSync(envFile, "utf8");
    } catch {
      // creating it
    }
    const line = `ANTHROPIC_API_KEY=${key}`;
    text = /^ANTHROPIC_API_KEY=.*$/m.test(text)
      ? text.replace(/^ANTHROPIC_API_KEY=.*$/m, line)
      : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`;
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    fs.writeFileSync(envFile, text, { mode: 0o600 });
  };

  const removeKeyFromEnvFile = () => {
    try {
      const text = fs.readFileSync(envFile, "utf8");
      fs.writeFileSync(envFile, text.replace(/^ANTHROPIC_API_KEY=.*(\r?\n|$)/gm, ""), { mode: 0o600 });
    } catch {
      // no file: nothing saved
    }
  };

  const app = express();
  app.disable("x-powered-by");

  // When only listening on this computer, refuse requests addressed to any other host name.
  // This blocks DNS-rebinding tricks where a web page reaches the local server under its own domain.
  const loopbackOnly = LOOPBACK_HOSTS.has(host);
  app.use((req, res, next) => {
    if (!loopbackOnly) return next();
    const hostname = (req.headers.host || "").replace(/:\d+$/, "");
    if (LOOPBACK_HOSTS.has(hostname)) return next();
    res.status(403).send("Forbidden");
  });

  app.use(express.json({ limit: "40mb" }));
  app.use(express.static(path.join(here, "public")));

  app.get("/api/status", (req, res) => {
    res.json({ ai: !!getClient(), model: getModel(), canConfigure: isLoopback(req) });
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

  // "Remove key" in Settings: forget the saved key, back to offline mode.
  app.delete("/api/config", (req, res) => {
    if (!isLoopback(req)) {
      res.status(403).json({ error: "The API key can only be changed from this computer." });
      return;
    }
    removeKeyFromEnvFile();
    delete process.env.ANTHROPIC_API_KEY;
    client = null;
    res.json({ ai: !!getClient() });
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
  const route = (handler) => async (req, res) => {
    try {
      res.json(await handler(req));
    } catch (err) {
      console.error(`[${req.path}]`, err.message);
      res.status(502).json({ error: "That service isn't reachable right now. Check your internet connection." });
    }
  };
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
  app.get(
    "/api/currency",
    route((req) =>
      services.currency({
        amount: Number.isFinite(Number(req.query.amount)) ? Number(req.query.amount) : 1,
        from: text(req.query.from, 3).toUpperCase(),
        to: text(req.query.to, 3).toUpperCase(),
      }),
    ),
  );
  app.get("/api/music/radio", route((req) => (text(req.query.q) ? services.radio(text(req.query.q, 80)) : { stations: [] })));

  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const actualPort = server.address().port;
  const shown = host === "0.0.0.0" || host === "::" ? "localhost" : host;
  const url = `http://${shown}:${actualPort}`;

  if (log) {
    console.log(`\n  Nova is running at ${url}\n`);
    console.log(
      getClient()
        ? `  AI brain: ${getModel()}`
        : "  AI brain: off (offline commands only). Add your Anthropic API key in Settings or in .env to unlock everything.",
    );
    console.log("");
  }
  return { server, port: actualPort, url };
}

// `node server.js` starts the web version.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((err) => {
    console.error(err.code === "EADDRINUSE" ? `Port ${err.port} is already in use. Set PORT to another number.` : err.message);
    process.exit(1);
  });
}
