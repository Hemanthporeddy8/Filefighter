
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
};

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
}

function renderFrame() {
  // Don't render when tab is hidden (unless exporting)
  if (document.hidden && !isExporting) return;
  
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
  for (const vid of activeVideos.values()) vid.pause();
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

  // Safety check: estimate memory usage
  const estimatedMB = Math.round((totalFrames * exportW * exportH * 4) / (1024 * 1024));
  if (estimatedMB > 800) {
    showToast('Export too heavy', `Estimated ${estimatedMB}MB RAM needed. Reduce duration or resolution in Settings.`, true);
    return;
  }

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
    const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 8000000 });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start();

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
    const frameMs = 1000 / fps;
    
    for (let frame = 0; frame < totalFrames; frame++) {
      const t = frame / fps;
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
      renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);

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
      const pct = Math.round((frame / totalFrames) * 100);
      const elapsed = (performance.now() - exportStartTime) / 1000;
      const eta = frame > 0 ? Math.round((elapsed / frame) * (totalFrames - frame)) : '?';
      setProcessing(true, `Exporting ${pct}%`, `Frame ${frame+1}/${totalFrames} • ~${eta}s remaining • Esc to cancel`);

      // Yield to browser — prevents tab freeze
      await new Promise(r => setTimeout(r, frameMs > 8 ? frameMs : 8));
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
}

function getNextStartTime(trackId) {
  const trackItems = state.items.filter(i => i.track === trackId);
  if (!trackItems.length) return 0;
  return Math.max(...trackItems.map(i => i.start + i.duration));
}

const MAX_FILE_SIZE_MB = 200;
const MAX_DURATION_MIN = 10;
const MAX_UPLOAD_COUNT = 5;

async function handleVideoFiles(files) {
  const valid = files.filter(f => f.type.startsWith('video/') || f.type.startsWith('image/'));
  if (!valid.length) return;

  // --- STRICT FILE LIMITS (checked before any heavy processing) ---
  if (valid.length > MAX_UPLOAD_COUNT) {
    showToast(`Max ${MAX_UPLOAD_COUNT} files at once`, `You tried ${valid.length} files. Select fewer.`, true);
    return;
  }
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
        const src = URL.createObjectURL(file);
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
            // Duration check
            if (vid.duration > MAX_DURATION_MIN * 60) {
              resolve(null);
              showToast('Video too long', `Max ${MAX_DURATION_MIN} minutes. Trim your video first.`, true);
              return;
            }
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
  ['v1', 'v2', 't1', 'a1'].forEach(trackId => {
      const track = document.getElementById('track-' + trackId);
      if(!track) return;
      // Remove only clip elements, preserve the track-empty placeholder
      track.querySelectorAll('.tl-clip, .tl-audio-block').forEach(e => e.remove());
      const hasItems = state.items.filter(i => i.track === trackId).length > 0;
      const emptyEl = track.querySelector('.track-empty');
      if(emptyEl) emptyEl.style.display = hasItems ? 'none' : 'flex';
      
      state.items.filter(i => i.track === trackId).forEach(item => {
          const left = (item.start / state.totalDuration) * 100;
          const width = (item.duration / state.totalDuration) * 100;
          const el = document.createElement('div');
          
          if (trackId === 'a1') {
              el.className = 'tl-audio-block' + (state.activeLayer === item.id ? ' selected' : '');
              el.innerHTML = `<span class="tl-audio-name">${item.name}</span>
                              <div class="tl-trim-left" data-action="trim-start"></div>
                              <div class="tl-trim-right" data-action="trim-end"></div>`;
          } else {
              el.className = 'tl-clip' + (state.activeLayer === item.id ? ' selected' : '');
              el.innerHTML = `
                ${item.thumbnail ? `<div class="tl-clip-filmstrip"><img class="tl-clip-frame" src="${item.thumbnail}" draggable="false"/></div>` : ''}
                <div class="tl-clip-name">${item.name}</div>
                <div class="tl-trim-left" data-action="trim-start"></div>
                <div class="tl-trim-right" data-action="trim-end"></div>
              `;
          }
          el.dataset.id = item.id;
          el.style.left = left + '%';
          el.style.width = Math.max(width, 1) + '%';
          
          el.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            if(e.target.dataset.action) handleDrag(e, item.id, e.target.dataset.action);
            else handleDrag(e, item.id, 'move'); 
          });
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
  const pct = state.totalDuration > 0 ? (state.globalTime / state.totalDuration) * 100 : 0;
  const p = document.getElementById('playhead');
  if(p) p.style.left = pct + '%';
  updateTimecode();
}

document.getElementById('tracks-scroll')?.addEventListener('mousedown', e => {
  if (e.target.closest('.tl-trim-left') || e.target.closest('.tl-trim-right') || e.target.closest('.tl-clip') || e.target.closest('.tl-audio-block')) return;
  const inner = document.getElementById('tracks-inner');
  const rect = inner.getBoundingClientRect();
  const x = e.clientX - rect.left; 
  const pct = Math.max(0, Math.min(1, x / rect.width));
  seekTo(pct * state.totalDuration);
});

// --- ABSOLUTE POSITIONING DRAG LOGIC ---
let dragState = null;
function handleDrag(e, itemId, action) {
  e.stopPropagation();
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  selectLayer(itemId);
  
  dragState = { 
      type: action, 
      item, 
      startX: e.clientX, 
      startStart: item.start, 
      startDuration: item.duration,
      startTrimStart: item.trimStart, 
      startTrimEnd: item.trimEnd, 
      trackWidth: document.getElementById('tracks-inner').getBoundingClientRect().width 
  };
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}
function onDragMove(e) {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dt = (dx / dragState.trackWidth) * state.totalDuration;
  const item = dragState.item;
  
  if (dragState.type === 'move') {
      item.start = Math.max(0, dragState.startStart + dt);
  } else if (dragState.type === 'trim-start') {
      // Dragging left handle: change start time and duration, update trimStart
      const shift = Math.min(dt, dragState.startDuration - 0.1); // Prevent 0 duration
      item.start = Math.max(0, dragState.startStart + shift);
      item.duration = dragState.startDuration - (item.start - dragState.startStart);
      item.trimStart = dragState.startTrimStart + (item.start - dragState.startStart);
  } else if (dragState.type === 'trim-end') {
      // Dragging right handle: change duration, update trimEnd
      item.duration = Math.max(0.1, dragState.startDuration + dt);
      item.trimEnd = dragState.startTrimStart + item.duration;
  }
  
  computeTotalDuration();
  renderTimeline();
  renderInspector();
  renderFrame();
}
function onDragEnd() {
  if (dragState) {
    pushHistory();
    dragState = null;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }
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
  if (document.hidden && state.isPlaying) {
    // Pause audio elements but keep isPlaying=true so RAF continues position tracking
    for (const node of audioNodesMap.values()) { if (!node.audio.paused) node.audio.pause(); }
  } else if (!document.hidden && state.isPlaying) {
    // Resume audio
    updateMediaPlayback();
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
  if(!ruler) return;
  ruler.innerHTML = '';
  const trackContent = document.getElementById('tracks-inner');
  const width = trackContent ? trackContent.offsetWidth : 600;
  const interval = Math.max(1, Math.ceil(state.totalDuration / (width / 80)));
  for (let t = 0; t <= state.totalDuration; t += interval) {
    const pct = (t / state.totalDuration) * 100;
    const label = document.createElement('span');
    label.className = 'ruler-label';
    label.style.left = pct + '%';
    label.textContent = formatTime(t);
    ruler.appendChild(label);
  }
}

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

