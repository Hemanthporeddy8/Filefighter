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
renderCanvas.width = 1920;
renderCanvas.height = 1080;
const renderCtx = renderCanvas.getContext('2d', { alpha: false });

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
function pushHistory() {
  const snapshot = state.items.map(i => ({...i, filters: {...i.filters}, transform: {...i.transform}}));
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  state.history.push(snapshot);
  state.historyIndex++;
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

// --- AUDIO GRAPH SYNC ---
function syncAudioGraph() {
  state.items.filter(i => i.type === 'video' || i.type === 'audio').forEach(item => {
    if (!audioNodesMap.has(item.id)) {
      const audio = document.createElement(item.type === 'video' ? 'video' : 'audio');
      audio.src = item.src;
      audio.crossOrigin = "anonymous";
      audio.muted = (item.type === 'video'); // Mute the HTML element, play through WebAudio
      
      const source = audioCtx.createMediaElementSource(audio);
      const gain = audioCtx.createGain();
      source.connect(gain);
      gain.connect(masterGain);
      audioNodesMap.set(item.id, { audio, source, gain });
    }
    const node = audioNodesMap.get(item.id);
    node.gain.gain.value = item.volume ?? 1;
  });
  
  // Clean up removed
  for (const [id, node] of audioNodesMap.entries()) {
    if (!state.items.find(i => i.id === id)) {
      node.audio.pause();
      node.gain.disconnect();
      audioNodesMap.delete(id);
    }
  }
  masterGain.gain.value = state.masterVolume;
}

// --- RENDER PIPELINE ---
function playLoop(ts) {
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
}

function renderFrame() {
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
      renderCtx.font = `${item.transform.weight || 600} ${item.transform.size || 64}px ${item.transform.font || 'Inter'}`;
      renderCtx.fillStyle = item.color || '#fff';
      renderCtx.globalAlpha = (item.opacity ?? 100) / 100;
      renderCtx.textAlign = 'center';
      renderCtx.textBaseline = 'middle';
      const x = (item.transform.x / 100) * renderCanvas.width;
      const y = (item.transform.y / 100) * renderCanvas.height;
      renderCtx.fillText(item.name, x, y);
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
  
  renderCtx.translate(cx + (item.transform.x || 0), cy + (item.transform.y || 0));
  renderCtx.scale(item.transform.scaleX || 1, item.transform.scaleY || 1);
  renderCtx.rotate((item.transform.rotation || 0) * Math.PI / 180);
  renderCtx.globalAlpha = (item.opacity ?? 100) / 100;
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
      vid.muted = true; // WebAudio handles actual output
      activeVideos.set(item.id, vid);
    }
    // Sync logic
    if (Math.abs(vid.currentTime - localTime) > 0.1) vid.currentTime = localTime;
    if (state.isPlaying && vid.paused) vid.play().catch(()=>{});
    
    if (vid.videoWidth) {
      const scale = Math.min(renderCanvas.width / vid.videoWidth, renderCanvas.height / vid.videoHeight) || 1;
      const w = vid.videoWidth * scale;
      const h = vid.videoHeight * scale;
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
      const scale = Math.min(renderCanvas.width / img.naturalWidth, renderCanvas.height / img.naturalHeight) || 1;
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      renderCtx.drawImage(img, -w/2, -h/2, w, h);
    }
  }
  renderCtx.restore();
}

