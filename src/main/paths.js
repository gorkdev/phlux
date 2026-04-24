const path = require('path');
const { app } = require('electron');

function userData() {
  return app.getPath('userData');
}

function versionsDir() {
  return path.join(userData(), 'versions');
}

function versionDir(version) {
  return path.join(versionsDir(), version);
}

function binDir() {
  return path.join(userData(), 'bin');
}

function shimPath() {
  return path.join(binDir(), process.platform === 'win32' ? 'php.exe' : 'php');
}

function activeLinkPath() {
  return path.join(userData(), 'active');
}

function configPath() {
  return path.join(userData(), 'config.json');
}

function sourcesPath() {
  return path.join(userData(), 'sources.json');
}

function downloadsDir() {
  return path.join(userData(), 'downloads');
}

module.exports = {
  userData,
  versionsDir,
  versionDir,
  binDir,
  shimPath,
  activeLinkPath,
  configPath,
  sourcesPath,
  downloadsDir,
};
