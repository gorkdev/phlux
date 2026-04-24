const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const https = require('https');
const http = require('http');
const log = require('electron-log/main');

function get(url, onProgress, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        resolve(get(next, onProgress, redirectsLeft - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      resolve(res);
    });
    req.on('error', reject);
    req.setTimeout(60_000, () => req.destroy(new Error('Request timeout')));
  });
}

async function download(url, destFile, onProgress) {
  await fsp.mkdir(path.dirname(destFile), { recursive: true });
  log.info('Downloading', url, '->', destFile);
  const res = await get(url);
  const total = parseInt(res.headers['content-length'] || '0', 10);
  let received = 0;

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destFile);
    res.on('data', (chunk) => {
      received += chunk.length;
      if (onProgress && total) {
        onProgress({ received, total, percent: Math.round((received / total) * 100) });
      } else if (onProgress) {
        onProgress({ received, total: 0, percent: 0 });
      }
    });
    res.pipe(out);
    out.on('finish', () => out.close(resolve));
    out.on('error', reject);
    res.on('error', reject);
  });
  log.info('Downloaded', received, 'bytes');
  return destFile;
}

module.exports = { download };
