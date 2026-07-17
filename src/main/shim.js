const path = require('path');

const isAscii = (s) => /^[\x20-\x7E]*$/.test(s);

// cmd.exe decodes .cmd files, and the files `for /f` reads, using the console's OEM
// codepage (CP857 on a Turkish install) — never UTF-8. Any non-ASCII byte written
// into them is mis-decoded at run time. userData sits under the user's profile, so a
// username like "Görkem" would corrupt every path baked into the shim.
//
// The shim stays ASCII-only instead: it derives the Phlux root from %~dp0, which cmd
// expands from its own knowledge of where the script lives rather than from any text
// we encoded, and target.txt holds a path relative to that root
// ("versions\8.3\php.exe" — ASCII regardless of the username). Externally linked
// binaries (XAMPP, Laragon) live outside the root and must be stored absolute.
function shimTargetRef(root, activePhpExe) {
  const rel = path.win32.relative(root, activePhpExe);
  if (rel && !rel.startsWith('..') && !path.win32.isAbsolute(rel)) {
    return { ref: rel, absolute: false };
  }
  if (!isAscii(activePhpExe)) {
    throw new Error(
      `PHP is installed at a path containing non-ASCII characters (${activePhpExe}), which the ` +
      `Windows shim cannot resolve. Move it to an ASCII-only path, or install this version ` +
      `through Phlux instead of linking it.`
    );
  }
  return { ref: activePhpExe, absolute: true };
}

// setlocal keeps PHLUX_* out of the caller's environment; exit /b forwards the exit
// code that setlocal would otherwise swallow.
function buildWindowsShim(absolute) {
  const invoke = absolute ? '"%PHLUX_PHP%"' : '"%PHLUX_ROOT%\\%PHLUX_PHP%"';
  return [
    '@echo off',
    'setlocal EnableExtensions',
    'set "PHLUX_ROOT=%~dp0.."',
    'if not exist "%PHLUX_ROOT%\\active\\target.txt" (',
    '  echo phlux: no active PHP version. Open Phlux and activate one.>&2',
    '  exit /b 9009',
    ')',
    'for /f "usebackq delims=" %%A in ("%PHLUX_ROOT%\\active\\target.txt") do set "PHLUX_PHP=%%A"',
    `${invoke} %*`,
    'exit /b %ERRORLEVEL%',
    '',
  ].join('\r\n');
}

// Mirrors what the shim does with target.txt: anything not already absolute is
// taken as relative to the Phlux root.
function resolveTargetRef(root, ref) {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  return path.win32.isAbsolute(trimmed) ? trimmed : path.win32.join(root, trimmed);
}

module.exports = { shimTargetRef, buildWindowsShim, resolveTargetRef, isAscii };
