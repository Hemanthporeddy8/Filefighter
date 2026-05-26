/**
 * public/video-editor/index.js
 * 
 * Standalone entry script for the Editroy Video Editor.
 * Operates as the central controller bridging UI DOM inputs with our modular
 * high-performance intelligent media engine.
 */

import { stateMachine, EditorStates } from './engine/state-machine.js';
import { deviceProfiler, DeviceClasses } from './engine/device-profiler.js';
import { adaptiveQuality } from './engine/adaptive-quality.js';
import { decoderPool } from './engine/decoder-pool.js';
import { taskQueue } from './engine/task-queue.js';
import { memoryManager } from './engine/memory-manager.js';
import { renderScheduler } from './engine/render-scheduler.js';
import { timelineVirtualizer } from './engine/timeline-virtualizer.js';
import { videoProxy } from './engine/video-proxy.js';
import { exportEngine } from './engine/export-engine.js';
import { sessionStore } from './engine/session-store.js';
import { aiBackgroundRemover } from './engine/ai-remover.js';

// ── INDEXEDDB SESSION FILES PERSISTENCE ────────────────────────
const FILES_DB_NAME = 'EditroySessionFilesDB';
const FILES_STORE_NAME = 'session_files';

function openFilesDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILES_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(FILES_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSessionFile(itemId, file) {
  try {
    const db = await openFilesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILES_STORE_NAME, 'readwrite');
      const store = tx.objectStore(FILES_STORE_NAME);
      const request = store.put(file, itemId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('[SessionFiles] saveSessionFile failed:', e);
  }
}

async function getSessionFile(itemId) {
  try {
    const db = await openFilesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILES_STORE_NAME, 'readonly');
      const store = tx.objectStore(FILES_STORE_NAME);
      const request = store.get(itemId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('[SessionFiles] getSessionFile failed:', e);
    return null;
  }
}

async function deleteSessionFile(itemId) {
  try {
    const db = await openFilesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILES_STORE_NAME, 'readwrite');
      const store = tx.objectStore(FILES_STORE_NAME);
      const request = store.delete(itemId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('[SessionFiles] deleteSessionFile failed:', e);
  }
}

async function clearSessionFiles() {
  try {
    const db = await openFilesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILES_STORE_NAME, 'readwrite');
      const store = tx.objectStore(FILES_STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('[SessionFiles] clearSessionFiles failed:', e);
  }
}

// ── GLOBAL STATE ──────────────────────────────────────────────
export const state = {
  items: [], // Array of { id, type, file, src, proxySrc, thumbnail, start, duration, trimStart, trimEnd, track, volume, filters, transform, opacity, blendMode }
  activeLayer: null,
  globalTime: 0,
  totalDuration: 30, // Default timeline length
  isPlaying: false,
  history: [],
  historyIndex: -1,
  masterVolume: 1,
  fps: 30,
  tlZoom: 1.0,    // Timeline zoom multiplier (0.25 – 8×)
  exportWidth: 1280,
  exportHeight: 720,
  showToast: (title, desc = '', isError = false) => showToast(title, desc, isError)
};

let handleDragState = null;
let canvasDrag = null;

// ── Timeline viewport constants ──────────────────────────────
const BASE_PPS = 80;            // pixels-per-second at zoom 1×
const TL_ZOOM_MIN = 0.15;
const TL_ZOOM_MAX = 8;
const TL_ZOOM_STEP = 0.25;

function pps() { return BASE_PPS * state.tlZoom; }
function timeToPx(t) { return t * pps(); }
function pxToTime(px) { return px / pps(); }

function getTlScroll() {
  const el = document.getElementById('tracks-scroll');
  return el ? el.scrollLeft : 0;
}

function getTlViewportW() {
  const el = document.getElementById('tracks-scroll');
  return el ? el.clientWidth : 800;
}

// Uid generator helper
function uid() { return 'clip-' + Math.random().toString(36).substring(2, 11); }

// Timecode helper
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

// ── THEME MANAGEMENT ──────────────────────────────────────────
let currentTheme = localStorage.getItem('theme') || 'system';

export function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.add('light');
  } else {
    // System Theme Match
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.add('light');
    }
  }
  
  // Update UI topbar button state
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    const span = themeBtn.querySelector('span');
    if (span) {
      span.textContent = `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
    }
    
    // Cycle custom icons based on active mode
    const svg = themeBtn.querySelector('svg');
    if (svg) {
      if (theme === 'light') {
        svg.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
      } else if (theme === 'dark') {
        svg.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
      } else {
        svg.innerHTML = '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>';
      }
    }
  }
}

// Watch for system color scheme updates in system mode
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentTheme === 'system') {
    applyTheme('system');
  }
});

async function restoreSessionFiles() {
  const saved = sessionStore.loadSession();
  if (!saved || saved.items.length === 0) return;
  
  setProcessing(true, 'Restoring session...', 'Re-linking active media files...');
  
  for (const item of state.items) {
    if (item.type === 'text') continue;
    
    // Get stored file from IndexedDB
    const file = await getSessionFile(item.id);
    if (file) {
      item.file = file;
      item.src = memoryManager.trackBlob(URL.createObjectURL(file));
      
      if (item.type === 'image') {
        item.thumbnail = item.src;
      } else if (item.type === 'video') {
        // If there's no thumbnail restored, generate a new one
        if (!item.thumbnail) {
          const vid = document.createElement('video');
          vid.preload = 'metadata';
          vid.src = item.src;
          await new Promise(r => { vid.onloadedmetadata = r; vid.onerror = r; });
          if (vid.videoWidth) {
            item.thumbnail = await generateThumbnail(vid);
          }
        }
      }
    }
  }
  
  setProcessing(false);
  syncAudioGraph();
  renderAll();
}

// ── STARTUP INITIALIZATION ────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Apply active layout theme
  applyTheme(currentTheme);
  const previewCanvas = document.getElementById('preview-img-canvas');
  
  // 1. Phase 1: Device Profiler
  showToast('🔌 System diagnostic', 'Profiling device performance...');
  const profile = await deviceProfiler.profileDevice();
  
  // 2. Phase 2: Adaptive Quality Configuration
  adaptiveQuality.initialize(profile.deviceClass, previewCanvas);
  showToast(
    `🚀 Engine Optimized`,
    `Tuned editor for: ${profile.deviceClass.replace('_', ' ')} (${profile.cores} Cores / ${profile.ram}GB RAM)`
  );

  // 3. Initialize Render Scheduler
  renderScheduler.initialize(
    state,
    () => renderFrame(renderScheduler.state),
    () => updateMediaPlayback(),
    () => updatePlayhead()
  );

  stateMachine.onChange(st => {
    const icon = document.getElementById('play-icon');
    if (!icon) return;
    if (st === EditorStates.PLAYING) {
      icon.innerHTML = '<rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/>';
    } else {
      icon.innerHTML = '<polygon points="4,2 14,8 4,14"/>';
    }
  });

  // 4. Initialize Timeline virtualizer
  timelineVirtualizer.initialize(state, timeToPx, pxToTime);

  // 5. Setup UI & Event Listeners
  setupEventListeners();

  // 6. Restore Session autosave (Warning 5 / Phase 13)
  const saved = sessionStore.loadSession();
  if (saved && saved.items.length > 0) {
    state.items = saved.items;
    state.totalDuration = saved.totalDuration || 30;
    state.masterVolume = saved.masterVolume || 1;
    computeTotalDuration();
    
    restoreSessionFiles().then(() => {
      showToast('💾 Session restored', 'Recovered clip layers.');
    }).catch(err => {
      console.error('Failed to restore session files:', err);
      renderAll();
    });
  } else {
    renderAll();
  }
});

// ── STATE HISTORY SAVING (Warning 5) ─────────────────────────
const MAX_HISTORY = 15;
function pushHistory() {
  const snapshot = state.items.map(i => ({...i, filters: {...i.filters}, transform: {...i.transform}}));
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  state.history.push(snapshot);
  state.historyIndex++;
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(state.history.length - MAX_HISTORY);
    state.historyIndex = state.history.length - 1;
  }
  
  // Save to persistent storage automatically (metadata only!)
  sessionStore.saveSession(state.items, state.totalDuration, state.masterVolume);
  
  updateActionButtons();
}

function updateActionButtons() {
  const hasMedia = state.items.length > 0;
  
  // Toggle preview empty state overlay
  const previewEmpty = document.getElementById('preview-empty');
  if (previewEmpty) previewEmpty.style.display = hasMedia ? 'none' : 'flex';
  
  // Undo, Split, Delete states
  document.getElementById('btn-undo').disabled = (state.historyIndex <= 0);
  const selected = !!state.activeLayer;
  document.getElementById('btn-split').disabled = !selected;
  document.getElementById('btn-delete').disabled = !selected;
  
  // Export buttons
  document.getElementById('btn-export-top').disabled = !hasMedia;
  const mainExp = document.getElementById('btn-export-main');
  if (mainExp) mainExp.disabled = !hasMedia;
  
  // Playback & Frame step buttons
  document.getElementById('btn-play').disabled = !hasMedia;
  const frameBack = document.getElementById('btn-frame-back'); if (frameBack) frameBack.disabled = !hasMedia;
  const frameFwd = document.getElementById('btn-frame-fwd'); if (frameFwd) frameFwd.disabled = !hasMedia;
}

// ── TELEMETRY SYSTEM DRAW CHECKS ──────────────────────────────
function renderFrame(st) {
  const renderCanvas = document.getElementById('preview-img-canvas');
  if (!renderCanvas) return;
  const renderCtx = renderCanvas.getContext('2d');
  
  renderCtx.fillStyle = '#000';
  renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
  
  const renderOrder = { 'v1': 1, 'v2': 2, 't1': 3, 'a1': 0 };
  const activeItems = st.items
    .filter(i => st.globalTime >= i.start && st.globalTime < i.start + i.duration)
    .sort((a, b) => (renderOrder[a.track] || 0) - (renderOrder[b.track] || 0));
  
  activeItems.forEach(item => {
    if (item.type === 'video' || item.type === 'image') {
      const localTime = item.trimStart + (st.globalTime - item.start);
      drawVisual(renderCtx, renderCanvas, item, localTime);
    } else if (item.type === 'text') {
      renderCtx.save();
      const cx = renderCanvas.width / 2;
      const cy = renderCanvas.height / 2;
      
      let transAlpha = 1;
      if (item.transition) {
        const elapsed = st.globalTime - item.start;
        const remaining = (item.start + item.duration) - st.globalTime;
        if (item.transition.fadeIn > 0 && elapsed < item.transition.fadeIn) transAlpha = Math.max(0, elapsed / item.transition.fadeIn);
        if (item.transition.fadeOut > 0 && remaining < item.transition.fadeOut) transAlpha = Math.min(transAlpha, Math.max(0, remaining / item.transition.fadeOut));
      }
      
      renderCtx.translate(cx + (item.transform.x || 0), cy + (item.transform.y || 0));
      renderCtx.scale(item.transform.scaleX ?? 1, item.transform.scaleY ?? 1);
      renderCtx.rotate((item.transform.rotation || 0) * Math.PI / 180);
      renderCtx.globalAlpha = ((item.opacity ?? 100) / 100) * transAlpha;
      
      renderCtx.font = `${item.transform.weight || 600} ${item.transform.size || 64}px "${item.transform.font || 'Inter'}"`;
      renderCtx.fillStyle = item.color || '#fff';
      renderCtx.textAlign = 'center';
      renderCtx.textBaseline = 'middle';
      renderCtx.fillText(item.name, 0, 0);
      renderCtx.restore();
    }
  });

  // Apply master post-processing visual effects (excluding slowmo)
  const activeFxList = st.items.filter(f => 
    f.track === 'fx1' && 
    f.fxType !== 'slowmo' &&
    st.globalTime >= f.start && 
    st.globalTime < (f.start + f.duration)
  );

  activeFxList.forEach(fx => {
    if (fx.fxType === 'blur') {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = renderCanvas.width;
      tempCanvas.height = renderCanvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(renderCanvas, 0, 0);
      
      renderCtx.save();
      renderCtx.filter = 'blur(6px)';
      renderCtx.drawImage(tempCanvas, 0, 0);
      renderCtx.restore();
    } else if (fx.fxType === 'glitch') {
      const w = renderCanvas.width;
      const h = renderCanvas.height;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(renderCanvas, 0, 0);
      
      renderCtx.clearRect(0, 0, w, h);
      
      const slices = 8;
      for (let i = 0; i < slices; i++) {
        const sy = (h / slices) * i;
        const sh = h / slices;
        const disp = (Math.random() - 0.5) * 20;
        
        renderCtx.save();
        if (Math.random() < 0.35) {
          renderCtx.globalAlpha = 0.8;
          renderCtx.drawImage(tempCanvas, 0, sy, w, sh, disp - 5, sy, w, sh);
          renderCtx.fillStyle = 'rgba(255, 0, 100, 0.12)';
          renderCtx.fillRect(0, sy, w, sh);
        } else {
          renderCtx.drawImage(tempCanvas, 0, sy, w, sh, disp, sy, w, sh);
        }
        renderCtx.restore();
      }
    } else if (fx.fxType === 'vhs') {
      const w = renderCanvas.width;
      const h = renderCanvas.height;
      renderCtx.save();
      renderCtx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let y = 0; y < h; y += 4) {
        renderCtx.fillRect(0, y, w, 2);
      }
      const timeSeed = Date.now();
      const noiseY = (timeSeed / 8) % h;
      renderCtx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      renderCtx.fillRect(0, noiseY, w, Math.random() * 15 + 5);
      
      renderCtx.globalCompositeOperation = 'color';
      renderCtx.fillStyle = 'rgba(0, 120, 255, 0.04)';
      renderCtx.fillRect(0, 0, w, h);
      renderCtx.restore();
    } else if (fx.fxType === 'film') {
      const w = renderCanvas.width;
      const h = renderCanvas.height;
      renderCtx.save();
      renderCtx.globalCompositeOperation = 'color';
      renderCtx.fillStyle = 'rgba(150, 100, 50, 0.2)';
      renderCtx.fillRect(0, 0, w, h);
      renderCtx.restore();
      
      renderCtx.save();
      renderCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      renderCtx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.6) {
          const scratchX = Math.random() * w;
          renderCtx.beginPath();
          renderCtx.moveTo(scratchX, 0);
          renderCtx.lineTo(scratchX + (Math.random() - 0.5) * 10, h);
          renderCtx.stroke();
        }
      }
      renderCtx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      for (let i = 0; i < 4; i++) {
        if (Math.random() < 0.5) {
          renderCtx.beginPath();
          renderCtx.arc(Math.random() * w, Math.random() * h, Math.random() * 2 + 1, 0, Math.PI * 2);
          renderCtx.fill();
        }
      }
      renderCtx.restore();
    } else if (fx.fxType === 'pixelate') {
      const w = renderCanvas.width;
      const h = renderCanvas.height;
      const pixelSize = 10;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w / pixelSize;
      tempCanvas.height = h / pixelSize;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(renderCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
      
      renderCtx.save();
      renderCtx.imageSmoothingEnabled = false;
      renderCtx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, w, h);
      renderCtx.restore();
    } else if (fx.fxType === 'noise') {
      if (!window._noisePattern) {
        const noiseCanvas = document.createElement('canvas');
        noiseCanvas.width = 64;
        noiseCanvas.height = 64;
        const nCtx = noiseCanvas.getContext('2d');
        const nData = nCtx.createImageData(64, 64);
        for (let i = 0; i < nData.data.length; i += 4) {
          const val = Math.floor(Math.random() * 255);
          nData.data[i] = val;
          nData.data[i+1] = val;
          nData.data[i+2] = val;
          nData.data[i+3] = 18;
        }
        nCtx.putImageData(nData, 0, 0);
        window._noisePattern = renderCtx.createPattern(noiseCanvas, 'repeat');
      }
      renderCtx.save();
      renderCtx.translate(Math.random() * 64, Math.random() * 64);
      renderCtx.fillStyle = window._noisePattern;
      renderCtx.fillRect(-64, -64, renderCanvas.width + 64, renderCanvas.height + 64);
      renderCtx.restore();
    }
  });

  updateSelectionOverlay();
}

function drawVisual(renderCtx, renderCanvas, item, localTime) {
  renderCtx.save();
  const cx = renderCanvas.width / 2;
  const cy = renderCanvas.height / 2;
  
  let transAlpha = 1;
  if (item.transition) {
    const elapsed = state.globalTime - item.start;
    const remaining = (item.start + item.duration) - state.globalTime;
    if (item.transition.fadeIn > 0 && elapsed < item.transition.fadeIn) {
      transAlpha = Math.max(0, elapsed / item.transition.fadeIn);
    }
    if (item.transition.fadeOut > 0 && remaining < item.transition.fadeOut) {
      transAlpha = Math.min(transAlpha, Math.max(0, remaining / item.transition.fadeOut));
    }
  }
  
  renderCtx.translate(cx + (item.transform.x || 0), cy + (item.transform.y || 0));
  renderCtx.scale(item.transform.scaleX ?? 1, item.transform.scaleY ?? 1);
  renderCtx.rotate((item.transform.rotation || 0) * Math.PI / 180);
  renderCtx.globalAlpha = ((item.opacity ?? 100) / 100) * transAlpha;
  
  if (item.blendMode && item.blendMode !== 'normal') {
    renderCtx.globalCompositeOperation = item.blendMode;
  }
  
  // Phase 2: Disable canvas heavy filters under Low-end profiles
  if (adaptiveQuality.activeConfig.enableComplexFilters && item.filters) {
    const f = item.filters;
    let filterStr = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) grayscale(${f.grayscale}%)`;
    if (f.sepia) filterStr += ` sepia(${f.sepia}%)`;
    if (f.blur) filterStr += ` blur(${f.blur}px)`;
    renderCtx.filter = filterStr;
  }

  if (item.type === 'video') {
    const vid = decoderPool.get(item);
    const isPlaying = stateMachine.is(EditorStates.PLAYING);
    
    // Retrieve active speed effects at current playhead from track 'fx1'
    let speedMult = 1.0;
    const activeSpeed = state.items.find(f => 
      f.track === 'fx1' && 
      f.fxType === 'slowmo' && 
      state.globalTime >= f.start && 
      state.globalTime < (f.start + f.duration)
    );
    if (activeSpeed) {
      speedMult = parseFloat(activeSpeed.speed) || 0.5;
    }
    
    if (vid && vid.playbackRate !== speedMult) {
      vid.playbackRate = speedMult;
    }
    
    // Force seek once on initialization to ensure the decoder starts loading/decoding the correct frame
    if (vid._hasSeekedOnce === undefined) {
      vid._hasSeekedOnce = false;
    }
    
    try {
      const threshold = isPlaying ? 0.35 : 0.05;
      let shouldSeek = !vid._hasSeekedOnce || (isPlaying 
        ? (!vid.seeking && Math.abs(vid.currentTime - localTime) > threshold)
        : (Math.abs(vid.currentTime - localTime) > threshold));
        
      if (shouldSeek) {
        const now = performance.now();
        const lastSeek = vid._lastSeekTs || 0;
        
        // Cap scrubbing seeks to at most once per 60ms
        if (!isPlaying && vid._hasSeekedOnce && (now - lastSeek < 60)) {
          shouldSeek = false;
          
          // Schedule a deferred seek to ensure the final scrub position is rendered!
          if (vid._deferredSeekTimeout) {
            clearTimeout(vid._deferredSeekTimeout);
          }
          vid._deferredSeekTimeout = setTimeout(() => {
            if (!stateMachine.is(EditorStates.PLAYING)) {
              vid.currentTime = localTime;
              vid._lastSeekTs = performance.now();
              import('/video-editor/engine/render-scheduler.js').then(({ renderScheduler }) => {
                renderScheduler.triggerSingleUpdate();
              });
            }
          }, 65);
        }
        
        if (shouldSeek) {
          vid.currentTime = localTime;
          vid._lastSeekTs = now;
          vid._hasSeekedOnce = true;
          if (vid._deferredSeekTimeout) {
            clearTimeout(vid._deferredSeekTimeout);
            vid._deferredSeekTimeout = null;
          }
        }
      }
    } catch (e) {
      console.warn("Video seek failed", e);
    }
    if (isPlaying && vid.paused && !vid.seeking) {
      vid.play().catch(()=>{});
    }
    if (!isPlaying && !vid.paused) {
      vid.pause();
    }
    
    try {
      if (vid.readyState >= 2 && vid.videoWidth) {
        const fitScale = Math.min(renderCanvas.width / vid.videoWidth, renderCanvas.height / vid.videoHeight) || 1;
        const w = vid.videoWidth * fitScale;
        const h = vid.videoHeight * fitScale;
        renderCtx.drawImage(vid, -w/2, -h/2, w, h);
      }
    } catch (e) {
      console.warn("Video draw failed", e);
    }
  } else if (item.type === 'image') {
    let img = memoryManager.imageCache.get(item.id);
    if (!img) {
      img = new Image();
      img.onload = () => {
        renderScheduler.triggerSingleUpdate();
      };
      img.src = item.src;
      memoryManager.imageCache.set(item.id, img);
    }
    if (img.complete && img.naturalWidth) {
      const fitScale = Math.min(renderCanvas.width / img.naturalWidth, renderCanvas.height / img.naturalHeight) || 1;
      const w = img.naturalWidth * fitScale;
      const h = img.naturalHeight * fitScale;
      renderCtx.drawImage(img, -w/2, -h/2, w, h);
    }
  }
  renderCtx.restore();
}

