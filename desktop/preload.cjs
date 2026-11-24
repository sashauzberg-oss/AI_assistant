// Bridge between the Nova page and the desktop app. Only these functions are exposed.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("novaDesktop", {
  platform: process.platform,
  snip: () => ipcRenderer.invoke("nova:snip"),
  openExternal: (url) => ipcRenderer.invoke("nova:open-external", url),
  getSettings: () => ipcRenderer.invoke("nova:get-settings"),
  setHotkeys: (hotkeys) => ipcRenderer.invoke("nova:set-hotkeys", hotkeys),
  setOpenAtLogin: (on) => ipcRenderer.invoke("nova:set-open-at-login", on),
  onAskImage: (callback) => ipcRenderer.on("nova:ask-image", (_event, payload) => callback(payload)),
  popupUpdate: (update) => ipcRenderer.send("nova:popup-update", update),
  ready: () => ipcRenderer.send("nova:ready"),
});
