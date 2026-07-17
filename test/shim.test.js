const test = require('node:test');
const assert = require('node:assert');
const { shimTargetRef, buildWindowsShim, resolveTargetRef, isAscii } = require('../src/main/shim');

const ASCII_ROOT = 'C:\\Users\\Gorkem\\AppData\\Roaming\\Phlux';
const TURKISH_ROOT = 'C:\\Users\\Görkem\\AppData\\Roaming\\Phlux';

test('a managed version is stored relative to the Phlux root', () => {
  const t = shimTargetRef(ASCII_ROOT, `${ASCII_ROOT}\\versions\\8.3\\php.exe`);
  assert.deepStrictEqual(t, { ref: 'versions\\8.3\\php.exe', absolute: false });
});

test('a managed version under a non-ASCII username still yields an ASCII pointer', () => {
  // The whole point: the username never reaches the shim, so cmd's OEM decoding
  // has nothing to corrupt.
  const t = shimTargetRef(TURKISH_ROOT, `${TURKISH_ROOT}\\versions\\7.1\\php.exe`);
  assert.deepStrictEqual(t, { ref: 'versions\\7.1\\php.exe', absolute: false });
  assert.ok(isAscii(t.ref));
});

test('every byte written into the shim is ASCII for a non-ASCII root', () => {
  const { ref, absolute } = shimTargetRef(TURKISH_ROOT, `${TURKISH_ROOT}\\versions\\8.4\\php.exe`);
  // Nothing cmd reads may carry a byte the OEM codepage would decode differently.
  for (const content of [ref, buildWindowsShim(absolute)]) {
    assert.ok(Buffer.from(content, 'utf8').every((b) => b < 0x80), `non-ASCII byte in: ${content}`);
  }
});

test('an externally linked binary is stored absolute', () => {
  const t = shimTargetRef(ASCII_ROOT, 'C:\\xampp\\php\\php.exe');
  assert.deepStrictEqual(t, { ref: 'C:\\xampp\\php\\php.exe', absolute: true });
});

test('an external binary on a non-ASCII path is rejected instead of silently breaking', () => {
  assert.throws(
    () => shimTargetRef(ASCII_ROOT, 'C:\\Ç\\php\\php.exe'),
    /non-ASCII/
  );
});

test('the shim resolves its root from %~dp0 rather than a baked-in path', () => {
  for (const absolute of [true, false]) {
    const cmd = buildWindowsShim(absolute);
    assert.match(cmd, /set "PHLUX_ROOT=%~dp0\.\."/);
    assert.ok(!cmd.includes('C:\\Users'), 'no absolute user path may be baked into the shim');
  }
});

test('the shim isolates its variables and forwards the exit code', () => {
  const cmd = buildWindowsShim(false);
  assert.match(cmd, /^setlocal EnableExtensions$/m);
  assert.match(cmd, /^exit \/b %ERRORLEVEL%$/m);
  assert.match(cmd, /\r\n$/, 'batch files need CRLF line endings');
});

test('a relative pointer resolves back to the original binary', () => {
  const exe = `${TURKISH_ROOT}\\versions\\8.3\\php.exe`;
  const { ref } = shimTargetRef(TURKISH_ROOT, exe);
  assert.strictEqual(resolveTargetRef(TURKISH_ROOT, ref), exe);
});

test('an absolute pointer resolves to itself and ignores the root', () => {
  assert.strictEqual(
    resolveTargetRef(ASCII_ROOT, 'C:\\xampp\\php\\php.exe'),
    'C:\\xampp\\php\\php.exe'
  );
});

test('an empty pointer resolves to nothing', () => {
  assert.strictEqual(resolveTargetRef(ASCII_ROOT, '  \r\n'), null);
});
