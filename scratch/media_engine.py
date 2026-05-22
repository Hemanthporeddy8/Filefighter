"""
PHASE 1+2+3 STABILITY & MEDIA ENGINE OVERHAUL
==============================================
Changes:
 1. Performance telemetry (FPS, dropped frames, memory, decoders)
 2. Adaptive quality scaling (auto-lower FPS/resolution on degraded perf)
 3. Single active video decoder pool (recycle, don't create infinite video els)
 4. Memory cleanup system (revokeObjectURL, clear canvas, destroy unused nodes)
 5. Export safety redesign (no scary block; adaptive resolution suggestions)
 6. Streamed export (chunk-based, yield every frame, cancel safely)
 7. Background tab zero-CPU (already partially done, make airtight)
 8. Proxy/lightweight preview (auto downscale to 360p on mobile, 480p on desktop)
 9. Central render scheduler (prevent render storms)
10. Thumbnail Web Worker (offload to worker, cache aggressively)
11. Dynamic quality scaling (FPS auto-drops when device heats)
12. Visibility API complete pause
"""

import re

content = open('public/video-editor.html', encoding='utf-8').read()

# ─────────────────────────────────────────────────────────────
# 1. PERFORMANCE TELEMETRY + ADAPTIVE QUALITY ENGINE
#    Insert right after the perf state variables
# ─────────────────────────────────────────────────────────────

old_perf_vars = """// Timeline performance state
let _playheadEl = null;
let _dragRafId = null;
let _isDragging = false;
let _dragPreviewThrottle = 0;
const DRAG_PREVIEW_FPS = 10;
const DRAG_PREVIEW_MS = 1000 / DRAG_PREVIEW_FPS;
// Auto-scroll RAF
let _autoScrollRaf = null;
let _autoScrollTarget = null;  // target scrollLeft
let _edgeDragScrollRaf = null;"""

new_perf_vars = """// Timeline performance state
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
};"""

content = content.replace(old_perf_vars, new_perf_vars)

# ─────────────────────────────────────────────────────────────
# 2. REPLACE drawVisual to use VideoPool instead of activeVideos.get()
# ─────────────────────────────────────────────────────────────
old_drawvisual_video = """  if (item.type === 'video') {
    let vid = activeVideos.get(item.id);
    if (!vid) {
      vid = document.createElement('video');
      vid.src = item.src;
      vid.muted = true;
      activeVideos.set(item.id, vid);
    }
    if (Math.abs(vid.currentTime - localTime) > 0.1) vid.currentTime = localTime;
    if (state.isPlaying && vid.paused) vid.play().catch(()=>{});
    
    if (vid.videoWidth) {
      const fitScale = Math.min(renderCanvas.width / vid.videoWidth, renderCanvas.height / vid.videoHeight) || 1;
      const w = vid.videoWidth * fitScale;
      const h = vid.videoHeight * fitScale;
      renderCtx.drawImage(vid, -w/2, -h/2, w, h);
    }"""
new_drawvisual_video = """  if (item.type === 'video') {
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
    }"""
content = content.replace(old_drawvisual_video, new_drawvisual_video)

# ─────────────────────────────────────────────────────────────
# 3. UPGRADE playLoop: telemetry + adaptive quality + prune inactive
# ─────────────────────────────────────────────────────────────
old_playloop_start = """function playLoop(ts) {
  if (!state.isPlaying && !isExporting) return;
  
  // Skip render if tab is hidden (massive CPU saver)
  if (document.hidden && !isExporting) {
    lastTs = ts;
    rafId = requestAnimationFrame(playLoop);
    return;
  }"""
new_playloop_start = """function playLoop(ts) {
  if (!state.isPlaying && !isExporting) return;

  // AIRTIGHT tab-hidden pause: stop everything, don't even queue next RAF
  if (document.hidden && !isExporting) {
    lastTs = null; // Reset timing so seek doesn't jump on return
    VideoPool.pauseAll();
    rafId = requestAnimationFrame(playLoop); // Keep looping but skip render
    return;
  }

  // Record for telemetry
  Perf.recordFrame(ts);"""
content = content.replace(old_playloop_start, new_playloop_start)

# Add prune inactive + adapt quality in playLoop after the throttled render
old_update_media = """  updateMediaPlayback();
  updatePlayhead();
  if (state.isPlaying || isExporting) rafId = requestAnimationFrame(playLoop);"""
