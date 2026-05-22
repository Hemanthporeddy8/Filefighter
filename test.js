
const state = {
  items: [], // Array of { id, type, file, src, start, duration, trimStart, trimEnd, track, volume, filters, transform, opacity, blendMode }
  activeLayer: null,
  globalTime: 0,
  totalDuration: 30, // Default timeline length
  isPlaying: false,
  history: [],
  historyIndex: -1,
  masterVolume: 1,
  fps: 30,
  tlZoom: 1.0,    // Timeline zoom multiplier (0.25 – 8×)
};

// ── Timeline viewport constants ──────────────────────────────
const BASE_PPS = 80;            // pixels-per-second at zoom 1×
const TL_ZOOM_MIN = 0.15;
const TL_ZOOM_MAX = 8;
const TL_ZOOM_STEP = 0.25;     // multiplicative step
// Return current pixels-per-second
function pps() { return BASE_PPS * state.tlZoom; }
// Convert time → pixel offset (inside tracks-inner)
function timeToPx(t) { return t * pps(); }
// Convert pixel offset → time
function pxToTime(px) { return px / pps(); }

// --- CORE ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);
const mediaDest = audioCtx.createMediaStreamDestination();
masterGain.connect(mediaDest);

const renderCanvas = document.createElement('canvas');
renderCanvas.width = 480;  // Preview at 480p — saves 16x RAM vs 1080p
renderCanvas.height = 270;
const renderCtx = renderCanvas.getContext('2d', { alpha: false, willReadFrequently: false });

const audioNodesMap = new Map(); 
const activeVideos = new Map();
const imageCache = new Map();

let rafId = null;
let lastTs = null;
let isExporting = false;
let exportRecorder = null;
let exportChunks = [];

// Timeline performance state
let _playheadEl = null;
let _dragRafId = null;
let _isDragging = false;
let _dragPreviewThrottle = 0;
const DRAG_PREVIEW_FPS = 10;
const DRAG_PREVIEW_MS = 1000 / DRAG_PREVIEW_FPS;
// Auto-scroll RAF
let _autoScrollRaf = null;
let _autoScrollTarget = null;
let _edgeDragScrollRaf = null;

// ── Performance Telemetry ────────────────────────────────────
const Perf = {
  fps: 0,
  droppedFrames: 0,
  renderMs: 0,
  activeDecoders: 0,
  memEstimateMB: 0,
  _frameTimes: [],
  _lastFrameTs: 0,
  _quality: 'high',   // 'high' | 'medium' | 'low'
  _qualityCheckTs: 0,

  recordFrame(ts) {
    if (this._lastFrameTs > 0) {
      const dt = ts - this._lastFrameTs;
      this._frameTimes.push(dt);
      if (this._frameTimes.length > 30) this._frameTimes.shift();
      const avg = this._frameTimes.reduce((a,b) => a+b, 0) / this._frameTimes.length;
      this.fps = avg > 0 ? Math.round(1000 / avg) : 0;
    }
    this._lastFrameTs = ts;
  },

  // Called periodically to auto-lower quality if needed
  adaptQuality() {
    const now = performance.now();
    if (now - this._qualityCheckTs < 3000) return; // Check every 3s
    this._qualityCheckTs = now;

    const targetFps = MOBILE ? 18 : 24;
    const fps = this.fps;

    if (fps > 0 && fps < targetFps * 0.55) {
      // Very low FPS — switch to low quality
      if (this._quality !== 'low') {
        this._quality = 'low';
        AdaptiveRenderer.applyQuality('low');
      }
    } else if (fps > 0 && fps < targetFps * 0.75) {
      if (this._quality === 'high') {
        this._quality = 'medium';
        AdaptiveRenderer.applyQuality('medium');
      }
    } else if (fps >= targetFps * 0.9) {
      if (this._quality !== 'high') {
        this._quality = 'high';
        AdaptiveRenderer.applyQuality('high');
      }
    }
  },

  // Rough memory estimate from active resources
  updateMemEstimate() {
    let mb = 0;
    mb += VideoPool.size * 20;       // ~20MB per active video decoder
    mb += imageCache.size * 2;       // ~2MB per image
    mb += state.items.length * 0.5;  // State overhead
    mb += renderCanvas.width * renderCanvas.height * 4 / (1024 * 1024); // Canvas
    this.memEstimateMB = Math.round(mb);
  }
};

// ── Adaptive Renderer ─────────────────────────────────────────
const AdaptiveRenderer = {
  applyQuality(level) {
    if (level === 'low') {
      // Halve preview resolution
      const aspect = renderCanvas.width / renderCanvas.height || 16/9;
      const h = MOBILE ? 90 : 180;
      renderCanvas.width = Math.round(h * aspect);
      renderCanvas.height = h;
    } else if (level === 'medium') {
      const aspect = renderCanvas.width / renderCanvas.height || 16/9;
      const h = MOBILE ? 135 : 240;
      renderCanvas.width = Math.round(h * aspect);
      renderCanvas.height = h;
    } else {
      // Restore default
      const aspect = (state.exportWidth || 1920) / (state.exportHeight || 1080);
      const h = MOBILE ? 135 : 270;
      renderCanvas.width = Math.round(h * aspect);
      renderCanvas.height = h;
    }
  }
};

// ── Video Decoder Pool (single-decoder-at-a-time) ─────────────
// Limits active video elements. Recycles old ones instead of creating new.
const VideoPool = {
  _pool: new Map(), // itemId -> HTMLVideoElement
  get size() { return this._pool.size; },

  get(item) {
    if (this._pool.has(item.id)) return this._pool.get(item.id);
    // Reuse an idle video element if pool is large
    if (this._pool.size >= 3) {
      // Find and destroy oldest unused element
      const oldest = this._pool.keys().next().value;
      const old = this._pool.get(oldest);
      if (old) { old.pause(); old.src = ''; old.load(); }
      this._pool.delete(oldest);
    }
    const vid = document.createElement('video');
    vid.src = item.src;
    vid.muted = true;
    vid.preload = 'none'; // Don't auto-preload — decode on demand
    vid.playsInline = true;
    this._pool.set(item.id, vid);
    return vid;
  },

  remove(itemId) {
    const vid = this._pool.get(itemId);
    if (vid) { vid.pause(); vid.src = ''; vid.load(); }
    this._pool.delete(itemId);
    Perf.activeDecoders = this._pool.size;
  },

  pauseAll() {
    for (const vid of this._pool.values()) vid.pause();
  },

  // Pause videos NOT currently visible (saves decoder budget)
  pruneInactive() {
    const t = state.globalTime;
    for (const [id, vid] of this._pool.entries()) {
      const item = state.items.find(i => i.id === id);
      if (!item) { this.remove(id); continue; }
      const isActive = t >= item.start && t < item.start + item.duration;
      if (!isActive && !vid.paused) { vid.pause(); }
    }
    Perf.activeDecoders = this._pool.size;
  }
};

// ── Memory Cleanup Manager ────────────────────────────────────
const MemoryManager = {
  // Track all blob URLs created
  _blobUrls: new Set(),

  trackBlob(url) {
    if (url && url.startsWith('blob:')) this._blobUrls.add(url);
    return url;
  },

  // Revoke URLs for removed items
  revokeItemBlobs(item) {
    if (item.src && item.src.startsWith('blob:')) {
      URL.revokeObjectURL(item.src);
      this._blobUrls.delete(item.src);
    }
    // Clean up video from pool
    VideoPool.remove(item.id);
    // Clean up image from cache
    imageCache.delete(item.id);
    // Clean up audio node
    const node = audioNodesMap.get(item.id);
    if (node) { node.audio.pause(); node.audio.src = ''; audioNodesMap.delete(item.id); }
  },

  // Revoke all blobs for a full project clear
  revokeAll() {
    for (const url of this._blobUrls) {
      try { URL.revokeObjectURL(url); } catch(e) {}
    }
    this._blobUrls.clear();
    VideoPool._pool.clear();
    imageCache.clear();
    for (const node of audioNodesMap.values()) { node.audio.pause(); node.audio.src = ''; }
    audioNodesMap.clear();
  }
};

// ── Thumbnail Cache (prevent regeneration) ────────────────────
const ThumbnailCache = {
  _cache: new Map(), // src -> dataURL
  has(src) { return this._cache.has(src); },
  get(src) { return this._cache.get(src); },
  set(src, dataUrl) { this._cache.set(src, dataUrl); },
  // Limit cache size
  prune() {
    if (this._cache.size > 50) {
      const oldest = this._cache.keys().next().value;
      this._cache.delete(oldest);
    }
  }
};

// ── Central Render Scheduler ──────────────────────────────────
// Prevents duplicate RAF loops and render storms
const RenderScheduler = {
  _pending: false,
  _rafId: null,

  // Schedule a single render frame (deduped)
  schedule(fn) {
    if (this._pending) return;
    this._pending = true;
    this._rafId = requestAnimationFrame(() => {
      this._pending = false;
      fn();
    });
  },

  cancel() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this._pending = false;
  }
};

// --- UTILS ---
function formatTime(t) {
  if (isNaN(t) || t < 0) return '00:00.00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;
}
function uid() { return '_' + Math.random().toString(36).slice(2,9) + Date.now(); }

// Mobile/low-power detection
function isMobile() {
  return navigator.maxTouchPoints > 1 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}
