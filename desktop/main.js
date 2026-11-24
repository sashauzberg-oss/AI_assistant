// Nova desktop app: the Nova web app in its own window, plus a global hotkey that snips
// any part of the screen (like the Snipping Tool) and answers the question in it.
import { app, BrowserWindow, Menu, Tray, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, nativeImage, nativeTheme, screen, session, shell, systemPreferences, Notification } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../server.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const asset = (name) => path.join(here, "assets", name);
const ui = (name) => path.join(here, "ui", name);
const isMac = process.platform === "darwin";

if (process.env.NOVA_USER_DATA) app.setPath("userData", process.env.NOVA_USER_DATA);
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// ------------------------------------------------------------------ settings

export const DEFAULT_HOTKEYS = { snip: "CommandOrControl+Shift+Space", toggle: "Alt+Shift+N" };
const DEFAULT_PORT = 47823; // fixed, so the app's saved notes and settings survive restarts

const settingsFile = () => path.join(app.getPath("userData"), "desktop-settings.json");
function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
    return { port: DEFAULT_PORT, ...saved, hotkeys: { ...DEFAULT_HOTKEYS, ...saved.hotkeys } };
  } catch {
    return { port: DEFAULT_PORT, hotkeys: { ...DEFAULT_HOTKEYS } };
  }
}
function saveSettings() {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}

let settings;
let serverUrl;
let mainWindow = null;
let rendererReady = false;
const pendingAsks = [];
let tray = null;
let popup = null;
let snipping = false;
let quitting = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------------------------------ windows

/** Keep every window on its own content: web links open in the default browser. */
function lockDown(win, allowedPrefix) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (allowedPrefix && url.startsWith(allowedPrefix)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 820,
    minWidth: 380,
    minHeight: 480,
    show: false,
    title: "Nova",
    icon: asset("icon.png"),
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0b0d14" : "#f5f6fb",
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false, // keep music and timers smooth while hidden in the tray
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  lockDown(mainWindow, serverUrl);
  mainWindow.webContents.on("did-start-loading", () => (rendererReady = false));
  mainWindow.loadURL(serverUrl);
  mainWindow.once("ready-to-show", () => {
    if (!process.argv.includes("--hidden")) mainWindow.show();
  });
  mainWindow.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow.hide();
    if (!settings.toldAboutTray && Notification.isSupported()) {
      settings.toldAboutTray = true;
      saveSettings();
      new Notification({
        title: "Nova is still running",
        body: `Press ${formatAccelerator(settings.hotkeys.snip)} anywhere to snip a question. Quit from the tray icon.`,
        icon: asset("icon.png"),
      }).show();
    }
  });
}

function showMain() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleMain() {
  if (mainWindow?.isVisible() && mainWindow.isFocused()) mainWindow.hide();
  else showMain();
}

function formatAccelerator(accel = "") {
  return accel
    .split("+")
    .map((part) => {
      if (part === "CommandOrControl" || part === "CmdOrCtrl") return isMac ? "⌘" : "Ctrl";
      if (part === "Alt" || part === "Option") return isMac ? "⌥" : "Alt";
      if (part === "Shift") return isMac ? "⇧" : "Shift";
      return part;
    })
    .join(isMac ? "" : "+");
}

// ------------------------------------------------------------------ screen capture

async function captureDisplay() {
  if (isMac && systemPreferences.getMediaAccessStatus("screen") === "denied") {
    const { response } = await dialog.showMessageBox({
      type: "info",
      message: "Nova needs permission to see your screen",
      detail: "Open System Settings › Privacy & Security › Screen Recording, turn on Nova, then restart Nova.",
      buttons: ["Open System Settings", "Cancel"],
    });
    if (response === 0) shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
    return null;
  }
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const scale = display.scaleFactor || 1;
  const thumbnailSize = { width: Math.round(display.size.width * scale), height: Math.round(display.size.height * scale) };
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize });
  const index = screen.getAllDisplays().findIndex((d) => d.id === display.id);
  const source = sources.find((s) => s.display_id === String(display.id)) || sources[index] || sources[0];
  if (!source || source.thumbnail.isEmpty()) throw new Error("Couldn't capture the screen.");
  return { display, image: source.thumbnail };
}