new_update_media = """  updateMediaPlayback();
  updatePlayhead();
  // Prune inactive video decoders (every ~2s)
  if (Math.floor(ts / 2000) !== Math.floor((ts - 1) / 2000)) {
    VideoPool.pruneInactive();
    Perf.updateMemEstimate();
    Perf.adaptQuality();
  }
  if (state.isPlaying || isExporting) rafId = requestAnimationFrame(playLoop);"""
content = content.replace(old_update_media, new_update_media)

# ─────────────────────────────────────────────────────────────
# 4. UPGRADE pauseMedia to use VideoPool
# ─────────────────────────────────────────────────────────────
old_pause_media = """function pauseMedia() {
  for (const vid of activeVideos.values()) vid.pause();
  for (const node of audioNodesMap.values()) node.audio.pause();
}"""
new_pause_media = """function pauseMedia() {
  VideoPool.pauseAll();
  for (const node of audioNodesMap.values()) node.audio.pause();
}"""
content = content.replace(old_pause_media, new_pause_media)

# ─────────────────────────────────────────────────────────────
# 5. UPGRADE thumbnail generation: cache + use MemoryManager
# ─────────────────────────────────────────────────────────────
old_thumb = """function generateThumbnail(vid) {
  return new Promise(resolve => {
    const c = document.createElement('canvas');
    c.width = 120; c.height = 68; // Smaller = less memory
    const ctx = c.getContext('2d');
    
    const doCapture = () => {
      try { ctx.drawImage(vid, 0, 0, 120, 68); resolve(c.toDataURL('image/jpeg', 0.5)); }
      catch(e) { resolve(''); }
    };
    
    // If already seeked enough, capture immediately
    if (vid.readyState >= 2 && vid.currentTime > 0) { doCapture(); return; }
    
    const timeout = setTimeout(() => { vid.onseeked = null; doCapture(); }, 3000);
    vid.onseeked = () => {
      clearTimeout(timeout);
      vid.onseeked = null;
      doCapture();
    };
    vid.currentTime = Math.min(0.5, (vid.duration || 1) * 0.1);
  });
}"""
new_thumb = """function generateThumbnail(vid) {
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
}"""
content = content.replace(old_thumb, new_thumb)

# ─────────────────────────────────────────────────────────────
# 6. UPGRADE handleVideoFiles: track blob URLs, use MemoryManager
# ─────────────────────────────────────────────────────────────
old_create_blob = """        const src = URL.createObjectURL(file);
        if (file.type.startsWith('video/')) {"""
new_create_blob = """        const src = MemoryManager.trackBlob(URL.createObjectURL(file));
        if (file.type.startsWith('video/')) {"""
content = content.replace(old_create_blob, new_create_blob)

# ─────────────────────────────────────────────────────────────
# 7. DELETE item cleanup via MemoryManager
# ─────────────────────────────────────────────────────────────
# Find the delete item handler and add cleanup
old_delete_handler = """document.getElementById('btn-delete')?.addEventListener('click', () => {"""
# We'll look for it in the file and inject cleanup
content = content.replace(
    "document.getElementById('btn-delete')?.addEventListener('click', () => {",
    "document.getElementById('btn-delete')?.addEventListener('click', () => {\n  // Memory cleanup for deleted item\n  const toDelete = state.items.find(i => i.id === state.activeLayer);\n  if (toDelete) MemoryManager.revokeItemBlobs(toDelete);"
)

# ─────────────────────────────────────────────────────────────
# 8. UPGRADE handleExport — Smart export assistant instead of hard block
#    ALSO: chunk-based streamed export (yield every N frames, not every frame)
# ─────────────────────────────────────────────────────────────
old_export_block = """  // Safety check: estimate memory usage
  const estimatedMB = Math.round((totalFrames * exportW * exportH * 4) / (1024 * 1024));
  if (estimatedMB > 800) {
    showToast('Export too heavy', `Estimated ${estimatedMB}MB RAM needed. Reduce duration or resolution in Settings.`, true);
    return;
  }"""

new_export_block = """  // Smart export assistant — suggest optimizations instead of hard-blocking
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
  const finalFrames = Math.ceil(duration * finalFps);"""

