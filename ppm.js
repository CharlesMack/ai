import { processAIRequest } from './ai-assistant.js';

const APPDROPS = [
  { id: 'ai-assistant', name: 'AI Assistant', emoji: '🤖', path: '', description: 'AI-powered task assistant', version: '1.0.0', category: 'AI' },
  { id: 'atlas', name: 'Atlas', emoji: '🌍', path: 'https://charlesmack.github.io/OnePagerMiniOS/appdrops/atlas/index.html', description: 'Global mapping tool', version: '1.0.0', category: 'Tools' },
  { id: 'aurora', name: 'Aurora', emoji: '🌌', path: 'https://charlesmack.github.io/OnePagerMiniOS/appdrops/aurora/index.html', description: 'Visual effects suite', version: '1.2.1', category: 'Media' },
  { id: 'performance-monitor', name: 'Performance Monitor', emoji: '📊', path: 'https://charlesmack.github.io/OnePagerMiniOS/appdrops/performance-monitor/index.html', description: 'Monitors device load', version: '1.0.0', category: 'Tools' }
];

let apps = [...APPDROPS];
let openApps = [];
let isEditMode = false;
let draggedTile = null;
let placeholder = null;
let touchOffsetX = 0;
let touchOffsetY = 0;
let highestZ = 10;
let isOnline = navigator.onLine;
let autoSyncEnabled = localStorage.getItem('autoSync') === 'true';
let aiFeaturesEnabled = localStorage.getItem('aiFeatures') !== 'false';

const phone = document.getElementById('phone');
const grid = document.getElementById('grid');
const toolbar = document.getElementById('toolbar');
const sortAZ = document.getElementById('sortAZ');
const done = document.getElementById('done');
const homeBtn = document.getElementById('homeBtn');
const appSwitcherBtn = document.getElementById('appSwitcherBtn');
const appSwitcher = document.getElementById('appSwitcher');
const appSwitcherBody = document.getElementById('appSwitcherBody');
const closeSwitcher = document.getElementById('closeSwitcher');
const scrollIndicator = document.getElementById('scrollIndicator');
const timeElement = document.getElementById('time');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const colorPicker = document.getElementById('colorPicker');
const resetColorBtn = document.getElementById('resetColor');
const syncAppDropsBtn = document.getElementById('syncAppDrops');
const cleanAppDropsBtn = document.getElementById('cleanAppDrops');
const autoSyncToggle = document.getElementById('autoSyncToggle');
const aiPerformanceToggle = document.getElementById('aiPerformanceToggle');
const syncStatus = document.getElementById('syncStatus');
const syncLog = document.getElementById('syncLog');
const appSearch = document.getElementById('appSearch');
const categoryFilter = document.getElementById('categoryFilter');
const mesh = document.getElementById('mesh');
const openPerformanceMonitorBtn = document.getElementById('openPerformanceMonitor');

let isTouch = 'ontouchstart' in window;
let lastTouchTime = 0;

document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchTime <= 300) {
    e.preventDefault();
  }
  lastTouchTime = now;
}, { passive: false });

document.body.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  const startY = e.touches[0].clientY;
  document.body.addEventListener('touchmove', (e) => {
    const y = e.touches[0].clientY;
    if (y > startY && window.scrollY === 0) {
      e.preventDefault();
    }
  }, { passive: false });
}, { passive: false });

function detectLowSpec() {
  const isLowMemory = 'deviceMemory' in navigator && navigator.deviceMemory < 4;
  const isLowCores = 'hardwareConcurrency' in navigator && navigator.hardwareConcurrency < 4;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isLowMemory || isLowCores || prefersReduced) {
    document.body.classList.add('low-spec');
    aiFeaturesEnabled = false;
    aiPerformanceToggle.checked = false;
    localStorage.setItem('aiFeatures', 'false');
    logSync('Low-spec mode enabled; AI features disabled.');
  }
}

function loadSavedAppDrops() {
  const savedApps = localStorage.getItem('appDrops');
  if (savedApps) {
    apps = JSON.parse(savedApps);
    renderTiles();
    populateCategories();
  }
}

function saveAppDrops() {
  localStorage.setItem('appDrops', JSON.stringify(apps));
}

