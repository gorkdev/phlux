const ENABLE_EXTENSIONS = [
  'curl',
  'fileinfo',
  'gd',
  'intl',
  'mbstring',
  'openssl',
  'pdo_mysql',
  'pdo_sqlite',
  'sqlite3',
  'zip',
];

// Windows builds up to PHP 7.1 ship gd as php_gd2.dll; 7.2+ renamed it to plain gd.
const EXTENSION_ALIASES = {
  gd: ['gd', 'gd2'],
};

// PHP 7.2 dropped the php_*.dll spelling in php.ini-development in favour of the
// bare extension name, so both forms have to be recognised. An extension with no
// matching line is either compiled into the build (zip, on <= 7.1) or not shipped
// at all — in both cases there is nothing to uncomment.
// \s must not be used here: it matches newlines, which lets a pattern run past the
// end of its line and swallow the following one.
const H = '[ \\t]*';

function enableExtension(ini, ext) {
  for (const name of EXTENSION_ALIASES[ext] || [ext]) {
    const modern = new RegExp(`^;${H}extension${H}=${H}${name}${H}(;.*)?$`, 'm');
    if (modern.test(ini)) return ini.replace(modern, `extension=${name}`);

    const legacy = new RegExp(`^;${H}extension${H}=${H}php_${name}\\.dll`, 'm');
    if (legacy.test(ini)) return ini.replace(legacy, `extension=php_${name}.dll`);
  }
  return ini;
}

function buildPhpIni(devIni, extDirAbsolute) {
  let ini = devIni;
  for (const ext of ENABLE_EXTENSIONS) ini = enableExtension(ini, ext);
  const extDir = extDirAbsolute.replace(/\\/g, '/');
  return ini.replace(
    new RegExp(`^;${H}extension_dir${H}=${H}"ext"`, 'm'),
    `extension_dir = "${extDir}"`
  );
}

module.exports = { buildPhpIni, enableExtension, ENABLE_EXTENSIONS };
