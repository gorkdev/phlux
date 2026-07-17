const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const log = require('electron-log/main');
const paths = require('./paths');
const { shimTargetRef, buildWindowsShim, resolveTargetRef } = require('./shim');
const { loadConfig, saveConfig } = require('./config');

const execFileP = promisify(execFile);

async function writeWindowsShim(activePhpExe) {
  const { ref, absolute } = shimTargetRef(paths.userData(), activePhpExe);

  await fsp.mkdir(paths.binDir(), { recursive: true });
  const activeDir = path.join(paths.userData(), 'active');
  await fsp.rm(activeDir, { recursive: true, force: true });
  await fsp.mkdir(activeDir, { recursive: true });

  await fsp.writeFile(path.join(activeDir, 'target.txt'), ref, 'ascii');

  const cmd = buildWindowsShim(absolute);
  for (const name of ['php.cmd', 'php.bat']) {
    await fsp.writeFile(path.join(paths.binDir(), name), cmd, 'ascii');
  }
}

async function writeUnixShim(activePhpExe) {
  await fsp.mkdir(paths.binDir(), { recursive: true });
  const link = path.join(paths.binDir(), 'php');
  try { await fsp.unlink(link); } catch { /* ignore */ }
  await fsp.symlink(activePhpExe, link);
}

async function readPath(scope) {
  const ps = `[Environment]::GetEnvironmentVariable('Path','${scope}')`;
  const { stdout } = await execFileP('powershell.exe', ['-NoProfile', '-Command', ps], { timeout: 10_000 });
  return (stdout || '').trim().split(';').filter(Boolean);
}

async function isOnUserPath() {
  if (process.platform !== 'win32') return true;
  try {
    const entries = await readPath('User');
    const binLower = path.normalize(paths.binDir()).toLowerCase();
    return entries.length > 0 && path.normalize(entries[0]).toLowerCase() === binLower;
  } catch (err) {
    log.warn('isOnUserPath failed', err.message);
    return false;
  }
}

async function addToUserPath() {
  if (process.platform !== 'win32') return addToUnixProfile();
  const binDir = paths.binDir();
  const ps = `$bin = '${binDir.replace(/'/g, "''")}'; $current = [Environment]::GetEnvironmentVariable('Path','User'); if ([string]::IsNullOrEmpty($current)) { $current = '' }; $parts = @($current -split ';' | Where-Object { $_ -and ($_.Trim().ToLower() -ne $bin.Trim().ToLower()) }); $parts = @($bin) + $parts; $new = ($parts -join ';'); [Environment]::SetEnvironmentVariable('Path', $new, 'User')`;
  await execFileP('powershell.exe', ['-NoProfile', '-Command', ps], { timeout: 10_000 });
  log.info('Pinned', binDir, 'to front of user PATH');
}

async function needsMachineElevation() {
  if (process.platform !== 'win32') return false;
  try {
    const machine = await readPath('Machine');
    const binLower = path.normalize(paths.binDir()).toLowerCase();
    const binIdx = machine.findIndex((p) => path.normalize(p).toLowerCase() === binLower);
    let firstPhpIdx = -1;
    for (let i = 0; i < machine.length; i++) {
      const exe = path.join(machine[i], 'php.exe');
      if (fs.existsSync(exe)) { firstPhpIdx = i; break; }
    }
    if (firstPhpIdx === -1) return false;
    if (binIdx === -1) return true;
    return binIdx > firstPhpIdx;
  } catch {
    return false;
  }
}

async function removeShim() {
  if (process.platform === 'win32') {
    for (const name of ['php.cmd', 'php.bat']) {
      try { await fsp.unlink(path.join(paths.binDir(), name)); } catch { /* ignore */ }
    }
  } else {
    try { await fsp.unlink(path.join(paths.binDir(), 'php')); } catch { /* ignore */ }
  }
  try { await fsp.rm(path.join(paths.userData(), 'active'), { recursive: true, force: true }); } catch { /* ignore */ }
}

async function elevatePinToMachinePath() {
  if (process.platform !== 'win32') throw new Error('Only supported on Windows');
  const binDir = paths.binDir();
  const inner = [
    `$bin = '${binDir.replace(/'/g, "''")}';`,
    `$current = [Environment]::GetEnvironmentVariable('Path','Machine');`,
    `if ([string]::IsNullOrEmpty($current)) { $current = '' };`,
    `$parts = @($current -split ';' | Where-Object { $_ -and ($_.Trim().ToLower() -ne $bin.Trim().ToLower()) });`,
    `$parts = @($bin) + $parts;`,
    `[Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'Machine');`,
  ].join(' ');
  const encoded = Buffer.from(inner, 'utf16le').toString('base64');
  const outer = `Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','${encoded}'`;
  try {
    await execFileP('powershell.exe', ['-NoProfile', '-Command', outer], { timeout: 120_000 });
    log.info('Pinned', binDir, 'to front of machine PATH (elevated)');
    return { ok: true };
  } catch (err) {
    log.warn('Elevation failed or cancelled', err.message);
    return { ok: false, error: err.message };
  }
}

