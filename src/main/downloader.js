const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const log = require('electron-log/main');

function get(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    // A redirect must not be able to downgrade the transport: these archives are
    // executable code, and sources.json is editable by hand.
    if (!url.startsWith('https:')) return reject(new Error(`Refusing to download over plain HTTP: ${url}`));
    const req = https.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        resolve(get(next, redirectsLeft - 1));
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

async function download(url, destFile, onProgress, expectedSha256) {
  await fsp.mkdir(path.dirname(destFile), { recursive: true });
  log.info('Downloading', url, '->', destFile);
  const res = await get(url);
  const total = parseInt(res.headers['content-length'] || '0', 10);
  const hash = crypto.createHash('sha256');
  let received = 0;
  // The renderer rebuilds the whole version grid per event, so emitting one per
  // chunk would spend more time painting than downloading.
  let lastPercent = -1;

  try {
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(destFile);
      const fail = (err) => { out.destroy(); res.destroy(); reject(err); };

      res.on('data', (chunk) => {
        received += chunk.length;
        hash.update(chunk);
        if (!onProgress) return;
        const percent = total ? Math.round((received / total) * 100) : 0;
        if (percent === lastPercent) return;
        lastPercent = percent;
        onProgress({ received, total, percent });
      });
      res.pipe(out);
      out.on('finish', () => out.close((err) => (err ? reject(err) : resolve())));
      out.on('error', fail);
      res.on('error', fail);
    });

    if (total && received !== total) {
      throw new Error(`Download truncated: expected ${total} bytes but got ${received}`);
    }

    const actual = hash.digest('hex');
    if (expectedSha256 && actual.toLowerCase() !== expectedSha256.toLowerCase()) {
      throw new Error(
        `Checksum mismatch for ${path.basename(destFile)}. Expected ${expectedSha256}, got ${actual}. ` +
        `The download was discarded.`
      );
    }
    log.info('Downloaded', received, 'bytes', expectedSha256 ? '(sha256 verified)' : '(no checksum published)');
    return destFile;
  } catch (err) {
    // Never leave a partial or unverified archive behind for the extractor to find.
    await fsp.rm(destFile, { force: true }).catch(() => {});
    throw err;
  }
}

module.exports = { download };
