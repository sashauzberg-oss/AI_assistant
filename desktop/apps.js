// Opens apps installed on the computer by name ("calculator", "Spotify", "Discord").
// Commands are run directly (never through a shell) and names are checked first,
// so a name can't smuggle in other commands.
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { shell } from "electron";

const SAFE_NAME = /^[\p{L}\p{N} .'+_&-]{1,60}$/u;

const ALIASES = {
  win32: {
    calculator: "calc.exe", calc: "calc.exe", notepad: "notepad.exe", "text editor": "notepad.exe", paint: "mspaint.exe",
    "file explorer": "explorer.exe", explorer: "explorer.exe", files: "explorer.exe", "my files": "explorer.exe",
    "task manager": "taskmgr.exe", "command prompt": "cmd.exe", cmd: "cmd.exe", terminal: "cmd.exe", powershell: "powershell.exe",
    "control panel": "control.exe", settings: "ms-settings:", "windows settings": "ms-settings:", camera: "microsoft.windows.camera:",
    clock: "ms-clock:", alarms: "ms-clock:", "microsoft store": "ms-windows-store:", store: "ms-windows-store:",
    "snipping tool": "ms-screenclip:", calendar: "outlookcal:", mail: "outlookmail:",
  },
  darwin: {
    calculator: "Calculator", calc: "Calculator", notepad: "TextEdit", "text editor": "TextEdit", "file explorer": "Finder",
    explorer: "Finder", files: "Finder", settings: "System Settings", "system preferences": "System Settings",
    terminal: "Terminal", "task manager": "Activity Monitor", camera: "Photo Booth", clock: "Clock", calendar: "Calendar",
    mail: "Mail", notes: "Notes", music: "Music", photos: "Photos", messages: "Messages", "app store": "App Store", store: "App Store",
  },
  linux: {
    calculator: ["gnome-calculator", "kcalc", "galculator", "mate-calc", "xcalc"],
    notepad: ["gnome-text-editor", "gedit", "kate", "mousepad", "xed", "pluma", "kwrite"],
    "file explorer": ["nautilus", "dolphin", "thunar", "nemo", "pcmanfm", "caja"],
    terminal: ["x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "tilix", "xterm"],
    settings: ["gnome-control-center", "systemsettings", "xfce4-settings-manager", "cinnamon-settings"],
    "task manager": ["gnome-system-monitor", "plasma-systemmonitor", "ksysguard", "xfce4-taskmanager"],
  },
};
ALIASES.linux.calc = ALIASES.linux.calculator;
ALIASES.linux["text editor"] = ALIASES.linux.notepad;
ALIASES.linux.files = ALIASES.linux["file explorer"];
ALIASES.linux.explorer = ALIASES.linux["file explorer"];

const run = (cmd, args) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout: 20000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => (err ? reject(err) : resolve(stdout))),
  );

function launch(cmd, args = []) {
  const child = spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: false });
  child.on("error", () => {});
  child.unref();
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** Best name match: exact, then starts-with, then contains (shortest wins). */
export function bestMatch(items, query, getName = (x) => x.name) {
  const q = query.toLowerCase().trim();
  const named = items.map((item) => ({ item, name: getName(item).toLowerCase() }));
  const exact = named.find((n) => n.name === q);
  if (exact) return exact.item;
  const pick = (list) => list.sort((a, b) => a.name.length - b.name.length)[0]?.item;
  return (
    pick(named.filter((n) => n.name.startsWith(q))) ||
    pick(named.filter((n) => new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(n.name))) ||
    null
  );
}

// ---------- Windows: everything in the Start menu ----------

let startAppsCache = null;
async function startApps() {
  if (startAppsCache && Date.now() - startAppsCache.at < 10 * 60 * 1000) return startAppsCache.list;
  const out = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress"]);
  const parsed = JSON.parse(out || "[]");
  const list = (Array.isArray(parsed) ? parsed : [parsed]).filter((a) => a?.Name && a?.AppID);
  startAppsCache = { at: Date.now(), list };
  return list;
}

async function openWindows(name) {
  const alias = ALIASES.win32[name.toLowerCase()];
  if (alias) {
    if (alias.endsWith(":")) await shell.openExternal(alias);
    else launch(alias);
    return { ok: true, name: titleCase(name) };
  }
  const match = bestMatch(await startApps(), name, (a) => a.Name);
  if (!match) return { ok: false, error: `I couldn't find an app called “${name}” on this computer.` };
  launch("explorer.exe", [`shell:AppsFolder\\${match.AppID}`]);
  return { ok: true, name: match.Name };
}

// ---------- macOS ----------

async function openMac(name) {
  const app = ALIASES.darwin[name.toLowerCase()] || name;
  try {
    await run("open", ["-a", app]);
    return { ok: true, name: app };
  } catch {
    return { ok: false, error: `I couldn't find an app called “${name}” on this Mac.` };
  }
}

// ---------- Linux ----------

function onPath(bin) {
  return (process.env.PATH || "").split(path.delimiter).some((dir) => {
    try {
      fs.accessSync(path.join(dir, bin), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

const DESKTOP_DIRS = [
  path.join(os.homedir(), ".local/share/applications"),
  "/usr/local/share/applications",
  "/usr/share/applications",
  "/var/lib/flatpak/exports/share/applications",
  path.join(os.homedir(), ".local/share/flatpak/exports/share/applications"),
  "/var/lib/snapd/desktop/applications",
];

function desktopEntries() {
  const entries = [];
  for (const dir of DESKTOP_DIRS) {
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".desktop"));
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        const text = fs.readFileSync(path.join(dir, file), "utf8");
        const section = text.split(/^\[/m).find((s) => s.startsWith("Desktop Entry]")) || "";
        const get = (key) => section.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();
        if (get("NoDisplay") === "true" || get("Type") !== "Application" || !get("Name") || !get("Exec")) continue;
        entries.push({ id: file.replace(/\.desktop$/, ""), name: get("Name"), exec: get("Exec") });
      } catch {
        // unreadable entry
      }
    }
  }
  return entries;
}

function splitExec(exec) {
  const args = [];
  for (const m of exec.matchAll(/"((?:[^"\\]|\\.)*)"|(\S+)/g)) {
    const arg = m[1] !== undefined ? m[1].replace(/\\(.)/g, "$1") : m[2];
    if (!/^%[a-zA-Z]$/.test(arg)) args.push(arg.replace(/%[fFuUick]/g, ""));
  }
  return args.filter(Boolean);
}

async function openLinux(name) {
  const candidates = ALIASES.linux[name.toLowerCase()];
  if (candidates) {
    const bin = candidates.find(onPath);
    if (bin) {
      launch(bin);
      return { ok: true, name: titleCase(name) };
    }
  }
  const entry = bestMatch(desktopEntries(), name);
  if (!entry) return { ok: false, error: `I couldn't find an app called “${name}” on this computer.` };
  if (onPath("gtk-launch")) launch("gtk-launch", [entry.id]);
  else {
    const [cmd, ...args] = splitExec(entry.exec);
    launch(cmd, args);
  }
  return { ok: true, name: entry.name };
}

export async function openApp(rawName) {
  const name = String(rawName || "").trim().replace(/^(the|my)\s+/i, "").replace(/\s+app$/i, "");
  if (!SAFE_NAME.test(name)) return { ok: false, error: "That doesn't look like an app name." };
  try {
    if (process.platform === "win32") return await openWindows(name);
    if (process.platform === "darwin") return await openMac(name);
    return await openLinux(name);
  } catch (err) {
    return { ok: false, error: `Couldn't open ${name}: ${err.message}` };
  }
}
