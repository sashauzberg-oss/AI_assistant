// Nova desktop app: a floating typing bar (like Spotlight) that grows to show answers,
// plus a global hotkey that snips any part of the screen (like the Snipping Tool) and
// answers the question in it.
import { app, BrowserWindow, Menu, Tray, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, nativeImage, nativeTheme, powerSaveBlocker, screen, session, shell, systemPreferences, Notification } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../server.js";
import { openApp } from "./apps.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const asset = (name) => path.join(here, "assets", name);
const ui = (name) => path.join(here, "ui", name);
const isMac = process.platform === "darwin";

if (process.env.NOVA_USER_DATA) app.setPath("userData", process.env.NOVA_USER_DATA);
// Nova works in the background (music, timers, the pet riding the cursor): don't let
// Chromium slow its timers down when its windows aren't in front.
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// ------------------------------------------------------------------ settings

export const DEFAULT_HOTKEYS = { snip: "CommandOrControl+Shift+Space", toggle: "Alt+Space" };
const BAR_WIDTH = 720; // includes the transparent margin around the bar for its shadow
const DEFAULT_PORT = 47823; // fixed, so the app's saved notes and settings survive restarts

const settingsFile = () => path.join(app.getPath("userData"), "desktop-settings.json");
function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
    // Saved shortcuts only count once the user has changed them; otherwise follow the defaults.
    const hotkeys = saved.hotkeysCustomized ? { ...DEFAULT_HOTKEYS, ...saved.hotkeys } : { ...DEFAULT_HOTKEYS };
    return { port: DEFAULT_PORT, ...saved, hotkeys };
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
let keepOpen = false; // the page asks to stay open (file picker, settings)
let stage = null; // the full-screen joke cutscene window, while it's on
let ride = null; // the pet riding the cursor: its window and how the ride is going
let fakeCursor = null; // tests can steer the "cursor"
const cursorPoint = () => fakeCursor || screen.getCursorScreenPoint();
let movingProgrammatically = false;

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
    width: BAR_WIDTH,
    height: 104,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    title: "Nova",
    icon: asset("icon.png"),
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false, // keep music and timers smooth while hidden
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  mainWindow.setAlwaysOnTop(true, "floating");
  lockDown(mainWindow, serverUrl);
  mainWindow.webContents.on("did-start-loading", () => (rendererReady = false));
  mainWindow.loadURL(serverUrl);
  mainWindow.once("ready-to-show", () => {
    if (!process.argv.includes("--hidden")) showMain();
  });
  mainWindow.on("show", () => mainWindow.webContents.send("nova:visibility", true));
  mainWindow.on("hide", () => mainWindow.webContents.send("nova:visibility", false));

  // Like Spotlight: clicking somewhere else puts the bar away, unless it's pinned.
  mainWindow.on("blur", () => {
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFocused() || !mainWindow.isVisible()) return;
      if (settings.pinned || keepOpen || snipping || stage || quitting) return;
      if (popup && !popup.isDestroyed() && popup.isFocused()) return; // our own answer bubble isn't "somewhere else"
      mainWindow.hide();
    }, 150);
  });

  // Remember where the user dragged the bar.
  mainWindow.on("move", () => {
    if (movingProgrammatically || !mainWindow.isVisible()) return;
    const [x, y] = mainWindow.getPosition();
    settings.barPosition = { x, y };
    clearTimeout(createMainWindow.saveTimer);
    createMainWindow.saveTimer = setTimeout(saveSettings, 500);
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
        body: `Press ${formatAccelerator(settings.hotkeys.toggle)} to open Nova, or ${formatAccelerator(settings.hotkeys.snip)} to snip a question.`,
        icon: asset("icon.png"),
      }).show();
    }
  });
}

/** Move/resize the bar without counting it as the user dragging it. */
function setBarBounds(bounds) {
  movingProgrammatically = true;
  // Linux ignores size changes on non-resizable windows, so allow it for a moment.
  mainWindow.setResizable(true);
  mainWindow.setBounds(bounds);
  mainWindow.setResizable(false);
  setTimeout(() => (movingProgrammatically = false), 100);
}

