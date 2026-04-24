const https = require('https');
const log = require('electron-log/main');

const RELEASES_URL = 'https://windows.php.net/downloads/releases/releases.json';
const ARCHIVES_INDEX = 'https://windows.php.net/downloads/releases/archives/';
const BASE = 'https://windows.php.net';

function fetchText(url, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        return resolve(fetchText(new URL(res.headers.location, url).toString(), timeoutMs));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Resolver timeout')));
  });
}

async function headOk(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      res.resume();
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        resolve(headOk(new URL(res.headers.location, url).toString()));
        return;
      }
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(8_000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function resolveFromReleases(majorMinor) {
  try {
    const body = await fetchText(RELEASES_URL);
    const data = JSON.parse(body);
    const entry = data[majorMinor];
    if (!entry) return null;
    const asset = entry['nts-zip'] || entry['zip'];
    if (!asset?.path) return null;
    return new URL(asset.path, BASE).toString();
  } catch (err) {
    log.warn('releases.json lookup failed', err.message);
    return null;
  }
}

async function resolveFromArchives(majorMinor) {
  try {
    const html = await fetchText(ARCHIVES_INDEX);
    const prefix = `php-${majorMinor}.`;
    const re = new RegExp(`href="(${prefix.replace(/\./g, '\\.')}[0-9]+-nts-Win32-[^"]+-x64\\.zip)"`, 'g');
    const matches = [...html.matchAll(re)].map((m) => m[1]);
    if (!matches.length) return null;
    matches.sort((a, b) => {
      const pa = parseInt(a.match(/php-\d+\.\d+\.(\d+)/)[1], 10);
      const pb = parseInt(b.match(/php-\d+\.\d+\.(\d+)/)[1], 10);
      return pb - pa;
    });
    return `${ARCHIVES_INDEX}${matches[0]}`;
  } catch (err) {
    log.warn('archives lookup failed', err.message);
    return null;
  }
}

async function resolveDownloadUrl(majorMinor, configuredUrl) {
  if (configuredUrl && (await headOk(configuredUrl))) {
    return { url: configuredUrl, via: 'configured' };
  }
  const released = await resolveFromReleases(majorMinor);
  if (released && (await headOk(released))) {
    return { url: released, via: 'releases.json' };
  }
  const archived = await resolveFromArchives(majorMinor);
  if (archived && (await headOk(archived))) {
    return { url: archived, via: 'archives' };
  }
  throw new Error(
    `Could not resolve a download URL for PHP ${majorMinor}. ` +
    `Configured URL is unreachable, and neither releases.json nor the archives index returned a usable match.`
  );
}

module.exports = { resolveDownloadUrl };