const MOBILE = isMobile();
if (MOBILE) {
  // Show mobile mode badge
  document.addEventListener('DOMContentLoaded', () => {
    const badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:9999;background:rgba(99,102,241,.9);color:#fff;font-size:10px;padding:3px 8px;border-radius:4px;font-family:Inter,sans-serif;pointer-events:none';
    badge.textContent = '⚡ Mobile mode';
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 4000);
  });
}
function showToast(title, desc='', isError=false) {
  const el = document.getElementById('toast');
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-desc').textContent = desc;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}
function setProcessing(show, title='Processing…', desc='Please wait') {
  const el = document.getElementById('proc-overlay');
  document.getElementById('proc-title').textContent = title;
  document.getElementById('proc-desc').textContent = desc;
  el.classList.toggle('show', show);
}

// --- STATE MANAGEMENT ---
const MAX_HISTORY = 15;
function pushHistory() {
  const snapshot = state.items.map(i => ({...i, filters: {...i.filters}, transform: {...i.transform}}));
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  state.history.push(snapshot);
  state.historyIndex++;
  // Trim old history to prevent RAM growth
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(state.history.length - MAX_HISTORY);
    state.historyIndex = state.history.length - 1;
  }
  updateActionButtons();
}
document.getElementById('btn-undo').addEventListener('click', () => {
  if (state.historyIndex > 0) {
    state.historyIndex--;
    state.items = state.history[state.historyIndex].map(i => ({...i, filters: {...i.filters}, transform: {...i.transform}}));
    computeTotalDuration();
    renderAll();
    syncAudioGraph();
    showToast('Undo', 'State restored');
    updateActionButtons();
  }
});

// --- AUDIO SYNC (Simple Direct Approach) ---
function syncAudioGraph() {
  // For each video/audio item, ensure we have a dedicated audio element
  state.items.filter(i => i.type === 'video' || i.type === 'audio').forEach(item => {
    if (!audioNodesMap.has(item.id)) {
      const audio = document.createElement('audio');
      audio.src = item.src;
      audio.preload = 'auto';
      audioNodesMap.set(item.id, { audio });
    }
    const node = audioNodesMap.get(item.id);
    node.audio.volume = Math.min(1, Math.max(0, (item.volume ?? 1) * state.masterVolume));
  });
  
  // Clean up removed items
  for (const [id, node] of audioNodesMap.entries()) {
    if (!state.items.find(i => i.id === id)) {
      node.audio.pause();
      node.audio.src = '';
      audioNodesMap.delete(id);
    }
  }
}

// --- RENDER PIPELINE ---
// Throttled play loop — max 24fps, skip when tab hidden
const TARGET_FPS = 24;
const FRAME_MS = 1000 / TARGET_FPS;
let lastRenderTs = 0;

function playLoop(ts) {
  if (!state.isPlaying && !isExporting) return;

  // AIRTIGHT tab-hidden pause: stop everything, don't even queue next RAF
  if (document.hidden && !isExporting) {
    lastTs = null; // Reset timing so seek doesn't jump on return
    VideoPool.pauseAll();
    rafId = requestAnimationFrame(playLoop); // Keep looping but skip render
    return;
  }

  // Record for telemetry
  Perf.recordFrame(ts);

  if (lastTs !== null) {
    const dt = (ts - lastTs) / 1000;
    state.globalTime += dt;
    if (state.globalTime >= state.totalDuration) {
      if (isExporting) { finishExport(); return; }
      else {
        state.isPlaying = false;
        state.globalTime = 0;
        document.getElementById('play-icon').innerHTML = '<polygon points="4,2 14,8 4,14"/>';
        pauseMedia();
        updatePlayhead();
        return;
      }
    }
  }
  lastTs = ts;

  // Throttle canvas render to TARGET_FPS
  if (ts - lastRenderTs >= FRAME_MS) {
    lastRenderTs = ts;
    renderFrame();
  }
  
  updateMediaPlayback();
  updatePlayhead();
  // Prune inactive video decoders (every ~2s)
  if (Math.floor(ts / 2000) !== Math.floor((ts - 1) / 2000)) {
    VideoPool.pruneInactive();
    Perf.updateMemEstimate();
    Perf.adaptQuality();
  }
  if (state.isPlaying || isExporting) rafId = requestAnimationFrame(playLoop);
}