function updateMediaPlayback() {
  state.items.filter(i => i.type === 'video' || i.type === 'audio').forEach(item => {
    const node = memoryManager.audioNodesMap.get(item.id);
    if (!node) return;
    
    const isActive = state.globalTime >= item.start && state.globalTime < (item.start + item.duration);
    const isPlaying = stateMachine.is(EditorStates.PLAYING);
    
    if (isActive) {
      // Retrieve active speed effects at current playhead from track 'fx1'
      let speedMult = 1.0;
      const activeSpeed = state.items.find(f => 
        f.track === 'fx1' && 
        f.fxType === 'slowmo' && 
        state.globalTime >= f.start && 
        state.globalTime < (f.start + f.duration)
      );
      if (activeSpeed) {
        speedMult = parseFloat(activeSpeed.speed) || 0.5;
      }
      
      if (node.audio.playbackRate !== speedMult) {
        node.audio.playbackRate = speedMult;
      }

      const targetTime = item.trimStart + (state.globalTime - item.start);
      node.audio.volume = item.muted ? 0 : Math.min(1, Math.max(0, (item.volume ?? 1) * state.masterVolume));
      
      const threshold = isPlaying ? 0.3 : 0.05;
      const shouldSeek = isPlaying 
        ? (!node.audio.seeking && Math.abs(node.audio.currentTime - targetTime) > threshold)
        : (Math.abs(node.audio.currentTime - targetTime) > threshold);
      
      if (shouldSeek) {
        node.audio.currentTime = targetTime;
      }
      
      if (isPlaying) {
        if (node.audio.paused && !node.audio.seeking) {
          node.audio.play().catch(e => console.warn("Audio play blocked", e));
        }
      } else {
        if (!node.audio.paused) node.audio.pause();
      }
    } else {
      if (!node.audio.paused) node.audio.pause();
    }
  });
}

// ── PLAYBACK ENGINE ───────────────────────────────────────────
function togglePlay() {
  if (!state.items.length) return;
  const icon = document.getElementById('play-icon');
  
  if (stateMachine.is(EditorStates.PLAYING)) {
    icon.innerHTML = '<polygon points="4,2 14,8 4,14"/>';
    stateMachine.transitionTo(EditorStates.IDLE);
  } else {
    icon.innerHTML = '<rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/>';
    if (state.globalTime >= state.totalDuration) seekTo(0);
    stateMachine.transitionTo(EditorStates.PLAYING);
  }
}