function placeBar() {
  const { height } = mainWindow.getBounds();
  const saved = settings.barPosition;
  const visible = saved && screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return saved.x >= a.x - 100 && saved.x < a.x + a.width - 100 && saved.y >= a.y - 10 && saved.y < a.y + a.height - 60;
  });
  if (visible) {
    setBarBounds({ x: saved.x, y: saved.y, width: BAR_WIDTH, height });
    return;
  }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  setBarBounds({
    x: Math.round(area.x + (area.width - BAR_WIDTH) / 2),
    y: Math.round(area.y + area.height * 0.16),
    width: BAR_WIDTH,
    height,
  });
}

function showMain() {
  if (!mainWindow) return;
  if (!mainWindow.isVisible()) placeBar();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("nova:shown");
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

const SNIP_MODES = ["answer", "text", "translate", "explain"];

/** Full-screen overlay showing the frozen screenshot; resolves { x, y, width, height, mode } (DIPs), { full, mode } or null. */
function selectRegion(display, image, mode = "answer") {
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
      if (!value || typeof value !== "object") return finish(null);
      const mode = SNIP_MODES.includes(value.mode) ? value.mode : "answer";
      if (value.full) return finish({ full: true, mode });
      const ok = ["x", "y", "width", "height"].every((k) => Number.isFinite(value[k]));
      if (!ok || value.width < 4 || value.height < 4) return finish(null);
      const x = Math.max(0, Math.min(display.bounds.width, value.x));
      const y = Math.max(0, Math.min(display.bounds.height, value.y));
      finish({
        x,
        y,
        width: Math.min(display.bounds.width - x, value.width),
        height: Math.min(display.bounds.height - y, value.height),
        mode,
      });
    };
    ipcMain.on("overlay:ready", onReady);
    ipcMain.on("overlay:result", onResult);
    overlay.on("closed", () => finish(null));
    overlay.webContents.once("did-finish-load", () => {
      overlay.webContents.send("overlay:image", {
        dataUrl: `data:image/jpeg;base64,${image.toJPEG(92).toString("base64")}`,
        mode: SNIP_MODES.includes(mode) ? mode : "answer",
      });
    });
    overlay.loadFile(ui("overlay.html"));
  });
}

/**
 * A cutscene (the joke show or the fight scene) in a full-screen window on the display
 * Nova is on. Resolves when it's over (or skipped).
 */
function playCutscene(show) {
  if (stage) return Promise.resolve(false);
  return new Promise((resolve) => {
    const anchor = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() ? mainWindow.getBounds() : null;
    const display = anchor ? screen.getDisplayMatching(anchor) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const win = new BrowserWindow({
      ...display.bounds,
      frame: false,
      show: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      enableLargerThanScreen: true,
      title: "Nova on stage",
      webPreferences: {
        preload: path.join(here, "stage-preload.cjs"),
        contextIsolation: true,
        sandbox: true,
        autoplayPolicy: "no-user-gesture-required",
      },
    });
    stage = win;
    win.setAlwaysOnTop(true, "screen-saver");
    if (isMac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    lockDown(win, serverUrl);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(limit);
      ipcMain.removeListener("stage:done", onDone);
      stage = null;
      if (!win.isDestroyed()) win.destroy();
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) mainWindow.focus();
      resolve(true);
    };
    const onDone = (event) => {
      if (!win.isDestroyed() && event.sender === win.webContents) finish();
    };
    const limit = setTimeout(finish, 120000); // never leave a stuck window over the screen
    ipcMain.on("stage:done", onDone);
    win.on("closed", finish);
    win.webContents.on("render-process-gone", finish);
    win.once("ready-to-show", () => {
      win.setBounds(display.bounds);
      win.show();
      win.setBounds(display.bounds); // some window managers nudge it on show
      win.focus();
    });
    win.loadURL(`${new URL("cutscene.html", serverUrl)}#${encodeURIComponent(JSON.stringify(show))}`).catch(finish);
  });
}

// ------------------------------------------------------------------ the pet rides the cursor

const RIDER = { width: 260, height: 150 }; // room for the pet and its speech bubble
const SEAT = { x: 3, y: 6 }; // where the pet sits, from the cursor's tip (as in public/js/rider.js)
const RIDER_BOTTOM = 22; // the pet's seat is this far above the window's bottom (its legs hang below)
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Moves the rider window so the pet sits on `point` (a cursor position). */
function placeRider(point) {
  const x = Math.round(point.x + SEAT.x - RIDER.width / 2);
  const y = Math.round(point.y + SEAT.y - (RIDER.height - RIDER_BOTTOM));
  if (ride.placed?.x !== x || ride.placed?.y !== y) {
    ride.win.setPosition(x, y);
    ride.placed = { x, y };
  }
  // Check the window really went there: if the system didn't move it (crossing to
  // another screen, say), move it again with its whole frame.
  const [cx, cy] = ride.win.getPosition();
  if (Math.abs(cx - x) > 1 || Math.abs(cy - y) > 1) {
    if (++ride.stuck > 4) {
      ride.win.setBounds({ x, y, ...RIDER });
      ride.stuck = 0;
    }
  } else {
    ride.stuck = 0;
  }
}

