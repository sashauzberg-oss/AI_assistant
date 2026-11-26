// Bridge between the Nova page and the desktop app. Only these functions are exposed.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("novaDesktop", {
  platform: process.platform,
  snip: (mode) => ipcRenderer.invoke("nova:snip", mode),
  openExternal: (url) => ipcRenderer.invoke("nova:open-external", url),
  openApp: (name) => ipcRenderer.invoke("nova:open-app", name),
  joke: (show) => ipcRenderer.invoke("nova:joke", show),
  readClipboard: () => ipcRenderer.invoke("nova:read-clipboard"),
  copy: (text) => ipcRenderer.invoke("nova:copy", text),
  getSettings: () => ipcRenderer.invoke("nova:get-settings"),
  setHotkeys: (hotkeys) => ipcRenderer.invoke("nova:set-hotkeys", hotkeys),
  setOpenAtLogin: (on) => ipcRenderer.invoke("nova:set-open-at-login", on),
  setPinned: (on) => ipcRenderer.invoke("nova:set-pinned", on),
  resize: (height) => ipcRenderer.send("nova:resize", height),
  hide: () => ipcRenderer.send("nova:hide"),
  show: () => ipcRenderer.send("nova:show"),
  keepOpen: (on) => ipcRenderer.send("nova:keep-open", on),
  onShown: (callback) => ipcRenderer.on("nova:shown", () => callback()),
  onVisibility: (callback) => ipcRenderer.on("nova:visibility", (_event, visible) => callback(visible)),
  onAskImage: (callback) => ipcRenderer.on("nova:ask-image", (_event, payload) => callback(payload)),
  popupUpdate: (update) => ipcRenderer.send("nova:popup-update", update),
  showAnswer: (answer) => ipcRenderer.send("nova:show-answer", answer),
  ready: () => ipcRenderer.send("nova:ready"),
});
