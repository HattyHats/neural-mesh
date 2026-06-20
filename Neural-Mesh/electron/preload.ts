import { ipcRenderer, contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronBridge', {
  saveMeshFile: (data: string) => ipcRenderer.invoke('save-mesh-file', data),
  openMeshFile: () => ipcRenderer.invoke('open-mesh-file')
});