function updateMediaPlayback() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  state.items.filter(i => i.type === 'video' || i.type === 'audio').forEach(item => {
    const node = audioNodesMap.get(item.id);
    if (!node) return;
    
    const isActive = state.globalTime >= item.start && state.globalTime < (item.start + item.duration);
    if (isActive && state.isPlaying) {
      const targetTime = item.trimStart + (state.globalTime - item.start);
      if (Math.abs(node.audio.currentTime - targetTime) > 0.2) node.audio.currentTime = targetTime;
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

// --- EXPORT PIPELINE ---
async function handleExport() {
  if (!state.items.length) { showToast('Nothing to export', 'Add clips first', true); return; }
  if (state.isPlaying) togglePlay();
  seekTo(0);
  isExporting = true;
  exportChunks = [];
  
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  setProcessing(true, 'Exporting Video…', 'Rendering frames, please wait');
  
  try {
    const videoStream = renderCanvas.captureStream(state.fps);
    const audioStream = mediaDest.stream;
    
    // Check if audio tracks exist
    const tracks = [...videoStream.getVideoTracks()];
    if (audioStream.getAudioTracks().length > 0) {
        tracks.push(...audioStream.getAudioTracks());
    }
    
    const combinedStream = new MediaStream(tracks);
    exportRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 5000000 });
    exportRecorder.ondataavailable = e => { if (e.data.size > 0) exportChunks.push(e.data); };
    exportRecorder.onstop = saveExport;
    exportRecorder.start(100);
    lastTs = performance.now();
    rafId = requestAnimationFrame(playLoop);
  } catch(e) {
    isExporting = false;
    setProcessing(false);
    showToast('Export failed', e.message, true);
  }
}
function finishExport() {
  isExporting = false;
  if (exportRecorder && exportRecorder.state !== 'inactive') exportRecorder.stop();
}
function saveExport() {
  const blob = new Blob(exportChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `filefighter-export-${Date.now()}.webm`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setProcessing(false);
  showToast('Export complete', 'Downloaded as WebM');
  state.globalTime = 0;
  seekTo(0);
}

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
    vid.onseeked = () => {
      c.width = 160; c.height = 90;
      c.getContext('2d').drawImage(vid, 0, 0, 160, 90);
      resolve(c.toDataURL('image/jpeg', 0.7));
      vid.onseeked = null;
    };
    vid.currentTime = 0.5;
  });
}

function getNextStartTime(trackId) {
  const trackItems = state.items.filter(i => i.track === trackId);
  if (!trackItems.length) return 0;
  return Math.max(...trackItems.map(i => i.start + i.duration));
}

