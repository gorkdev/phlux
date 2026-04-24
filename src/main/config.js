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
    '8.4': 'https://windows.php.net/downloads/releases/php-8.4.3-nts-Win32-vs17-x64.zip',
    '8.3': 'https://windows.php.net/downloads/releases/php-8.3.16-nts-Win32-vs16-x64.zip',
    '8.2': 'https://windows.php.net/downloads/releases/php-8.2.27-nts-Win32-vs16-x64.zip',
    '8.1': 'https://windows.php.net/downloads/releases/archives/php-8.1.31-nts-Win32-vs16-x64.zip',
    '7.4': 'https://windows.php.net/downloads/releases/archives/php-7.4.33-nts-Win32-vc15-x64.zip',
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
  return await readJson(file, DEFAULT_SOURCES);
}

module.exports = {
  loadConfig,
  saveConfig,
  loadSources,
  DEFAULT_SOURCES,
};