function renderFrame() {
  // Don't render when tab is hidden (unless exporting)
  if (document.hidden && !isExporting) return;
  
  const _rfStart = performance.now();
  renderCtx.fillStyle = '#000';
  renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
  
  // Sort items by track z-index (video v1 -> image v2 -> text t1)
  const renderOrder = { 'v1': 1, 'v2': 2, 't1': 3, 'a1': 0 };
  const activeItems = state.items.filter(i => state.globalTime >= i.start && state.globalTime < i.start + i.duration)
                               .sort((a,b) => renderOrder[a.track] - renderOrder[b.track]);
  
  activeItems.forEach(item => {
    if (item.type === 'video' || item.type === 'image') {
      const localTime = item.trimStart + (state.globalTime - item.start);
      drawVisual(item, localTime);
    } else if (item.type === 'text') {
      renderCtx.save();
      const cx = renderCanvas.width / 2;
      const cy = renderCanvas.height / 2;
      
      // Apply transition fade
      let transAlpha = 1;
      if (item.transition) {
        const elapsed = state.globalTime - item.start;
        const remaining = (item.start + item.duration) - state.globalTime;
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

  const pc = document.getElementById('preview-img-canvas');
  if (pc.width !== renderCanvas.width) {
    pc.width = renderCanvas.width;
    pc.height = renderCanvas.height;
  }
  pc.getContext('2d').drawImage(renderCanvas, 0, 0);
}

function drawVisual(item, localTime) {
  renderCtx.save();
  const cx = renderCanvas.width / 2;
  const cy = renderCanvas.height / 2;
  
  // Calculate transition fade
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
  if (item.blendMode && item.blendMode !== 'normal') renderCtx.globalCompositeOperation = item.blendMode;
  
  const f = item.filters;
  let filterStr = `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) grayscale(${f.grayscale}%)`;
  if (f.sepia) filterStr += ` sepia(${f.sepia}%)`;
  if (f.blur) filterStr += ` blur(${f.blur}px)`;
  renderCtx.filter = filterStr;

  if (item.type === 'video') {
    // Use VideoPool — recycles elements, limits active decoders
    const vid = VideoPool.get(item);
    if (Math.abs(vid.currentTime - localTime) > 0.1) vid.currentTime = localTime;
    if (state.isPlaying && vid.paused) vid.play().catch(()=>{});
    if (!state.isPlaying && !vid.paused) vid.pause();
    
    if (vid.videoWidth) {
      const fitScale = Math.min(renderCanvas.width / vid.videoWidth, renderCanvas.height / vid.videoHeight) || 1;
      const w = vid.videoWidth * fitScale;
      const h = vid.videoHeight * fitScale;
      renderCtx.drawImage(vid, -w/2, -h/2, w, h);
    }
  } else if (item.type === 'image') {
    let img = imageCache.get(item.id);
    if (!img) {
      img = new Image();
      img.src = item.src;
      imageCache.set(item.id, img);
    }
    if (img.complete && img.naturalWidth) {
      // Images use their natural size (scaleX/Y controls final size)
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
    const node = audioNodesMap.get(item.id);
    if (!node) return;
    
    const isActive = state.globalTime >= item.start && state.globalTime < (item.start + item.duration);
    if (isActive && state.isPlaying) {
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

function pauseMedia() {
  VideoPool.pauseAll();
  for (const node of audioNodesMap.values()) node.audio.pause();
}

function togglePlay() {
  if (!state.items.length) return;
  state.isPlaying = !state.isPlaying;
  const icon = document.getElementById('play-icon');
  if (state.isPlaying) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    icon.innerHTML = '<rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/>';
    if (state.globalTime >= state.totalDuration) seekTo(0);
    lastTs = null;
    rafId = requestAnimationFrame(playLoop);
  } else {
    icon.innerHTML = '<polygon points="4,2 14,8 4,14"/>';
    cancelAnimationFrame(rafId);
    pauseMedia();
  }
}

function seekTo(t) {
  state.globalTime = Math.max(0, Math.min(state.totalDuration, t));
  updatePlayhead();
  if (state.isPlaying) _autoScrollDuringPlayback();
  if (!state.isPlaying) {
    renderFrame();
    updateMediaPlayback();
    pauseMedia();
  }
}

// --- EXPORT PIPELINE (Frame-by-Frame Renderer) ---
let exportCancelled = false;
async function handleExport() {
  if (!state.items.length) { showToast('Nothing to export', 'Add clips first', true); return; }
  if (state.isPlaying) togglePlay();

  // Use full resolution for export (stored when video was loaded, or fallback)
  const exportW = state.exportWidth || 1280;
  const exportH = state.exportHeight || 720;
  const fps = state.fps || 30;
  const duration = state.totalDuration;
  const totalFrames = Math.ceil(duration * fps);

  // Smart export assistant — suggest optimizations instead of hard-blocking
  const estimatedMB = Math.round((totalFrames * exportW * exportH * 4) / (1024 * 1024));
  
  // Determine best export profile automatically
  let autoExportW = exportW, autoExportH = exportH, autoFps = fps;
  const deviceHeavy = estimatedMB > 400 || MOBILE;
  if (deviceHeavy) {
    // Auto-select optimized profile
    if (estimatedMB > 800 || (MOBILE && estimatedMB > 200)) {
      autoExportW = 854; autoExportH = 480; autoFps = 24; // 480p
    } else if (estimatedMB > 400) {
      autoExportW = Math.min(exportW, 1280); autoExportH = Math.min(exportH, 720); autoFps = 24; // 720p max
    }
    if (autoExportW !== exportW || autoExportH !== exportH) {
      showToast(
        '📱 Optimized export',
        `Switched to ${autoExportW}×${autoExportH} @ ${autoFps}fps for stable export on this device.`
      );
      await new Promise(r => setTimeout(r, 1200));
    }
  }
  // Replace export dimensions with auto-selected ones
  const finalExportW = autoExportW;
  const finalExportH = autoExportH;
  const finalFps = autoFps;
  const finalFrames = Math.ceil(duration * finalFps);

  exportCancelled = false;
  setProcessing(true, 'Preparing Export…', 'Loading media files');
  
  // Allow Escape to cancel
  const onEsc = (e) => { if (e.key === 'Escape') { exportCancelled = true; document.removeEventListener('keydown', onEsc); } };
  document.addEventListener('keydown', onEsc);

  try {

    // --- AUDIO SETUP ---
    // Create a fresh AudioContext for mixing
    const exportAudioCtx = new AudioContext();
    const masterGainNode = exportAudioCtx.createGain();
    masterGainNode.gain.value = state.masterVolume;
    const exportDest = exportAudioCtx.createMediaStreamDestination();
    masterGainNode.connect(exportDest);

    // Create an audio element + WebAudio node for each video/audio item
    const audioEls = [];
    for (const item of state.items.filter(i => i.type === 'video' || i.type === 'audio')) {
      const el = document.createElement('audio');
      el.src = item.src;
      el.preload = 'auto';
      // Wait for audio to load
      await new Promise(r => { el.oncanplay = r; el.onerror = r; el.load(); });
      try {
        const src = exportAudioCtx.createMediaElementSource(el);
        const gainNode = exportAudioCtx.createGain();
        gainNode.gain.value = Math.min(1, item.volume ?? 1);
        src.connect(gainNode);
        gainNode.connect(masterGainNode);
        audioEls.push({ el, item, gain: gainNode });
      } catch(e) { console.warn('Audio connect failed:', e); }
    }

    // --- VIDEO SETUP: pre-load all video elements ---
    const exportVids = new Map();
    for (const item of state.items.filter(i => i.type === 'video')) {
      const vid = document.createElement('video');
      vid.src = item.src;
      vid.muted = true;
      vid.preload = 'auto';
      await new Promise(r => { vid.oncanplay = r; vid.onerror = r; vid.load(); });
      exportVids.set(item.id, vid);
    }

    // --- RECORDER SETUP ---
    const videoStream = renderCanvas.captureStream(fps);
    const allTracks = [...videoStream.getVideoTracks()];
    if (exportDest.stream.getAudioTracks().length > 0) {
      allTracks.push(...exportDest.stream.getAudioTracks());
    }
    const combinedStream = new MediaStream(allTracks);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

    const exportStartTime = performance.now();
    const chunks = [];
    // Adaptive bitrate: lower resolution = lower bitrate for smaller file
    const bitrate = finalExportW >= 1280 ? 8000000 : finalExportW >= 854 ? 4000000 : 2000000;
    const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: bitrate });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start(250); // Emit chunks every 250ms (streaming mode, not batched)

    // Start all audio elements from beginning (they play in real-time while we render frames)
    // This is accurate because we render at exactly fps rate and audio runs alongside
    for (const { el, item } of audioEls) {
      el.currentTime = item.trimStart + 0; // Start at trim start for t=0
      // Only play if this item starts at t=0
      if (item.start <= 0.05) {
        el.play().catch(() => {});
      }
    }

    // Temporarily resize canvas to export resolution
    const prevW = renderCanvas.width, prevH = renderCanvas.height;
    renderCanvas.width = exportW;
    renderCanvas.height = exportH;
    
    // --- FRAME-BY-FRAME RENDER LOOP ---
    const frameMs = 1000 / finalFps;
    
    for (let frame = 0; frame < finalFrames; frame++) {
      const t = frame / finalFps;
      state.globalTime = t;

      // Update audio elements playback state
      for (const { el, item } of audioEls) {
        const isActive = t >= item.start && t < item.start + item.duration;
        if (isActive) {
          const targetTime = item.trimStart + (t - item.start);
          // Only seek if significantly off (seeking is expensive)
          if (Math.abs(el.currentTime - targetTime) > 0.15) {
            el.currentTime = targetTime;
          }
          if (el.paused) el.play().catch(() => {});
        } else {
          if (!el.paused) el.pause();
        }
      }

      // Render canvas frame
      renderCtx.fillStyle = '#000';
      renderCtx.fillRect(0, 0, finalExportW, finalExportH);

      const renderOrder = { 'v1': 1, 'v2': 2, 't1': 3, 'a1': 0 };
      const activeItems = state.items
        .filter(i => t >= i.start && t < i.start + i.duration)
        .sort((a, b) => (renderOrder[a.track] || 0) - (renderOrder[b.track] || 0));

      for (const item of activeItems) {
        if (item.type === 'video') {
          const vid = exportVids.get(item.id);
          if (!vid) continue;
          const localTime = item.trimStart + (t - item.start);
          // Seek and wait for frame to decode
          if (Math.abs(vid.currentTime - localTime) > 0.05) {
            vid.currentTime = localTime;
            await new Promise(r => {
              const onSeeked = () => { vid.removeEventListener('seeked', onSeeked); r(); };
              vid.addEventListener('seeked', onSeeked);
              setTimeout(r, 200); // Max wait 200ms
            });
          }
          if (vid.videoWidth) {
            renderCtx.save();
            const cx = renderCanvas.width / 2;
            const cy = renderCanvas.height / 2;
            renderCtx.translate(cx + (item.transform.x||0), cy + (item.transform.y||0));
            renderCtx.scale(item.transform.scaleX??1, item.transform.scaleY??1);
            renderCtx.rotate((item.transform.rotation||0)*Math.PI/180);
            renderCtx.globalAlpha = (item.opacity??100)/100;
            applyFilterCtx(renderCtx, item.filters);
            const fitScale = Math.min(renderCanvas.width/vid.videoWidth, renderCanvas.height/vid.videoHeight);
            const w = vid.videoWidth * fitScale, h = vid.videoHeight * fitScale;
            renderCtx.drawImage(vid, -w/2, -h/2, w, h);
            renderCtx.restore();
          }
        } else if (item.type === 'image') {
          const img = imageCache.get(item.id);
          if (img && img.complete && img.naturalWidth) {
            renderCtx.save();
            const cx = renderCanvas.width / 2;
            const cy = renderCanvas.height / 2;
            // Transition fade
            let alpha = (item.opacity??100)/100;
            if (item.transition) {
              const elapsed = t - item.start;
              const remaining = (item.start + item.duration) - t;
              if (item.transition.fadeIn > 0 && elapsed < item.transition.fadeIn) alpha *= elapsed / item.transition.fadeIn;
              if (item.transition.fadeOut > 0 && remaining < item.transition.fadeOut) alpha *= remaining / item.transition.fadeOut;
            }
            renderCtx.translate(cx + (item.transform.x||0), cy + (item.transform.y||0));
            renderCtx.scale(item.transform.scaleX??0.3, item.transform.scaleY??0.3);
            renderCtx.rotate((item.transform.rotation||0)*Math.PI/180);
            renderCtx.globalAlpha = alpha;
            applyFilterCtx(renderCtx, item.filters);
            const fitScale = Math.min(renderCanvas.width/img.naturalWidth, renderCanvas.height/img.naturalHeight);
            const w = img.naturalWidth * fitScale, h = img.naturalHeight * fitScale;
            renderCtx.drawImage(img, -w/2, -h/2, w, h);
            renderCtx.restore();
          }
        } else if (item.type === 'text') {
          renderCtx.save();
          const cx = renderCanvas.width / 2;
          const cy = renderCanvas.height / 2;
          renderCtx.translate(cx + (item.transform.x||0), cy + (item.transform.y||0));
          renderCtx.scale(item.transform.scaleX??1, item.transform.scaleY??1);
          renderCtx.rotate((item.transform.rotation||0)*Math.PI/180);
          renderCtx.globalAlpha = (item.opacity??100)/100;
          renderCtx.font = `${item.transform.weight||700} ${item.transform.size||64}px ${item.transform.font||'Inter'}`;
          renderCtx.fillStyle = item.color || '#fff';
          renderCtx.textAlign = 'center';
          renderCtx.textBaseline = 'middle';
          renderCtx.fillText(item.name, 0, 0);
          renderCtx.restore();
        }
      }

      // Check cancel
      if (exportCancelled) {
        setProcessing(false);
        showToast('Export cancelled', 'Press Export to try again');
        for (const { el } of audioEls) { el.pause(); el.src = ''; }
        exportAudioCtx.close();
        recorder.stop();
        return;
      }
      
      // Update progress with ETA
      const pct = Math.round((frame / finalFrames) * 100);
      const elapsed = (performance.now() - exportStartTime) / 1000;
      const eta = frame > 0 ? Math.round((elapsed / frame) * (finalFrames - frame)) : '?';
      setProcessing(true, `Exporting ${pct}%`, `Frame ${frame+1}/${finalFrames} • ~${eta}s remaining • Esc to cancel`);

      // Yield every 4 frames (not every frame) — faster export with still-responsive UI
      if (frame % 4 === 0) await new Promise(r => setTimeout(r, 0));
    }

    // Restore preview canvas size
    renderCanvas.width = prevW;
    renderCanvas.height = prevH;
    
    // Stop recorder and save
    recorder.stop();
    recorder.onstop = () => {
      // Cleanup
      for (const { el } of audioEls) { el.pause(); el.src = ''; }
      exportAudioCtx.close();

      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `editroy-${Date.now()}.webm`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setProcessing(false);
      showToast('Export complete! ✓', 'Video downloaded');
      state.globalTime = 0;
      seekTo(0);
    };

  } catch(err) {
    setProcessing(false);
    showToast('Export failed', err.message, true);
    console.error('Export error:', err);
  }
}

// Helper: apply CSS filter string to canvas context
function applyFilterCtx(ctx, f) {
  if (!f) return;
  ctx.filter = `brightness(${f.brightness??100}%) contrast(${f.contrast??100}%) saturate(${f.saturate??100}%) grayscale(${f.grayscale??0}%)${f.sepia ? ` sepia(${f.sepia}%)` : ''}${f.blur ? ` blur(${f.blur}px)` : ''}`;
}

// Legacy stubs (no longer used but kept to avoid errors)
function finishExport() {}
function saveExport() {}


// --- UPLOADS & DURATION ---
function computeTotalDuration() {
  const maxEnd = state.items.reduce((max, item) => Math.max(max, item.start + item.duration), 0);
  state.totalDuration = Math.max(maxEnd + 2, 10); // Give 2 seconds padding, min 10s
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
function generateThumbnail(vid) {
  // Check cache first (avoid re-generating for same source)
  if (vid.src && ThumbnailCache.has(vid.src)) {
    return Promise.resolve(ThumbnailCache.get(vid.src));
  }
  return new Promise(resolve => {
    const c = document.createElement('canvas');
    // Tiny thumbnail — 80×45px, 4× less data than before
    c.width = 80; c.height = 45;
    const ctx = c.getContext('2d', { alpha: false });
    
    const doCapture = () => {
      try {
        ctx.drawImage(vid, 0, 0, 80, 45);
        const dataUrl = c.toDataURL('image/jpeg', 0.4); // 40% quality = tiny file
        if (vid.src) { ThumbnailCache.set(vid.src, dataUrl); ThumbnailCache.prune(); }
        resolve(dataUrl);
      } catch(e) { resolve(''); }
      finally {
        // Free temporary canvas immediately
        c.width = 1; c.height = 1;
      }
    };
    
    if (vid.readyState >= 2 && vid.currentTime > 0) { doCapture(); return; }
    
    const timeout = setTimeout(() => { vid.onseeked = null; doCapture(); }, 2000);
    vid.onseeked = () => {
      clearTimeout(timeout);
      vid.onseeked = null;
      doCapture();
    };
    // Seek to 10% in to get a representative frame (avoid black start frames)
    vid.currentTime = Math.min(0.5, (vid.duration || 10) * 0.1);
  });
}

function getNextStartTime(trackId) {
  const trackItems = state.items.filter(i => i.track === trackId);
  if (!trackItems.length) return 0;
  return Math.max(...trackItems.map(i => i.start + i.duration));
}

const MAX_FILE_SIZE_MB = 200;
async function handleVideoFiles(files) {
  const valid = files.filter(f => f.type.startsWith('video/') || f.type.startsWith('image/'));
  if (!valid.length) return;

  // --- SIZE LIMIT (200MB max per file) ---
  const tooBig = valid.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
  if (tooBig.length) {
    const mb = (tooBig[0].size / 1024 / 1024).toFixed(0);
    showToast('File too large', `Max ${MAX_FILE_SIZE_MB}MB. "${tooBig[0].name}" is ${mb}MB.`, true);
    return;
  }

  setProcessing(true, 'Processing media…', `Loading 1 of ${valid.length}`);
  const newItems = [];
  
  // Process ONE file at a time — avoids hanging browser tab
  for (let i = 0; i < valid.length; i++) {
    const file = valid[i];
    setProcessing(true, 'Processing media\u2026', `File ${i+1} of ${valid.length}: ${file.name.substring(0,28)}`);
    await new Promise(r => setTimeout(r, 10)); // Yield to browser

    try {
      const item = await new Promise((resolve, reject) => {
        const src = MemoryManager.trackBlob(URL.createObjectURL(file));
        if (file.type.startsWith('video/')) {
          const vid = document.createElement('video');
          vid.preload = 'metadata';
          // Timeout: don't hang forever if video won't load
          const fallback = setTimeout(() => {
            resolve({ id: uid(), type: 'video', name: file.name, file, src, thumbnail: '',
              start: getNextStartTime('v1'), duration: 30, trimStart: 0, trimEnd: 30, track: 'v1',
              filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
              transform: {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, blendMode:'normal', opacity:100, volume:1,
              transition: {fadeIn:0,fadeOut:0} });
          }, 8000);
          vid.onloadedmetadata = async () => {
            clearTimeout(fallback);
            if (!state.items.some(it => it.type==='video') && !newItems.some(it => it.type==='video')) {
              // Set preview canvas to scaled-down size (480p for preview, upscale with CSS)
              const aspect = (vid.videoWidth || 1920) / (vid.videoHeight || 1080);
              const previewH = isMobile() ? 135 : 270;
              renderCanvas.width = Math.round(previewH * aspect);
              renderCanvas.height = previewH;
              // Store original resolution for export
              state.exportWidth = vid.videoWidth || 1920;
              state.exportHeight = vid.videoHeight || 1080;
            }
            const thumb = await generateThumbnail(vid);
            resolve({ id: uid(), type: 'video', name: file.name, file, src, thumbnail: thumb,
              start: getNextStartTime('v1'), duration: vid.duration, trimStart: 0, trimEnd: vid.duration, track: 'v1',
              filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
              transform: {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, blendMode:'normal', opacity:100, volume:1,
              transition: {fadeIn:0,fadeOut:0} });
          };
          vid.onerror = () => { clearTimeout(fallback); reject(new Error('Cannot load: ' + file.name)); };
          vid.src = src;
        } else {
          resolve({ id: uid(), type: 'image', name: file.name, file, src, thumbnail: src,
            start: getNextStartTime('v2'), duration: 5, trimStart: 0, trimEnd: 5, track: 'v2',
            filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
            transform: {x:0,y:0,scaleX:0.3,scaleY:0.3,rotation:0}, blendMode:'normal', opacity:100, volume:1,
            transition: {fadeIn:0,fadeOut:0} });
        }
      });
      if (item) {
        newItems.push(item);
        state.items.push(item);
        if (!state.activeLayer) state.activeLayer = item.id;
        computeTotalDuration();
        syncAudioGraph();
        renderTimeline(); // Partial refresh — don't re-render everything
      }
    } catch(e) { showToast('Skipped', e.message, true); }
  }

  if (newItems.length) {
    pushHistory();
    renderAll();
    showToast('Media added \u2713', `${newItems.length} file(s) added to timeline`);
  }
  setProcessing(false);
}

async function handleAudioFiles(files) {
  const valid = files.filter(f => f.type.startsWith('audio/'));
  if (!valid.length) return;
  const newTracks = await Promise.all(valid.map(file => new Promise(resolve => {
    const src = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.src = src;
    audio.onloadedmetadata = () => resolve({ 
        id: uid(), type: 'audio', name: file.name, file, src, 
        start: getNextStartTime('a1'), duration: audio.duration, trimStart: 0, trimEnd: audio.duration, track: 'a1', volume: 1 
    });
  })));
  state.items.push(...newTracks);
  pushHistory();
  computeTotalDuration();
  syncAudioGraph();
  renderAll();
  showToast('Audio added', newTracks.length + ' track(s) added');
}

// DRAG ZONES
function setupUploadZone(zoneId, inputId, handler) {
  const zone = document.getElementById(zoneId); const inp = document.getElementById(inputId);
  if (!zone || !inp) return;
  zone.addEventListener('click', () => inp.click());
  inp.addEventListener('change', () => { if (inp.files.length) handler(Array.from(inp.files)); inp.value=''; });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor='var(--accent)'; });
  zone.addEventListener('dragleave', () => zone.style.borderColor='');
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor=''; if (e.dataTransfer.files.length) handler(Array.from(e.dataTransfer.files)); });
}
setupUploadZone('uz-video', 'input-video', handleVideoFiles);
setupUploadZone('uz-image', 'input-image', handleVideoFiles);
setupUploadZone('uz-audio', 'input-audio', handleAudioFiles);
document.getElementById('trigger-video-upload')?.addEventListener('click', () => document.getElementById('input-video').click());
document.getElementById('trigger-image-upload')?.addEventListener('click', () => document.getElementById('input-image').click());
document.getElementById('trigger-audio-upload')?.addEventListener('click', () => document.getElementById('input-audio').click());

// --- UI RENDER ---
function renderAll() {
  document.getElementById('preview-video').style.display = 'none';
  document.getElementById('preview-img-canvas').classList.add('visible');
  
  renderTimeline();
  renderInspector();
  updateActionButtons();
  buildRuler();
  seekTo(state.globalTime);
  if (typeof updateSelectionOverlay === 'function') updateSelectionOverlay();
}

function updateActionButtons() {
  const hasMedia = state.items.length > 0;
  document.getElementById('preview-empty').style.display = hasMedia ? 'none' : 'flex';
  document.getElementById('btn-export-top').disabled = !hasMedia;
  document.getElementById('btn-export-main').disabled = !hasMedia;
  document.getElementById('btn-play').disabled = !hasMedia;
  document.getElementById('btn-undo').disabled = state.historyIndex <= 0;
  document.getElementById('btn-delete').disabled = !state.activeLayer;
  document.getElementById('btn-split').disabled = !hasMedia;
}

// Throttle timeline renders — debounced 50ms
let _tlTimer = null;
function renderTimelineDebounced() {
  clearTimeout(_tlTimer);
  _tlTimer = setTimeout(renderTimeline, 50);
}
function renderTimeline() {
  // ── Update tracks-inner width to match content ──
  const totalPx = Math.max(timeToPx(state.totalDuration), getTlViewportW());
  const inner = document.getElementById('tracks-inner');
  if (inner) inner.style.width = totalPx + 'px';

  ['v1', 'v2', 't1', 'a1'].forEach(trackId => {
    const track = document.getElementById('track-' + trackId);
    if (!track) return;
    // Remove clip elements only
    track.querySelectorAll('.tl-clip, .tl-audio-block').forEach(e => e.remove());
    const hasItems = state.items.filter(i => i.track === trackId).length > 0;
    const emptyEl = track.querySelector('.track-empty');
    if (emptyEl) emptyEl.style.display = hasItems ? 'none' : 'flex';

    state.items.filter(i => i.track === trackId).forEach(item => {
      const el = document.createElement('div');
      const isSelected = state.activeLayer === item.id;

      if (trackId === 'a1') {
        el.className = 'tl-audio-block' + (isSelected ? ' selected' : '');
        el.innerHTML = `<span class="tl-audio-name">${item.name}</span>
                        <div class="tl-trim-left" data-action="trim-start"></div>
                        <div class="tl-trim-right" data-action="trim-end"></div>`;
      } else {
        el.className = 'tl-clip' + (isSelected ? ' selected' : '');
        el.innerHTML = `
          ${item.thumbnail ? `<div class="tl-clip-filmstrip"><img class="tl-clip-frame" src="${item.thumbnail}" draggable="false"/></div>` : ''}
          <div class="tl-clip-name">${item.name}</div>
          <div class="tl-trim-left" data-action="trim-start"></div>
          <div class="tl-trim-right" data-action="trim-end"></div>
        `;
      }
      el.dataset.id = item.id;

      // ── PIXEL-BASED positioning (no % recalc, no layout thrash) ──
      el.style.left = timeToPx(item.start) + 'px';
      el.style.width = Math.max(timeToPx(item.duration), 4) + 'px';

      el.addEventListener('mousedown', e => {
        e.preventDefault(); e.stopPropagation();
        if (e.target.dataset.action) handleDrag(e, item.id, e.target.dataset.action);
        else handleDrag(e, item.id, 'move');
      });
      el.addEventListener('touchstart', e => {
        e.stopPropagation();
        if (e.target.dataset.action) handleDrag(e, item.id, e.target.dataset.action);
        else handleDrag(e, item.id, 'move');
      }, { passive: true });
      el.setAttribute('draggable', 'false');
      track.appendChild(el);
    });
  });
  
  // Update left panel clips list
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

function updatePlayhead() {
  if (!_playheadEl) _playheadEl = document.getElementById('playhead');
  const px = timeToPx(state.globalTime);
  if (_playheadEl) {
    _playheadEl.style.left = px + 'px';
    _playheadEl.style.transform = '';   // pixel-absolute, no transform offset
  }
  updateTimecode();
  // Auto-scroll the viewport to keep playhead visible
  _scheduleAutoScroll();
}

// ── Timeline Auto-Scroll (viewport camera) ───────────────────
function getTlScroll() {
  const el = document.getElementById('tracks-scroll');
  return el ? el.scrollLeft : 0;
}
function getTlViewportW() {
  const el = document.getElementById('tracks-scroll');
  return el ? el.clientWidth : 800;
}
function setTlScrollInstant(x) {
  const el = document.getElementById('tracks-scroll');
  if (el) el.scrollLeft = Math.max(0, x);
}

// Smoothly scroll the timeline so the playhead stays visible
function _scheduleAutoScroll() {
  if (_autoScrollRaf) return; // already queued
  _autoScrollRaf = requestAnimationFrame(_doAutoScroll);
}
function _doAutoScroll() {
  _autoScrollRaf = null;
  if (_isDragging) return; // Don't fight drag scroll
  const scrollEl = document.getElementById('tracks-scroll');
  if (!scrollEl) return;
  const scrollLeft = scrollEl.scrollLeft;
  const vw = scrollEl.clientWidth;
  const phPx = timeToPx(state.globalTime);

  // Define "safe zone": 15% – 85% of viewport width
  const leftEdge = scrollLeft + vw * 0.15;
  const rightEdge = scrollLeft + vw * 0.85;

  let target = scrollLeft;
  if (phPx < leftEdge) {
    target = phPx - vw * 0.25;
  } else if (phPx > rightEdge) {
    target = phPx - vw * 0.5;
  } else {
    return; // Playhead is already in safe zone, no scroll needed
  }

  target = Math.max(0, target);
  _smoothScrollTo(scrollEl, target);
}

// Smooth scroll: lerp toward target using RAF
function _smoothScrollTo(el, targetX) {
  if (_autoScrollRaf) cancelAnimationFrame(_autoScrollRaf);
  const LERP = 0.18; // How fast to interpolate (lower = smoother/slower)
  function step() {
    const diff = targetX - el.scrollLeft;
    if (Math.abs(diff) < 0.5) { el.scrollLeft = targetX; _autoScrollRaf = null; return; }
    el.scrollLeft += diff * LERP;
    _autoScrollRaf = requestAnimationFrame(step);
  }
  _autoScrollRaf = requestAnimationFrame(step);
}

// During playback: keep playhead centered smoothly
function _autoScrollDuringPlayback() {
  const scrollEl = document.getElementById('tracks-scroll');
  if (!scrollEl || !state.isPlaying) return;
  const vw = scrollEl.clientWidth;
  const phPx = timeToPx(state.globalTime);
  const scrollLeft = scrollEl.scrollLeft;
  const leftEdge = scrollLeft + vw * 0.15;
  const rightEdge = scrollLeft + vw * 0.80;
  if (phPx < leftEdge || phPx > rightEdge) {
    const target = Math.max(0, phPx - vw * 0.35);
    _smoothScrollTo(scrollEl, target);
  }
}

// Edge-drag auto-scroll: when dragging clip near edge, scroll
function _startEdgeDragScroll(clientX) {
  const scrollEl = document.getElementById('tracks-scroll');
  if (!scrollEl) return;
  const rect = scrollEl.getBoundingClientRect();
  const EDGE_ZONE = 60; // px from edge triggers scroll
  const MAX_SPEED = 12; // max px/frame scroll speed
  cancelAnimationFrame(_edgeDragScrollRaf);
  function edgeLoop() {
    if (!_isDragging) { _edgeDragScrollRaf = null; return; }
    const x = clientX;
    const leftDist = x - rect.left;
    const rightDist = rect.right - x;
    let delta = 0;
    if (leftDist < EDGE_ZONE) delta = -MAX_SPEED * (1 - leftDist / EDGE_ZONE);
    else if (rightDist < EDGE_ZONE) delta = MAX_SPEED * (1 - rightDist / EDGE_ZONE);
    if (delta !== 0) scrollEl.scrollLeft += delta;
    _edgeDragScrollRaf = requestAnimationFrame(edgeLoop);
  }
  _edgeDragScrollRaf = requestAnimationFrame(edgeLoop);
}


// Timeline scrubbing with RAF-based smooth playhead update
let _scrubbing = false;
let _scrubRafId = null;

function doScrub(clientX) {
  const scrollEl = document.getElementById('tracks-scroll');
  if (!scrollEl) return;
  const rect = scrollEl.getBoundingClientRect();
  // x relative to tracks-inner (accounting for scroll)
  const x = (clientX - rect.left) + scrollEl.scrollLeft;
  const t = Math.max(0, Math.min(state.totalDuration, pxToTime(x)));
  seekTo(t);
}

document.getElementById('tracks-scroll')?.addEventListener('mousedown', e => {
  if (e.target.closest('.tl-trim-left') || e.target.closest('.tl-trim-right') || e.target.closest('.tl-clip') || e.target.closest('.tl-audio-block')) return;
  if (e.target.closest('.tl-clip')) return;
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

// Touch scrubbing on timeline
document.getElementById('tracks-scroll')?.addEventListener('touchstart', e => {
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
}, { passive: true });

// --- MOMENTUM SCROLL FOR TIMELINE ---
(function() {
  const FRICTION = 0.88;       // Higher = more glide (Canva-like)
  const MIN_VEL = 0.5;         // Stop threshold px/frame
  let scrollEl = null;
  let velX = 0;
  let animId = null;
  let lastScrollX = 0;
  let lastScrollTime = 0;
  let isScrolling = false;

  function getScrollEl() {
    if (!scrollEl) scrollEl = document.getElementById('tracks-scroll');
    return scrollEl;
  }

  function momentumLoop() {
    const el = getScrollEl();
    if (!el) return;
    velX *= FRICTION;
    if (Math.abs(velX) < MIN_VEL) { animId = null; return; }
    el.scrollLeft += velX;
    animId = requestAnimationFrame(momentumLoop);
  }

  // Wheel: intercept and add momentum on trackpad/mouse
  document.addEventListener('wheel', (e) => {
    const el = getScrollEl();
    if (!el || !el.contains(e.target)) return;
    // If trackpad pinch/horizontal scroll, intercept
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      e.preventDefault();
      cancelAnimationFrame(animId);
      velX = e.deltaX * 0.6; // Scale factor for feel
      el.scrollLeft += velX;
      animId = requestAnimationFrame(momentumLoop);
    }
  }, { passive: false });

  // Touch: flick gesture
  let touchStartX = 0;
  let touchLastX = 0;
  let touchLastTime = 0;
  let touchVelX = 0;

  document.addEventListener('touchstart', (e) => {
    const el = getScrollEl();
    if (!el || !el.contains(e.target) || e.touches.length !== 1) return;
    cancelAnimationFrame(animId);
    velX = 0;
    touchStartX = e.touches[0].clientX;
    touchLastX = touchStartX;
    touchLastTime = performance.now();
    isScrolling = false;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    const el = getScrollEl();
    if (!el || !el.contains(e.target) || e.touches.length !== 1) return;
    if (_isDragging) return; // Don't momentum-scroll during clip drag
    const x = e.touches[0].clientX;
    const dx = touchLastX - x;
    const now = performance.now();
    const dt = now - touchLastTime || 1;
    touchVelX = dx / dt * 16; // velocity in px/frame
    touchLastX = x;
    touchLastTime = now;
    el.scrollLeft += dx;
    isScrolling = true;
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!isScrolling) return;
    isScrolling = false;
    velX = touchVelX;
    animId = requestAnimationFrame(momentumLoop);
    touchVelX = 0;
  }, { passive: true });
})();

// --- ABSOLUTE POSITIONING DRAG LOGIC ---
let dragState = null;
function handleDrag(e, itemId, action) {
  e.stopPropagation();
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
    // No longer using trackWidth % — we use pps() directly
    scrollLeftAtStart: getTlScroll(),
  };
  // Set drag cursor on body
  if (action === 'move') document.body.classList.add('is-dragging');
  else document.body.classList.add('is-trimming');
  // Add visual feedback to the dragged clip
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
  const dt = pxToTime(dx); // Pixel delta → time delta via pps()
  const item = dragState.item;
  // Update edge-drag scroll position
  if (typeof _startEdgeDragScroll === 'function') _startEdgeDragScroll(clientX);
  
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
  
  // FAST PATH: update only the dragged clip's DOM element via transform, skip full renderTimeline()
  applyClipTransformFast(item);
  
  // Throttle inspector + preview frame during drag
  if (!_dragRafId) {
    _dragRafId = requestAnimationFrame(() => {
      _dragRafId = null;
      renderInspector();
      // Low-fps preview during drag
      const now = performance.now();
      if (now - _dragPreviewThrottle > DRAG_PREVIEW_MS) {
        _dragPreviewThrottle = now;
        renderFrame();
      }
    });
  }
}

// Apply clip position/width update via DOM mutation (no full re-render)
// Uses pixel-per-second system — no % recalc, no layout thrash
function applyClipTransformFast(item) {
  const trackEl = document.getElementById('track-' + item.track);
  if (!trackEl) return;
  const clipEl = trackEl.querySelector('[data-id="' + item.id + '"]');
  if (!clipEl) return;
  // Also update inner container width live during drag
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
  // Restore body cursor
  document.body.classList.remove('is-dragging', 'is-trimming');
  // Remove dragging class from clip
  const trackEl = document.getElementById('track-' + dragState.item.track);
  const clipEl = trackEl?.querySelector('[data-id="' + dragState.item.id + '"]');
  if (clipEl) clipEl.classList.remove('dragging');
  pushHistory();
  dragState = null;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);
  // Full re-render once drag ends
  renderTimeline();
  renderFrame();
}

// --- RAIL NAVIGATION (Left sidebar) ---
document.querySelectorAll('.rail-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const pane = document.getElementById('tab-' + btn.dataset.tab);
    if(pane) pane.classList.add('active');
  });
});

