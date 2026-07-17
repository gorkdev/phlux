const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const AdmZip = require('adm-zip');
const log = require('electron-log/main');
const paths = require('./paths');
const { download } = require('./downloader');
const { loadConfig, saveConfig, loadSources } = require('./config');
const { readVersion } = require('./discovery');
const { resolveDownloadUrl } = require('./resolver');
const { buildPhpIni } = require('./phpini');
const { removeShim } = require('./switcher');

function sendProgress(win, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('install-progress', payload);
  }
}

async function extractZip(zipFile, targetDir) {
  await fsp.mkdir(targetDir, { recursive: true });
  const zip = new AdmZip(zipFile);
  zip.extractAllTo(targetDir, true);
}

async function ensurePhpIni(versionFolder) {
  const dev = path.join(versionFolder, 'php.ini-development');
  const out = path.join(versionFolder, 'php.ini');
  if (fs.existsSync(out)) return;
  if (!fs.existsSync(dev)) return;

  const devIni = await fsp.readFile(dev, 'utf8');
  await fsp.writeFile(out, buildPhpIni(devIni, path.join(versionFolder, 'ext')), 'utf8');
}

async function installVersion(win, version) {
  const sources = await loadSources();
  const platformSources = sources[process.platform] || {};
  const configuredUrl = platformSources[version];

  sendProgress(win, { version, stage: 'resolve', percent: 0 });
  const { url, via } = await resolveDownloadUrl(version, configuredUrl);
  log.info(`Resolved PHP ${version} via ${via}: ${url}`);

  sendProgress(win, { version, stage: 'download', percent: 0 });

  const zipFile = path.join(paths.downloadsDir(), `php-${version}.zip`);
  await download(url, zipFile, (p) => {
    sendProgress(win, { version, stage: 'download', percent: p.percent, received: p.received, total: p.total });
  });

  sendProgress(win, { version, stage: 'extract', percent: 100 });

  const target = paths.versionDir(version);
  await fsp.rm(target, { recursive: true, force: true });
  await extractZip(zipFile, target);
  await ensurePhpIni(target);

  const phpExe = path.join(target, process.platform === 'win32' ? 'php.exe' : 'php');
  const actual = await readVersion(phpExe);

  const cfg = await loadConfig();
  cfg.installed[version] = {
    version,
    resolvedVersion: actual || version,
    path: phpExe,
    installedAt: new Date().toISOString(),
  };
  await saveConfig(cfg);

  try { await fsp.unlink(zipFile); } catch { /* ignore */ }
  log.info('Installed PHP', version, '->', phpExe);

  sendProgress(win, { version, stage: 'done', percent: 100, resolvedVersion: actual });
  return cfg.installed[version];
}

async function uninstallVersion(version) {
  const cfg = await loadConfig();
  const entry = cfg.installed[version];
  if (!entry) return;
  if (entry.managed !== false) {
    await fsp.rm(paths.versionDir(version), { recursive: true, force: true });
  }
  const wasActive = cfg.activeVersion === version;
  delete cfg.installed[version];
  if (wasActive) {
    cfg.activeVersion = null;
    await removeShim();
  }
  await saveConfig(cfg);
}

async function linkExisting(majorMinor, phpPath, source) {
  if (!fs.existsSync(phpPath)) throw new Error(`PHP binary not found at ${phpPath}`);
  const actual = await readVersion(phpPath);
  if (!actual) throw new Error(`Unable to read PHP version from ${phpPath}`);

  const cfg = await loadConfig();
  cfg.installed[majorMinor] = {
    version: majorMinor,
    resolvedVersion: actual,
    path: phpPath,
    source: source || 'System',
    managed: false,
    installedAt: new Date().toISOString(),
  };
  await saveConfig(cfg);
  log.info('Linked external PHP', actual, '@', phpPath);
  return cfg.installed[majorMinor];
}

module.exports = { installVersion, uninstallVersion, linkExisting };
