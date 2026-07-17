# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-07-17

### Added

- PHP 7.1 and 7.0 in the default Windows source catalogue. Both are VC14 x64 builds and need the Visual C++ 2015–2022 redistributable, which is already present on most machines.
- Unit tests (`npm test`) for `php.ini` generation and Windows shim generation.

### Fixed

- Extensions were not enabled at all when installing PHP 7.1 or older. PHP 7.2 renamed the `php.ini-development` entries from `;extension=php_curl.dll` to `;extension=curl`, and only the newer spelling was recognised. Both are now handled, including `gd`, which older builds ship as `php_gd2.dll`. `zip` is compiled into builds up to 7.1 and correctly needs no entry.
- The shim broke on any machine whose username contains non-ASCII characters (for example `C:\Users\Görkem`). `cmd.exe` decodes `.cmd` files using the console OEM codepage rather than UTF-8, so the baked-in path was mis-decoded at run time. The shim now derives its root from `%~dp0` and stores managed versions as a root-relative, ASCII-only path.
- Activation reported success when the UAC prompt was cancelled, leaving `php` resolving to the PHP that shadows the shim on the machine `PATH`. The UI now names the shadowing installation and explains how to fix it.
- `PHLUX_PHP` leaked into the calling shell's environment; the shim now uses `setlocal`.

## [0.1.0] - 2026-05-07

Initial public preview. Windows is fully supported; macOS and Linux launch but cannot install PHP versions yet.

### Added

- Electron-based desktop UI for managing PHP versions.
- System discovery for existing PHP installations (XAMPP, Laragon, WAMP, Homebrew, apt, common manual locations).
- One-click install of PHP versions from `windows.php.net`, with extraction into per-version isolated folders.
- Default extension activation on install: `curl`, `mbstring`, `openssl`, `pdo_mysql`, `intl`, `zip`, `gd`, `fileinfo`, `sqlite3`, `pdo_sqlite`.
- Self-healing download URL resolver that falls back to `releases.json` and the `/archives/` index when a configured ZIP is rotated.
- Link-existing flow for PHP installations already on the machine (XAMPP / Laragon / Homebrew).
- Auto-elevated machine `PATH` fix on first activation, via a single UAC PowerShell prompt.
- Shim-based version switching: a single text file (`active/target.txt`) decides which PHP `php -v` resolves to. No reboot or `refreshenv` required.
- Graceful fallback to system PHP when the active Phlux version is uninstalled.
- Cross-platform groundwork: symlink + shell-profile shim model on macOS / Linux (sources catalogue not yet populated).
- Persistent JSON configuration (`config.json`, `sources.json`) under the platform user-data directory.
- Unified main + renderer logging via `electron-log`.
- App icon and `BrowserWindow` icon resolver (`assets/icons/`).
- electron-builder packaging for NSIS (Windows), DMG (macOS) and AppImage (Linux).

### Known limitations

- macOS and Linux installers cannot fetch PHP yet (`sources.json` ships empty for those platforms).
- Windows installer is unsigned; SmartScreen may warn on first run.
- No automatic update mechanism yet (planned for V3).

[Unreleased]: https://github.com/gorkdev/phlux/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/gorkdev/phlux/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/gorkdev/phlux/releases/tag/v0.1.0