function seekTo(t) {
  state.globalTime = Math.max(0, Math.min(state.totalDuration, t));
  updatePlayhead();
  if (stateMachine.is(EditorStates.PLAYING)) {
    _autoScrollDuringPlayback();
  } else {
    renderScheduler.triggerSingleUpdate();
  }
}

function syncAudioGraph() {
  state.items.filter(i => i.type === 'video' || i.type === 'audio').forEach(item => {
    if (!memoryManager.audioNodesMap.has(item.id)) {
      const audio = document.createElement('audio');
      audio.src = item.src;
      audio.preload = 'auto';
      memoryManager.audioNodesMap.set(item.id, { audio });
    }
    const node = memoryManager.audioNodesMap.get(item.id);
    node.audio.volume = item.muted ? 0 : Math.min(1, Math.max(0, (item.volume ?? 1) * state.masterVolume));
  });
  
  // Prune deleted sound nodes
  for (const [id, node] of memoryManager.audioNodesMap.entries()) {
    if (!state.items.find(i => i.id === id)) {
      node.audio.pause();
      node.audio.removeAttribute('src');
      node.audio.load();
      memoryManager.audioNodesMap.delete(id);
    }
  }
}

function computeTotalDuration() {
  const maxEnd = state.items.reduce((max, item) => Math.max(max, item.start + item.duration), 0);
  state.totalDuration = Math.max(maxEnd, 10);
  updateTimecode();
}

function updateTimecode() {
  const cur = formatTime(state.globalTime);
  const tot = formatTime(state.totalDuration);
  document.getElementById('tc-current').textContent = cur;
  document.getElementById('tc-total').textContent = tot;
  const pbtc = document.getElementById('pb-tc');
  if(pbtc) pbtc.textContent = cur + ' / ' + tot;
}

function updatePlayhead() {
  const _playheadEl = document.getElementById('playhead');
  const px = timeToPx(state.globalTime);
  if (_playheadEl) {
    _playheadEl.style.left = px + 'px';
  }
  updateTimecode();
  _scheduleAutoScroll();
}

// ── TIMELINE SCROLLING ────────────────────────────────────────
let _autoScrollRaf = null;
function _scheduleAutoScroll() {
  if (_autoScrollRaf) return;
  _autoScrollRaf = requestAnimationFrame(_doAutoScroll);
}
function _doAutoScroll() {
  _autoScrollRaf = null;
  const scrollEl = document.getElementById('tracks-scroll');
  if (!scrollEl) return;
  const scrollLeft = scrollEl.scrollLeft;
  const vw = scrollEl.clientWidth;
  const phPx = timeToPx(state.globalTime);

  const leftEdge = scrollLeft + vw * 0.15;
  const rightEdge = scrollLeft + vw * 0.85;

  let target = scrollLeft;
  if (phPx < leftEdge) {
    target = phPx - vw * 0.25;
  } else if (phPx > rightEdge) {
    target = phPx - vw * 0.5;
  } else {
    return; // Already in safe zone
  }

  target = Math.max(0, target);
  _smoothScrollTo(scrollEl, target);
}

