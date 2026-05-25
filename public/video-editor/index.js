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
    renderAll();
    showToast('💾 Session restored', 'Recovered clip layers.');
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
      
      renderCtx.font = `${item.transform.weight || 600} ${item.transform.size || 64}px ${item.transform.font || 'Inter'}`;
      renderCtx.fillStyle = item.color || '#fff';
      renderCtx.textAlign = 'center';
      renderCtx.textBaseline = 'middle';
      renderCtx.fillText(item.name, 0, 0);
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
    if (Math.abs(vid.currentTime - localTime) > 0.1) vid.currentTime = localTime;
    if (stateMachine.is(EditorStates.PLAYING) && vid.paused) vid.play().catch(()=>{});
    if (!stateMachine.is(EditorStates.PLAYING) && !vid.paused) vid.pause();
    
    if (vid.videoWidth) {
      const fitScale = Math.min(renderCanvas.width / vid.videoWidth, renderCanvas.height / vid.videoHeight) || 1;
      const w = vid.videoWidth * fitScale;
      const h = vid.videoHeight * fitScale;
      renderCtx.drawImage(vid, -w/2, -h/2, w, h);
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
    if (isActive && stateMachine.is(EditorStates.PLAYING)) {
      const targetTime = item.trimStart + (state.globalTime - item.start);
      node.audio.volume = Math.min(1, Math.max(0, (item.volume ?? 1) * state.masterVolume));
      if (Math.abs(node.audio.currentTime - targetTime) > 0.3) node.audio.currentTime = targetTime;
      if (node.audio.paused) {
        node.audio.play().catch(e => console.warn("Audio play blocked", e));
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
    node.audio.volume = Math.min(1, Math.max(0, (item.volume ?? 1) * state.masterVolume));
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
  state.totalDuration = Math.max(maxEnd + 2, 10);
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
  
  const newTracks = await Promise.all(valid.map(file => new Promise(resolve => {
    const src = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.src = src;
    
    audio.onloadedmetadata = () => {
      // Setup dynamic background audio analysis worker (Phase 3 & Central Workers)
      const item = { 
        id: uid(), type: 'audio', name: file.name, file, src, 
        start: getNextStartTime('a1'), duration: audio.duration, trimStart: 0, trimEnd: audio.duration, track: 'a1', volume: 1 
      };
      
      // Perform background channel downsampling inside audio-processor.worker
      _extractWaveformWorker(file, item).then(peaks => {
        item.waveformPeaks = peaks;
        resolve(item);
      });
    };
  })));

  state.items.push(...newTracks);
  pushHistory();
  computeTotalDuration();
  syncAudioGraph();
  renderAll();
  setProcessing(false);
  showToast('Audio added ✓', newTracks.length + ' track(s) added');
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
  const empty = document.getElementById('prop-empty');
  const videoPane = document.getElementById('prop-video');
  const textPane = document.getElementById('prop-text');
  
  if (!state.activeLayer) {
    if(empty) empty.style.display = 'flex';
    if(videoPane) videoPane.style.display = 'none';
    if(textPane) textPane.style.display = 'none';
    return;
  }
  
  const item = state.items.find(i => i.id === state.activeLayer);
  if (!item) { 
    if(empty) empty.style.display = 'flex';
    if(videoPane) videoPane.style.display = 'none';
    if(textPane) textPane.style.display = 'none';
    return; 
  }
  
  if(empty) empty.style.display = 'none';
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
  } else if (item.type === 'text') {
    if(videoPane) videoPane.style.display = 'none';
    if(textPane) textPane.style.display = 'flex';
    
    const textInput = document.getElementById('in-text-content');
    const colorInput = document.getElementById('in-text-color');
    const sizeInput = document.getElementById('in-text-size');
    if(textInput) textInput.value = item.name;
    if(colorInput) colorInput.value = item.color || '#ffffff';
    if(sizeInput) sizeInput.value = item.transform.size || 64;
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

function setSlider(id, valId, val) {
  const s = document.getElementById(id); const v = document.getElementById(valId);
  if(s) s.value = val; if(v) v.textContent = val;
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

  document.getElementById('btn-split').addEventListener('click', () => {
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
    state.activeLayer = a.id;
    pushHistory();
    computeTotalDuration();
    syncAudioGraph();
    renderAll();
  });

  document.getElementById('btn-delete').addEventListener('click', () => {
    const toDelete = state.items.find(i => i.id === state.activeLayer);
    if (toDelete) {
      memoryManager.freeClipResources(toDelete);
      state.items = state.items.filter(c => c.id !== toDelete.id);
      state.activeLayer = null;
      pushHistory();
      computeTotalDuration();
      syncAudioGraph();
      renderAll();
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

  // ── ZOOM BINDINGS ──
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    state.tlZoom = Math.min(TL_ZOOM_MAX, state.tlZoom + TL_ZOOM_STEP);
    document.getElementById('zoom-label').textContent = Math.round(state.tlZoom * 100) + '%';
    renderAll();
  });
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    state.tlZoom = Math.max(TL_ZOOM_MIN, state.tlZoom - TL_ZOOM_STEP);
    document.getElementById('zoom-label').textContent = Math.round(state.tlZoom * 100) + '%';
    renderAll();
  });

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
      const item = state.items.find(c => c.id === state.activeLayer);
      if (!item || !item.filters) { showToast('Select a video/image first'); return; }
      item.filters = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0 };
      if (name === 'Glitch' || name === 'Noise') { item.filters.contrast = 150; item.filters.saturate = 150; }
      else if (name === 'VHS') { item.filters.contrast = 120; item.filters.saturate = 120; item.filters.blur = 1; }
      else if (name === 'Old Film') { item.filters.sepia = 80; item.filters.contrast = 110; }
      else if (name === 'Blur') { item.filters.blur = 5; }
      else if (name === 'Pixelate') { item.filters.contrast = 130; item.filters.grayscale = 20; }
      renderInspector(); renderFrame(state); pushHistory(); showToast(`Applied: ${name}`);
    });
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
    const fontSize = (item.transform.size || 64) * (item.transform.scaleX ?? 1);
    halfW = (item.name.length * fontSize * 0.35 * scaleX) / 2;
    halfH = fontSize * scaleY / 2 + 8;
  }
  return { cx, cy, halfW, halfH };
}