/** Full-screen overlay showing the frozen screenshot; resolves a rectangle (DIPs), "full" or null. */
function selectRegion(display, image) {
  return new Promise((resolve) => {
    const overlay = new BrowserWindow({
      ...display.bounds,
      frame: false,
      show: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      enableLargerThanScreen: true,
      backgroundColor: "#000000",
      webPreferences: { preload: path.join(here, "overlay-preload.cjs"), contextIsolation: true, sandbox: true },
    });
    overlay.setAlwaysOnTop(true, "screen-saver");
    if (isMac) overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    lockDown(overlay);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener("overlay:result", onResult);
      ipcMain.removeListener("overlay:ready", onReady);
      if (!overlay.isDestroyed()) overlay.destroy();
      resolve(value);
    };
    const onReady = (event) => {
      if (event.sender !== overlay.webContents) return;
      overlay.setBounds(display.bounds);
      overlay.show();
      overlay.focus();
    };
    const onResult = (event, value) => {
      if (event.sender !== overlay.webContents) return;
      if (value === "full") return finish("full");
      const ok = value && ["x", "y", "width", "height"].every((k) => Number.isFinite(value[k]));
      if (!ok || value.width < 4 || value.height < 4) return finish(null);
      const x = Math.max(0, Math.min(display.bounds.width, value.x));
      const y = Math.max(0, Math.min(display.bounds.height, value.y));
      finish({
        x,
        y,
        width: Math.min(display.bounds.width - x, value.width),
        height: Math.min(display.bounds.height - y, value.height),
      });
    };
    ipcMain.on("overlay:ready", onReady);
    ipcMain.on("overlay:result", onResult);
    overlay.on("closed", () => finish(null));
    overlay.webContents.once("did-finish-load", () => {
      overlay.webContents.send("overlay:image", `data:image/jpeg;base64,${image.toJPEG(92).toString("base64")}`);
    });
    overlay.loadFile(ui("overlay.html"));
  });
}

function encode(image) {
  let img = image;
  const { width, height } = img.getSize();
  const maxSide = 2000;
  if (Math.max(width, height) > maxSide) {
    img = width >= height ? img.resize({ width: maxSide, quality: "best" }) : img.resize({ height: maxSide, quality: "best" });
  }
  const data = img.toJPEG(90).toString("base64");
  const size = img.getSize();
  return { dataUrl: `data:image/jpeg;base64,${data}`, mediaType: "image/jpeg", data, width: size.width, height: size.height };
}

/**
 * Takes a snip. Hides Nova first when Nova itself is in front, so it isn't in the picture.
 * Resolves { image, rect } (rect in screen coordinates) or null if cancelled.
 */
export async function snip({ hideNova = false } = {}) {
  if (snipping) return null;
  snipping = true;
  const restoreNova = hideNova && mainWindow?.isVisible();
  try {
    if (popup) {
      popup.destroy();
      popup = null;
    }
    if (restoreNova) {
      mainWindow.hide();
      await sleep(isMac ? 350 : 250); // let the window finish disappearing
    }
    const captured = await captureDisplay();
    if (!captured) return null;
    const { display, image } = captured;
    const region = await selectRegion(display, image);
    if (!region) return null;
    if (region === "full") return { image: encode(image), rect: display.bounds };
    const scale = image.getSize().width / display.bounds.width;
    const cropped = image.crop({
      x: Math.round(region.x * scale),
      y: Math.round(region.y * scale),
      width: Math.max(1, Math.round(region.width * scale)),
      height: Math.max(1, Math.round(region.height * scale)),
    });
    return {
      image: encode(cropped),
      rect: { x: display.bounds.x + region.x, y: display.bounds.y + region.y, width: region.width, height: region.height },
    };
  } catch (err) {
    dialog.showErrorBox("Nova couldn't capture the screen", err.message);
    return null;
  } finally {
    snipping = false;
    if (restoreNova) showMain();
  }
}

// ------------------------------------------------------------------ answer bubble