// --- INSPECTOR ---
function selectLayer(id) { state.activeLayer = id; renderAll(); }

// Fix Inspector Tabs
document.querySelectorAll('.rp-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rp-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.rp-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('pane-' + btn.dataset.pane)?.classList.add('active');
  });
});

function renderInspector() {
  const empty = document.getElementById('rp-empty');
  const videoPane = document.getElementById('rp-video');
  const textPane = document.getElementById('rp-text');
  
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
    
    // Populate Transform tab
    const px = document.getElementById('in-pos-x'); if(px) px.value = item.transform.x || 0;
    const py = document.getElementById('in-pos-y'); if(py) py.value = item.transform.y || 0;
    const sx = document.getElementById('in-scale-x'); if(sx) sx.value = item.transform.scaleX ?? 1;
    const sy = document.getElementById('in-scale-y'); if(sy) sy.value = item.transform.scaleY ?? 1;
    const rt = document.getElementById('in-rotation'); if(rt) rt.value = item.transform.rotation || 0;
    
    // Populate Transition fields
    const fi = document.getElementById('in-fade-in'); if(fi) fi.value = item.transition?.fadeIn || 0;
    const fo = document.getElementById('in-fade-out'); if(fo) fo.value = item.transition?.fadeOut || 0;
    
    // Populate Blend tab
    const bl = document.getElementById('sel-blend'); if(bl) bl.value = item.blendMode || 'normal';
  } else if (item.type === 'audio') {
    if(videoPane) videoPane.style.display = 'flex';
    if(textPane) textPane.style.display = 'none';
    setSlider('sl-vol', 'val-vol', Math.round((item.volume ?? 1) * 100));
    document.getElementById('sl-vol').disabled = false;
  } else if (item.type === 'text') {
    if(videoPane) videoPane.style.display = 'none';
    if(textPane) textPane.style.display = 'flex';
    // Populate text editing fields
    const textInput = document.getElementById('in-text-content');
    const colorInput = document.getElementById('in-text-color');
    const sizeInput = document.getElementById('in-text-size');
    if(textInput) textInput.value = item.name;
    if(colorInput) colorInput.value = item.color || '#ffffff';
    if(sizeInput) sizeInput.value = item.transform.size || 64;
  }
  
  // Update text layers list in left panel
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
}
function setSlider(id, valId, val) {
  const s = document.getElementById(id); const v = document.getElementById(valId);
  if(s) s.value = val; if(v) v.textContent = val;
}
function bindSlider(id, cb) {
  const el = document.getElementById(id);
  if(el) el.addEventListener('input', e => { cb(Number(e.target.value)); renderFrame(); });
}
bindSlider('sl-brightness', v => updateActiveFilter('brightness', v));
bindSlider('sl-contrast', v => updateActiveFilter('contrast', v));
bindSlider('sl-saturation', v => updateActiveFilter('saturate', v));
bindSlider('sl-grayscale', v => updateActiveFilter('grayscale', v));
bindSlider('sl-opacity', v => { const i = state.items.find(x=>x.id===state.activeLayer); if(i) i.opacity = v; });
bindSlider('sl-vol', v => {
  const item = state.items.find(x=>x.id===state.activeLayer);
  if (item) {
      item.volume = v / 100;
      syncAudioGraph();
  }
});
document.getElementById('sl-master-vol-side')?.addEventListener('input', e => {
  state.masterVolume = e.target.value / 100;
  document.getElementById('val-master-vol-side').textContent = e.target.value;
  syncAudioGraph();
});
function updateActiveFilter(key, val) {
  const item = state.items.find(c=>c.id===state.activeLayer);
  if(item && item.filters) { item.filters[key] = val; document.getElementById(`val-${key}`).textContent = val; }
}

