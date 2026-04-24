const { ipcMain, shell } = require('electron');
const log = require('electron-log/main');
const paths = require('./paths');
const { loadConfig, loadSources } = require('./config');
const { discoverSystemInstallations } = require('./discovery');
const { installVersion, uninstallVersion, linkExisting } = require('./installer');
const { activate, verifyActive, isOnUserPath, getSystemActive, detectConflicts, elevatePinToMachinePath } = require('./switcher');

function register(getWindow) {
  ipcMain.handle('state:getAll', async () => {
    const [config, sources, system, shimActive, systemActive, onPath, conflicts] = await Promise.all([
      loadConfig(),
      loadSources(),
      discoverSystemInstallations(),
      verifyActive(),
      getSystemActive(),
      isOnUserPath(),
      detectConflicts(),
    ]);
    const activeResolved = shimActive || systemActive;
    const activeSource = shimActive ? 'phlux' : (systemActive ? 'system' : null);
    return {
      platform: process.platform,
      config,
      sources: sources[process.platform] || {},
      system,
      activeResolved,
      activeSource,
      pathConfigured: onPath,
      conflicts,
      paths: {
        userData: paths.userData(),
        bin: paths.binDir(),
        versions: paths.versionsDir(),
      },
    };
  });

  ipcMain.handle('install:linkExisting', async (_e, { majorMinor, path: phpPath, source }) => {
    try {
      const result = await linkExisting(majorMinor, phpPath, source);
      return { ok: true, result };
    } catch (err) {
      log.error('linkExisting failed', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('install:version', async (_e, version) => {
    try {
      const result = await installVersion(getWindow(), version);
      return { ok: true, result };
    } catch (err) {
      log.error('install failed', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('install:uninstall', async (_e, version) => {
    try {
      await uninstallVersion(version);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('activate:version', async (_e, version) => {
    try {
      const result = await activate(version);
      return { ok: true, result };
    } catch (err) {
      log.error('activate failed', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('path:elevate', async () => {
    return await elevatePinToMachinePath();
  });

  ipcMain.handle('open:folder', async (_e, p) => {
    await shell.openPath(p);
    return { ok: true };
  });
}

module.exports = { register };
