// The cursor-riding pet's window: it hears how the cursor moves and says when it has left.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("novaRider", {
  onMotion: (callback) => ipcRenderer.on("rider:motion", (_event, motion) => callback(motion)),
  onLand: (callback) => ipcRenderer.on("rider:land", () => callback()),
  onPet: (callback) => ipcRenderer.on("rider:pet", (_event, pet) => callback(pet)),
  onLeave: (callback) => ipcRenderer.on("rider:leave", (_event, info) => callback(info || {})),
  left: () => ipcRenderer.send("rider:left"),
});