function _smoothScrollTo(el, targetX) {
  const LERP = 0.18;
  function step() {
    const diff = targetX - el.scrollLeft;
    if (Math.abs(diff) < 0.5) { el.scrollLeft = targetX; return; }
    el.scrollLeft += diff * LERP;
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function _autoScrollDuringPlayback() {
  const scrollEl = document.getElementById('tracks-scroll');
  if (!scrollEl) return;
  const scrollLeft = scrollEl.scrollLeft;
  const vw = scrollEl.clientWidth;
  const phPx = timeToPx(state.globalTime);
  
  if (phPx > scrollLeft + vw || phPx < scrollLeft) {
    scrollEl.scrollLeft = Math.max(0, phPx - vw * 0.15);
  }
}

// ── TIMELINE VIRTUALIZATION UPDATES ─────────────────────────
function renderTimeline() {
  timelineVirtualizer.virtualizeTimeline();
  updateLeftPanelClips();
  buildRuler();
}

function renderAll() {
  const canvas = document.getElementById('preview-img-canvas');
  if (canvas) canvas.classList.add('visible');
  const video = document.getElementById('preview-video');
  if (video) video.style.display = 'none';
  
  renderTimeline();
  renderScheduler.triggerSingleUpdate();
  renderInspector();
  updateActionButtons();
}

// ── MEDIA FILE IMPORT QUEUES (Phase 3 & 4) ────────────────────
const MAX_FILE_SIZE_MB = 200;

async function handleVideoFiles(files) {
  const valid = files.filter(f => f.type.startsWith('video/') || f.type.startsWith('image/'));
  if (!valid.length) return;

  const tooBig = valid.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
  if (tooBig.length) {
    const mb = (tooBig[0].size / 1024 / 1024).toFixed(0);
    showToast('File too large', `Max ${MAX_FILE_SIZE_MB}MB. "${tooBig[0].name}" is ${mb}MB.`, true);
    return;
  }

  setProcessing(true, 'Processing media…', `Loading 1 of ${valid.length}`);
  const newItems = [];
  
  // Sequentially process files to avoid hanging the browser tab (Phase 3)
  for (let i = 0; i < valid.length; i++) {
    const file = valid[i];
    
    // Check if we have an offline clip with the same name that we can re-link
    const matchingOfflineItem = state.items.find(it => it.name === file.name && !it.src);
    if (matchingOfflineItem) {
      setProcessing(true, 'Re-linking media…', `Restoring "${file.name}"`);
      const src = memoryManager.trackBlob(URL.createObjectURL(file));
      matchingOfflineItem.file = file;
      matchingOfflineItem.src = src;
      matchingOfflineItem.thumbnail = file.type.startsWith('video/') ? '' : src;
      
      if (file.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.src = src;
        await new Promise(r => { vid.onloadedmetadata = r; vid.onerror = r; });
        if (vid.videoWidth) {
          const thumb = await generateThumbnail(vid);
          matchingOfflineItem.thumbnail = thumb;
        }
      }
      
      // Fire proxy generator in background if needed
      if (file.type.startsWith('video/') && videoProxy.shouldProxy(file, 1280, 720)) {
        videoProxy.generateProxy(matchingOfflineItem, () => {});
      }
      
      showToast('File Re-linked! ✓', `Restored timeline clip: ${file.name}`);
      continue;
    }

    setProcessing(true, 'Processing media…', `Loading File ${i + 1}/${valid.length}: ${file.name.substring(0,25)}`);
    await new Promise(r => setTimeout(r, 20)); // Yield thread

    try {
      const item = await new Promise((resolve, reject) => {
        const src = memoryManager.trackBlob(URL.createObjectURL(file));
        
        if (file.type.startsWith('video/')) {
          const vid = document.createElement('video');
          vid.preload = 'metadata';
          
          const fallback = setTimeout(() => {
            resolve({
              id: uid(), type: 'video', name: file.name, file, src, thumbnail: '',
              start: getNextStartTime('v1'), duration: 15, trimStart: 0, trimEnd: 15, track: 'v1',
              filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
              transform: {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, blendMode:'normal', opacity:100, volume:1,
              transition: {fadeIn:0,fadeOut:0}
            });
          }, 8000);

          vid.onloadedmetadata = async () => {
            clearTimeout(fallback);
            
            // Adjust original ratios
            if (!state.items.some(it => it.type === 'video') && !newItems.some(it => it.type === 'video')) {
              state.exportWidth = vid.videoWidth || 1280;
              state.exportHeight = vid.videoHeight || 720;
            }

            // Generate first-frame thumbnail using TaskQueue (Phase 7)
            const thumb = await new Promise(r => {
              taskQueue.enqueue(`thumb-${file.name}`, async () => {
                const url = await generateThumbnail(vid);
                r(url);
              }, 2); // Priority 2: run thumbnails swiftly
            });

            resolve({
              id: uid(), type: 'video', name: file.name, file, src, thumbnail: thumb,
              start: getNextStartTime('v1'), duration: vid.duration, trimStart: 0, trimEnd: vid.duration, track: 'v1',
              filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
              transform: {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, blendMode:'normal', opacity:100, volume:1,
              transition: {fadeIn:0,fadeOut:0}
            });
          };

          vid.onerror = () => { clearTimeout(fallback); reject(new Error('Cannot load: ' + file.name)); };
          vid.src = src;
        } else {
          // Images
          resolve({
            id: uid(), type: 'image', name: file.name, file, src, thumbnail: src,
            start: getNextStartTime('v2'), duration: 5, trimStart: 0, trimEnd: 5, track: 'v2',
            filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
            transform: {x:0,y:0,scaleX:0.3,scaleY:0.3,rotation:0}, blendMode:'normal', opacity:100, volume:1,
            transition: {fadeIn:0,fadeOut:0}
          });
        }
      });

      if (item) {
        newItems.push(item);
        state.items.push(item);
        
        // Save file to IndexedDB session files store so it survives page refresh
        if (item.file) {
          await saveSessionFile(item.id, item.file);
        }
        
        // 4. Phase 4: Progressive proxy generation (non-blocking)
        if (item.type === 'video' && videoProxy.shouldProxy(item.file, item.videoWidth || 1280, item.videoHeight || 720)) {
          videoProxy.generateProxy(item, (pct) => {
            showToast('🔄 Optimizing assets', `Proxy generation for ${item.name}: ${pct}%`);
          });
        }

        if (!state.activeLayer) state.activeLayer = item.id;
        computeTotalDuration();
        syncAudioGraph();
        renderTimeline();
      }
    } catch (e) {
      showToast('Import Skipped', e.message, true);
    }
  }

  if (newItems.length) {
    pushHistory();
    renderAll();
    showToast('Media added ✓', `${newItems.length} file(s) added to timeline`);
  }
  setProcessing(false);
}

function generateThumbnail(vid) {
  return new Promise(resolve => {
    const c = document.createElement('canvas');
    c.width = 80; c.height = 45;
    const ctx = c.getContext('2d', { alpha: false });
    
    const doCapture = () => {
      try {
        ctx.drawImage(vid, 0, 0, 80, 45);
        const dataUrl = c.toDataURL('image/jpeg', 0.4);
        resolve(dataUrl);
      } catch(e) { resolve(''); }
      finally { c.width = 1; c.height = 1; }
    };
    
    if (vid.readyState >= 2 && vid.currentTime > 0) { doCapture(); return; }
    
    const timeout = setTimeout(() => { vid.onseeked = null; doCapture(); }, 2000);
    vid.onseeked = () => {
      clearTimeout(timeout);
      vid.onseeked = null;
      doCapture();
    };
    vid.currentTime = Math.min(0.5, (vid.duration || 10) * 0.1);
  });
}

async function handleAudioFiles(files) {
  const valid = files.filter(f => f.type.startsWith('audio/'));
  if (!valid.length) return;
  
  setProcessing(true, 'Analyzing audio channels...', 'Analyzing...');
  
  const newTracks = [];
  
  for (const file of valid) {
    // Check if we have an offline audio track with the same name
    const matchingOffline = state.items.find(it => it.name === file.name && !it.src && it.type === 'audio');
    if (matchingOffline) {
      const src = URL.createObjectURL(file);
      matchingOffline.file = file;
      matchingOffline.src = src;
      syncAudioGraph();
      showToast('Audio Re-linked! ✓', `Restored timeline track: ${file.name}`);
      continue;
    }
    
    const item = await new Promise(resolve => {
      const src = URL.createObjectURL(file);
      const audio = document.createElement('audio');
      audio.src = src;
      
      audio.onloadedmetadata = () => {
        const item = { 
          id: uid(), type: 'audio', name: file.name, file, src, 
          start: getNextStartTime('a1'), duration: audio.duration, trimStart: 0, trimEnd: audio.duration, track: 'a1', volume: 1 
        };
        
        _extractWaveformWorker(file, item).then(peaks => {
          item.waveformPeaks = peaks;
          resolve(item);
        });
      };
    });
    
    if (item) {
      newTracks.push(item);
      state.items.push(item);
      
      // Save file to IndexedDB session files store so it survives page refresh
      if (item.file) {
        await saveSessionFile(item.id, item.file);
      }
    }
  }

  if (newTracks.length) {
    pushHistory();
    computeTotalDuration();
    syncAudioGraph();
  }
  renderAll();
  setProcessing(false);
  if (newTracks.length) {
    showToast('Audio added ✓', newTracks.length + ' track(s) added');
  }
}

/**
 * Spawns the dynamic Web Worker to parse audio channel waveforms off-thread.
 */
function _extractWaveformWorker(file, item) {
  return new Promise((resolve) => {
    const audioCtx = new AudioContext();
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        const buffer = await audioCtx.decodeAudioData(reader.result);
        const rawChannel = buffer.getChannelData(0); // Left channel

        // Load background worker as dynamic blob URL
        const worker = new Worker('/video-editor/workers/audio-processor.js', { type: 'module' });
        
        worker.onmessage = (e) => {
          if (e.data.type === 'WAVEFORM_COMPLETE') {
            const peaks = new Float32Array(e.data.peaks);
            worker.terminate();
            resolve(peaks);
          }
        };

        // Transfer large array buffer to the worker without copy overhead
        worker.postMessage({
          type: 'GENERATE_WAVEFORM',
          channelData: rawChannel.buffer,
          samplesCount: 150
        }, [rawChannel.buffer]);

      } catch (err) {
        console.warn('Audio worker failed, using flat fallback waveform', err);
        resolve(new Float32Array(150).fill(0.3));
      }
    };
    
    reader.readAsArrayBuffer(file);
  });
}

function getNextStartTime(trackId) {
  const trackItems = state.items.filter(i => i.track === trackId);
  if (!trackItems.length) return 0;
  return Math.max(...trackItems.map(i => i.start + i.duration));
}

function updateLeftPanelClips() {
  const clipsList = document.getElementById('clips-list');
  const clipsSection = document.getElementById('clips-section');
  if (clipsList) {
    const videos = state.items.filter(i => i.type === 'video');
    if(clipsSection) clipsSection.style.display = videos.length ? 'block' : 'none';
    clipsList.innerHTML = videos.map(clip => `
      <div class="clip-item ${state.activeLayer === clip.id ? 'selected' : ''}" data-id="${clip.id}" style="cursor:pointer">
        <div class="clip-thumb">${clip.thumbnail ? `<img src="${clip.thumbnail}"/>` : ''}<div class="clip-dur">${formatTime(clip.duration)}</div></div>
        <div class="clip-info"><div class="clip-name" title="${clip.name}">${clip.name}</div></div>
      </div>
    `).join('');
    clipsList.querySelectorAll('.clip-item').forEach(el => 
      el.addEventListener('click', () => selectLayer(el.dataset.id)));
  }
}

// ── LAYER SELECTION ───────────────────────────────────────────
function selectLayer(id) {
  state.activeLayer = id;
  renderAll();
}

// ── RENDER INSPECTOR VALUES ────────────────────────────────────
function renderInspector() {
  const empty = document.getElementById('rp-empty');
  const videoPane = document.getElementById('rp-video');
  const textPane = document.getElementById('rp-text');
  const effectsPane = document.getElementById('rp-effects');
  
  if (!state.activeLayer) {
    if(empty) empty.style.display = 'flex';
    if(videoPane) videoPane.style.display = 'none';
    if(textPane) textPane.style.display = 'none';
    if(effectsPane) effectsPane.style.display = 'none';
    return;
  }
  
  const item = state.items.find(i => i.id === state.activeLayer);
  if (!item) { 
    if(empty) empty.style.display = 'flex';
    if(videoPane) videoPane.style.display = 'none';
    if(textPane) textPane.style.display = 'none';
    if(effectsPane) effectsPane.style.display = 'none';
    return; 
  }
  
  if(empty) empty.style.display = 'none';
  if(effectsPane) effectsPane.style.display = 'none';
  
  if (item.type === 'video' || item.type === 'image') {
    if(videoPane) videoPane.style.display = 'flex';
    if(textPane) textPane.style.display = 'none';
    
    setSlider('sl-brightness', 'val-brightness', item.filters.brightness);
    setSlider('sl-contrast', 'val-contrast', item.filters.contrast);
    setSlider('sl-saturation', 'val-saturation', item.filters.saturate);
    setSlider('sl-grayscale', 'val-grayscale', item.filters.grayscale);
    setSlider('sl-opacity', 'val-opacity', item.opacity ?? 100);
    setSlider('sl-vol', 'val-vol', Math.round((item.volume ?? 1) * 100));
    
    document.getElementById('sl-vol').disabled = (item.type === 'image');
    
    // Mute button binding
    const muteBtn = document.getElementById('btn-mute-clip');
    if (muteBtn) {
      muteBtn.textContent = item.muted ? '🔊 Unmute clip' : '🔇 Mute clip';
      muteBtn.disabled = (item.type === 'image');
    }

    // Track lane dropdown binding
    const trackLaneSelect = document.getElementById('sel-track-lane');
    if (trackLaneSelect) {
      trackLaneSelect.value = item.track || (item.type === 'video' ? 'v1' : 'v2');
      trackLaneSelect.disabled = false;
    }
    
    const ts = document.getElementById('in-trim-start'); if(ts) ts.value = item.trimStart.toFixed(2);
    const te = document.getElementById('in-trim-end'); if(te) te.value = item.trimEnd.toFixed(2);
    
    const px = document.getElementById('in-pos-x'); if(px) px.value = item.transform.x || 0;
    const py = document.getElementById('in-pos-y'); if(py) py.value = item.transform.y || 0;
    const sx = document.getElementById('in-scale-x'); if(sx) sx.value = item.transform.scaleX ?? 1;
    const sy = document.getElementById('in-scale-y'); if(sy) sy.value = item.transform.scaleY ?? 1;
    const rt = document.getElementById('in-rotation'); if(rt) rt.value = item.transform.rotation || 0;
    
    const fi = document.getElementById('in-fade-in'); if(fi) fi.value = item.transition?.fadeIn || 0;
    const fo = document.getElementById('in-fade-out'); if(fo) fo.value = item.transition?.fadeOut || 0;
    
    const bl = document.getElementById('sel-blend'); if(bl) bl.value = item.blendMode || 'normal';
  } else if (item.type === 'audio') {
    if(videoPane) videoPane.style.display = 'flex';
    if(textPane) textPane.style.display = 'none';
    setSlider('sl-vol', 'val-vol', Math.round((item.volume ?? 1) * 100));
    document.getElementById('sl-vol').disabled = false;

    // Mute button binding for audio
    const muteBtn = document.getElementById('btn-mute-clip');
    if (muteBtn) {
      muteBtn.textContent = item.muted ? '🔊 Unmute clip' : '🔇 Mute clip';
      muteBtn.disabled = false;
    }

    // Track lane dropdown binding (disabled for audio)
    const trackLaneSelect = document.getElementById('sel-track-lane');
    if (trackLaneSelect) {
      trackLaneSelect.disabled = true;
    }
  } else if (item.type === 'text') {
    if(videoPane) videoPane.style.display = 'none';
    if(textPane) textPane.style.display = 'flex';
    
    const textInput = document.getElementById('in-text-content');
    const fontSelect = document.getElementById('sel-font');
    const sizeInput = document.getElementById('in-text-size');
    const colorInput = document.getElementById('in-text-color');
    const startInput = document.getElementById('in-text-start');
    const durInput = document.getElementById('in-text-dur');
    const xInput = document.getElementById('in-text-x');
    const yInput = document.getElementById('in-text-y');

    if (textInput) textInput.value = item.name || '';
    if (fontSelect) fontSelect.value = item.transform.font || 'Inter';
    if (sizeInput) sizeInput.value = item.transform.size || 64;
    if (colorInput) colorInput.value = item.color || '#ffffff';
    
    setSlider('sl-text-opacity', 'val-text-opacity', item.opacity ?? 100);
    
    if (startInput) startInput.value = item.start.toFixed(2);
    if (durInput) durInput.value = item.duration.toFixed(2);
    if (xInput) xInput.value = item.transform.x || 0;
    if (yInput) yInput.value = item.transform.y || 0;
  } else if (item.type === 'effect') {
    if(videoPane) videoPane.style.display = 'none';
    if(textPane) textPane.style.display = 'none';
    if(effectsPane) effectsPane.style.display = 'flex';
    
    const fxNameInput = document.getElementById('in-fx-name');
    const fxTypeInput = document.getElementById('in-fx-type');
    const fxStartInput = document.getElementById('in-fx-start');
    const fxDurInput = document.getElementById('in-fx-dur');
    const fxSpeedGroup = document.getElementById('fx-speed-group');
    const fxSpeedSelect = document.getElementById('sel-fx-speed');
    
    if (fxNameInput) fxNameInput.value = item.name || '';
    if (fxTypeInput) fxTypeInput.value = item.fxType || '';
    if (fxStartInput) fxStartInput.value = item.start.toFixed(2);
    if (fxDurInput) fxDurInput.value = item.duration.toFixed(2);
    
    if (fxSpeedGroup) {
      fxSpeedGroup.style.display = item.fxType === 'slowmo' ? 'block' : 'none';
    }
    if (fxSpeedSelect) {
      fxSpeedSelect.value = item.speed || '0.5';
    }
  }
  
  const textList = document.getElementById('text-layers-list');
  if(textList) {
    const texts = state.items.filter(i => i.type === 'text');
    textList.innerHTML = texts.map(t => `
      <div class="text-layer-item ${state.activeLayer === t.id ? 'selected' : ''}" data-id="${t.id}">
        <span class="text-layer-name">${t.name}</span>
        <span class="text-dot"></span>
      </div>
    `).join('');
    textList.querySelectorAll('.text-layer-item').forEach(el => 
      el.addEventListener('click', () => selectLayer(el.dataset.id)));
  }
  
  updateActionButtons();
}

function buildRuler() {
  const ruler = document.getElementById('ruler');
  if (!ruler) return;
  ruler.innerHTML = '';

  const totalPx = timeToPx(state.totalDuration);
  ruler.style.width = totalPx + 'px';
  ruler.style.position = 'relative';

  const step = state.tlZoom < 0.5 ? 5 : state.tlZoom > 3 ? 0.5 : 1;
  const ppsVal = pps();
  
  for (let t = 0; t <= state.totalDuration; t += step) {
    const left = t * ppsVal;
    
    if (step === 1 && state.tlZoom > 1) {
      for (let sub = t + 0.1; sub < t + 1; sub += 0.1) {
        const subLeft = sub * ppsVal;
        const tick = document.createElement('div');
        tick.className = 'ruler-tick';
        tick.style.left = subLeft + 'px';
        ruler.appendChild(tick);
      }
    }

    const tick = document.createElement('div');
    tick.className = 'ruler-tick major';
    tick.style.left = left + 'px';
    ruler.appendChild(tick);

    const label = document.createElement('div');
    label.className = 'ruler-label';
    label.style.left = left + 'px';
    label.textContent = formatTime(t).split('.')[0];
    ruler.appendChild(label);
  }
}

function setTlZoom(newZoom, anchorTime) {
  const scrollEl = document.getElementById('tracks-scroll');
  const oldZoom = state.tlZoom;
  state.tlZoom = Math.max(TL_ZOOM_MIN, Math.min(TL_ZOOM_MAX, newZoom));
  
  if (scrollEl && anchorTime != null) {
    const oldPx = anchorTime * BASE_PPS * oldZoom;
    const newPx = anchorTime * BASE_PPS * state.tlZoom;
    const screenOffset = oldPx - scrollEl.scrollLeft;
    scrollEl.scrollLeft = newPx - screenOffset;
  }

  const zl = document.getElementById('zoom-label');
  if (zl) zl.textContent = Math.round(state.tlZoom * 100) + '%';

  renderTimeline();
  updatePlayhead();
}

function setSlider(id, valId, val) {
  const s = document.getElementById(id); const v = document.getElementById(valId);
  if(s) s.value = val; if(v) v.textContent = val;
}

function deleteLayer(itemId) {
  const toDelete = state.items.find(i => i.id === itemId);
  if (toDelete) {
    const deletedStart = toDelete.start;
    const deletedDuration = toDelete.duration;
    const deletedTrack = toDelete.track;

    const isSrcShared = state.items.some(it => it.id !== toDelete.id && it.src === toDelete.src);
    const isProxyShared = state.items.some(it => it.id !== toDelete.id && it.proxySrc === toDelete.proxySrc);
    const isThumbShared = state.items.some(it => it.id !== toDelete.id && it.thumbnail === toDelete.thumbnail);

    memoryManager.freeClipResources(toDelete, { srcShared: isSrcShared, proxyShared: isProxyShared, thumbShared: isThumbShared });
    state.items = state.items.filter(c => c.id !== toDelete.id);
    deleteSessionFile(itemId); // Remove from IndexedDB session store

    // Ripple shift subsequent clips in the same track
    state.items.forEach(item => {
      if (item.track === deletedTrack && item.start > deletedStart) {
        item.start = Math.max(0, item.start - deletedDuration);
      }
    });

    if (state.activeLayer === itemId) {
      state.activeLayer = null;
    }
    pushHistory();
    computeTotalDuration();
    syncAudioGraph();
    renderAll();
  }
}

function addTextLayer(text, size, weight) {
  const item = {
    id: uid(), type: 'text', name: text || 'Your text here', 
    start: state.globalTime, duration: 5, trimStart: 0, trimEnd: 5, track: 't1',
    color: '#ffffff', 
    filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
    transform: { x: 0, y: 0, size: size || 64, weight: weight || 700, font: 'Inter', scaleX:1, scaleY:1, rotation:0 },
    opacity: 100, volume: 0, blendMode: 'normal',
    transition: { fadeIn: 0, fadeOut: 0 }
  };
  state.items.push(item);
  state.activeLayer = item.id;
  pushHistory();
  computeTotalDuration();
  syncAudioGraph();
  renderAll();
  showToast('Text added', 'Edit it in the Properties panel');
}

function addEffectLayer(fxType, fxName) {
  const item = {
    id: uid(), type: 'effect', name: fxName || 'Effect',
    start: state.globalTime, duration: 4, trimStart: 0, trimEnd: 4, track: 'fx1',
    fxType: fxType,
    speed: fxType === 'slowmo' ? '0.5' : '1.0',
    filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
    transform: { x: 0, y: 0, scaleX:1, scaleY:1, rotation:0 },
    opacity: 100, volume: 0, blendMode: 'normal',
    transition: { fadeIn: 0, fadeOut: 0 }
  };
  state.items.push(item);
  state.activeLayer = item.id;
  pushHistory();
  computeTotalDuration();
  syncAudioGraph();
  renderAll();
  showToast(`${fxName} added`, 'Effect overlay placed on FX1');
}

// ── UI EVENT LISTENERS ATTACHMENT ─────────────────────────────
function setupEventListeners() {
  // Undo & Split Binds
  document.getElementById('btn-undo').addEventListener('click', () => {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      state.items = state.history[state.historyIndex].map(i => ({...i, filters: {...i.filters}, transform: {...i.transform}}));
      computeTotalDuration();
      renderAll();
      syncAudioGraph();
      showToast('Undo ✓', 'State restored');
    }
  });

  document.getElementById('btn-split').addEventListener('click', async () => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (!item) return;

    const isActive = state.globalTime >= item.start && state.globalTime < item.start + item.duration;
    if (!isActive) return;

    const splitTimeLocal = item.trimStart + (state.globalTime - item.start);
    if (splitTimeLocal <= item.trimStart + 0.1 || splitTimeLocal >= item.trimEnd - 0.1) return;

    const idx = state.items.indexOf(item);
    const a = { ...item, id: uid(), filters: {...item.filters}, transform: {...item.transform}, trimEnd: splitTimeLocal, duration: state.globalTime - item.start };
    const b = { ...item, id: uid(), filters: {...item.filters}, transform: {...item.transform}, start: state.globalTime, trimStart: splitTimeLocal, duration: item.trimEnd - splitTimeLocal };

    state.items.splice(idx, 1, a, b);
    
    // Save new split clips' files to IndexedDB session files store so they survive page refresh
    if (a.file) {
      await saveSessionFile(a.id, a.file);
    }
    if (b.file) {
      await saveSessionFile(b.id, b.file);
    }
    
    // Remove the old item's hardware decoder and WebAudio resources safely without revoking Blob URL
    decoderPool.remove(item.id);
    const soundNode = memoryManager.audioNodesMap.get(item.id);
    if (soundNode) {
      soundNode.audio.pause();
      soundNode.audio.removeAttribute('src');
      soundNode.audio.load();
      memoryManager.audioNodesMap.delete(item.id);
    }
    
    // Delete the original split clip's file from IndexedDB
    await deleteSessionFile(item.id);

    state.activeLayer = a.id;
    pushHistory();
    computeTotalDuration();
    syncAudioGraph();
    renderAll();
  });

  document.getElementById('btn-delete').addEventListener('click', () => {
    if (state.activeLayer) {
      deleteLayer(state.activeLayer);
    }
  });

  // ── TIMELINE CONTEXT MENU ──
  // Hide context menu when clicking outside
  document.addEventListener('click', () => {
    const ctxMenu = document.getElementById('ctx-menu');
    if (ctxMenu) ctxMenu.classList.remove('show');
  });

  // Position and show context menu
  window.showTimelineContextMenu = function(e, itemId) {
    const ctxMenu = document.getElementById('ctx-menu');
    if (!ctxMenu) return;
    
    ctxMenu.style.left = e.clientX + 'px';
    ctxMenu.style.top = e.clientY + 'px';
    ctxMenu.classList.add('show');
    
    ctxMenu.dataset.targetId = itemId;
  };

  // Select item from context menu
  document.getElementById('ctx-select')?.addEventListener('click', () => {
    const ctxMenu = document.getElementById('ctx-menu');
    const targetId = ctxMenu?.dataset.targetId;
    if (targetId) {
      selectLayer(targetId);
    }
  });

  // Delete item (Ripple Delete) from context menu
  document.getElementById('ctx-delete')?.addEventListener('click', () => {
    const ctxMenu = document.getElementById('ctx-menu');
    const targetId = ctxMenu?.dataset.targetId;
    if (targetId) {
      deleteLayer(targetId);
    }
  });

  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    let next;
    if (currentTheme === 'system') next = 'light';
    else if (currentTheme === 'light') next = 'dark';
    else next = 'system';
    
    applyTheme(next);
    showToast('Theme Changed ✓', `Applied ${next} theme`);
  });

  // Playback & Export clicks
  document.getElementById('btn-play').addEventListener('click', togglePlay);
  document.getElementById('btn-skip-start').addEventListener('click', () => seekTo(0));
  document.getElementById('btn-skip-end').addEventListener('click', () => seekTo(state.totalDuration - 0.01));
  document.getElementById('btn-frame-back')?.addEventListener('click', () => seekTo(state.globalTime - 1 / state.fps));
  document.getElementById('btn-frame-fwd')?.addEventListener('click', () => seekTo(state.globalTime + 1 / state.fps));

  // Export handlers (yielding watchdogs, Phase 10)
  const runExport = () => {
    if (!state.items.length) return;
    setProcessing(true, 'Preparing Export...', 'Configuring encoders...');
    
    exportEngine.exportProject(
      state,
      (ctx, canvas) => renderFrame({ items: state.items, globalTime: state.globalTime }),
      (pct) => {
        setProcessing(true, `Exporting: ${pct}%`, 'Rendering video frames... Esc to cancel');
      },
      (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        a.download = `editroy-export-${Date.now()}.${ext}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setProcessing(false);
        showToast('Export complete ✓', 'File downloaded');
      },
      (err) => {
        setProcessing(false);
        showToast('Export failed', err, true);
      }
    );
  };

  document.getElementById('btn-export-top').addEventListener('click', runExport);
  const mainExp = document.getElementById('btn-export-main');
  if (mainExp) mainExp.addEventListener('click', runExport);

  // ── NAVIGATION RAIL (Left sidebar) ──
  document.querySelectorAll('.rail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      const pane = document.getElementById('tab-' + tab);
      document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      if (pane) pane.classList.add('active');
    });
  });

  // ── INSPECTOR TABS ──
  document.querySelectorAll('.rp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rp-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.rp-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('pane-' + btn.dataset.pane)?.classList.add('active');
    });
  });

  // ── TRIGGER UPLOADS ──
  document.getElementById('trigger-video-upload')?.addEventListener('click', () => document.getElementById('input-video').click());
  document.getElementById('trigger-image-upload')?.addEventListener('click', () => document.getElementById('input-image').click());
  document.getElementById('trigger-audio-upload')?.addEventListener('click', () => document.getElementById('input-audio').click());

  // ── UPLOAD ZONES ──
  setupUploadZone('uz-video', 'input-video', handleVideoFiles);
  setupUploadZone('uz-image', 'input-image', handleVideoFiles);
  setupUploadZone('uz-audio', 'input-audio', handleAudioFiles);

  // ── TIMELINE SCRUBBING & ZOOM BINDINGS ──
  let _scrubbing = false;
  let _scrubRafId = null;

  function doScrub(clientX) {
    const scrollEl = document.getElementById('tracks-scroll');
    if (!scrollEl) return;
    const rect = scrollEl.getBoundingClientRect();
    const x = (clientX - rect.left) + scrollEl.scrollLeft;
    const t = Math.max(0, Math.min(state.totalDuration, pxToTime(x)));
    seekTo(t);
  }

  const tracksScroll = document.getElementById('tracks-scroll');
  
  tracksScroll?.addEventListener('mousedown', e => {
    if (e.target.closest('.tl-trim-left') || e.target.closest('.tl-trim-right') || e.target.closest('.tl-clip') || e.target.closest('.tl-audio-block')) return;
    _scrubbing = true;
    doScrub(e.clientX);
    
    const onMove = (ev) => {
      if (!_scrubbing) return;
      cancelAnimationFrame(_scrubRafId);
      _scrubRafId = requestAnimationFrame(() => doScrub(ev.clientX));
    };
    const onUp = () => {
      _scrubbing = false;
      cancelAnimationFrame(_scrubRafId);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseup', onUp);
  });

  tracksScroll?.addEventListener('touchstart', e => {
    if (e.target.closest('.tl-trim-left') || e.target.closest('.tl-trim-right') || e.target.closest('.tl-clip') || e.target.closest('.tl-audio-block')) return;
    if (!e.touches[0]) return;
    _scrubbing = true;
    doScrub(e.touches[0].clientX);
    
    const onMove = (ev) => {
      if (!_scrubbing || !ev.touches[0]) return;
      cancelAnimationFrame(_scrubRafId);
      _scrubRafId = requestAnimationFrame(() => doScrub(ev.touches[0].clientX));
    };
    const onEnd = () => {
      _scrubbing = false;
      cancelAnimationFrame(_scrubRafId);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
  });

  // Timeline Zoom Buttons
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    const scrollEl = document.getElementById('tracks-scroll');
    const anchor = scrollEl ? pxToTime(scrollEl.scrollLeft + scrollEl.clientWidth / 2) : state.globalTime;
    setTlZoom(state.tlZoom * (1 + TL_ZOOM_STEP), anchor);
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    const scrollEl = document.getElementById('tracks-scroll');
    const anchor = scrollEl ? pxToTime(scrollEl.scrollLeft + scrollEl.clientWidth / 2) : state.globalTime;
    setTlZoom(state.tlZoom / (1 + TL_ZOOM_STEP), anchor);
  });

  // Ctrl+Wheel Zoom on Timeline
  tracksScroll?.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = tracksScroll.getBoundingClientRect();
    const anchor = pxToTime((e.clientX - rect.left) + tracksScroll.scrollLeft);
    const delta = e.deltaY > 0 ? -TL_ZOOM_STEP * 0.5 : TL_ZOOM_STEP * 0.5;
    setTlZoom(state.tlZoom * (1 + delta), anchor);
  }, { passive: false });

  // Touch Pinch Zoom on Timeline
  (function() {
    let lastPinchDist = 0;
    tracksScroll?.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        lastPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    tracksScroll?.addEventListener('touchmove', e => {
      if (e.touches.length !== 2 || lastPinchDist === 0) return;
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const ratio = dist / lastPinchDist;
      lastPinchDist = dist;
      setTlZoom(state.tlZoom * ratio, state.globalTime);
    }, { passive: true });
    tracksScroll?.addEventListener('touchend', () => {
      lastPinchDist = 0;
    }, { passive: true });
  })();

  // ── PREVIEW ZOOM ──
  let previewZoom = 100;
  function applyPreviewZoom() {
    const pc = document.getElementById('preview-img-canvas');
    if (pc) { pc.style.transform = `scale(${previewZoom / 100})`; pc.style.transformOrigin = 'center center'; }
    const zoomVal = document.getElementById('zoom-label');
    if (zoomVal) zoomVal.textContent = previewZoom + '%';
  }
  
  // ── FILTERS & ADJUSTMENTS ──
  const bindSlider = (id, cb) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', e => { cb(Number(e.target.value)); renderFrame(state); });
  };
  const updateActiveFilter = (key, val) => {
    const item = state.items.find(c => c.id === state.activeLayer);
    if (item && item.filters) {
      item.filters[key] = val;
      const valLabel = document.getElementById(`val-${key}`);
      if (valLabel) valLabel.textContent = val;
    }
  };
  bindSlider('sl-brightness', v => updateActiveFilter('brightness', v));
  bindSlider('sl-contrast', v => updateActiveFilter('contrast', v));
  bindSlider('sl-saturation', v => updateActiveFilter('saturate', v));
  bindSlider('sl-grayscale', v => updateActiveFilter('grayscale', v));
  bindSlider('sl-opacity', v => {
    const item = state.items.find(x => x.id === state.activeLayer);
    if (item) {
      item.opacity = v;
      const label = document.getElementById('val-opacity');
      if (label) label.textContent = v;
    }
  });
  bindSlider('sl-vol', v => {
    const item = state.items.find(x => x.id === state.activeLayer);
    if (item) {
      item.volume = v / 100;
      const label = document.getElementById('val-vol');
      if (label) label.textContent = v;
      syncAudioGraph();
    }
  });
  document.getElementById('sl-master-vol-side')?.addEventListener('input', e => {
    state.masterVolume = e.target.value / 100;
    const label = document.getElementById('val-master-vol-side');
    if (label) label.textContent = e.target.value;
    syncAudioGraph();
  });
  document.getElementById('sl-sel-vol-side')?.addEventListener('input', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item) {
      item.volume = Number(e.target.value) / 100;
      const label = document.getElementById('val-sel-vol-side');
      if (label) label.textContent = e.target.value;
      syncAudioGraph();
    }
  });

  document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
    const item = state.items.find(c => c.id === state.activeLayer);
    if (item && item.filters) {
      item.filters = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0 };
      renderInspector(); renderFrame(state); pushHistory(); showToast('Filters reset');
    }
  });

  document.getElementById('btn-mute-clip')?.addEventListener('click', () => {
    const item = state.items.find(x => x.id === state.activeLayer);
    if (item) {
      item.muted = !item.muted;
      const muteBtn = document.getElementById('btn-mute-clip');
      if (muteBtn) muteBtn.textContent = item.muted ? '🔊 Unmute clip' : '🔇 Mute clip';
      syncAudioGraph();
      pushHistory();
      renderAll();
    }
  });

  document.getElementById('sel-track-lane')?.addEventListener('change', e => {
    const item = state.items.find(x => x.id === state.activeLayer);
    if (item) {
      item.track = e.target.value;
      pushHistory();
      renderAll();
    }
  });

  // ── TRANSFORM FIELDS ──
  const bindTransformInput = (inputId, prop) => {
    document.getElementById(inputId)?.addEventListener('input', e => {
      const item = state.items.find(i => i.id === state.activeLayer);
      if (item && item.transform) {
        item.transform[prop] = parseFloat(e.target.value) || 0;
        renderFrame(state);
      }
    });
    document.getElementById(inputId)?.addEventListener('change', () => pushHistory());
  };
  bindTransformInput('in-pos-x', 'x');
  bindTransformInput('in-pos-y', 'y');
  bindTransformInput('in-scale-x', 'scaleX');
  bindTransformInput('in-scale-y', 'scaleY');
  bindTransformInput('in-rotation', 'rotation');

  document.getElementById('in-fade-in')?.addEventListener('input', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item) {
      if (!item.transition) item.transition = { fadeIn: 0, fadeOut: 0 };
      item.transition.fadeIn = parseFloat(e.target.value) || 0;
      renderFrame(state);
    }
  });
  document.getElementById('in-fade-in')?.addEventListener('change', () => pushHistory());

  document.getElementById('in-fade-out')?.addEventListener('input', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item) {
      if (!item.transition) item.transition = { fadeIn: 0, fadeOut: 0 };
      item.transition.fadeOut = parseFloat(e.target.value) || 0;
      renderFrame(state);
    }
  });
  document.getElementById('in-fade-out')?.addEventListener('change', () => pushHistory());

  document.getElementById('sel-blend')?.addEventListener('change', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item) { item.blendMode = e.target.value; renderFrame(state); pushHistory(); }
  });

  document.getElementById('btn-reset-transform')?.addEventListener('click', () => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item) {
      item.transform = { x: 0, y: 0, scaleX: item.type === 'image' ? 0.3 : 1, scaleY: item.type === 'image' ? 0.3 : 1, rotation: 0 };
      item.transition = { fadeIn: 0, fadeOut: 0 };
      renderInspector(); renderFrame(state); pushHistory(); showToast('Transform reset');
    }
  });

  // ── TRIM INPUTS ──
  document.getElementById('in-trim-start')?.addEventListener('change', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item) {
      item.trimStart = parseFloat(e.target.value) || 0;
      item.duration = item.trimEnd - item.trimStart;
      computeTotalDuration(); renderTimeline(); pushHistory();
    }
  });
  document.getElementById('in-trim-end')?.addEventListener('change', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item) {
      item.trimEnd = parseFloat(e.target.value) || item.duration;
      item.duration = item.trimEnd - item.trimStart;
      computeTotalDuration(); renderTimeline(); pushHistory();
    }
  });

  // ── TEXT INSPECTOR ──
  document.getElementById('in-text-content')?.addEventListener('input', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'text') { item.name = e.target.value; renderFrame(state); renderTimeline(); }
  });
  document.getElementById('in-text-content')?.addEventListener('change', () => pushHistory());

  document.getElementById('in-text-color')?.addEventListener('input', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'text') { item.color = e.target.value; renderFrame(state); }
  });
  document.getElementById('in-text-color')?.addEventListener('change', () => pushHistory());

  document.getElementById('in-text-size')?.addEventListener('input', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'text') { item.transform.size = parseInt(e.target.value) || 64; renderFrame(state); }
  });
  document.getElementById('in-text-size')?.addEventListener('change', () => pushHistory());

  document.getElementById('sl-text-opacity')?.addEventListener('input', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'text') {
      item.opacity = Number(e.target.value);
      const label = document.getElementById('val-text-opacity');
      if (label) label.textContent = e.target.value;
      renderFrame(state);
    }
  });
  document.getElementById('sl-text-opacity')?.addEventListener('change', () => pushHistory());

  document.getElementById('sel-font')?.addEventListener('change', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'text') { item.transform.font = e.target.value; renderFrame(state); pushHistory(); }
  });

  document.getElementById('in-text-start')?.addEventListener('change', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'text') { 
      item.start = Math.max(0, parseFloat(e.target.value) || 0); 
      computeTotalDuration(); renderTimeline(); pushHistory(); 
    }
  });

  document.getElementById('in-text-dur')?.addEventListener('change', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'text') { 
      item.duration = Math.max(0.2, parseFloat(e.target.value) || 1); 
      computeTotalDuration(); renderTimeline(); pushHistory(); 
    }
  });

  document.getElementById('in-text-x')?.addEventListener('input', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'text') { item.transform.x = parseFloat(e.target.value) || 0; renderFrame(state); }
  });
  document.getElementById('in-text-x')?.addEventListener('change', () => pushHistory());

  document.getElementById('in-text-y')?.addEventListener('input', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'text') { item.transform.y = parseFloat(e.target.value) || 0; renderFrame(state); }
  });
  document.getElementById('in-text-y')?.addEventListener('change', () => pushHistory());

  // ── TEXT ADDITION & PRESETS ──
  document.getElementById('btn-add-text')?.addEventListener('click', () => addTextLayer('Your text here', 64, 700));
  document.querySelectorAll('.text-preset').forEach(el => {
    el.addEventListener('click', () => {
      const size = parseInt(el.dataset.size) || 64;
      const weight = parseInt(el.dataset.weight) || 700;
      const label = el.querySelector('span')?.textContent || 'Text';
      addTextLayer(label, size, weight);
    });
  });

  // ── EFFECT CARDS ──
  document.querySelectorAll('.effect-card').forEach(el => {
    el.addEventListener('click', async () => {
      const spanEl = el.querySelector('span');
      if (!spanEl) return;
      const name = spanEl.textContent;
      if (name.includes('AI Background')) {
        if (!aiBackgroundRemover.isDeviceSuitable()) {
          showToast('⚠️ Performance notice', 'AI models run best on desktop profiles with high RAM.', true);
        }
        setProcessing(true, 'Checking AI Suite...', 'Loading placeholders sparsely...');
        await aiBackgroundRemover.loadModelSparsely();
        setProcessing(false);
        showToast('Coming Soon! ✓', 'AI background remover placeholder loaded.');
        return;
      }
      
      const fxType = el.dataset.fx;
      if (fxType) {
        addEffectLayer(fxType, name);
      }
    });
  });

  // ── EFFECTS PROPERTIES BINDINGS ──
  document.getElementById('in-fx-start')?.addEventListener('change', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'effect') {
      item.start = Math.max(0, parseFloat(e.target.value) || 0);
      computeTotalDuration(); renderTimeline(); pushHistory();
    }
  });

  document.getElementById('in-fx-dur')?.addEventListener('change', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'effect') {
      item.duration = Math.max(0.2, parseFloat(e.target.value) || 1);
      item.trimEnd = item.duration;
      computeTotalDuration(); renderTimeline(); pushHistory();
    }
  });

  document.getElementById('sel-fx-speed')?.addEventListener('change', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.type === 'effect' && item.fxType === 'slowmo') {
      item.speed = e.target.value;
      pushHistory();
      renderAll();
    }
  });

  // ── NEW AI TOOLS INITIALIZER ──
  document.getElementById('btn-run-ai-remover')?.addEventListener('click', async () => {
    if (!aiBackgroundRemover.isDeviceSuitable()) {
      showToast('⚠️ Performance notice', 'AI models run best on desktop profiles with high RAM.', true);
    }
    setProcessing(true, 'Checking AI Suite...', 'Loading AI models sparsely...');
    await aiBackgroundRemover.loadModelSparsely();
    setProcessing(false);
    showToast('Coming Soon! ✓', 'AI background remover placeholder loaded.');
  });

  // ── TIMELINE RESIZER ──
  (function() {
    const resizer = document.getElementById('timeline-resizer');
    const app = document.getElementById('app');
    if (!resizer || !app) return;
    let isResizing = false, startY = 0, startH = 280;
    
    resizer.addEventListener('mousedown', e => {
      isResizing = true;
      startY = e.clientY;
      startH = parseInt(getComputedStyle(app).getPropertyValue('--timeline-h') || '280');
      resizer.classList.add('dragging');
      document.body.style.cursor = 'ns-resize';
    });
    
    document.addEventListener('mousemove', e => {
      if (!isResizing) return;
      const dy = e.clientY - startY;
      const newH = Math.max(120, Math.min(600, startH - dy));
      app.style.setProperty('--timeline-h', newH + 'px');
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        resizer.classList.remove('dragging');
        document.body.style.cursor = '';
      }
    });
  })();

  // ── CANVAS INTERACTION (drag to move, scroll to resize) ──
  canvasDrag = null;
  const previewCanvas = document.getElementById('preview-canvas');
  const renderCanvas = document.getElementById('preview-img-canvas');

  previewCanvas?.addEventListener('contextmenu', e => {
    const renderCanvas = document.getElementById('preview-img-canvas');
    if (!renderCanvas) return;
    
    const activeItems = state.items.filter(item => {
      return state.globalTime >= item.start && state.globalTime < item.start + item.duration;
    });
    
    const clickedItem = activeItems.find(item => {
      if (item.type !== 'image' && item.type !== 'text') return false;
      const bounds = getItemBoundsOnScreen(item);
      if (!bounds) return false;
      
      const rect = renderCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      return (mouseX >= bounds.cx - bounds.halfW && 
              mouseX <= bounds.cx + bounds.halfW && 
              mouseY >= bounds.cy - bounds.halfH && 
              mouseY <= bounds.cy + bounds.halfH);
    });

    if (clickedItem) {
      e.preventDefault();
      e.stopPropagation();
      selectLayer(clickedItem.id);
      if (typeof window.showTimelineContextMenu === 'function') {
        window.showTimelineContextMenu(e, clickedItem.id);
      }
    }
  });

  previewCanvas?.addEventListener('mousedown', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (!item || (item.type !== 'image' && item.type !== 'text')) return;
    if (e.target.dataset.handle) return;
    e.preventDefault();
    const rect = renderCanvas.getBoundingClientRect();
    canvasDrag = {
      item, startMouseX: e.clientX, startMouseY: e.clientY,
      startItemX: item.transform.x || 0, startItemY: item.transform.y || 0,
      scaleFactorX: renderCanvas.width / rect.width,
      scaleFactorY: renderCanvas.height / rect.height
    };
  });

  previewCanvas?.addEventListener('wheel', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (!item || (item.type !== 'image' && item.type !== 'text')) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.03 : 0.03;
    item.transform.scaleX = Math.max(0.05, Math.min(5, (item.transform.scaleX ?? 1) + delta));
    item.transform.scaleY = Math.max(0.05, Math.min(5, (item.transform.scaleY ?? 1) + delta));
    renderFrame(state); renderInspector(); updateSelectionOverlay();
  }, { passive: false });

  document.addEventListener('mousemove', e => {
    if (handleDragState) {
      const dx = (e.clientX - handleDragState.startMouseX) * handleDragState.scaleFactorX;
      const dy = (e.clientY - handleDragState.startMouseY) * handleDragState.scaleFactorY;
      const item = handleDragState.item;
      
      if (handleDragState.handle === 'move') {
        item.transform.x = handleDragState.startX + dx;
        item.transform.y = handleDragState.startY + dy;
      } else {
        const newSX = Math.max(0.05, handleDragState.startScaleX + (dx / 200));
        const newSY = Math.max(0.05, handleDragState.startScaleY + (dy / 200));
        if (handleDragState.handle === 'se') { item.transform.scaleX = newSX; item.transform.scaleY = newSY; }
        else if (handleDragState.handle === 'sw') { item.transform.scaleX = Math.max(0.05, handleDragState.startScaleX - dx/200); item.transform.scaleY = newSY; }
        else if (handleDragState.handle === 'ne') { item.transform.scaleX = newSX; item.transform.scaleY = Math.max(0.05, handleDragState.startScaleY - dy/200); }
        else if (handleDragState.handle === 'nw') { item.transform.scaleX = Math.max(0.05, handleDragState.startScaleX - dx/200); item.transform.scaleY = Math.max(0.05, handleDragState.startScaleY - dy/200); }
      }
      renderFrame(state); renderInspector(); updateSelectionOverlay();
    }
    if (canvasDrag) {
      const dx = (e.clientX - canvasDrag.startMouseX) * canvasDrag.scaleFactorX;
      const dy = (e.clientY - canvasDrag.startMouseY) * canvasDrag.scaleFactorY;
      canvasDrag.item.transform.x = canvasDrag.startItemX + dx;
      canvasDrag.item.transform.y = canvasDrag.startItemY + dy;
      renderFrame(state); renderInspector(); updateSelectionOverlay();
    }
  });

  document.addEventListener('mouseup', () => {
    if (handleDragState || canvasDrag) { pushHistory(); handleDragState = null; canvasDrag = null; }
  });

  // ── TIMELINE CLIP DRAG FUNCTIONS ──
  let dragState = null;
  let _isDragging = false;
  let _dragPreviewThrottle = 0;
  let _dragRafId = null;
  const DRAG_PREVIEW_MS = 60;

  function handleDrag(e, itemId, action) {
    if (e.stopPropagation) e.stopPropagation();
    const item = state.items.find(i => i.id === itemId);
    if (!item) return;
    selectLayer(itemId);
    _isDragging = true;
    _dragPreviewThrottle = 0;
    
    const startX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    dragState = { 
      type: action, 
      item, 
      startX,
      startStart: item.start, 
      startDuration: item.duration,
      startTrimStart: item.trimStart, 
      startTrimEnd: item.trimEnd, 
      scrollLeftAtStart: getTlScroll(),
    };
    
    if (action === 'move') document.body.classList.add('is-dragging');
    else document.body.classList.add('is-trimming');
    
    const trackEl = document.getElementById('track-' + item.track);
    const clipEl = trackEl?.querySelector('[data-id="' + item.id + '"]');
    if (clipEl) clipEl.classList.add('dragging');
    
    document.addEventListener('mousemove', onDragMove, { passive: true });
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: true });
    document.addEventListener('touchend', onDragEnd);
  }

  function onDragMove(e) {
    if (!dragState) return;
    const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : dragState.startX);
    const dx = clientX - dragState.startX;
    const dt = pxToTime(dx);
    const item = dragState.item;
    
    if (dragState.type === 'move') {
      item.start = Math.max(0, dragState.startStart + dt);
    } else if (dragState.type === 'trim-start') {
      const shift = Math.min(dt, dragState.startDuration - 0.1);
      item.start = Math.max(0, dragState.startStart + shift);
      item.duration = dragState.startDuration - (item.start - dragState.startStart);
      item.trimStart = dragState.startTrimStart + (item.start - dragState.startStart);
    } else if (dragState.type === 'trim-end') {
      item.duration = Math.max(0.1, dragState.startDuration + dt);
      item.trimEnd = dragState.startTrimStart + item.duration;
    }
    
    computeTotalDuration();
    applyClipTransformFast(item);
    
    if (!_dragRafId) {
      _dragRafId = requestAnimationFrame(() => {
        _dragRafId = null;
        renderInspector();
        const now = performance.now();
        if (now - _dragPreviewThrottle > DRAG_PREVIEW_MS) {
          _dragPreviewThrottle = now;
          renderFrame(state);
        }
      });
    }
  }

  function applyClipTransformFast(item) {
    const trackEl = document.getElementById('track-' + item.track);
    if (!trackEl) return;
    const clipEl = trackEl.querySelector('[data-id="' + item.id + '"]');
    if (!clipEl) return;
    const inner = document.getElementById('tracks-inner');
    if (inner) {
      const totalPx = Math.max(timeToPx(state.totalDuration), getTlViewportW());
      inner.style.width = totalPx + 'px';
    }
    clipEl.style.left = timeToPx(item.start) + 'px';
    clipEl.style.width = Math.max(timeToPx(item.duration), 4) + 'px';
  }

  function onDragEnd(e) {
    if (!dragState) return;
    cancelAnimationFrame(_dragRafId);
    _dragRafId = null;
    _isDragging = false;
    document.body.classList.remove('is-dragging', 'is-trimming');
    const trackEl = document.getElementById('track-' + dragState.item.track);
    const clipEl = trackEl?.querySelector('[data-id="' + dragState.item.id + '"]');
    if (clipEl) clipEl.classList.remove('dragging');
    pushHistory();
    dragState = null;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);
    renderTimeline();
    renderFrame(state);
  }

  state.handleDrag = handleDrag;
}

function handleTextUpload(textStr) {
  if (!textStr || !textStr.length) return;
  const clip = {
    id: uid(), type: 'text', name: textStr,
    start: getNextStartTime('t1'), duration: 5, trimStart: 0, trimEnd: 5, track: 't1',
    filters: {}, transform: {x:0, y:0, scaleX:1, scaleY:1, rotation:0, size:64, weight:600},
    color: '#ffffff', opacity: 100
  };
  state.items.push(clip);
  pushHistory();
  computeTotalDuration();
  renderAll();
}

function setupUploadZone(zoneId, inputId, handler) {
  const zone = document.getElementById(zoneId); const inp = document.getElementById(inputId);
  if (!zone || !inp) return;
  zone.addEventListener('click', () => inp.click());
  inp.addEventListener('change', () => { if (inp.files.length) handler(Array.from(inp.files)); inp.value=''; });
}

// ── UTILITIES ─────────────────────────────────────────────────
function showToast(title, desc = '', isError = false) {
  const el = document.getElementById('toast');
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-desc').textContent = desc;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

function setProcessing(show, title = 'Processing…', desc = 'Please wait') {
  const el = document.getElementById('proc-overlay');
  document.getElementById('proc-title').textContent = title;
  document.getElementById('proc-desc').textContent = desc;
  el.classList.toggle('show', show);
}

// ── SELECTION OVERLAYS ────────────────────────────────────────
const selOverlay = document.createElement('div');
selOverlay.id = 'sel-overlay';
selOverlay.style.cssText = 'position:absolute;pointer-events:none;z-index:15;display:none;';
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('preview-canvas');
  if (container) container.appendChild(selOverlay);
});

function updateSelectionOverlay() {
  if (!state.activeLayer) { selOverlay.style.display = 'none'; return; }
  const item = state.items.find(i => i.id === state.activeLayer);
  if (!item || item.type === 'audio' || item.type === 'video') { selOverlay.style.display = 'none'; return; }
  
  const b = getItemBoundsOnScreen(item);
  if (!b) return;
  
  const pc = document.getElementById('preview-img-canvas');
  const pcRect = pc?.getBoundingClientRect();
  const containerRect = document.getElementById('preview-canvas')?.getBoundingClientRect();
  if (!pcRect || !containerRect) return;
  
  const offX = pcRect.left - containerRect.left;
  const offY = pcRect.top - containerRect.top;
  const left = offX + b.cx - b.halfW;
  const top = offY + b.cy - b.halfH;
  const width = b.halfW * 2;
  const height = b.halfH * 2;
  
  selOverlay.style.display = 'block';
  selOverlay.style.left = left + 'px';
  selOverlay.style.top = top + 'px';
  selOverlay.style.width = width + 'px';
  selOverlay.style.height = height + 'px';
  selOverlay.style.border = '2px solid rgba(99,102,241,.9)';
  selOverlay.style.borderRadius = '3px';
  selOverlay.style.pointerEvents = 'none';

  const canInteract = item.type !== 'video';
  const handleStyle = canInteract ? 'pointer-events:auto;' : '';
  // Draw corner handles
  selOverlay.innerHTML = canInteract ? `
    <div data-handle="nw" style="position:absolute;width:10px;height:10px;background:#fff;border:2px solid var(--accent);border-radius:2px;top:-5px;left:-5px;cursor:nwse-resize;${handleStyle}"></div>
    <div data-handle="ne" style="position:absolute;width:10px;height:10px;background:#fff;border:2px solid var(--accent);border-radius:2px;top:-5px;right:-5px;cursor:nesw-resize;${handleStyle}"></div>
    <div data-handle="sw" style="position:absolute;width:10px;height:10px;background:#fff;border:2px solid var(--accent);border-radius:2px;bottom:-5px;left:-5px;cursor:nesw-resize;${handleStyle}"></div>
    <div data-handle="se" style="position:absolute;width:10px;height:10px;background:#fff;border:2px solid var(--accent);border-radius:2px;bottom:-5px;right:-5px;cursor:nwse-resize;${handleStyle}"></div>
    <div data-handle="move" style="position:absolute;inset:0;cursor:move;${handleStyle}"></div>
  ` : '';

  // Bind handle events
  selOverlay.querySelectorAll('[data-handle]').forEach(h => {
    h.style.pointerEvents = 'auto';
    h.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const rect = pc.getBoundingClientRect();
      handleDragState = {
        handle: h.dataset.handle,
        item, startMouseX: e.clientX, startMouseY: e.clientY,
        startX: item.transform.x || 0, startY: item.transform.y || 0,
        startScaleX: item.transform.scaleX ?? 1, startScaleY: item.transform.scaleY ?? 1,
        scaleFactorX: pc.width / rect.width,
        scaleFactorY: pc.height / rect.height
      };
    });
  });
}

function getItemBoundsOnScreen(item) {
  const pc = document.getElementById('preview-img-canvas');
  if (!pc) return null;
  const rect = pc.getBoundingClientRect();
  const scaleX = rect.width / pc.width;
  const scaleY = rect.height / pc.height;
  const cx = rect.width / 2 + (item.transform.x || 0) * scaleX;
  const cy = rect.height / 2 + (item.transform.y || 0) * scaleY;
  
  let halfW = 100, halfH = 60;
  if (item.type === 'image') {
    const img = memoryManager.imageCache.get(item.id);
    if (img && img.naturalWidth) {
      const fitScale = Math.min(pc.width / img.naturalWidth, pc.height / img.naturalHeight);
      halfW = img.naturalWidth * fitScale * (item.transform.scaleX ?? 1) * scaleX / 2;
      halfH = img.naturalHeight * fitScale * (item.transform.scaleY ?? 1) * scaleY / 2;
    }
  } else if (item.type === 'text') {
    const ctx = pc.getContext('2d');
    ctx.save();
    const fontSize = item.transform.size || 64;
    const fontName = item.transform.font || 'Inter';
    const fontWeight = item.transform.weight || 600;
    ctx.font = `${fontWeight} ${fontSize}px "${fontName}"`;
    const metrics = ctx.measureText(item.name || '');
    ctx.restore();
    
    const textWidth = metrics.width;
    const scaleFactorX = (item.transform.scaleX ?? 1);
    const scaleFactorY = (item.transform.scaleY ?? 1);
    
    halfW = (textWidth * scaleFactorX * scaleX) / 2 + 10;
    halfH = (fontSize * scaleFactorY * scaleY) / 2 + 10;
  }
  return { cx, cy, halfW, halfH };
}

// ── PROJECT BACKUPS & RESETS (IndexedDB + JSZip) ─────────────
const DB_NAME = 'EditroyBackupsDB';
const STORE_NAME = 'backups';

function openBackupsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllBackups() {
  const db = await openBackupsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.sort((a,b) => b.timestamp - a.timestamp));
    request.onerror = () => reject(request.error);
  });
}

async function saveBackup(id, name, zipBlob) {
  const db = await openBackupsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const backupItem = { id, name, timestamp: Date.now(), data: zipBlob };
    const request = store.put(backupItem);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteBackup(id) {
  const db = await openBackupsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 1. Create a full ZIP backup of the project containing all original files + JSON metadata
async function createProjectZip() {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip library is not loaded.');
  }

  const zip = new JSZip();
  const metadata = state.items.map(item => {
    const { file, src, proxySrc, thumbnail, ...rest } = item;
    return {
      ...rest,
      fileName: file ? file.name : (item.name || ''),
      fileSize: file ? file.size : 0,
      fileType: file ? file.type : ''
    };
  });

  zip.file('project.json', JSON.stringify({
    metadata,
    totalDuration: state.totalDuration,
    masterVolume: state.masterVolume
  }));

  const mediaFolder = zip.folder('media');
  const addedFiles = new Set();

  for (const item of state.items) {
    if (item.file && !addedFiles.has(item.file.name)) {
      addedFiles.add(item.file.name);
      mediaFolder.file(item.file.name, item.file);
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

// 2. Load a project from a Zip Blob
async function loadProjectFromZip(zipBlob) {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip library is not loaded.');
  }
  
  setProcessing(true, 'Extracting backup…', 'Decompressing Zip archive...');
  const zip = await JSZip.loadAsync(zipBlob);
  const jsonText = await zip.file('project.json').async('string');
  const project = JSON.parse(jsonText);

  // Clear current project
  state.items.forEach(item => memoryManager.freeClipResources(item));
  state.items = [];
  state.activeLayer = null;

  // Process files inside zip and recreate local Blob URLs
  const mediaFolder = zip.folder('media');
  const filePromises = project.metadata.map(async (meta) => {
    const clip = { ...meta };
    if (meta.fileName) {
      const fileEntry = mediaFolder.file(meta.fileName);
      if (fileEntry) {
        const fileBlob = await fileEntry.async('blob');
        const file = new File([fileBlob], meta.fileName, { type: meta.fileType });
        clip.file = file;
        clip.src = memoryManager.trackBlob(URL.createObjectURL(file));
        
        if (clip.type === 'video') {
          // Re-generate thumbnail for video asynchronously
          const vid = document.createElement('video');
          vid.preload = 'metadata';
          vid.src = clip.src;
          await new Promise(r => { vid.onloadedmetadata = r; vid.onerror = r; });
          if (vid.videoWidth) {
            clip.thumbnail = await generateThumbnail(vid);
          }
        } else if (clip.type === 'image') {
          clip.thumbnail = clip.src;
        }
      }
    }
    return clip;
  });

  state.items = await Promise.all(filePromises);

  // Save restored files to session IndexedDB so they survive page refresh!
  await clearSessionFiles();
  for (const item of state.items) {
    if (item.file && item.id) {
      await saveSessionFile(item.id, item.file);
    }
  }

  state.totalDuration = project.totalDuration || 30;
  state.masterVolume = project.masterVolume || 1;

  setProcessing(false);
  pushHistory();
  computeTotalDuration();
  syncAudioGraph();
  renderAll();
  showToast('Backup restored ✓', 'Loaded configurations successfully');
}

// 3. Render backups in the overlay list
async function updateBackupsModal() {
  const listEl = document.getElementById('backups-list');
  if (!listEl) return;

  const backups = await getAllBackups();
  document.getElementById('backup-count').textContent = backups.length;

  if (backups.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center; padding: 12px; color: var(--text3); font-style:italic; font-size:11px;">
        No backups stored yet. Click Reset to start anew and backup your current work!
      </div>`;
    return;
  }

  listEl.innerHTML = backups.map(b => `
    <div style="display:flex; justify-content:space-between; align-items:center; background: var(--bg2); border:1px solid var(--border); padding: 8px 12px; border-radius: 8px; gap: 8px;">
      <div style="min-width:0; flex:1;">
        <div style="font-size:12px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${b.name}">${b.name}</div>
        <div style="font-size:10px; color: var(--text3); margin-top:2px;">${new Date(b.timestamp).toLocaleString()}</div>
      </div>
      <div style="display:flex; gap: 4px; flex-shrink:0;">
        <button class="panel-hdr-btn btn-restore-item" data-id="${b.id}" title="Restore" style="width:26px; height:26px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
        <button class="panel-hdr-btn btn-download-item" data-id="${b.id}" title="Download ZIP file" style="width:26px; height:26px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="panel-hdr-btn danger btn-delete-item" data-id="${b.id}" title="Delete" style="width:26px; height:26px; color: var(--red);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  // Bind clicks
  listEl.querySelectorAll('.btn-restore-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const b = backups.find(x => x.id === btn.dataset.id);
      if (b) {
        await loadProjectFromZip(b.data);
        document.getElementById('backups-modal-overlay').style.display = 'none';
      }
    });
  });

  listEl.querySelectorAll('.btn-download-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const b = backups.find(x => x.id === btn.dataset.id);
      if (b) {
        const url = URL.createObjectURL(b.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${b.name.replace(/\s+/g, '_')}_backup.zip`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showToast('Backup Zip Downloaded! ✓');
      }
    });
  });

  listEl.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this backup?')) {
        await deleteBackup(btn.dataset.id);
        updateBackupsModal();
        showToast('Backup deleted ✓');
      }
    });
  });
}