/**
 * "get on": a small see-through, click-through window with the pet follows the cursor
 * around the screen. It hops over from the bar (`from`, a screen point) first.
 */
function startRide(pet, from, restarts = 0, home = null) {
  if (ride && (ride.phase === "leaving" || ride.phase === "fly-back")) finishRide(); // "get on" again right after "get off"
  if (ride) {
    ride.pet = pet;
    ride.name = pet.name || ride.name;
    ride.win.webContents.send("rider:pet", pet);
    buildTrayMenu();
    return true;
  }
  const start = from || cursorPoint();
  const win = new BrowserWindow({
    ...RIDER,
    x: Math.round(start.x + SEAT.x - RIDER.width / 2),
    y: Math.round(start.y + SEAT.y - (RIDER.height - RIDER_BOTTOM)),
    frame: false,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    title: "Nova rider",
    webPreferences: { preload: path.join(here, "rider-preload.cjs"), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setIgnoreMouseEvents(true); // clicks go straight through to whatever is underneath
  if (isMac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  lockDown(win, serverUrl);
  const bar = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && from ? mainWindow.getPosition() : null;
  ride = {
    win,
    pet,
    restarts,
    name: pet.name || "your pet",
    phase: "climb",
    startedAt: 0,
    from: start,
    dock: bar ? { x: from.x - bar[0], y: from.y - bar[1] } : home, // where to fly back to, on the bar
    trail: [],
    timer: null,
    placed: null,
    stuck: 0,
    lastTop: 0,
    // While riding, the system mustn't put Nova to sleep in the background (on a Mac,
    // App Nap would slow the window down until the pet stops following the cursor).
    blocker: powerSaveBlocker.start("prevent-app-suspension"),
  };
  win.once("ready-to-show", () => {
    if (!ride || ride.win !== win) return;
    win.showInactive();
    ride.startedAt = Date.now();
    ride.timer = setInterval(rideTick, 8); // well over the screen's frame rate, so the pet keeps up
  });
  // Only "get off" ends a ride. If the window goes away by itself, put the pet right back
  // on the cursor (giving up only if that keeps failing).
  const lost = () => {
    if (ride?.win !== win) return;
    if (ride.phase === "leaving" || ride.phase === "fly-back" || quitting) return finishRide();
    const { pet: again, restarts: tries, dock } = ride;
    finishRide({ restarting: tries < 5 });
    if (tries < 5) setTimeout(() => !ride && !quitting && startRide(again, null, tries + 1, dock), 300);
  };
  win.on("closed", lost);
  win.webContents.on("render-process-gone", lost);
  win.loadURL(`${new URL("rider.html", serverUrl)}#${encodeURIComponent(JSON.stringify(pet))}`).catch(lost);
  buildTrayMenu();
  return true;
}

function rideTick() {
  if (!ride || ride.win.isDestroyed()) return;
  const now = Date.now();
  const point = cursorPoint();
  if (ride.phase === "climb" || ride.phase === "fly-back") {
    const ms = ride.phase === "climb" ? 650 : 550;
    const t = Math.min(1, (now - ride.startedAt) / ms);
    const to = ride.phase === "climb" ? point : ride.to;
    const e = easeInOut(t);
    placeRider({ x: ride.from.x + (to.x - ride.from.x) * e, y: ride.from.y + (to.y - ride.from.y) * e - 90 * Math.sin(Math.PI * t) });
    if (t < 1) return;
    if (ride.phase === "fly-back") return finishRide();
    ride.phase = "ride";
    ride.trail = [{ ...point, t: now }];
    ride.win.webContents.send("rider:land");
    return;
  }
  if (ride.phase !== "ride") return;
  // The cursor's speed over the last tenth of a second, so uneven updates don't make it jumpy.
  ride.trail.push({ ...point, t: now });
  while (ride.trail.length > 2 && now - ride.trail[0].t > 100) ride.trail.shift();
  const first = ride.trail[0];
  const dt = Math.max(0.016, (now - first.t) / 1000);
  const vx = (point.x - first.x) / dt;
  const vy = (point.y - first.y) / dt;
  // A window always shows up a frame or so after the cursor has moved; aim a little
  // ahead on fast moves so the pet stays on the cursor instead of trailing behind it.
  const lead = (v) => Math.max(-24, Math.min(24, v * 0.012));
  placeRider({ x: point.x + lead(vx), y: point.y + lead(vy) });
  if (now - (ride.lastSent || 0) >= 15) {
    ride.lastSent = now;
    ride.win.webContents.send("rider:motion", { vx, vy });
  }
  // Stay above every other window, even ones that come to the front later.
  if (now - ride.lastTop > 1000) {
    ride.lastTop = now;
    ride.win.setAlwaysOnTop(true, "screen-saver");
    ride.win.moveTop();
  }
}

/** "get off": the pet says goodbye and flies back to the bar (or hops off if the bar is away). */
function stopRide() {
  if (!ride || ride.phase === "leaving" || ride.phase === "fly-back") return;
  if (ride.phase === "climb") return finishRide();
  ride.phase = "leaving";
  const back = ride.dock && mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() ? mainWindow.getPosition() : null;
  ride.win.webContents.send("rider:leave", { flying: !!back });
  const current = ride;
  if (back) {
    // say goodbye for a moment, then fly home
    setTimeout(() => {
      if (ride !== current) return;
      ride.phase = "fly-back";
      ride.from = { ...cursorPoint() };
      ride.to = { x: back[0] + ride.dock.x, y: back[1] + ride.dock.y };
      ride.startedAt = Date.now();
    }, 500);
  }
  setTimeout(() => ride === current && finishRide(), 2500); // never leave it hanging
}

function finishRide({ restarting = false } = {}) {
  if (!ride) return;
  const { win, timer, blocker } = ride;
  ride = null;
  clearInterval(timer);
  if (powerSaveBlocker.isStarted(blocker)) powerSaveBlocker.stop(blocker);
  if (!win.isDestroyed()) win.destroy();
  if (!restarting && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("nova:ride-state", false);
  buildTrayMenu();
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
export async function snip({ hideNova = false, mode = "answer" } = {}) {
  if (snipping) return null;
  snipping = true;
  const restoreNova = hideNova && mainWindow?.isVisible();
  const riderWin = ride && !ride.win.isDestroyed() && ride.win.isVisible() ? ride.win : null;
  try {
    if (popup) {
      popup.destroy();
      popup = null;
    }
    if (riderWin) riderWin.hide(); // keep the pet out of the screenshot
    if (restoreNova) {
      mainWindow.hide();
      await sleep(isMac ? 350 : 250); // let the window finish disappearing
    } else if (riderWin) {
      await sleep(150);
    }
    const captured = await captureDisplay();
    if (!captured) return null;
    const { display, image } = captured;
    const region = await selectRegion(display, image, mode);
    if (!region) return null;
    if (region.full) return { image: encode(image), rect: display.bounds, mode: region.mode };
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
      mode: region.mode,
    };
  } catch (err) {
    dialog.showErrorBox("Nova couldn't capture the screen", err.message);
    return null;
  } finally {
    snipping = false;
    if (restoreNova) showMain();
    if (riderWin && !riderWin.isDestroyed()) riderWin.showInactive();
  }
}

// ------------------------------------------------------------------ answer bubble

function openPopup(shot, { onLoad } = {}) {
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
    win.webContents.send("popup:init", { thumb: shot.image?.dataUrl || null, hotkey: formatAccelerator(settings.hotkeys.snip), mode: shot.mode });
    onLoad?.(win);
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
  const payload = { image: shot.image, mode: shot.mode };
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
  if (ride) items.push({ label: `Get ${ride.name} off the cursor`, click: stopRide }, { type: "separator" });
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
  ipcMain.handle("nova:snip", async (event, mode) => {
    if (!fromMain(event)) return null;
    const shot = await snip({ hideNova: true, mode: typeof mode === "string" ? mode : "answer" });
    return shot ? { ...shot.image, mode: shot.mode } : null;
  });
  ipcMain.on("nova:resize", (event, height) => {
    if (!fromMain(event) || !Number.isFinite(height)) return;
    const bounds = mainWindow.getBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    const h = Math.round(Math.max(64, Math.min(height, area.y + area.height - bounds.y - 8)));
    if (Math.abs(h - bounds.height) > 1) setBarBounds({ ...bounds, height: h });
  });
  ipcMain.on("nova:hide", (event) => {
    if (fromMain(event)) mainWindow.hide();
  });
  ipcMain.on("nova:show", (event) => {
    if (fromMain(event)) showMain();
  });
  ipcMain.on("nova:keep-open", (event, on) => {
    if (fromMain(event)) keepOpen = !!on;
  });
  ipcMain.handle("nova:set-pinned", (event, on) => {
    if (!fromMain(event)) return false;
    settings.pinned = !!on;
    saveSettings();
    return settings.pinned;
  });
  // Electron's clipboard follows the web's async Clipboard API (read, readText, writeText).
  ipcMain.handle("nova:read-clipboard", async (event) => {
    if (!fromMain(event)) return null;
    const text = (await clipboard.readText()) || "";
    if (text.trim()) return { text: text.slice(0, 50000) };
    try {
      for (const item of await clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        const image = nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()));
        if (!image.isEmpty()) return { image: encode(image) };
      }
    } catch {
      // no readable image
    }
    return { text: "" };
  });
  ipcMain.handle("nova:copy", async (event, text) => {
    if (!fromMain(event) || typeof text !== "string") return false;
    await clipboard.writeText(text);
    return true;
  });
  ipcMain.handle("nova:cutscene", (event, scene) => {
    if (!fromMain(event) || !scene || typeof scene !== "object") return false;
    const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");
    const show = { scene: scene.scene === "fight" ? "fight" : "joke", kind: text(scene.kind, 20), name: text(scene.name, 24), speak: scene.speak === true };
    if (show.scene === "joke") {
      show.setup = text(scene.setup, 400);
      show.punchline = text(scene.punchline, 400);
      if (!show.setup && !show.punchline) return false;
    } else {
      show.foe = text(scene.foe, 20);
      show.foeName = text(scene.foeName, 30);
    }
    return playCutscene(show);
  });
  ipcMain.handle("nova:ride", (event, opts) => {
    if (!fromMain(event) || !opts || typeof opts !== "object") return false;
    if (!opts.on) {
      const was = !!ride;
      stopRide();
      return was;
    }
    const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");
    const pet = { kind: text(opts.kind, 20), name: text(opts.name, 24), sound: text(opts.sound, 30) };
    const from = Number.isFinite(opts.from?.x) && Number.isFinite(opts.from?.y) ? { x: opts.from.x, y: opts.from.y } : null;
    return startRide(pet, from);
  });
  ipcMain.handle("nova:riding", (event) => fromMain(event) && !!ride);
  ipcMain.on("rider:left", (event) => {
    if (ride && !ride.win.isDestroyed() && event.sender === ride.win.webContents && ride.phase === "leaving") finishRide();
  });
  ipcMain.handle("nova:open-app", (event, name) => {
    if (!fromMain(event) || typeof name !== "string") return { ok: false, error: "Invalid app name." };
    return openApp(name);
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
      pinned: !!settings.pinned,
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
    settings.hotkeysCustomized = true;
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
  // "Open the full answer" from the strip under the bar: show it in the answer bubble, next to the bar.
  ipcMain.on("nova:show-answer", (event, answer) => {
    if (!fromMain(event) || !answer || typeof answer.html !== "string") return;
    const b = mainWindow.getBounds();
    openPopup(
      { rect: { x: b.x + 90, y: b.y + b.height - 10, width: 0, height: 0 }, mode: "answer" },
      { onLoad: (win) => win.webContents.send("popup:update", { pet: answer.pet, html: answer.html, text: answer.text, done: true }) },
    );
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
    if (fromPopup(event) && typeof text === "string") clipboard.writeText(text).catch(() => {});
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

  if (process.env.NOVA_TEST) globalThis.novaTest = { snip, snipAndAnswer, showMain, getPopup: () => popup, getMain: () => mainWindow, getStage: () => stage, hasTray: () => !!tray, getRide: () => ride && { phase: ride.phase, bounds: ride.win.getBounds(), visible: ride.win.isVisible(), restarts: ride.restarts, onTop: ride.win.isAlwaysOnTop(), blocking: powerSaveBlocker.isStarted(ride.blocker) },
    crashRider: () => ride?.win.webContents.forcefullyCrashRenderer(), setCursor: (point) => (fakeCursor = point), stopRide };
});
