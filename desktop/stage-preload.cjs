// The cutscene window only needs to say when the show is over.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("novaStage", {
  done: () => ipcRenderer.send("stage:done"),
});
