<div align="center">

# Phlux

**One-click PHP version switcher for Windows.**
macOS and Linux support is scaffolded but not production-ready yet.

Download, install and activate any PHP version from a clean desktop UI &mdash; no more editing `PATH` by hand, no UAC hunting in `sysdm.cpl`, no broken XAMPP setups.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D6.svg?logo=windows&logoColor=white)](#supported-platforms)
[![macOS / Linux](https://img.shields.io/badge/macOS%20%7C%20Linux-experimental-orange.svg)](#supported-platforms)
[![Electron](https://img.shields.io/badge/Electron-41-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node](https://img.shields.io/badge/Node-20%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

[Features](#features) &nbsp;&bull;&nbsp; [Quick start](#quick-start) &nbsp;&bull;&nbsp; [How it works](#how-it-works) &nbsp;&bull;&nbsp; [Tech stack](#tech-stack) &nbsp;&bull;&nbsp; [Roadmap](#roadmap)

</div>

---

> **Platform status**
>
> - **Windows 10 / 11 (x64)** &mdash; fully supported. This is the V1 target and the only platform we actively test against.
> - **macOS / Linux** &mdash; the discovery, switcher and shim plumbing is written but the default download sources are empty and installation has **not** been validated end-to-end. Expect rough edges until V2. See [Supported platforms](#supported-platforms) for details.

## Why Phlux

Juggling PHP versions is a recurring pain for developers who maintain legacy codebases alongside cutting-edge projects. Existing solutions each have friction:

- **XAMPP / WAMP** ship with a single PHP and expect you to reinstall for each version.
- **Laragon** bundles many versions but locks you into its ecosystem.
- **Manual installs** mean downloading ZIPs, extracting them, editing `php.ini`, and fighting the Windows `PATH` dialog every time.
- **Command-line managers** like `phpenv` and `phpbrew` are great on Unix but hostile on Windows.

Phlux treats PHP version management as a first-class desktop experience. One list, one click, versions installed side-by-side under your home directory, and a shim layer that makes `php -v` report whichever version you last activated &mdash; in every fresh terminal, system-wide.

## Features

- **System discovery** &mdash; scans for existing PHP installations from XAMPP, Laragon, WAMP, Homebrew, apt and common manual locations, then surfaces them as a read-only reference list.
- **One-click install** &mdash; pick a version from the library, click *Install*, watch the progress. Phlux downloads the official Windows build, extracts it to an isolated per-version folder, enables the usual extensions (`curl`, `mbstring`, `openssl`, `pdo_mysql`, `intl`, `zip`, `gd`, `fileinfo`, `sqlite3`, `pdo_sqlite`) and registers it.
- **Self-healing download URLs** &mdash; if the configured ZIP was rotated to the archives by a newer patch, Phlux transparently resolves the working URL via `windows.php.net`'s `releases.json` or the `/archives/` index.
- **Use existing XAMPP / Laragon** &mdash; no need to re-download PHP you already have. Phlux links the detected system binary into the active slot with one click.
- **Auto-elevated PATH fix** &mdash; the first activation pins Phlux's shim folder to the front of the **machine** `PATH` via a single UAC prompt, so the `php` command resolves to Phlux in every terminal, independent of user profile order. Subsequent activations need no elevation.
- **Instant switch, no reboot** &mdash; activating a different version rewrites a single text file that the shim reads. Every new terminal picks it up immediately; Apache/nginx setups are untouched.
- **Graceful fallback** &mdash; uninstall the active Phlux version and the shim is removed automatically, so the OS falls back to your original system PHP (XAMPP, Homebrew, etc.).
- **Cross-platform groundwork** &mdash; the shim model uses `.cmd/.bat` on Windows and symlinks with shell-profile hooks on macOS / Linux. The same storage and discovery logic works on all three.

## Screenshot

![Phlux main window](assets/screenshot.png)

<sub>(If the image does not render, a screenshot will be added once the first release is cut.)</sub>

## Quick start

### Prerequisites

- **Windows 10 / 11 (x64)** &mdash; the only fully supported platform for V1.
- **Node.js 20 LTS** or newer &mdash; only required to build from source.
- macOS / Linux users can still launch the app to explore the UI, but installing and activating PHP versions from the library will fail until the V2 adapters land.

### Run from source

```bash
git clone https://github.com/<your-handle>/phlux.git
cd phlux
npm install
npm run dev
```

`npm run dev` launches the app with `electronmon`, auto-reloading on file changes. DevTools opens in a detached window for inspection.

### Produce a Windows installer

```bash
npm run build:win
```

The signed installer lands in `dist/`.

## How it works

```
┌──────────────────────────────────────────────────────────────┐
│                          Phlux UI                            │
│  (Electron renderer, vanilla HTML/CSS/JS, contextIsolation)  │
└─────────────┬──────────────────────────────────┬─────────────┘
              │ IPC (preload.js)                 │
              ▼                                  ▼
┌──────────────────────────┐       ┌─────────────────────────────┐
│  Main process            │       │  Filesystem                 │
│                          │       │                             │
│  discovery.js → scans    │       │  %APPDATA%\Phlux\           │
│  downloader.js → fetch   │       │    ├── versions\8.x\...     │
│  resolver.js → URL        │       │    ├── bin\php.cmd         │
│  installer.js → extract  │       │    ├── active\target.txt    │
│  switcher.js → shim+PATH │       │    ├── config.json          │
│  ipc.js → bridge         │       │    └── sources.json         │
│  config.js → persistence │       │                             │
└──────────┬───────────────┘       └─────────────────────────────┘
           │ spawn / PowerShell
           ▼
  ┌────────────────────┐
  │  System PHP probes │   where.exe / php -v
  └────────────────────┘
```

### The shim trick

Phlux never edits the files of your existing XAMPP or Laragon installation. On first activation it:

1. Creates `%APPDATA%\Phlux\bin\php.cmd` (and `php.bat`), which reads `%APPDATA%\Phlux\active\target.txt` and executes whatever `php.exe` that file points to.
2. Pins that `bin` folder to the front of the **user** `PATH`.
3. If another PHP (like XAMPP) lives in the **machine** `PATH`, raises a UAC prompt once to pin the same folder to the front of the machine `PATH`. This is the only elevated step Phlux ever performs and it only happens the first time.

Switching versions is just overwriting `target.txt`. No process restart, no registry editing, no `refreshenv`. Opening a new terminal is enough.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| **Desktop shell** | [Electron 41](https://www.electronjs.org/) | Cross-platform, mature, tight integration with Node APIs needed for filesystem, child processes and PATH manipulation. |
| **UI** | Vanilla HTML + CSS + JavaScript | Two or three screens, zero bundler, zero framework overhead. Fast iteration, small binary. |
| **Main process** | Node.js 20 (bundled with Electron) | `child_process`, `fs/promises`, `https`, `path`, all first-party. |
| **Package & install** | [electron-builder 26](https://www.electron.build/) | NSIS installer on Windows, DMG on macOS, AppImage on Linux &mdash; declarative config. |
| **Dev loop** | [electronmon 2](https://github.com/catdad/electronmon) | Auto-restart on file changes without custom watchers. |
| **Archive extraction** | [adm-zip 0.5](https://github.com/cthackers/adm-zip) | Pure JS, no native dependencies, handles windows.php.net ZIPs reliably. |
| **Logging** | [electron-log 5](https://github.com/megahertz/electron-log) | Unified main/renderer logs that end up on disk for bug reports. |
| **Persistence** | `fs`-backed JSON (`config.json`, `sources.json`) | Small surface, explicit schema, trivially migratable. Replaces `electron-store` (which is ESM-only on v11). |
| **PATH / elevation** | PowerShell via `child_process.execFile` | `[Environment]::SetEnvironmentVariable('Path', ..., 'User' | 'Machine')` plus `Start-Process -Verb RunAs` for the one-time UAC prompt. |
| **Download URL resolution** | `windows.php.net` `releases.json` + `/archives/` HTML index | Self-heals when PHP patch rotations move the default URL. |

### Project layout

```
phlux/
├── src/
│   ├── main/
│   │   ├── index.js        ← Electron main entry
│   │   ├── paths.js        ← userData path helpers
│   │   ├── config.js       ← JSON config + sources
│   │   ├── discovery.js    ← System PHP scanner
│   │   ├── downloader.js   ← Streaming HTTP(S) download
│   │   ├── resolver.js     ← URL resolution (releases.json + archives)
│   │   ├── installer.js    ← Unzip, php.ini tweaks, linkExisting
│   │   ├── switcher.js     ← Shim, user PATH, machine PATH elevation
│   │   └── ipc.js          ← ipcMain handlers
│   ├── preload.js          ← contextBridge (window.api)
│   └── renderer/
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── assets/                  ← Icons (icon.ico / icon.icns / icon.png)
├── build/                   ← electron-builder resources
├── package.json
└── README.md
```

## Supported platforms

| OS | Status | What works today | What is missing |
| --- | --- | --- | --- |
| **Windows 10 / 11 (x64)** | **Fully supported** | Discovery, install, activate, auto PATH fix, system PHP fallback. | Code signing (see [Roadmap](#roadmap)). |
| **macOS 13+** (Apple Silicon &amp; Intel) | **Experimental** | Launches, discovery picks up Homebrew PHP, `php -v` readout, symlink-based shim + shell-profile hook. | `sources.json[darwin]` is empty; there is no Homebrew/tarball installer or PHP-FPM integration yet. Installing any version from the library will fail. Not signed/notarised. |
| **Linux** (AppImage target) | **Experimental** | Launches, discovery scans `/usr/bin`, `/usr/local/bin`, `/opt/php`, symlink shim + shell-profile hook. | `sources.json[linux]` is empty; no distro-specific package-manager adapter (apt / dnf / pacman). Installing any version from the library will fail. |

If you are comfortable using Phlux as a **viewer** for what is already on your Mac or Linux box (detected versions, active PHP readout) it works today. Full install / switch parity with Windows is a V2 goal.

## Configuration

Phlux stores all user data under `%APPDATA%\Phlux\` (Windows), `~/Library/Application Support/Phlux/` (macOS), or `~/.config/Phlux/` (Linux).

- `config.json` &mdash; installed versions and currently-active version.
- `sources.json` &mdash; per-platform download URLs per `major.minor`. New versions added in future Phlux releases are merged into your existing file automatically without overwriting your customisations.
- `versions/` &mdash; one folder per installed version, each a self-contained PHP distribution.
- `bin/` &mdash; the shim folder that lives on your `PATH`.
- `downloads/` &mdash; cached ZIPs (deleted after successful installs).

You can edit `sources.json` to point at your own mirrors or pin specific patches.

## Roadmap

### V2 &mdash; cross-platform parity

- [ ] **macOS installer** &mdash; Homebrew adapter (`brew install php@X.Y`, `brew unlink / link`) plus fallback to [liip/php-osx](https://php-osx.liip.ch/) tarballs.
- [ ] **Linux installer** &mdash; distro-aware adapter (Ondřej Surý PPA on Ubuntu, Remi repo on Fedora) with an [asdf-php](https://github.com/asdf-community/asdf-php) fallback.
- [ ] `.tar.gz` / tarball extraction path alongside the existing ZIP handler.
- [ ] PHP-FPM integration (`brew services restart php@X.Y`, `systemctl restart php8.3-fpm`) so Apache / nginx setups pick up the switch automatically.
- [ ] Signed & notarised macOS DMG; signed Linux AppImage where the format allows.

### V3 &mdash; polish and distribution

- [ ] Dark / light theme toggle.
- [ ] Composer install per PHP version.
- [ ] `php.ini` editor inside the app (enable extensions, set `memory_limit`, etc.).
- [ ] Apache / nginx config hooks on Windows too.
- [ ] Auto-update via [electron-updater](https://www.electron.build/auto-update).
- [ ] Code signing via [Azure Trusted Signing](https://learn.microsoft.com/azure/trusted-signing/) so Windows SmartScreen / Smart App Control stop warning on fresh installs.
- [ ] Microsoft Store + Homebrew Cask + Winget manifests.

## Contributing

Pull requests are welcome. For non-trivial changes, open an issue first to discuss the direction.

```bash
git clone https://github.com/<your-handle>/phlux.git
cd phlux
npm install
npm run dev
```

Code style is intentionally minimal: no linter hooks, no formatter, no test framework yet. Keep modules small and focused, prefer Node built-ins over dependencies, and avoid introducing TypeScript without consensus.

## Troubleshooting

**The `php -v` command still reports my old version after activating.**
Open a **new** terminal. Windows resolves `PATH` at shell start; the one you had open before the first activation still holds the old value.

**SmartScreen or Smart App Control blocks part of the install.**
Until a signed release is shipped, exclude `%APPDATA%\Phlux` from Windows Security &rarr; Virus &amp; threat protection &rarr; Exclusions. This is a one-time step for the developer build.

**UAC prompt keeps appearing on every activation.**
It should only appear once, the first time Phlux needs to edit the machine `PATH`. If it keeps firing, check that your machine `PATH` actually contains `%APPDATA%\Phlux\bin` at position 0 &mdash; an aggressive antivirus may be reverting the change.

## License

Released under the [MIT License](LICENSE).

Copyright &copy; ajans.io