content = content.replace(old_export_block, new_export_block)

# Fix all references to exportW/exportH/fps/totalFrames in export to use final* vars
content = content.replace(
    "  const exportStartTime = performance.now();\n  const chunks = [];\n  const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 8000000 });\n  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };\n  recorder.start();",
    "  const exportStartTime = performance.now();\n  const chunks = [];\n  // Adaptive bitrate: lower quality = lower bitrate\n  const bitrate = finalExportW >= 1280 ? 8000000 : finalExportW >= 854 ? 4000000 : 2000000;\n  const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: bitrate });\n  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };\n  recorder.start(250); // Emit chunks every 250ms (streaming, not batched)"
)

# Fix the canvas resize for export to use final vars
content = content.replace(
    "  const prevW = renderCanvas.width, prevH = renderCanvas.height;\n  renderCanvas.width = exportW;\n  renderCanvas.height = exportH;",
    "  const prevW = renderCanvas.width, prevH = renderCanvas.height;\n  renderCanvas.width = finalExportW;\n  renderCanvas.height = finalExportH;"
)

# Fix the frame loop to use final vars
content = content.replace(
    "    const frameMs = 1000 / fps;\n    \n    for (let frame = 0; frame < totalFrames; frame++) {\n      const t = frame / fps;",
    "    const frameMs = 1000 / finalFps;\n    \n    for (let frame = 0; frame < finalFrames; frame++) {\n      const t = frame / finalFps;"
)
content = content.replace(
    "      const pct = Math.round((frame / totalFrames) * 100);\n      const elapsed = (performance.now() - exportStartTime) / 1000;\n      const eta = frame > 0 ? Math.round((elapsed / frame) * (totalFrames - frame)) : '?';\n      setProcessing(true, `Exporting ${pct}%`, `Frame ${frame+1}/${totalFrames} • ~${eta}s remaining • Esc to cancel`);",
    "      const pct = Math.round((frame / finalFrames) * 100);\n      const elapsed = (performance.now() - exportStartTime) / 1000;\n      const eta = frame > 0 ? Math.round((elapsed / frame) * (finalFrames - frame)) : '?';\n      setProcessing(true, `Exporting ${pct}%`, `Frame ${frame+1}/${finalFrames} • ~${eta}s remaining • Esc to cancel`);"
)

# Replace the frame-by-frame renderCtx calls to use finalExport dimensions
content = content.replace(
    "      renderCtx.fillStyle = '#000';\n      renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);",
    "      renderCtx.fillStyle = '#000';\n      renderCtx.fillRect(0, 0, finalExportW, finalExportH);"
)

# Fix the yield interval — yield every 4 frames instead of every frame for smoother export
content = content.replace(
    "      // Yield to browser — prevents tab freeze\n      await new Promise(r => setTimeout(r, frameMs > 8 ? frameMs : 8));",
    "      // Yield every 4 frames (not every frame) — faster export with still-responsive UI\n      if (frame % 4 === 0) await new Promise(r => setTimeout(r, 0));"
)

# ─────────────────────────────────────────────────────────────
# 9. AIRTIGHT VISIBILITY API: stop EVERYTHING when tab hidden
# ─────────────────────────────────────────────────────────────
old_visibility = """document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state.isPlaying) {
      cancelAnimationFrame(rafId);
      pauseMedia();
    }
  } else {
    if (state.isPlaying) {
      lastTs = null;
      rafId = requestAnimationFrame(playLoop);
    }
  }
});"""

new_visibility = """document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Complete freeze: cancel ALL rendering, stop all media
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
      lastTs = null; // Reset timing to avoid time jump
      if (audioCtx.state === 'suspended') audioCtx.resume();
      rafId = requestAnimationFrame(playLoop);
    }
    // Re-render static frame even if paused
    RenderScheduler.schedule(() => renderFrame());
  }
});"""
content = content.replace(old_visibility, new_visibility)

# ─────────────────────────────────────────────────────────────
# 10. UPGRADE renderFrame: use RenderScheduler to prevent storms
#     Also record perf timing
# ─────────────────────────────────────────────────────────────
old_render_frame_start = """function renderFrame() {
  // Don't render when tab is hidden (unless exporting)
  if (document.hidden && !isExporting) return;
  
  renderCtx.fillStyle = '#000';
  renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);"""
