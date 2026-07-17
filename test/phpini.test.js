const test = require('node:test');
const assert = require('node:assert');
const { buildPhpIni, ENABLE_EXTENSIONS } = require('../src/main/phpini');

// Excerpts taken verbatim from the shipped php.ini-development of each build.
const MODERN_INI = [
  '; extension_dir = "./"',
  '; On windows:',
  '; extension_dir = "ext"',
  ';extension=bz2',
  ';extension=curl',
  ';extension=fileinfo',
  ';extension=gd',
  ';extension=intl',
  ';extension=mbstring',
  ';extension=openssl',
  ';extension=pdo_mysql',
  ';extension=pdo_sqlite',
  ';extension=sqlite3',
  ';extension=zip',
  ';extension=oci8_19  ; Use with Oracle Database 19',
].join('\n');

const LEGACY_INI = [
  '; extension_dir = "./"',
  '; On windows:',
  '; extension_dir = "ext"',
  ';extension=php_bz2.dll',
  ';extension=php_curl.dll',
  ';extension=php_fileinfo.dll',
  ';extension=php_gd2.dll',
  ';extension=php_intl.dll',
  ';extension=php_mbstring.dll',
  ';extension=php_exif.dll      ; Must be after mbstring as it depends on it',
  ';extension=php_openssl.dll',
  ';extension=php_pdo_mysql.dll',
  ';extension=php_pdo_sqlite.dll',
  ';extension=php_sqlite3.dll',
].join('\n');

function enabled(ini) {
  return ini
    .split('\n')
    .filter((l) => /^extension=/.test(l))
    .map((l) => l.replace(/^extension=/, '').replace(/\s*;.*$/, '').trim());
}

test('PHP 7.2+ ini: every requested extension is uncommented under its bare name', () => {
  const out = buildPhpIni(MODERN_INI, 'C:\\data\\versions\\8.3\\ext');
  assert.deepStrictEqual(enabled(out).sort(), [...ENABLE_EXTENSIONS].sort());
});

test('PHP <=7.1 ini: extensions are uncommented under their php_*.dll name', () => {
  const out = buildPhpIni(LEGACY_INI, 'C:\\data\\versions\\7.1\\ext');
  // zip ships compiled into these builds, so there is no line to uncomment.
  assert.deepStrictEqual(enabled(out).sort(), [
    'php_curl.dll',
    'php_fileinfo.dll',
    'php_gd2.dll',
    'php_intl.dll',
    'php_mbstring.dll',
    'php_openssl.dll',
    'php_pdo_mysql.dll',
    'php_pdo_sqlite.dll',
    'php_sqlite3.dll',
  ]);
});

test('extensions that were not requested stay commented out', () => {
  for (const ini of [MODERN_INI, LEGACY_INI]) {
    const out = buildPhpIni(ini, 'C:\\data\\ext');
    assert.ok(/^;extension=(bz2|php_bz2\.dll)$/m.test(out), 'bz2 must remain disabled');
  }
  assert.ok(
    /^;extension=php_exif\.dll/m.test(buildPhpIni(LEGACY_INI, 'C:\\data\\ext')),
    'a commented line carrying a trailing comment must remain disabled'
  );
});

test('gd is not confused with gd2', () => {
  const out = buildPhpIni(';extension=gd\n;extension=gd2', 'C:\\data\\ext');
  assert.match(out, /^extension=gd$/m);
  assert.match(out, /^;extension=gd2$/m);
});

test('extension_dir is pointed at the version folder with forward slashes', () => {
  const out = buildPhpIni(MODERN_INI, 'C:\\data\\versions\\8.3\\ext');
  assert.match(out, /^extension_dir = "C:\/data\/versions\/8\.3\/ext"$/m);
  assert.ok(!/^;\s*extension_dir\s*=\s*"ext"/m.test(out), 'the windows default must be replaced');
  assert.match(out, /^; extension_dir = "\.\/"$/m, 'the unix default line is left untouched');
});
