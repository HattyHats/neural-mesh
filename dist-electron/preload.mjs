let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronBridge", {
	saveMeshFile: (data) => electron.ipcRenderer.invoke("save-mesh-file", data),
	openMeshFile: () => electron.ipcRenderer.invoke("open-mesh-file"),
	onQuickCapture: (callback) => electron.ipcRenderer.on("quick-capture-trigger", () => callback())
});
//#endregion