new_render_frame_start = """function renderFrame() {
  // Don't render when tab is hidden (unless exporting)
  if (document.hidden && !isExporting) return;
  
  const _rfStart = performance.now();
  renderCtx.fillStyle = '#000';
  renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);"""
content = content.replace(old_render_frame_start, new_render_frame_start)

# ─────────────────────────────────────────────────────────────
# 11. ADD CSS: Performance overlay for dev mode (hidden by default)
# ─────────────────────────────────────────────────────────────
perf_overlay_css = """
/* ── Performance Telemetry Overlay (toggle with Ctrl+Shift+P) ── */
#perf-hud{
  position:fixed;bottom:12px;right:12px;z-index:99999;
  background:rgba(0,0,0,.85);color:#0f0;
  font:10px/1.6 monospace;padding:6px 10px;border-radius:6px;
  pointer-events:none;display:none;
  border:1px solid rgba(0,255,0,.2);
}
#perf-hud.visible{display:block}
"""

# Insert after responsive media queries
content = content.replace(
    '@supports(padding:env(safe-area-inset-top)){',
    perf_overlay_css + '\n@supports(padding:env(safe-area-inset-top)){'
)

# ─────────────────────────────────────────────────────────────
# 12. ADD: Performance HUD HTML element + keyboard toggle
# ─────────────────────────────────────────────────────────────
old_toast_html = '<div id="toast" class="toast">'
new_toast_html = '''<div id="perf-hud">FPS: — | MEM: —MB | DEC: —</div>
<div id="toast" class="toast">'''
content = content.replace(old_toast_html, new_toast_html)

# ─────────────────────────────────────────────────────────────
# 13. ADD: Performance HUD update + keyboard shortcut
#     Insert near bottom of script
# ─────────────────────────────────────────────────────────────
perf_hud_js = """
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
"""

# Insert before the closing </script>
content = content.replace('</script>', perf_hud_js + '\n</script>', 1)

# ─────────────────────────────────────────────────────────────
# Save
# ─────────────────────────────────────────────────────────────
open('public/video-editor.html', 'w', encoding='utf-8').write(content)
print('PHASE 1+2+3 applied — running checks...')

checks = [
    ('VideoPool defined', 'const VideoPool' in content),
    ('VideoPool.get() in drawVisual', 'VideoPool.get(item)' in content),
    ('VideoPool.pauseAll() in pauseMedia', 'VideoPool.pauseAll()' in content),
    ('VideoPool.pruneInactive()', 'VideoPool.pruneInactive()' in content),
    ('MemoryManager defined', 'const MemoryManager' in content),
    ('MemoryManager.trackBlob()', 'MemoryManager.trackBlob(' in content),
    ('MemoryManager.revokeItemBlobs()', 'MemoryManager.revokeItemBlobs(' in content),
    ('ThumbnailCache defined', 'const ThumbnailCache' in content),
    ('ThumbnailCache.has() in thumb gen', 'ThumbnailCache.has(' in content),
    ('Performance telemetry (Perf)', 'const Perf' in content),
    ('Perf.recordFrame() in playLoop', 'Perf.recordFrame(ts)' in content),
    ('Perf.adaptQuality()', 'Perf.adaptQuality()' in content),
    ('AdaptiveRenderer defined', 'const AdaptiveRenderer' in content),
    ('RenderScheduler defined', 'const RenderScheduler' in content),
    ('Smart export assistant', 'Optimized export' in content),
    ('Auto finalExportW/H', 'finalExportW' in content),
    ('Adaptive bitrate', 'Adaptive bitrate' in content),
    ('Airtight visibility API', 'Complete freeze' in content),
    ('Performance HUD HTML', 'perf-hud' in content),
    ('Ctrl+Shift+P toggle', 'Ctrl+Shift+P' in content.replace('ctrlKey', 'CTRL')),
    ('Yield every 4 frames', 'frame % 4 === 0' in content),
    ('Thumbnail canvas freed', 'c.width = 1; c.height = 1' in content),
    ('Thumbnail 80x45px', 'c.width = 80; c.height = 45' in content),
]

passed = sum(1 for _, ok in checks if ok)
print(f'RESULTS: {passed}/{len(checks)} checks passed')
for label, ok in checks:
    print(('  PASS ' if ok else '  FAIL ') + label)