async function detectConflicts() {
  if (process.platform !== 'win32') return { machineConflicts: [], userConflicts: [] };
  try {
    const [machine, user] = await Promise.all([readPath('Machine'), readPath('User')]);
    const isPhpDir = async (dir) => {
      try {
        const p = path.join(dir, 'php.exe');
        return fs.existsSync(p);
      } catch { return false; }
    };
    const binLower = path.normalize(paths.binDir()).toLowerCase();
    const machineConflicts = [];
    for (const d of machine) if (await isPhpDir(d)) machineConflicts.push(d);
    const userConflicts = [];
    for (const d of user) {
      if (path.normalize(d).toLowerCase() === binLower) continue;
      if (await isPhpDir(d)) userConflicts.push(d);
    }
    return { machineConflicts, userConflicts };
  } catch (err) {
    log.warn('detectConflicts failed', err.message);
    return { machineConflicts: [], userConflicts: [] };
  }
}

async function getSystemActive() {
  try {
    const cmd = process.platform === 'win32' ? 'php.exe' : 'php';
    const { stdout } = await execFileP(cmd, ['-v'], { timeout: 5000 });
    const match = stdout.match(/PHP\s+([\d.]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function addToUnixProfile() {
  const home = process.env.HOME;
  if (!home) return;
  const line = `export PATH="${paths.binDir()}:$PATH" # phlux`;
  const targets = [path.join(home, '.zshrc'), path.join(home, '.bashrc'), path.join(home, '.profile')];
  for (const file of targets) {
    try {
      let content = '';
      try { content = await fsp.readFile(file, 'utf8'); } catch { /* missing */ }
      if (content.includes('# phlux')) continue;
      await fsp.appendFile(file, `\n${line}\n`);
    } catch { /* ignore */ }
  }
}

async function activate(version) {
  const cfg = await loadConfig();
  const entry = cfg.installed[version];
  if (!entry) throw new Error(`PHP ${version} is not installed`);
  if (!fs.existsSync(entry.path)) throw new Error(`PHP binary missing at ${entry.path}`);

  if (process.platform === 'win32') {
    await writeWindowsShim(entry.path);
  } else {
    await writeUnixShim(entry.path);
  }

  await addToUserPath();

  // Another PHP earlier on the machine PATH would win over the shim, so the
  // switch only takes effect if the user accepts the elevation prompt.
  let shadowedBy = null;
  if (await needsMachineElevation()) {
    log.info('Auto-elevating to pin shim on machine PATH');
    const elevated = await elevatePinToMachinePath();
    if (!elevated.ok) {
      const { machineConflicts } = await detectConflicts();
      shadowedBy = machineConflicts[0] || 'another PHP on the machine PATH';
      log.warn('Machine PATH not updated; shim stays shadowed by', shadowedBy);
    }
  }

  cfg.activeVersion = version;
  await saveConfig(cfg);
  log.info('Activated PHP', version, shadowedBy ? `(shadowed by ${shadowedBy})` : '');
  return { version, path: entry.path, binDir: paths.binDir(), shadowedBy };
}

async function readShimTarget() {
  const pointer = path.join(paths.userData(), 'active', 'target.txt');
  if (!fs.existsSync(pointer)) return null;
  return resolveTargetRef(paths.userData(), await fsp.readFile(pointer, 'ascii'));
}

async function verifyActive() {
  if (process.platform === 'win32') {
    try {
      const target = await readShimTarget();
      if (!target) return null;
      const { stdout } = await execFileP(target, ['-v'], { timeout: 5000 });
      const match = stdout.match(/PHP\s+([\d.]+)/);
      return match ? match[1] : null;
    } catch { return null; }
  }
  const link = path.join(paths.binDir(), 'php');
  try {
    const { stdout } = await execFileP(link, ['-v'], { timeout: 5000 });
    const match = stdout.match(/PHP\s+([\d.]+)/);
    return match ? match[1] : null;
  } catch { return null; }
}

module.exports = { activate, verifyActive, isOnUserPath, addToUserPath, getSystemActive, detectConflicts, elevatePinToMachinePath, removeShim };
