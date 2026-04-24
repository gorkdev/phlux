const path = require('path');
const { app, BrowserWindow } = require('electron');
const log = require('electron-log/main');
const ipc = require('./ipc');

log.initialize();
log.info('Phlux starting', { version: app.getVersion(), platform: process.platform });

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 820,
    minHeight: 560,
    backgroundColor: '#0f1115',
    title: 'Phlux',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  const isDev = !app.isPackaged;
  if (isDev || process.env.PHLUX_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.on('preload-error', (_e, preloadPath, error) => {
    log.error('Preload failed to load', preloadPath, error);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log.error('Renderer process gone', details);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  ipc.register(() => mainWindow);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (err) => log.error('uncaughtException', err));
process.on('unhandledRejection', (err) => log.error('unhandledRejection', err));