function openPopup(shot) {
  if (popup) popup.destroy();
  const area = screen.getDisplayMatching(shot.rect).workArea;
  const width = 420;
  const height = 240;
  let x = shot.rect.x + shot.rect.width + 14;
  if (x + width > area.x + area.width) x = shot.rect.x - width - 14;
  if (x < area.x) x = area.x + area.width - width - 16;
  const y = Math.round(Math.max(area.y + 12, Math.min(shot.rect.y, area.y + area.height - height - 12)));

  popup = new BrowserWindow({
    x: Math.round(x),
    y,
    width,
    height,
    minWidth: 300,
    minHeight: 140,
    frame: false,
    show: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: "Nova answer",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#141824" : "#ffffff",
    webPreferences: { preload: path.join(here, "popup-preload.cjs"), contextIsolation: true, sandbox: true },
  });
  popup.setAlwaysOnTop(true, "floating");
  lockDown(popup);
  const win = popup;
  win.webContents.once("did-finish-load", () => {
    win.webContents.send("popup:init", { thumb: shot.image.dataUrl, hotkey: formatAccelerator(settings.hotkeys.snip) });
    win.show();
  });
  win.on("closed", () => {
    if (popup === win) popup = null;
  });
  win.loadFile(ui("popup.html"));
}

/** The global hotkey: snip, show the answer bubble, and ask Nova. */
export async function snipAndAnswer() {
  const shot = await snip({ hideNova: !!mainWindow?.isFocused() });
  if (!shot) return;
  openPopup(shot);
  const payload = { image: shot.image, prompt: "Answer this" };
  if (rendererReady) mainWindow.webContents.send("nova:ask-image", payload);
  else pendingAsks.push(payload);
}

// ------------------------------------------------------------------ hotkeys, tray, IPC

const HOTKEY_ACTIONS = { snip: () => snipAndAnswer(), toggle: () => toggleMain() };

function registerHotkeys(hotkeys) {
  globalShortcut.unregisterAll();
  const errors = {};
  for (const [name, accel] of Object.entries(hotkeys)) {
    if (!accel || !HOTKEY_ACTIONS[name]) continue;
    try {
      if (!globalShortcut.register(accel, HOTKEY_ACTIONS[name])) errors[name] = `${formatAccelerator(accel)} is already used by another app.`;
    } catch {
      errors[name] = `“${accel}” isn't a valid shortcut.`;
    }
  }
  return errors;
}