async function handleVideoFiles(files) {
  setProcessing(true, 'Processing media…', 'Generating thumbnails');
  const valid = files.filter(f => f.type.startsWith('video/') || f.type.startsWith('image/'));
  if (!valid.length) { setProcessing(false); return; }
  
  try {
    const newItems = await Promise.all(valid.map(file => new Promise(resolve => {
      const src = URL.createObjectURL(file);
      if (file.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.src = src;
        vid.onloadedmetadata = async () => {
          if (!state.items.some(i => i.type === 'video')) {
            renderCanvas.width = vid.videoWidth || 1920;
            renderCanvas.height = vid.videoHeight || 1080;
          }
          const thumb = await generateThumbnail(vid);
          resolve({ id: uid(), type: 'video', name: file.name, file, src, thumbnail: thumb, 
            start: getNextStartTime('v1'), duration: vid.duration, trimStart: 0, trimEnd: vid.duration, track: 'v1',
            filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
            transform: {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, blendMode:'normal', opacity:100, volume: 1 });
        };
      } else {
        resolve({ id: uid(), type: 'image', name: file.name, file, src, thumbnail: src, 
          start: getNextStartTime('v2'), duration: 5, trimStart: 0, trimEnd: 5, track: 'v2',
          filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
          transform: {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, blendMode:'normal', opacity:100, volume: 1 });
      }
    })));
    state.items.push(...newItems);
    pushHistory();
    computeTotalDuration();
    if (!state.activeLayer) state.activeLayer = newItems[0].id;
    syncAudioGraph();
    renderAll();
    showToast('Media added', newItems.length + ' file(s) added');
  } catch(e) { showToast('Error', e.message, true); }
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

function renderTimeline() {
  // Ensure tracks exist in DOM
  const tracksInner = document.getElementById('tracks-inner');
  if (tracksInner.children.length < 3) {
      tracksInner.innerHTML = `
        <div class="tl-track" id="track-v2" data-track="v2">
            <div class="tl-track-label">V2 (Images)</div>
        </div>
        <div class="tl-track" id="track-v1" data-track="v1">
            <div class="tl-track-label">V1 (Video)</div>
        </div>
        <div class="tl-track" id="track-t1" data-track="t1">
            <div class="tl-track-label">T1 (Text)</div>
        </div>
        <div class="tl-track" id="track-a1" data-track="a1">
            <div class="tl-track-label">A1 (Audio)</div>
        </div>
      `;
  }
  
  ['v1', 'v2', 't1', 'a1'].forEach(trackId => {
      const track = document.getElementById('track-' + trackId);
      if(!track) return;
      track.querySelectorAll('.tl-clip, .tl-audio-block').forEach(e => e.remove());
      
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
            if(e.target.dataset.action) handleDrag(e, item.id, e.target.dataset.action);
            else handleDrag(e, item.id, 'move'); 
          });
          track.appendChild(el);
      });
  });
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
  if (!item) return;
  
  if(empty) empty.style.display = 'none';
  if (item.type === 'video' || item.type === 'image') {
    if(videoPane) videoPane.style.display = 'flex';
    if(textPane) textPane.style.display = 'none';
    
    setSlider('sl-brightness', 'val-brightness', item.filters.brightness);
    setSlider('sl-contrast', 'val-contrast', item.filters.contrast);
    setSlider('sl-saturation', 'val-saturation', item.filters.saturate);
    setSlider('sl-grayscale', 'val-grayscale', item.filters.grayscale);
    setSlider('sl-opacity', 'val-opacity', item.opacity ?? 100);
    setSlider('sl-vol', 'val-vol', (item.volume || 0) * 100);
    
    // Disable volume if image
    document.getElementById('sl-vol').disabled = (item.type === 'image');
    
    const ts = document.getElementById('in-trim-start'); if(ts) ts.value = item.trimStart.toFixed(2);
    const te = document.getElementById('in-trim-end'); if(te) te.value = item.trimEnd.toFixed(2);
  } else if (item.type === 'audio') {
    if(videoPane) videoPane.style.display = 'flex';
    if(textPane) textPane.style.display = 'none';
    setSlider('sl-vol', 'val-vol', (item.volume || 1) * 100);
    document.getElementById('sl-vol').disabled = false;
    document.querySelector('.rp-tab[data-pane="adjust"]').click();
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
  state.items = state.items.filter(c => c.id !== state.activeLayer);
  state.activeLayer = null;
  pushHistory(); computeTotalDuration(); syncAudioGraph(); renderAll();
});
document.getElementById('btn-split')?.addEventListener('click', () => {
  if (!state.items.length) return;
  const activeItems = state.items.filter(i => state.globalTime >= i.start && state.globalTime < i.start + i.duration);
  if (!activeItems.length) return;
  
  // Split all active items at playhead
  activeItems.forEach(item => {
      const splitTimeLocal = item.trimStart + (state.globalTime - item.start);
      if (splitTimeLocal <= item.trimStart + 0.1 || splitTimeLocal >= item.trimEnd - 0.1) return;
      
      const idx = state.items.indexOf(item);
      const a = { ...item, id: uid(), trimEnd: splitTimeLocal, duration: state.globalTime - item.start };
      const b = { ...item, id: uid(), start: state.globalTime, trimStart: splitTimeLocal, duration: item.trimEnd - splitTimeLocal };
      state.items.splice(idx, 1, a, b);
  });
  pushHistory(); computeTotalDuration(); renderAll();
});

// --- PLAYBACK BINDS ---
document.getElementById('btn-play')?.addEventListener('click', togglePlay);
document.getElementById('btn-export-top')?.addEventListener('click', handleExport);
document.getElementById('btn-export-main')?.addEventListener('click', handleExport);
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.target.matches('input,textarea,select')) { e.preventDefault(); togglePlay(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); document.getElementById('btn-undo').click(); }
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

// Init
pushHistory();
renderAll();
