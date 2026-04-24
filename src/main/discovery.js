const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const log = require('electron-log/main');

const execFileP = promisify(execFile);

function phpBinaryName() {
  return process.platform === 'win32' ? 'php.exe' : 'php';
}

async function readVersion(phpExe) {
  try {
    const { stdout } = await execFileP(phpExe, ['-v'], { timeout: 5000 });
    const match = stdout.match(/PHP\s+([\d.]+)/);
    return match ? match[1] : null;
  } catch (err) {
    log.debug('readVersion failed for', phpExe, err.message);
    return null;
  }
}

async function safeStat(p) {
  try { return await fsp.stat(p); } catch { return null; }
}

async function scanDir(baseDir, depth = 1) {
  const found = [];
  const stat = await safeStat(baseDir);
  if (!stat || !stat.isDirectory()) return found;

  const phpExe = path.join(baseDir, phpBinaryName());
  if (fs.existsSync(phpExe)) found.push(phpExe);

  if (depth > 0) {
    try {
      const entries = await fsp.readdir(baseDir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const nested = await scanDir(path.join(baseDir, e.name), depth - 1);
        found.push(...nested);
      }
    } catch { /* ignore */ }
  }
  return found;
}

function candidateRoots() {
  if (process.platform === 'win32') {
    return [
      'C:\\xampp\\php',
      'C:\\laragon\\bin\\php',
      'C:\\wamp64\\bin\\php',
      'C:\\wamp\\bin\\php',
      'C:\\php',
      'C:\\Program Files\\PHP',
    ];
  }
  if (process.platform === 'darwin') {
    return [
      '/opt/homebrew/opt',
      '/usr/local/opt',
      '/usr/local/bin',
      '/opt/homebrew/bin',
    ];
  }
  return [
    '/usr/bin',
    '/usr/local/bin',
    '/opt/php',
  ];
}

async function discoverSystemInstallations() {
  const results = [];
  const seen = new Set();

  for (const root of candidateRoots()) {
    const hits = await scanDir(root, 2);
    for (const exe of hits) {
      if (seen.has(exe.toLowerCase())) continue;
      seen.add(exe.toLowerCase());
      const version = await readVersion(exe);
      if (version) {
        results.push({
          source: inferSource(exe),
          path: exe,
          version,
          majorMinor: version.split('.').slice(0, 2).join('.'),
          managed: false,
        });
      }
    }
  }
  return results;
}

function inferSource(exe) {
  const p = exe.toLowerCase();
  if (p.includes('xampp')) return 'XAMPP';
  if (p.includes('laragon')) return 'Laragon';
  if (p.includes('wamp')) return 'WAMP';
  if (p.includes('homebrew') || p.includes('/opt/homebrew')) return 'Homebrew';
  return 'System';
}

module.exports = {
  discoverSystemInstallations,
  readVersion,
};