function buildTrayMenu() {
  const items = [
    { label: "Show Nova", accelerator: settings.hotkeys.toggle || undefined, click: showMain },
    { label: "Snip & answer", accelerator: settings.hotkeys.snip || undefined, click: () => snipAndAnswer() },
    { type: "separator" },
  ];
  if (process.platform === "win32" || isMac) {
    items.push({
      label: "Start Nova when I sign in",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => setOpenAtLogin(item.checked),
    });
    items.push({ type: "separator" });
  }
  items.push({ label: "Quit Nova", click: () => { quitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(`Nova: press ${formatAccelerator(settings.hotkeys.snip)} to snip & answer`);
}

function setOpenAtLogin(on) {
  app.setLoginItemSettings({ openAtLogin: on, openAsHidden: true, args: ["--hidden"] });
  if (tray) buildTrayMenu();
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(asset(isMac ? "trayTemplate.png" : "tray.png")));
  if (!isMac) tray.on("click", toggleMain); // on macOS a click opens the tray menu instead
  buildTrayMenu();
}

const fromMain = (event) => mainWindow && event.sender === mainWindow.webContents;
const fromPopup = (event) => popup && event.sender === popup.webContents;

function setupIpc() {
  ipcMain.handle("nova:snip", async (event) => {
    if (!fromMain(event)) return null;
    const shot = await snip({ hideNova: true });
    return shot ? shot.image : null;
  });
  ipcMain.handle("nova:open-external", async (event, url) => {
    if (!fromMain(event) || typeof url !== "string" || !/^https?:\/\//i.test(url)) return false;
    await shell.openExternal(url);
    return true;
  });
  ipcMain.handle("nova:get-settings", (event) => {
    if (!fromMain(event)) return null;
    return {
      hotkeys: settings.hotkeys,
      defaults: DEFAULT_HOTKEYS,
      labels: { snip: formatAccelerator(settings.hotkeys.snip), toggle: formatAccelerator(settings.hotkeys.toggle) },
      openAtLogin: app.getLoginItemSettings().openAtLogin,
      canOpenAtLogin: process.platform === "win32" || isMac,
      platform: process.platform,
    };
  });
  ipcMain.handle("nova:set-hotkeys", (event, hotkeys) => {
    if (!fromMain(event) || !hotkeys || typeof hotkeys !== "object") return { errors: { snip: "Invalid shortcut." } };
    const next = {
      snip: typeof hotkeys.snip === "string" ? hotkeys.snip.trim() : settings.hotkeys.snip,
      toggle: typeof hotkeys.toggle === "string" ? hotkeys.toggle.trim() : settings.hotkeys.toggle,
    };
    const errors = registerHotkeys(next);
    if (Object.keys(errors).length) {
      registerHotkeys(settings.hotkeys); // keep the old, working shortcuts
      return { errors };
    }
    settings.hotkeys = next;
    saveSettings();
    buildTrayMenu();
    return { errors: {}, labels: { snip: formatAccelerator(next.snip), toggle: formatAccelerator(next.toggle) } };
  });
  ipcMain.handle("nova:set-open-at-login", (event, on) => {
    if (!fromMain(event)) return false;
    setOpenAtLogin(!!on);
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.on("nova:ready", (event) => {
    if (!fromMain(event)) return;
    rendererReady = true;
    while (pendingAsks.length) mainWindow.webContents.send("nova:ask-image", pendingAsks.shift());
  });
  ipcMain.on("nova:popup-update", (event, update) => {
    if (fromMain(event) && popup && !popup.isDestroyed()) popup.webContents.send("popup:update", update);
  });

  ipcMain.on("popup:open-nova", (event) => {
    if (!fromPopup(event)) return;
    popup.destroy();
    showMain();
  });
  ipcMain.on("popup:close", (event) => {
    if (fromPopup(event)) popup.destroy();
  });
  ipcMain.on("popup:copy", (event, text) => {
    if (fromPopup(event) && typeof text === "string") clipboard.writeText(text);
  });
  ipcMain.on("popup:resize", (event, height) => {
    if (!fromPopup(event) || !Number.isFinite(height)) return;
    const bounds = popup.getBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    const h = Math.round(Math.max(140, Math.min(height, 560, area.y + area.height - bounds.y - 12)));
    if (Math.abs(h - bounds.height) > 2) popup.setBounds({ ...bounds, height: h });
  });
  ipcMain.on("popup:open-link", (event, url) => {
    if (fromPopup(event) && typeof url === "string" && /^https?:\/\//i.test(url)) shell.openExternal(url);
  });
}

// ------------------------------------------------------------------ start

app.on("second-instance", showMain);
app.on("activate", showMain);
app.on("before-quit", () => (quitting = true));
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  // Stay alive in the tray so the hotkey keeps working.
});

app.whenReady().then(async () => {
  settings = loadSettings();
  if (process.platform === "win32") app.setAppUserModelId("com.nova.assistant");

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(["notifications", "clipboard-sanitized-write"].includes(permission));
  });

  const envFile = path.join(app.getPath("userData"), ".env");
  // Running from source: also pick up the project's .env, if there is one.
  if (!app.isPackaged) {
    try {
      process.loadEnvFile(path.join(here, "..", ".env"));
    } catch {
      // none
    }
  }
  try {
    serverUrl = (await startServer({ port: settings.port, host: "127.0.0.1", envFile, log: !app.isPackaged })).url;
  } catch (err) {
    if (err.code !== "EADDRINUSE") throw err;
    // Something else took our port: use any free one (saved notes from earlier sessions won't show).
    serverUrl = (await startServer({ port: 0, host: "127.0.0.1", envFile, log: !app.isPackaged })).url;
  }

  setupIpc();
  createMainWindow();
  createTray();
  const errors = registerHotkeys(settings.hotkeys);
  if (errors.snip) {
    dialog.showMessageBox({
      type: "warning",
      message: "Nova's snip shortcut isn't available",
      detail: `${errors.snip}\n\nPick another one in Nova › Settings › Desktop.`,
    });
  }

  if (process.env.NOVA_TEST) globalThis.novaTest = { snip, snipAndAnswer, getPopup: () => popup, getMain: () => mainWindow, hasTray: () => !!tray };
});