// --- EFFECTS ---
document.querySelectorAll('.effect-card').forEach(el => {
  el.addEventListener('click', () => {
    const item = state.items.find(c => c.id === state.activeLayer);
    if(!item || !item.filters) { showToast('Select a video/image first'); return; }
    item.filters = {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0};
    const name = el.querySelector('span').textContent;
    if (name === 'Glitch' || name === 'Noise') { item.filters.contrast = 150; item.filters.saturate = 150; }
    else if (name === 'VHS') { item.filters.contrast = 120; item.filters.saturate = 120; item.filters.blur = 1; }
    else if (name === 'Old Film') { item.filters.sepia = 80; item.filters.contrast = 110; }
    else if (name === 'Blur') { item.filters.blur = 5; }
    else if (name === 'Pixelate') { item.filters.contrast = 130; item.filters.grayscale = 20; }
    renderInspector(); renderFrame(); pushHistory(); showToast(`Applied: ${name}`);
  });
});
document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
  const item = state.items.find(c=>c.id===state.activeLayer);
  if(item && item.filters) item.filters = {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0};
  renderInspector(); renderFrame(); pushHistory(); showToast('Filters reset');
});

// --- SPLIT & DELETE ---
document.getElementById('btn-delete')?.addEventListener('click', () => {
  // Memory cleanup for deleted item
  const toDelete = state.items.find(i => i.id === state.activeLayer);
  if (toDelete) MemoryManager.revokeItemBlobs(toDelete);
  if (!state.activeLayer) return;
  const id = state.activeLayer;
  const item = state.items.find(i => i.id === id);
  
  // Cleanup memory for deleted item
  if (item) {
    // Revoke blob URL to free memory
    if (item.src && item.src.startsWith('blob:')) URL.revokeObjectURL(item.src);
    // Remove from active videos map
    if (activeVideos.has(id)) {
      const vid = activeVideos.get(id);
      vid.pause(); vid.src = ''; vid.load();
      activeVideos.delete(id);
    }
    // Remove from audio map
    if (audioNodesMap.has(id)) {
      const node = audioNodesMap.get(id);
      node.audio.pause(); node.audio.src = '';
      audioNodesMap.delete(id);
    }
    // Remove from image cache
    imageCache.delete(id);
  }
  
  state.items = state.items.filter(c => c.id !== id);
  state.activeLayer = null;
  pushHistory(); computeTotalDuration(); syncAudioGraph(); renderAll();
});
document.getElementById('btn-split')?.addEventListener('click', () => {
  if (!state.items.length) return;
  // Only split the SELECTED item at the playhead position
  const item = state.items.find(i => i.id === state.activeLayer);
  if (!item) { showToast('Select a clip first', '', true); return; }
  
  const isActive = state.globalTime >= item.start && state.globalTime < item.start + item.duration;
  if (!isActive) { showToast('Playhead is outside selected clip', '', true); return; }
  
  const splitTimeLocal = item.trimStart + (state.globalTime - item.start);
  if (splitTimeLocal <= item.trimStart + 0.1 || splitTimeLocal >= item.trimEnd - 0.1) return;
  
  const idx = state.items.indexOf(item);
  const aFilters = {...item.filters}; const bFilters = {...item.filters};
  const aTrans = {...item.transform}; const bTrans = {...item.transform};
  const aTransition = item.transition ? {...item.transition} : {fadeIn:0,fadeOut:0};
  const bTransition = item.transition ? {...item.transition} : {fadeIn:0,fadeOut:0};
  
  const a = { ...item, id: uid(), filters: aFilters, transform: aTrans, transition: aTransition,
    trimEnd: splitTimeLocal, duration: state.globalTime - item.start };
  const b = { ...item, id: uid(), filters: bFilters, transform: bTrans, transition: bTransition,
    start: state.globalTime, trimStart: splitTimeLocal, duration: item.trimEnd - splitTimeLocal };
  
  // Remove old audio node for original item
  if (audioNodesMap.has(item.id)) {
    audioNodesMap.get(item.id).audio.pause();
    audioNodesMap.delete(item.id);
  }
  
  state.items.splice(idx, 1, a, b);
  state.activeLayer = a.id;
  pushHistory(); computeTotalDuration(); syncAudioGraph(); renderAll();
  showToast('Split', 'Clip split at playhead');
});

