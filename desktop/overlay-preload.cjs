const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlay", {
  onImage: (callback) => ipcRenderer.once("overlay:image", (_event, payload) => callback(payload)),
  ready: () => ipcRenderer.send("overlay:ready"),
  result: (value) => ipcRenderer.send("overlay:result", value),
});