// 4. project Reset & backup flow
async function handleResetProject() {
  const currentCount = state.items.length;
  
  if (currentCount > 0) {
    const askSave = confirm('Would you like to store your current project as a ZIP backup before resetting?\n\nSelecting YES saves a full archive locally in your browser (Limit 3).');
    
    if (askSave) {
      const backups = await getAllBackups();
      if (backups.length >= 3) {
        // Enforce 3 backups ceiling
        const overwrite = confirm('Limit of 3 backups reached! Would you like to overwrite your oldest backup to store this one?');
        if (!overwrite) {
          showToast('Reset aborted', 'Free up a backup slot first.', true);
          return;
        }
        // Purge oldest backup (last item)
        await deleteBackup(backups[backups.length - 1].id);
      }

      const backupName = prompt('Enter a name for this project backup:', `Project Backup ${new Date().toLocaleDateString()}`);
      if (backupName) {
        setProcessing(true, 'Creating Zip backup…', 'Writing file streams...');
        try {
          const zipBlob = await createProjectZip();
          await saveBackup('bk-' + Date.now(), backupName, zipBlob);
          showToast('Backup stored! ✓', 'Saved ZIP archive locally');
        } catch (err) {
          showToast('Backup failed', err.message, true);
        } finally {
          setProcessing(false);
        }
      }
    }
  }

  // Clear tracks and reset variables
  state.items.forEach(item => memoryManager.freeClipResources(item));
  state.items = [];
  state.activeLayer = null;
  state.globalTime = 0;
  state.totalDuration = 30;
  state.masterVolume = 1;

  sessionStore.clearSession();
  await clearSessionFiles(); // Clear IndexedDB session files!
  pushHistory();
  computeTotalDuration();
  syncAudioGraph();
  renderAll();
  showToast('Project Reset ✓', 'Started a fresh session');
  
  updateBackupsModal();
}

// Setup button bindings on load
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('backups-modal-overlay');
  
  document.getElementById('btn-history')?.addEventListener('click', () => {
    updateBackupsModal();
    if (modal) modal.style.display = 'flex';
  });

  document.getElementById('btn-close-backups')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });

  document.getElementById('btn-reset-project')?.addEventListener('click', handleResetProject);

  // ZIP uploader triggers
  const btnZipUpload = document.getElementById('btn-import-zip');
  const zipInput = document.getElementById('input-zip-uploader');
  
  btnZipUpload?.addEventListener('click', () => zipInput?.click());
  zipInput?.addEventListener('change', async () => {
    if (zipInput.files && zipInput.files[0]) {
      try {
        await loadProjectFromZip(zipInput.files[0]);
        if (modal) modal.style.display = 'none';
      } catch (err) {
        showToast('Restore failed', 'Invalid backup ZIP file.', true);
      } finally {
        zipInput.value = '';
      }
    }
  });

  // Initial count load
  getAllBackups().then(backups => {
    const badge = document.getElementById('backup-count');
    if (badge) badge.textContent = backups.length;
  });
});

