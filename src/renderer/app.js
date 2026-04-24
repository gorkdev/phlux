const phluxApi = window.api;

console.log('[phlux] renderer booted. bridge:', !!phluxApi);

if (!phluxApi) {
  document.body.innerHTML = `
    <div style="padding:40px;font-family:system-ui;color:#f87171;background:#0f1115;min-height:100vh;">
      <h2>Preload bridge not loaded</h2>
      <p>window.api is undefined. Check the terminal log for a "preload-error" entry, or open DevTools (Ctrl+Shift+I) and copy the red error to report back.</p>
    </div>`;
  throw new Error('phlux preload bridge missing');
}

const el = {
  activePill: document.getElementById('active-pill'),
  activeLabel: document.getElementById('active-label'),
  versionGrid: document.getElementById('version-grid'),
  systemList: document.getElementById('system-list'),
  footerStatus: document.getElementById('footer-status'),
  openData: document.getElementById('open-data'),
  cardTpl: document.getElementById('version-card-template'),
};

let state = null;
const progressByVersion = new Map();

function setStatus(text) {
  el.footerStatus.textContent = text;
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function renderActive() {
  const active = state.activeResolved;
  if (active) {
    el.activePill.classList.add('online');
    const suffix = state.activeSource === 'system' ? ' (system)' : '';
    el.activeLabel.textContent = `Active: PHP ${active}${suffix}`;
  } else {
    el.activePill.classList.remove('online');
    el.activeLabel.textContent = 'No active version';
  }
}

function findSystemMatch(majorMinor) {
  return state.system.find((s) => s.majorMinor === majorMinor);
}

function renderSystem() {
  el.systemList.innerHTML = '';
  if (!state.system.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No system PHP installations detected.';
    el.systemList.appendChild(li);
    return;
  }
  for (const s of state.system) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${s.source} · PHP ${s.version}</strong>
        <div class="path">${s.path}</div>
      </div>
    `;
    el.systemList.appendChild(li);
  }
}

function renderCard(version) {
  const frag = el.cardTpl.content.cloneNode(true);
  const card = frag.querySelector('.card');
  card.dataset.version = version;
  frag.querySelector('.version').textContent = `PHP ${version}`;

  const installed = state.config.installed[version];
  const isActive = state.config.activeVersion === version;
  const systemMatch = findSystemMatch(version);
  const badge = frag.querySelector('.badge');

  if (isActive) {
    badge.textContent = 'Active';
    badge.classList.add('active');
    card.classList.add('active');
  } else if (installed && installed.managed === false) {
    badge.textContent = `System · ${installed.source || 'External'}`;
    badge.classList.add('installed');
  } else if (installed) {
    badge.textContent = 'Installed';
    badge.classList.add('installed');
  } else if (systemMatch) {
    badge.textContent = `Detected · ${systemMatch.source}`;
    badge.classList.add('installed');
  } else {
    badge.textContent = 'Available';
  }

  const resolved = frag.querySelector('.resolved');
  if (installed?.resolvedVersion) {
    const src = installed.managed === false ? ` · ${installed.source}` : '';
    resolved.textContent = `Build ${installed.resolvedVersion}${src}`;
  } else if (systemMatch) {
    resolved.textContent = `Build ${systemMatch.version} · ${systemMatch.source}`;
  } else {
    resolved.textContent = 'Not yet installed';
  }

  const btnInstall = frag.querySelector('[data-action="install"]');
  const btnActivate = frag.querySelector('[data-action="activate"]');
  const btnUninstall = frag.querySelector('[data-action="uninstall"]');

  if (installed) {
    btnInstall.hidden = true;
    btnActivate.hidden = false;
    btnUninstall.hidden = false;
    btnActivate.textContent = isActive ? 'Active' : 'Activate';
    btnActivate.disabled = isActive;
    if (installed.managed === false) {
      btnUninstall.textContent = 'Unlink';
    }
  } else if (systemMatch) {
    btnInstall.textContent = `Use ${systemMatch.source}`;
    btnInstall.dataset.action = 'use-system';
  }

  const progress = progressByVersion.get(version);
  if (progress) {
    const bar = frag.querySelector('.progress');
    bar.hidden = false;
    bar.style.setProperty('--pct', `${progress.percent || 0}%`);
    frag.querySelector('.progress-label').textContent =
      progress.stage === 'resolve'
        ? 'Finding latest patch…'
        : progress.stage === 'download'
          ? `Downloading… ${progress.percent || 0}%`
          : progress.stage === 'extract'
            ? 'Extracting…'
            : 'Finalizing…';
    btnInstall.disabled = true;
    btnActivate.disabled = true;
    btnUninstall.disabled = true;
  }

  btnInstall.addEventListener('click', () => {
    if (btnInstall.dataset.action === 'use-system' && systemMatch) {
      useSystem(version, systemMatch);
    } else {
      installVersion(version);
    }
  });
  btnActivate.addEventListener('click', () => activateVersion(version));
  btnUninstall.addEventListener('click', () => uninstallVersion(version));

  return frag;
}

function renderVersions() {
  el.versionGrid.innerHTML = '';
  const sourceVersions = Object.keys(state.sources);
  const installedVersions = Object.keys(state.config.installed);
  const all = [...new Set([...sourceVersions, ...installedVersions])].sort(compareVersions);

  if (!all.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No versions configured for this platform yet. Add URLs to sources.json.';
    el.versionGrid.appendChild(empty);
    return;
  }

  for (const v of all) el.versionGrid.appendChild(renderCard(v));
}

function render() {
  renderActive();
  renderVersions();
  renderSystem();
}

async function refresh() {
  try {
    console.log('[api] fetching state…');
    state = await phluxApi.getState();
    console.log('[api] state received:', state);
    render();
  } catch (err) {
    console.error('[api] getState failed:', err);
    setStatus(`Failed to load state: ${err.message}`);
    el.activeLabel.textContent = 'Error';
    el.systemList.innerHTML = `<li class="muted" style="color:#f87171">Error: ${err.message}</li>`;
  }
}

async function installVersion(version) {
  progressByVersion.set(version, { stage: 'download', percent: 0 });
  setStatus(`Installing PHP ${version}…`);
  renderVersions();

  const res = await phluxApi.install(version);
  progressByVersion.delete(version);

  if (!res.ok) {
    setStatus(`Install failed: ${res.error}`);
  } else {
    setStatus(`PHP ${version} installed.`);
  }
  await refresh();
}

async function useSystem(version, systemMatch) {
  setStatus(`Linking ${systemMatch.source} PHP ${systemMatch.version}…`);
  const res = await phluxApi.linkExisting({
    majorMinor: version,
    path: systemMatch.path,
    source: systemMatch.source,
  });
  if (!res.ok) {
    setStatus(`Link failed: ${res.error}`);
    return;
  }
  setStatus(`Linked. Activating…`);
  const act = await phluxApi.activate(version);
  if (!act.ok) {
    setStatus(`Activation failed: ${act.error}`);
  } else {
    setStatus(`PHP ${version} is active via ${systemMatch.source}. Open a new terminal.`);
  }
  await refresh();
}

async function activateVersion(version) {
  setStatus(`Activating PHP ${version}… (you may see a UAC prompt on first activation)`);
  const res = await phluxApi.activate(version);
  if (!res.ok) {
    setStatus(`Activation failed: ${res.error}`);
  } else {
    setStatus(`PHP ${version} is now active. Open a new terminal to use it.`);
  }
  await refresh();
}

async function uninstallVersion(version) {
  setStatus(`Removing PHP ${version}…`);
  const res = await phluxApi.uninstall(version);
  if (!res.ok) {
    setStatus(`Remove failed: ${res.error}`);
  } else {
    setStatus(`PHP ${version} removed.`);
  }
  await refresh();
}

phluxApi.onInstallProgress((payload) => {
  if (payload.stage === 'done') {
    progressByVersion.delete(payload.version);
  } else {
    progressByVersion.set(payload.version, payload);
  }
  if (state) renderVersions();
});

el.openData.addEventListener('click', () => {
  if (state?.paths?.userData) phluxApi.openFolder(state.paths.userData);
});

refresh().catch((err) => {
  setStatus(`Failed to load: ${err.message}`);
});