// --- PLAYBACK BINDS ---
document.getElementById('btn-play')?.addEventListener('click', togglePlay);
document.getElementById('btn-export-top')?.addEventListener('click', handleExport);
document.getElementById('btn-export-main')?.addEventListener('click', handleExport);
document.getElementById('btn-skip-start')?.addEventListener('click', () => seekTo(0));
document.getElementById('btn-skip-end')?.addEventListener('click', () => seekTo(state.totalDuration - 0.01));
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.target.matches('input,textarea,select')) { e.preventDefault(); togglePlay(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); document.getElementById('btn-undo').click(); }
});

// Pause playback when tab is hidden, resume when visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Complete freeze: cancel ALL rendering, stop all media — near-zero CPU in background
    cancelAnimationFrame(rafId);
    rafId = null;
    cancelAnimationFrame(_autoScrollRaf);
    _autoScrollRaf = null;
    VideoPool.pauseAll();
    for (const node of audioNodesMap.values()) node.audio.pause();
    // Don't change state.isPlaying — user didn't press pause
  } else {
    // Resuming: restart loop if was playing
    if (state.isPlaying) {
      lastTs = null; // Reset timing to avoid time jump after coming back
      if (audioCtx.state === 'suspended') audioCtx.resume();
      rafId = requestAnimationFrame(playLoop);
    }
    // Re-render static frame even if paused
    RenderScheduler.schedule(() => renderFrame());
  }
});