function logSync(message) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const logEntry = document.createElement('div');
  logEntry.textContent = `[${time}] ${message}`;
  syncLog.appendChild(logEntry);
  syncLog.scrollTop = syncLog.scrollHeight;
}

function updateNetworkStatus() {
  isOnline = navigator.onLine;
  syncAppDropsBtn.disabled = !isOnline;
  cleanAppDropsBtn.disabled = !isOnline;
  syncStatus.textContent = isOnline ? 'Online: Ready to sync' : 'Offline: Sync unavailable';
  mesh.textContent = isOnline ? '⬡3' : '⬡✕';
  if (isOnline) {
    logSync('Network connection re-established. Ready to sync AppDrops.');
  } else {
    logSync('Network connection lost. Sync disabled.');
  }
}

async function syncAppDrops() {
  if (!isOnline) {
    logSync('Cannot sync: No network connection.');
    syncStatus.textContent = 'Offline: Sync unavailable';
    return;
  }

  syncAppDropsBtn.disabled = true;
  cleanAppDropsBtn.disabled = true;
  syncStatus.textContent = 'Syncing...';
  logSync('Initiating AppDrop sync with command center...');

  try {
    let remoteApps = [];
    try {
      const response = await fetch('https://charlesmack.github.io/command/appdrops/appdrops.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      remoteApps = await response.json();
      logSync('Fetched AppDrops from JSON endpoint.');
    } catch (jsonError) {
      logSync(`JSON fetch failed: ${jsonError.message}. Falling back to HTML parsing.`);
      const response = await fetch('https://charlesmack.github.io/command/appdrops/index.html');
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const appDropLinks = doc.querySelectorAll('a.appdrop-item');
      remoteApps = Array.from(appDropLinks).map(link => ({
        id: link.href.split('/').pop().replace('.html', ''),
        name: link.textContent.trim(),
        emoji: link.dataset.emoji || '🌟',
        path: link.href,
        description: link.dataset.description || 'No description available',
        version: link.dataset.version || 'Unknown',
        category: link.dataset.category || 'Uncategorized'
      }));
    }

    const existingIds = new Set(apps.map(app => app.id));
    const newApps = remoteApps.filter(app => !existingIds.has(app.id));
    apps = [...apps, ...newApps];
    saveAppDrops();
    renderTiles();
    populateCategories();

    const badge = document.getElementById('syncBadge');
    badge.textContent = newApps.length;
    badge.style.display = newApps.length > 0 ? 'flex' : 'none';

    logSync(`Sync complete: ${newApps.length} new AppDrops added.`);
    syncStatus.textContent = 'Sync complete';
    setTimeout(() => {
      syncStatus.textContent = 'Online: Ready to sync';
      syncAppDropsBtn.disabled = false;
      cleanAppDropsBtn.disabled = false;
    }, 2000);
  } catch (error) {
    logSync(`Sync failed: ${error.message}`);
    syncStatus.textContent = 'Sync failed';
    setTimeout(() => {
      syncStatus.textContent = 'Online: Ready to sync';
      syncAppDropsBtn.disabled = false;
      cleanAppDropsBtn.disabled = false;
    }, 2000);
  }
}

async function cleanAppDrops() {
  if (!isOnline) {
    logSync('Cannot clean: No network connection.');
    syncStatus.textContent = 'Offline: Clean unavailable';
    return;
  }

  syncAppDropsBtn.disabled = true;
  cleanAppDropsBtn.disabled = true;
  syncStatus.textContent = 'Cleaning...';
  logSync('Initiating AppDrop cleanup...');

  try {
    let remoteIds = new Set();
    try {
      const response = await fetch('https://charlesmack.github.io/command/appdrops/appdrops.json');
      const remoteApps = await response.json();
      remoteIds = new Set(remoteApps.map(app => app.id));
      logSync('Fetched AppDrop IDs from JSON endpoint.');
    } catch (jsonError) {
      logSync(`JSON fetch failed: ${jsonError.message}. Falling back to HTML parsing.`);
      const response = await fetch('https://charlesmack.github.io/command/appdrops/index.html');
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const appDropLinks = doc.querySelectorAll('a.appdrop-item');
      remoteIds = new Set(Array.from(appDropLinks).map(link => link.href.split('/').pop().replace('.html', '')));
    }

    const initialCount = apps.length;
    apps = apps.filter(app => remoteIds.has(app.id) || app.id === 'ai-assistant');
    saveAppDrops();
    renderTiles();
    populateCategories();

    logSync(`Cleanup complete: ${initialCount - apps.length} outdated AppDrops removed.`);
    syncStatus.textContent = 'Cleanup complete';
    setTimeout(() => {
      syncStatus.textContent = 'Online: Ready to sync';
      syncAppDropsBtn.disabled = false;
      cleanAppDropsBtn.disabled = false;
    }, 2000);
  } catch (error) {
    logSync(`Cleanup failed: ${error.message}`);
    syncStatus.textContent = 'Cleanup failed';
    setTimeout(() => {
      syncStatus.textContent = 'Online: Ready to sync';
      syncAppDropsBtn.disabled = false;
      cleanAppDropsBtn.disabled = false;
    }, 2000);
  }
}

function loadSavedColor() {
  const savedColor = localStorage.getItem('themeColor') || '#00ff7f';
  updateThemeColor(savedColor);
  colorPicker.value = savedColor;
}

function updateThemeColor(hex) {
  const rgb = hexToRgb(hex);
  const lightRgb = adjustBrightness(rgb, 1.2);
  const darkRgb = adjustBrightness(rgb, 0.8);
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent-light', `rgb(${lightRgb.r}, ${lightRgb.g}, ${lightRgb.b})`);
  document.documentElement.style.setProperty('--accent-dark', `rgb(${darkRgb.r}, ${darkRgb.g}, ${darkRgb.b})`);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`);
  localStorage.setItem('themeColor', hex);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function adjustBrightness({ r, g, b }, factor) {
  return {
    r: Math.min(255, Math.max(0, Math.round(r * factor))),
    g: Math.min(255, Math.max(0, Math.round(g * factor))),
    b: Math.min(255, Math.max(0, Math.round(b * factor)))
  };
}

function resetToDefaultColor() {
  const defaultColor = '#00ff7f';
  updateThemeColor(defaultColor);
  colorPicker.value = defaultColor;
}

function updateTime() {
  const now = new Date();
  timeElement.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateTime, 1000);
updateTime();

function createParticles() {
  if (document.body.classList.contains('low-spec')) return;
  const particlesContainer = document.getElementById('particles');
  const particleCount = window.innerWidth < 768 ? 10 : 20;
  particlesContainer.innerHTML = '';
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.animationDelay = `${Math.random() * 8}s`;
    particlesContainer.appendChild(particle);
  }
}

function populateCategories() {
  const categories = new Set(apps.map(app => app.category || 'Uncategorized'));
  categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function renderTiles() {
  grid.innerHTML = '';
  let filteredApps = apps;

  const searchTerm = appSearch.value.toLowerCase();
  if (searchTerm) {
    filteredApps = filteredApps.filter(app =>
      app.name.toLowerCase().includes(searchTerm) ||
      (app.description || '').toLowerCase().includes(searchTerm)
    );
  }

  const selectedCategory = categoryFilter.value;
  if (selectedCategory !== 'all') {
    filteredApps = filteredApps.filter(app => (app.category || 'Uncategorized') === selectedCategory);
  }

  filteredApps.forEach(app => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.id = app.id;
    tile.setAttribute('aria-label', `${app.name}: ${app.description || 'No description available'}`);
    tile.title = `${app.description || 'No description available'}\nVersion: ${app.version || 'Unknown'}\nCategory: ${app.category || 'Uncategorized'}`;
    tile.innerHTML = `
      <div class="icon">${app.emoji}</div>
      <div class="name">${app.name}</div>
      <div class="handle"></div>
    `;

    tile.addEventListener('click', (e) => {
      if (!isEditMode) {
        e.preventDefault();
        openApp(app);
      }
    });

    tile.addEventListener(isTouch ? 'touchstart' : 'mousedown', (e) => {
      if (isEditMode) startDragTile(e, tile, app);
    }, { passive: false });

    tile.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      toggleEditMode();
    });

    let longPressTimer;
    tile.addEventListener('touchstart', (e) => {
      longPressTimer = setTimeout(() => {
        if (!isEditMode) {
          navigator.vibrate?.(50);
          toggleEditMode();
        }
      }, 500);
    }, { passive: false });

    tile.addEventListener('touchend', () => clearTimeout(longPressTimer));
    tile.addEventListener('touchmove', () => clearTimeout(longPressTimer));

    grid.appendChild(tile);
  });
  checkScrollIndicator();
}

function toggleEditMode() {
  isEditMode = !isEditMode;
  toolbar.classList.toggle('show', isEditMode);
  grid.querySelectorAll('.tile').forEach(tile => {
    tile.classList.toggle('edit', isEditMode);
    if (!document.body.classList.contains('low-spec')) {
      tile.classList.toggle('jiggle', isEditMode);
    }
  });
  if (navigator.vibrate && isEditMode) navigator.vibrate(100);
}

sortAZ.addEventListener('click', () => {
  apps.sort((a, b) => a.name.localeCompare(b.name));
  saveAppDrops();
  renderTiles();
});

done.addEventListener('click', toggleEditMode);

function startDragTile(e, tile, app) {
  if (!isEditMode) return;
  e.preventDefault();

  const isTouchEvent = e.type === 'touchstart';
  draggedTile = tile.cloneNode(true);
  draggedTile.classList.add('ghost');
  document.body.appendChild(draggedTile);

  const rect = tile.getBoundingClientRect();
  if (isTouchEvent) {
    const touch = e.touches[0];
    touchOffsetX = touch.clientX - rect.left;
    touchOffsetY = touch.clientY - rect.top;
  } else {
    touchOffsetX = e.offsetX;
    touchOffsetY = e.offsetY;
  }

  placeholder = document.createElement('div');
  placeholder.className = 'placeholder';
  if (document.body.classList.contains('low-spec')) {
    placeholder.style.animation = 'none';
  }
  tile.parentNode.insertBefore(placeholder, tile.nextSibling);

  document.addEventListener(isTouchEvent ? 'touchmove' : 'mousemove', moveDragTile, { passive: false });
  document.addEventListener(isTouchEvent ? 'touchend' : 'mouseup', endDragTile, { passive: false });
  moveDragTile(e);
}

function moveDragTile(e) {
  if (!draggedTile) return;
  e.preventDefault();

  const isTouchEvent = e.type === 'touchmove';
  const clientX = isTouchEvent ? e.touches[0].clientX : e.clientX;
  const clientY = isTouchEvent ? e.touches[0].clientY : e.clientY;

  draggedTile.style.left = `${clientX - touchOffsetX}px`;
  draggedTile.style.top = `${clientY - touchOffsetY}px`;

  const tiles = Array.from(grid.querySelectorAll('.tile:not(.ghost)'));
  const closestTile = tiles.find(tile => {
    const rect = tile.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  });

  if (closestTile && closestTile !== placeholder) {
    const index = tiles.indexOf(closestTile);
    const placeholderIndex = Array.from(grid.children).indexOf(placeholder);
    grid.insertBefore(placeholder, index < placeholderIndex ? closestTile : closestTile.nextSibling);

    const draggedIndex = apps.findIndex(app => app.id === draggedTile.dataset.id);
    const targetIndex = tiles.indexOf(closestTile);
    const [draggedApp] = apps.splice(draggedIndex, 1);
    apps.splice(targetIndex, 0, draggedApp);
    saveAppDrops();
  }
}

function endDragTile() {
  if (!draggedTile) return;
  document.body.removeChild(draggedTile);
  grid.replaceChild(grid.querySelector(`.tile[data-id="${draggedTile.dataset.id}"]`), placeholder);
  draggedTile = null;
  placeholder = null;
  document.removeEventListener('touchmove', moveDragTile);
  document.removeEventListener('mousemove', moveDragTile);
  document.removeEventListener('touchend', endDragTile);
  document.removeEventListener('mouseup', endDragTile);
}

function openApp(app) {
  const existingPanel = document.querySelector(`.panel[data-id="${app.id}"]`);
  if (existingPanel) {
    existingPanel.style.zIndex = ++highestZ;
    existingPanel.classList.add('active');
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'panel active';
  panel.dataset.id = app.id;
  panel.style.zIndex = ++highestZ;

  if (app.id === 'ai-assistant' && aiFeaturesEnabled && !document.body.classList.contains('low-spec')) {
    panel.innerHTML = `
      <div class="p-head" onmousedown="startDragPanel(event, this.parentElement)" ontouchstart="startDragPanel(event, this.parentElement)">
        <div class="app-title">${app.name}</div>
        <div class="app-actions">
          <button class="btn minimize">–</button>
          <button class="btn new-tab">↗️</button>
          <button class="btn close">✕</button>
        </div>
      </div>
      <div class="p-body">
        <div class="ai-assistant-container">
          <input type="text" class="ai-input" placeholder="Enter AI task (e.g., generate text, analyze media)..." aria-label="AI task input">
          <button class="btn ai-submit">Submit</button>
          <div class="ai-output"></div>
        </div>
      </div>
    `;
    phone.appendChild(panel);
    openApps.push({ id: app.id, name: app.name, emoji: app.emoji });
    updateAppSwitcher();

    const aiInput = panel.querySelector('.ai-input');
    const aiOutput = panel.querySelector('.ai-output');
    const aiSubmit = panel.querySelector('.ai-submit');

    aiSubmit.addEventListener('click', async () => {
      const input = aiInput.value.trim();
      if (!input) return;
      aiOutput.textContent = 'Processing...';
      try {
        const result = await processAIRequest(input);
        aiOutput.textContent = result;
      } catch (error) {
        aiOutput.innerHTML = `<div class="ai-error">Error: ${error.message}</div>`;
      }
    });

    aiInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        aiSubmit.click();
      }
    });
  } else {
    if (app.id === 'ai-assistant' && (!aiFeaturesEnabled || document.body.classList.contains('low-spec'))) {
      panel.innerHTML = `
        <div class="p-head" onmousedown="startDragPanel(event, this.parentElement)" ontouchstart="startDragPanel(event, this.parentElement)">
          <div class="app-title">${app.name}</div>
          <div class="app-actions">
            <button class="btn minimize">–</button>
            <button class="btn new-tab">↗️</button>
            <button class="btn close">✕</button>
          </div>
        </div>
        <div class="p-body">
          <div class="ai-error">AI features are disabled or unsupported on this device.</div>
        </div>
      `;
    } else {
      panel.innerHTML = `
        <div class="p-head" onmousedown="startDragPanel(event, this.parentElement)" ontouchstart="startDragPanel(event, this.parentElement)">
          <div class="app-title">${app.name}</div>
          <div class="app-actions">
            <button class="btn minimize">–</button>
            <button class="btn new-tab">↗️</button>
            <button class="btn close">✕</button>
          </div>
        </div>
        <div class="p-body">
          <iframe src="${app.path}" title="${app.name}" loading="lazy"></iframe>
        </div>
      `;
    }
    phone.appendChild(panel);
    openApps.push({ id: app.id, name: app.name, emoji: app.emoji });
    updateAppSwitcher();

    if (app.path) {
      const iframe = panel.querySelector('iframe');
      iframe?.addEventListener('error', () => {
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          color: var(--accent); font-size: clamp(14px, 3.5vw, 16px); text-align: center; padding: 20px;
        `;
        errorMessage.textContent = `Failed to load ${app.name}. Check your connection or try again later.`;
        panel.querySelector('.p-body').appendChild(errorMessage);
      });
    }
  }

  panel.querySelector('.minimize').addEventListener('click', () => {
    panel.classList.remove('active');
    if (navigator.vibrate) navigator.vibrate(50);
  });

  panel.querySelector('.close').addEventListener('click', () => {
    phone.removeChild(panel);
    openApps = openApps.filter(a => a.id !== app.id);
    updateAppSwitcher();
    if (navigator.vibrate) navigator.vibrate(50);
  });

  panel.querySelector('.new-tab').addEventListener('click', () => {
    window.open(app.path || '#', '_blank');
  });

  panel.addEventListener('mousedown', (e) => {
    if (e.target === panel && e.offsetX > panel.offsetWidth - 10 && e.offsetY > panel.offsetHeight - 10) {
      startResizePanel(e, panel);
    }
  });

  panel.addEventListener('touchstart', (e) => {
    if (e.target === panel && e.offsetX > panel.offsetWidth - 10 && e.offsetY > panel.offsetHeight - 10) {
      startResizePanel(e, panel);
    }
  }, { passive: false });
}

function startDragPanel(e, panel) {
  e.preventDefault();
  const isTouchEvent = e.type === 'touchstart';
  const rect = panel.getBoundingClientRect();
  const offsetX = isTouchEvent ? e.touches[0].clientX -
