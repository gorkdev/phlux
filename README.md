# Phlux

One-click PHP version switcher. Download, install and activate any PHP version from a clean desktop UI — no more editing `PATH` by hand.

> Status: **V1 (Windows, CLI only).** macOS & Linux and Apache/XAMPP integration are planned.

## Features

- Detects existing PHP installations on your system (XAMPP, Laragon, manual, Homebrew, apt)
- Downloads official PHP releases from a configurable source list
- Installs each version into an isolated folder under your user data directory
- Switches the active CLI version with a single click using a shim on `PATH`
- Persists your library across sessions

## Requirements

- Node.js 20+ (only needed to build from source)
- Windows 10/11 for V1

## Getting started

```bash
npm install
npm run dev
```

To produce an installer:

```bash
npm run build:win
```

The installer lands in `dist/`.

## How switching works

Phlux never touches your system-wide PHP installations. On first run it:

1. Creates a shim directory at `%APPDATA%\Phlux\bin` containing a `php.exe` proxy.
2. Adds that directory to your **user** `PATH` (once).
3. Points the shim at whichever version you activate.

Opening a **new** terminal is enough to see the new version — no reboot, no admin rights.

## Project layout

```
phlux/
├── src/
│   ├── main/          Electron main process (Node APIs)
│   ├── preload.js     Secure IPC bridge
│   └── renderer/      UI (HTML/CSS/JS)
├── assets/            App icons
└── build/             electron-builder resources
```

## License

MIT © ajans.io