// --- TEXT LAYER FEATURE ---
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

document.getElementById('btn-add-text')?.addEventListener('click', () => addTextLayer('Your text here', 64, 700));
document.querySelectorAll('.text-preset').forEach(el => {
  el.addEventListener('click', () => {
    const size = parseInt(el.dataset.size) || 64;
    const weight = parseInt(el.dataset.weight) || 700;
    const label = el.querySelector('span')?.textContent || 'Text';
    addTextLayer(label, size, weight);
  });
});

function buildRuler() {
  const ruler = document.getElementById('ruler');
  if (!ruler) return;
  ruler.innerHTML = '';

  const totalPx = timeToPx(state.totalDuration);
  ruler.style.width = totalPx + 'px';
  ruler.style.position = 'relative';

  // Pick a sensible label interval based on zoom
  const currentPps = pps();
  // We want labels roughly every 60-140px
  const rawInterval = 60 / currentPps;     // ideal seconds between labels
  // Round to nice numbers: 0.5, 1, 2, 5, 10, 30, 60...
  const niceIntervals = [0.1,0.25,0.5,1,2,5,10,15,30,60,120,300];
  const interval = niceIntervals.find(n => n * currentPps >= 60) || 300;
  const minorInterval = interval / 5;

  // Minor ticks
  for (let t = 0; t <= state.totalDuration; t += minorInterval) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = timeToPx(t) + 'px';
    ruler.appendChild(tick);
  }

  // Major ticks + labels
  for (let t = 0; t <= state.totalDuration + interval * 0.01; t += interval) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick major';
    tick.style.left = timeToPx(t) + 'px';
    ruler.appendChild(tick);

    const label = document.createElement('span');
    label.className = 'ruler-label';
    label.style.left = timeToPx(t) + 'px';
    label.textContent = formatTime(t);
    ruler.appendChild(label);
  }
}


// ── Timeline Zoom System ──────────────────────────────────────
function setTlZoom(newZoom, anchorTime) {
  // anchorTime: keep this time point centered in the viewport during zoom
  const scrollEl = document.getElementById('tracks-scroll');
  const oldZoom = state.tlZoom;
  state.tlZoom = Math.max(TL_ZOOM_MIN, Math.min(TL_ZOOM_MAX, newZoom));
  
  if (scrollEl && anchorTime != null) {
    // Adjust scroll so that anchorTime stays at the same screen position
    const oldPx = anchorTime * BASE_PPS * oldZoom;
    const newPx = anchorTime * BASE_PPS * state.tlZoom;
    const screenOffset = oldPx - scrollEl.scrollLeft;
    scrollEl.scrollLeft = newPx - screenOffset;
  }

  // Update zoom label
  const zl = document.getElementById('zoom-label');
  if (zl) zl.textContent = Math.round(state.tlZoom * 100) + '%';

  // Re-render with new pps
  renderTimeline();
  buildRuler();
  updatePlayhead();
}

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

// Ctrl+Wheel zoom on timeline
document.getElementById('tracks-scroll')?.addEventListener('wheel', e => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const scrollEl = document.getElementById('tracks-scroll');
  const rect = scrollEl.getBoundingClientRect();
  const anchor = pxToTime((e.clientX - rect.left) + scrollEl.scrollLeft);
  const delta = e.deltaY > 0 ? -TL_ZOOM_STEP * 0.5 : TL_ZOOM_STEP * 0.5;
  setTlZoom(state.tlZoom * (1 + delta), anchor);
}, { passive: false });

// Pinch-to-zoom on touch devices
(function() {
  let lastPinchDist = 0;
  document.getElementById('tracks-scroll')?.addEventListener('touchstart', e => {
    if (e.touches.length === 2) lastPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  document.getElementById('tracks-scroll')?.addEventListener('touchmove', e => {
    if (e.touches.length !== 2 || lastPinchDist === 0) return;
    const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const ratio = dist / lastPinchDist;
    lastPinchDist = dist;
    setTlZoom(state.tlZoom * ratio, state.globalTime);
  }, { passive: true });
})();

// --- TRANSFORM INPUT BINDINGS ---
function bindTransformInput(inputId, prop) {
  document.getElementById(inputId)?.addEventListener('input', e => {
    const item = state.items.find(i => i.id === state.activeLayer);
    if (item && item.transform) {
      item.transform[prop] = parseFloat(e.target.value) || 0;
      renderFrame();
    }
  });
  document.getElementById(inputId)?.addEventListener('change', () => pushHistory());
}
bindTransformInput('in-pos-x', 'x');
bindTransformInput('in-pos-y', 'y');
bindTransformInput('in-scale-x', 'scaleX');
bindTransformInput('in-scale-y', 'scaleY');
bindTransformInput('in-rotation', 'rotation');

// Fade In / Fade Out
document.getElementById('in-fade-in')?.addEventListener('input', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if (item) { if(!item.transition) item.transition = {fadeIn:0, fadeOut:0}; item.transition.fadeIn = parseFloat(e.target.value) || 0; renderFrame(); }
});
document.getElementById('in-fade-in')?.addEventListener('change', () => pushHistory());
document.getElementById('in-fade-out')?.addEventListener('input', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if (item) { if(!item.transition) item.transition = {fadeIn:0, fadeOut:0}; item.transition.fadeOut = parseFloat(e.target.value) || 0; renderFrame(); }
});
document.getElementById('in-fade-out')?.addEventListener('change', () => pushHistory());

// Blend mode select
document.getElementById('sel-blend')?.addEventListener('change', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if (item) { item.blendMode = e.target.value; renderFrame(); pushHistory(); }
});

// Reset Transform
document.getElementById('btn-reset-transform')?.addEventListener('click', () => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if (item) {
    item.transform = {x:0, y:0, scaleX: item.type === 'image' ? 0.3 : 1, scaleY: item.type === 'image' ? 0.3 : 1, rotation:0};
    item.transition = {fadeIn:0, fadeOut:0};
    renderInspector(); renderFrame(); pushHistory(); showToast('Transform reset');
  }
});

// Trim input bindings
document.getElementById('in-trim-start')?.addEventListener('change', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if (item) { item.trimStart = parseFloat(e.target.value) || 0; item.duration = item.trimEnd - item.trimStart; computeTotalDuration(); renderTimeline(); pushHistory(); }
});
document.getElementById('in-trim-end')?.addEventListener('change', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if (item) { item.trimEnd = parseFloat(e.target.value) || item.duration; item.duration = item.trimEnd - item.trimStart; computeTotalDuration(); renderTimeline(); pushHistory(); }
});

// --- TEXT INSPECTOR BINDINGS ---
document.getElementById('in-text-content')?.addEventListener('input', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if(item && item.type === 'text') { item.name = e.target.value; renderFrame(); renderTimeline(); }
});
document.getElementById('in-text-color')?.addEventListener('input', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if(item && item.type === 'text') { item.color = e.target.value; renderFrame(); }
});
document.getElementById('in-text-size')?.addEventListener('input', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if(item && item.type === 'text') { item.transform.size = parseInt(e.target.value) || 64; renderFrame(); }
});
document.getElementById('sl-text-opacity')?.addEventListener('input', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if(item && item.type === 'text') { item.opacity = Number(e.target.value); document.getElementById('val-text-opacity').textContent = e.target.value; renderFrame(); }
});
document.getElementById('btn-delete-text')?.addEventListener('click', () => {
  if(state.activeLayer) { document.getElementById('btn-delete').click(); }
});

// --- SELECTION VOL SIDE PANEL ---
document.getElementById('sl-sel-vol-side')?.addEventListener('input', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if(item) { 
    item.volume = Number(e.target.value) / 100;
    document.getElementById('val-sel-vol-side').textContent = e.target.value;
    syncAudioGraph();
  }
});

