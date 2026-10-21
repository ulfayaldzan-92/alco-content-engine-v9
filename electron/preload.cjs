const { contextBridge, ipcRenderer } = require('electron');

/**
 * ALCO Content Engine Preload Script
 * Exposes secure IPC bridge for native desktop capabilities (such as Windows MachineGuid Device ID)
 * without exposing raw Node.js or Windows registry access to the renderer.
 */
const bridgeApi = {
  getDeviceId: () => ipcRenderer.invoke('alco:get-device-id'),
  isElectron: true,
  platform: process.platform,

  // ALCO Desktop Persistent Storage Bridge
  storage: {
    getBootstrapSnapshot: () => ipcRenderer.invoke('alco:storage:get-bootstrap-snapshot'),
    initProject: (projectId) => ipcRenderer.invoke('alco:storage:init-project', { projectId }),
    saveProjectData: (projectId, dataType, data, clientRevision) =>
      ipcRenderer.invoke('alco:storage:save-project-data', { projectId, dataType, data, clientRevision }),
    removeProjectData: (projectId, dataType) =>
      ipcRenderer.invoke('alco:storage:remove-project-data', { projectId, dataType }),
    saveManifest: (manifest) =>
      ipcRenderer.invoke('alco:storage:save-manifest', manifest),
    flush: () => ipcRenderer.invoke('alco:storage:flush'),
  },
};

contextBridge.exposeInMainWorld('alcoBridge', bridgeApi);
contextBridge.exposeInMainWorld('electronAPI', bridgeApi);

