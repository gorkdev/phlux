const { contextBridge, ipcRenderer } = require('electron');

console.log('[phlux] preload loaded');

contextBridge.exposeInMainWorld('api', {
  _preloadLoaded: true,
  getState: () => ipcRenderer.invoke('state:getAll'),
  install: (version) => ipcRenderer.invoke('install:version', version),
  linkExisting: (payload) => ipcRenderer.invoke('install:linkExisting', payload),
  uninstall: (version) => ipcRenderer.invoke('install:uninstall', version),
  activate: (version) => ipcRenderer.invoke('activate:version', version),
  elevatePath: () => ipcRenderer.invoke('path:elevate'),
  openFolder: (p) => ipcRenderer.invoke('open:folder', p),
  onInstallProgress: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('install-progress', handler);
    return () => ipcRenderer.removeListener('install-progress', handler);
  },
});
