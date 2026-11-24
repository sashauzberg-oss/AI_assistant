const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("popup", {
  onInit: (callback) => ipcRenderer.once("popup:init", (_event, data) => callback(data)),
  onUpdate: (callback) => ipcRenderer.on("popup:update", (_event, update) => callback(update)),
  openNova: () => ipcRenderer.send("popup:open-nova"),
  close: () => ipcRenderer.send("popup:close"),
  copy: (text) => ipcRenderer.send("popup:copy", text),
  resize: (height) => ipcRenderer.send("popup:resize", height),
  openLink: (url) => ipcRenderer.send("popup:open-link", url),
});
