const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const log = require('electron-log/main');
const paths = require('./paths');

const DEFAULT_CONFIG = {
  activeVersion: null,
  installed: {},
};

const DEFAULT_SOURCES = {
  win32: {
    '8.5': 'https://windows.php.net/downloads/releases/php-8.5.0-nts-Win32-vs17-x64.zip',
    '8.4': 'https://windows.php.net/downloads/releases/php-8.4.3-nts-Win32-vs17-x64.zip',
    '8.3': 'https://windows.php.net/downloads/releases/php-8.3.16-nts-Win32-vs16-x64.zip',
    '8.2': 'https://windows.php.net/downloads/releases/php-8.2.27-nts-Win32-vs16-x64.zip',
    '8.1': 'https://windows.php.net/downloads/releases/archives/php-8.1.31-nts-Win32-vs16-x64.zip',
    '8.0': 'https://windows.php.net/downloads/releases/archives/php-8.0.30-nts-Win32-vs16-x64.zip',
    '7.4': 'https://windows.php.net/downloads/releases/archives/php-7.4.33-nts-Win32-vc15-x64.zip',
    '7.3': 'https://windows.php.net/downloads/releases/archives/php-7.3.33-nts-Win32-VC15-x64.zip',
    '7.2': 'https://windows.php.net/downloads/releases/archives/php-7.2.34-nts-Win32-VC15-x64.zip',
    '7.1': 'https://windows.php.net/downloads/releases/archives/php-7.1.33-nts-Win32-VC14-x64.zip',
    '7.0': 'https://windows.php.net/downloads/releases/archives/php-7.0.33-nts-Win32-VC14-x64.zip',
  },
  darwin: {},
  linux: {},
};

async function ensureDirs() {
  for (const dir of [paths.userData(), paths.versionsDir(), paths.binDir(), paths.downloadsDir()]) {
    await fsp.mkdir(dir, { recursive: true });
  }
}

async function readJson(file, fallback) {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    log.warn('Failed to read', file, err.message);
    return fallback;
  }
}

async function writeJson(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

async function loadConfig() {
  await ensureDirs();
  const cfg = await readJson(paths.configPath(), DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG, ...cfg };
}

async function saveConfig(cfg) {
  await writeJson(paths.configPath(), cfg);
}

async function loadSources() {
  await ensureDirs();
  const file = paths.sourcesPath();
  if (!fs.existsSync(file)) {
    await writeJson(file, DEFAULT_SOURCES);
    return DEFAULT_SOURCES;
  }
  const existing = await readJson(file, DEFAULT_SOURCES);
  const merged = JSON.parse(JSON.stringify(existing));
  let changed = false;
  for (const platform of Object.keys(DEFAULT_SOURCES)) {
    if (!merged[platform]) { merged[platform] = {}; changed = true; }
    for (const [ver, url] of Object.entries(DEFAULT_SOURCES[platform])) {
      if (!merged[platform][ver]) {
        merged[platform][ver] = url;
        changed = true;
      }
    }
  }
  if (changed) await writeJson(file, merged);
  return merged;
}

module.exports = {
  loadConfig,
  saveConfig,
  loadSources,
  DEFAULT_SOURCES,
};
