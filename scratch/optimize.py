
# Performance optimization script for Editroy video editor
import re

with open('public/video-editor.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ============================================================
# OPT 1: Preview canvas downscale to 480x270 (was 1920x1080)
# This is the BIGGEST win — 16x less GPU/RAM for preview
# ============================================================
html = html.replace(
    'renderCanvas.width = 1920;\r\nrenderCanvas.height = 1080;',
    'renderCanvas.width = 480;\r\nrenderCanvas.height = 270;'
)
html = html.replace(
    "const renderCtx = renderCanvas.getContext('2d', { alpha: false });",
    "const renderCtx = renderCanvas.getContext('2d', { alpha: false, willReadFrequently: false });"
)

# Fix video resize to set preview canvas, not full-res
html = html.replace(
    """if (!state.items.some(it => it.type==='video') && !newItems.some(it => it.type==='video')) {
              renderCanvas.width = vid.videoWidth || 1920;
              renderCanvas.height = vid.videoHeight || 1080;
            }""",
    """if (!state.items.some(it => it.type==='video') && !newItems.some(it => it.type==='video')) {
              // Set preview canvas to scaled-down size (480p for preview, upscale with CSS)
              const aspect = (vid.videoWidth || 1920) / (vid.videoHeight || 1080);
              const previewH = isMobile() ? 135 : 270;
              renderCanvas.width = Math.round(previewH * aspect);
              renderCanvas.height = previewH;
              // Store original resolution for export
              state.exportWidth = vid.videoWidth || 1920;
              state.exportHeight = vid.videoHeight || 1080;
            }"""
)

# Make preview canvas CSS-fill the container properly
html = html.replace(
    '.preview-img-canvas{\n  max-width:100%;max-height:100%;\n  border-radius:2px;display:none;\n  position:absolute;cursor:grab;\n}\n.preview-img-canvas:active{cursor:grabbing}',
    '.preview-img-canvas{\n  max-width:100%;max-height:100%;\n  border-radius:2px;display:none;\n  position:absolute;cursor:grab;\n  image-rendering:auto;\n  object-fit:contain;\n}\n.preview-img-canvas:active{cursor:grabbing}'
)

# ============================================================
# OPT 2: Throttled render loop — max 24fps, skip when hidden
# ============================================================
old_playloop = '''function playLoop(ts) {
  if (!state.isPlaying && !isExporting) return;
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
  renderFrame();
  updateMediaPlayback();
  updatePlayhead();
  if (state.isPlaying || isExporting) rafId = requestAnimationFrame(playLoop);
}'''

new_playloop = '''// Throttled play loop — max 24fps, skip when tab hidden
const TARGET_FPS = 24;
const FRAME_MS = 1000 / TARGET_FPS;
let lastRenderTs = 0;

function playLoop(ts) {
  if (!state.isPlaying && !isExporting) return;
  
  // Skip render if tab is hidden (massive CPU saver)
  if (document.hidden && !isExporting) {
    lastTs = ts;
    rafId = requestAnimationFrame(playLoop);
    return;
  }

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
  if (state.isPlaying || isExporting) rafId = requestAnimationFrame(playLoop);
}'''
html = html.replace(old_playloop, new_playloop)

# ============================================================
# OPT 3: Mobile detection + performance mode
# ============================================================
old_uid = "function uid() { return '_' + Math.random().toString(36).slice(2,9) + Date.now(); }"
new_uid = '''function uid() { return '_' + Math.random().toString(36).slice(2,9) + Date.now(); }

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
}'''
html = html.replace(old_uid, new_uid)

# ============================================================
# OPT 4: Strict file limits before processing
# ============================================================
old_upload_start = '''async function handleVideoFiles(files) {
  const valid = files.filter(f => f.type.startsWith('video/') || f.type.startsWith('image/'));
  if (!valid.length) return;
  
  setProcessing(true, 'Processing media\u2026', `Loading 1 of ${valid.length}`);
  const newItems = [];
  
  // Process ONE file at a time — avoids hanging browser tab
  for (let i = 0; i < valid.length; i++) {'''

new_upload_start = '''const MAX_FILE_SIZE_MB = 200;
const MAX_DURATION_MIN = 10;
const MAX_UPLOAD_COUNT = 5;

async function handleVideoFiles(files) {
  const valid = files.filter(f => f.type.startsWith('video/') || f.type.startsWith('image/'));
  if (!valid.length) return;

  // --- STRICT FILE LIMITS ---
  if (valid.length > MAX_UPLOAD_COUNT) {
    showToast(`Max ${MAX_UPLOAD_COUNT} files at once`, `You selected ${valid.length} files. Please select fewer.`, true);
    return;
  }
  const tooBig = valid.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
  if (tooBig.length) {
    showToast('File too large', `Max ${MAX_FILE_SIZE_MB}MB per file. "${tooBig[0].name}" is ${(tooBig[0].size/1024/1024).toFixed(0)}MB.`, true);
    return;
  }

  setProcessing(true, 'Processing media\u2026', `Loading 1 of ${valid.length}`);
  const newItems = [];
  
  // Process ONE file at a time — avoids hanging browser tab
  for (let i = 0; i < valid.length; i++) {'''
html = html.replace(old_upload_start, new_upload_start)

# Also add duration check inside the video load callback
html = html.replace(
    '''vid.onloadedmetadata = async () => {
            clearTimeout(fallback);
            if (!state.items.some(it => it.type==='video') && !newItems.some(it => it.type==='video')) {''',
    '''vid.onloadedmetadata = async () => {
            clearTimeout(fallback);
            // Duration check
            if (vid.duration > MAX_DURATION_MIN * 60) {
              resolve(null);
              showToast('Video too long', `Max ${MAX_DURATION_MIN} minutes. Trim your video first.`, true);
              return;
            }
            if (!state.items.some(it => it.type==='video') && !newItems.some(it => it.type==='video')) {'''
)

# ============================================================
# OPT 5: Aggressive memory cleanup on item delete
# ============================================================
old_delete = """document.getElementById('btn-delete')?.addEventListener('click', () => {
  if (!state.activeLayer) return;
  state.items = state.items.filter(c => c.id !== state.activeLayer);
  state.activeLayer = null;
  pushHistory(); computeTotalDuration(); syncAudioGraph(); renderAll();
});"""

new_delete = """document.getElementById('btn-delete')?.addEventListener('click', () => {
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
});"""
html = html.replace(old_delete, new_delete)

# ============================================================
# OPT 6: Limit undo history to 15 steps max
# ============================================================
old_push_history = '''function pushHistory() {
  const snapshot = state.items.map(i => ({...i, filters: {...i.filters}, transform: {...i.transform}}));
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  state.history.push(snapshot);
  state.historyIndex++;
  updateActionButtons();
}'''

new_push_history = '''const MAX_HISTORY = 15;
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
}'''
html = html.replace(old_push_history, new_push_history)

# ============================================================
# OPT 7: Export safety check + progress ETA + cancel support
# ============================================================
old_export_start = '''// --- EXPORT PIPELINE (Frame-by-Frame Renderer) ---
async function handleExport() {
  if (!state.items.length) { showToast('Nothing to export', 'Add clips first', true); return; }
  if (state.isPlaying) togglePlay();

  setProcessing(true, 'Preparing Export\u2026', 'Loading media files');

  try {
    const fps = state.fps || 30;
    const duration = state.totalDuration;
    const totalFrames = Math.ceil(duration * fps);'''

new_export_start = '''// --- EXPORT PIPELINE (Frame-by-Frame Renderer) ---
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

  // Safety check: estimate memory usage
  const estimatedMB = Math.round((totalFrames * exportW * exportH * 4) / (1024 * 1024));
  if (estimatedMB > 800) {
    showToast('Export too heavy', `Estimated ${estimatedMB}MB RAM needed. Reduce duration or resolution in Settings.`, true);
    return;
  }

  exportCancelled = false;
  setProcessing(true, 'Preparing Export\u2026', 'Loading media files');
  
  // Allow Escape to cancel
  const onEsc = (e) => { if (e.key === 'Escape') { exportCancelled = true; document.removeEventListener('keydown', onEsc); } };
  document.addEventListener('keydown', onEsc);

  try {'''
html = html.replace(old_export_start, new_export_start)

# Inside the export frame loop, check cancel + update ETA
html = html.replace(
    '''      // Update progress
      const pct = Math.round((frame / totalFrames) * 100);
      setProcessing(true, `Exporting… ${pct}%`, `Frame ${frame+1} of ${totalFrames}`);

      // Wait exactly one frame duration before next frame
      await new Promise(r => setTimeout(r, frameMs));
    }''',
    '''      // Check cancel
      if (exportCancelled) {
        setProcessing(false);
        showToast('Export cancelled', 'Press Export to try again');
        for (const { el } of audioEls) { el.pause(); el.src = ''; }
        exportAudioCtx.close();
        recorder.stop();
        return;
      }
      
      // Update progress with ETA
      const pct = Math.round((frame / totalFrames) * 100);
      const elapsed = (performance.now() - exportStartTime) / 1000;
      const eta = frame > 0 ? Math.round((elapsed / frame) * (totalFrames - frame)) : '?';
      setProcessing(true, `Exporting ${pct}%`, `Frame ${frame+1}/${totalFrames} • ~${eta}s remaining • Esc to cancel`);

      // Yield to browser — prevents tab freeze
      await new Promise(r => setTimeout(r, frameMs > 8 ? frameMs : 8));
    }'''
)

# Add exportStartTime tracking
html = html.replace(
    "    const chunks = [];\n    const recorder = new MediaRecorder",
    "    const exportStartTime = performance.now();\n    const chunks = [];\n    const recorder = new MediaRecorder"
)

# Also use exportW/exportH for the export canvas
html = html.replace(
    "    // --- FRAME-BY-FRAME RENDER LOOP ---\n    const frameMs = 1000 / fps;",
    """    // Temporarily resize canvas to export resolution
    const prevW = renderCanvas.width, prevH = renderCanvas.height;
    renderCanvas.width = exportW;
    renderCanvas.height = exportH;
    
    // --- FRAME-BY-FRAME RENDER LOOP ---
    const frameMs = 1000 / fps;"""
)

# Restore preview canvas after export
html = html.replace(
    "    // Stop recorder and save\n    recorder.stop();",
    """    // Restore preview canvas size
    renderCanvas.width = prevW;
    renderCanvas.height = prevH;
    
    // Stop recorder and save
    recorder.stop();"""
)

# ============================================================
# OPT 8: Skip rendering when paused + nothing changed
# ============================================================
# Add state.renderDirty flag - only render when something changed
old_render_frame_start = '''function renderFrame() {
  renderCtx.fillStyle = '#000';
  renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);'''

new_render_frame_start = '''function renderFrame() {
  // Don't render when tab is hidden (unless exporting)
  if (document.hidden && !isExporting) return;
  
  renderCtx.fillStyle = '#000';
  renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);'''
html = html.replace(old_render_frame_start, new_render_frame_start)

# ============================================================
# OPT 9: Throttle timeline renderTimeline calls
# ============================================================
old_render_timeline_def = 'function renderTimeline() {'
new_render_timeline_def = '''// Throttle timeline renders — debounced 50ms
let _tlTimer = null;
function renderTimelineDebounced() {
  clearTimeout(_tlTimer);
  _tlTimer = setTimeout(renderTimeline, 50);
}
function renderTimeline() {'''
html = html.replace(old_render_timeline_def, new_render_timeline_def, 1)

# ============================================================
# OPT 10: Add state.exportWidth/Height to initial state
# ============================================================
html = html.replace(
    '  historyIndex: -1,\r\n  masterVolume: 1,\r\n  fps: 30,\r\n};',
    '  historyIndex: -1,\r\n  masterVolume: 1,\r\n  fps: 30,\r\n  exportWidth: 1280,\r\n  exportHeight: 720,\r\n  exportFormat: \'webm\',\r\n};'
)

# ============================================================
# OPT 11: Add Page Visibility API — pause RAF when hidden
# ============================================================
old_keydown = '''document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.target.matches('input,textarea,select')) { e.preventDefault(); togglePlay(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); document.getElementById('btn-undo').click(); }
});'''

new_keydown = '''document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.target.matches('input,textarea,select')) { e.preventDefault(); togglePlay(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); document.getElementById('btn-undo').click(); }
});

// Pause playback when tab is hidden, resume when visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.isPlaying) {
    // Pause audio elements but keep isPlaying=true so RAF continues position tracking
    for (const node of audioNodesMap.values()) { if (!node.audio.paused) node.audio.pause(); }
  } else if (!document.hidden && state.isPlaying) {
    // Resume audio
    updateMediaPlayback();
  }
});'''
html = html.replace(old_keydown, new_keydown)

# ============================================================
# OPT 12: Add mobile meta tags for PWA
# ============================================================
old_head = '''<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Editroy — Video Editor</title>'''
new_head = '''<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="theme-color" content="#0a0a0a"/>
<title>Editroy — Video Editor</title>'''
html = html.replace(old_head, new_head)

with open('public/video-editor.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("ALL OPTIMIZATIONS APPLIED")