// --- PREVIEW ZOOM ---
let previewZoom = 100;
function applyPreviewZoom() {
  const pc = document.getElementById('preview-img-canvas');
  if(pc) { pc.style.transform = `scale(${previewZoom / 100})`; pc.style.transformOrigin = 'center center'; }
  document.getElementById('pz-val').textContent = previewZoom + '%';
  document.getElementById('pz-slider').value = previewZoom;
}
document.getElementById('pz-slider')?.addEventListener('input', e => { previewZoom = Number(e.target.value); applyPreviewZoom(); });
document.getElementById('pz-in')?.addEventListener('click', () => { previewZoom = Math.min(200, previewZoom + 10); applyPreviewZoom(); });
document.getElementById('pz-out')?.addEventListener('click', () => { previewZoom = Math.max(20, previewZoom - 10); applyPreviewZoom(); });
document.getElementById('pz-fit')?.addEventListener('click', () => { previewZoom = 100; applyPreviewZoom(); });

// --- CANVAS INTERACTION (drag to move, handle to resize) ---
let canvasDrag = null;
let handleDragState = null;
const previewCanvas = document.getElementById('preview-img-canvas');

// Selection overlay - shows bounding box + handles for selected item
const selOverlay = document.createElement('div');
selOverlay.id = 'sel-overlay';
selOverlay.style.cssText = 'position:absolute;pointer-events:none;z-index:15;display:none;';
document.getElementById('preview-canvas')?.appendChild(selOverlay);

function getItemBoundsOnScreen(item) {
  const pc = document.getElementById('preview-img-canvas');
  if (!pc) return null;
  const rect = pc.getBoundingClientRect();
  const scaleX = rect.width / renderCanvas.width;
  const scaleY = rect.height / renderCanvas.height;
  const cx = rect.width / 2 + (item.transform.x || 0) * scaleX;
  const cy = rect.height / 2 + (item.transform.y || 0) * scaleY;
  
  let halfW = 100, halfH = 60;
  if (item.type === 'image') {
    const img = imageCache.get(item.id);
    if (img && img.naturalWidth) {
      const fitScale = Math.min(renderCanvas.width / img.naturalWidth, renderCanvas.height / img.naturalHeight);
      halfW = img.naturalWidth * fitScale * (item.transform.scaleX ?? 1) * scaleX / 2;
      halfH = img.naturalHeight * fitScale * (item.transform.scaleY ?? 1) * scaleY / 2;
    }
  } else if (item.type === 'text') {
    const fontSize = (item.transform.size || 64) * (item.transform.scaleX ?? 1);
    halfW = (item.name.length * fontSize * 0.35 * scaleX) / 2;
    halfH = fontSize * scaleY / 2 + 8;
  } else if (item.type === 'video') {
    const vid = activeVideos.get(item.id);
    if (vid && vid.videoWidth) {
      const fitScale = Math.min(renderCanvas.width / vid.videoWidth, renderCanvas.height / vid.videoHeight);
      halfW = vid.videoWidth * fitScale * scaleX / 2;
      halfH = vid.videoHeight * fitScale * scaleY / 2;
    } else {
      halfW = rect.width / 2;
      halfH = rect.height / 2;
    }
  }
  return { cx, cy, halfW, halfH, scaleX, scaleY };
}

function updateSelectionOverlay() {
  if (!state.activeLayer) { selOverlay.style.display = 'none'; return; }
  const item = state.items.find(i => i.id === state.activeLayer);
  // Only show overlay for images and text (NOT video, NOT audio)
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
      const pc = document.getElementById('preview-img-canvas');
      const rect = pc.getBoundingClientRect();
      handleDragState = {
        handle: h.dataset.handle,
        item, startMouseX: e.clientX, startMouseY: e.clientY,
        startX: item.transform.x || 0, startY: item.transform.y || 0,
        startScaleX: item.transform.scaleX ?? 1, startScaleY: item.transform.scaleY ?? 1,
        scaleFactorX: renderCanvas.width / rect.width,
        scaleFactorY: renderCanvas.height / rect.height
      };
    });
  });
}

document.addEventListener('mousemove', e => {
  if (handleDragState) {
    const dx = (e.clientX - handleDragState.startMouseX) * handleDragState.scaleFactorX;
    const dy = (e.clientY - handleDragState.startMouseY) * handleDragState.scaleFactorY;
    const item = handleDragState.item;
    
    if (handleDragState.handle === 'move') {
      item.transform.x = handleDragState.startX + dx;
      item.transform.y = handleDragState.startY + dy;
    } else {
      // Resize: scale based on drag delta
      const scaleDelta = Math.max(-0.005 * Math.abs(dx + dy), (dx - dy) * 0.001);
      const newSX = Math.max(0.05, handleDragState.startScaleX + (dx / 200));
      const newSY = Math.max(0.05, handleDragState.startScaleY + (dy / 200));
      if (handleDragState.handle === 'se') { item.transform.scaleX = newSX; item.transform.scaleY = newSY; }
      else if (handleDragState.handle === 'sw') { item.transform.scaleX = Math.max(0.05, handleDragState.startScaleX - dx/200); item.transform.scaleY = newSY; }
      else if (handleDragState.handle === 'ne') { item.transform.scaleX = newSX; item.transform.scaleY = Math.max(0.05, handleDragState.startScaleY - dy/200); }
      else if (handleDragState.handle === 'nw') { item.transform.scaleX = Math.max(0.05, handleDragState.startScaleX - dx/200); item.transform.scaleY = Math.max(0.05, handleDragState.startScaleY - dy/200); }
    }
    renderFrame(); renderInspector(); updateSelectionOverlay();
  }
  if (canvasDrag) {
    const dx = (e.clientX - canvasDrag.startMouseX) * canvasDrag.scaleFactorX;
    const dy = (e.clientY - canvasDrag.startMouseY) * canvasDrag.scaleFactorY;
    canvasDrag.item.transform.x = canvasDrag.startItemX + dx;
    canvasDrag.item.transform.y = canvasDrag.startItemY + dy;
    renderFrame(); renderInspector(); updateSelectionOverlay();
  }
  // Scroll-wheel resize overlay update is handled in wheel listener
});

document.addEventListener('mouseup', () => {
  if (handleDragState || canvasDrag) { pushHistory(); handleDragState = null; canvasDrag = null; }
});

// Click on canvas to deselect or drag-move image/text
previewCanvas?.addEventListener('mousedown', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if (!item || (item.type !== 'image' && item.type !== 'text')) return;
  e.preventDefault();
  const rect = previewCanvas.getBoundingClientRect();
  canvasDrag = {
    item, startMouseX: e.clientX, startMouseY: e.clientY,
    startItemX: item.transform.x || 0, startItemY: item.transform.y || 0,
    scaleFactorX: renderCanvas.width / rect.width,
    scaleFactorY: renderCanvas.height / rect.height
  };
});

// Scroll to resize
previewCanvas?.addEventListener('wheel', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if (!item || (item.type !== 'image' && item.type !== 'text')) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.03 : 0.03;
  item.transform.scaleX = Math.max(0.05, Math.min(5, (item.transform.scaleX ?? 1) + delta));
  item.transform.scaleY = Math.max(0.05, Math.min(5, (item.transform.scaleY ?? 1) + delta));
  renderFrame(); renderInspector(); updateSelectionOverlay();
}, { passive: false });

// --- TIMELINE RESIZER ---
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
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!isResizing) return;
    const delta = startY - e.clientY; // drag up = bigger timeline
    const newH = Math.max(140, Math.min(500, startH + delta));
    app.style.setProperty('--timeline-h', newH + 'px');
  });
  document.addEventListener('mouseup', () => {
    if (isResizing) { isResizing = false; resizer.classList.remove('dragging'); document.body.style.cursor = ''; }
  });
})();

// --- SETTINGS PANEL BINDINGS ---
document.querySelectorAll('.setting-option[data-res]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.setting-option[data-res]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const [w, h] = btn.dataset.res.split('x').map(Number);
    renderCanvas.width = w;
    renderCanvas.height = h;
    showToast(`Resolution: ${w}×${h}`, 'Canvas size updated');
    renderFrame();
  });
});
document.querySelectorAll('.setting-option[data-fps]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.setting-option[data-fps]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.fps = Number(btn.dataset.fps);
    showToast(`Frame rate: ${state.fps} fps`);
  });
});
document.querySelectorAll('.setting-option[data-fmt]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.setting-option[data-fmt]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.exportFormat = btn.dataset.fmt;
    showToast(`Export format: ${btn.dataset.fmt.toUpperCase()}`);
  });
});
document.getElementById('btn-ai-bg-remove')?.addEventListener('click', () => {
  showToast('AI Background Removal', 'Coming soon! We are working on this feature.', false);
});

// Init
pushHistory();
renderAll();


// ── Performance HUD ──────────────────────────────────────────
let _perfHudRaf = null;
function updatePerfHud() {
  const hud = document.getElementById('perf-hud');
  if (!hud || !hud.classList.contains('visible')) { _perfHudRaf = requestAnimationFrame(updatePerfHud); return; }
  Perf.updateMemEstimate();
  hud.textContent = [
    'FPS: ' + (Perf.fps || '--'),
    'Quality: ' + Perf.quality || Perf._quality,
    'MEM: ~' + Perf.memEstimateMB + 'MB',
    'Decoders: ' + VideoPool.size,
    'Items: ' + state.items.length,
    'Zoom: ' + Math.round(state.tlZoom * 100) + '%',
  ].join(' | ');
  _perfHudRaf = requestAnimationFrame(updatePerfHud);
}
updatePerfHud();

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key === 'P') {
    document.getElementById('perf-hud')?.classList.toggle('visible');
  }
});

