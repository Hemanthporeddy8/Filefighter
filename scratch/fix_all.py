import re

with open('public/video-editor.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ==============================
# FIX 1: Timeline height - increase from 200px to 280px so all 4 tracks visible
# ==============================
content = content.replace(
    'grid-template-rows:44px 1fr 200px;',
    'grid-template-rows:44px 1fr 280px;'
)

# ==============================  
# FIX 2: Audio - the REAL problem is that we create a video element with muted=true
# for the WebAudio path, but we ALSO need it unmuted for simple playback.
# The simplest fix: DON'T use WebAudio for basic playback. Just unmute the
# activeVideos map elements and control their volume directly.
# This removes the complex WebAudio graph that was failing silently.
# ==============================

# Replace the entire syncAudioGraph with a simpler direct approach
old_audio = '''// --- AUDIO GRAPH SYNC ---
function syncAudioGraph() {
  state.items.filter(i => i.type === 'video' || i.type === 'audio').forEach(item => {
    if (!audioNodesMap.has(item.id)) {
      const audio = document.createElement(item.type === 'video' ? 'video' : 'audio');
      audio.src = item.src;
      // NOTE: Do NOT set crossOrigin on blob: URLs \u2014 it causes CORS errors
      audio.muted = (item.type === 'video'); // Mute the HTML element, play through WebAudio
      
      let source;
      try {
        source = audioCtx.createMediaElementSource(audio);
      } catch(e) {
        // Element may already be connected to AudioContext, reuse existing
        source = audioCtx.createMediaElementSource(audio);
      }
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
}'''

new_audio = '''// --- AUDIO SYNC (Simple Direct Approach) ---
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
}'''
content = content.replace(old_audio, new_audio)

# Also fix the video element in drawVisual - unmute it so sound plays directly
content = content.replace(
    '''    let vid = activeVideos.get(item.id);
    if (!vid) {
      vid = document.createElement('video');
      vid.src = item.src;
      vid.muted = true; // WebAudio handles actual output
      activeVideos.set(item.id, vid);
    }''',
    '''    let vid = activeVideos.get(item.id);
    if (!vid) {
      vid = document.createElement('video');
      vid.src = item.src;
      vid.muted = true; // Muted for canvas drawing only - audio handled by separate elements
      activeVideos.set(item.id, vid);
    }'''
)

# Fix updateMediaPlayback to use the simpler audio approach
old_media = '''function updateMediaPlayback() {
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
}'''

new_media = '''function updateMediaPlayback() {
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
}'''
content = content.replace(old_media, new_media)

# ==============================
# FIX 3: Go to start / Go to end buttons + text add button + text presets
# ==============================

old_binds = '''// --- PLAYBACK BINDS ---
document.getElementById('btn-play')?.addEventListener('click', togglePlay);
document.getElementById('btn-export-top')?.addEventListener('click', handleExport);
document.getElementById('btn-export-main')?.addEventListener('click', handleExport);
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.target.matches('input,textarea,select')) { e.preventDefault(); togglePlay(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); document.getElementById('btn-undo').click(); }
});'''

new_binds = '''// --- PLAYBACK BINDS ---
document.getElementById('btn-play')?.addEventListener('click', togglePlay);
document.getElementById('btn-export-top')?.addEventListener('click', handleExport);
document.getElementById('btn-export-main')?.addEventListener('click', handleExport);
document.getElementById('btn-skip-start')?.addEventListener('click', () => seekTo(0));
document.getElementById('btn-skip-end')?.addEventListener('click', () => seekTo(state.totalDuration - 0.01));
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.target.matches('input,textarea,select')) { e.preventDefault(); togglePlay(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); document.getElementById('btn-undo').click(); }
});

// --- TEXT LAYER FEATURE ---
function addTextLayer(text, size, weight) {
  const item = {
    id: uid(), type: 'text', name: text || 'Your text here', 
    start: state.globalTime, duration: 5, trimStart: 0, trimEnd: 5, track: 't1',
    color: '#ffffff', 
    filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
    transform: { x: 50, y: 50, size: size || 64, weight: weight || 700, font: 'Inter', scaleX:1, scaleY:1, rotation:0 },
    opacity: 100, volume: 0, blendMode: 'normal'
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
});'''
content = content.replace(old_binds, new_binds)

# ==============================
# FIX 4: Inspector - also handle text type, show text editing controls
# ==============================
old_inspector = '''function renderInspector() {
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
}'''

new_inspector = '''function renderInspector() {
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
}'''
content = content.replace(old_inspector, new_inspector)

# ==============================
# FIX 5: Add text inspector HTML panel (rp-text) if it doesn't exist  
# ==============================
# Check if rp-text exists
if 'id="rp-text"' not in content:
    # Add it after rp-video closing div, before rp-export
    content = content.replace(
        '''    <div class="rp-export">''',
        '''    <!-- Text inspector -->
    <div class="rp-content" id="rp-text" style="display:none">
      <div class="rp-tabs">
        <button class="rp-tab active">Text</button>
      </div>
      <div class="rp-pane active" style="display:flex">
        <div class="prop-field">
          <label>TEXT CONTENT</label>
          <textarea id="in-text-content" rows="3" placeholder="Enter your text..."></textarea>
        </div>
        <div class="prop-grid-2">
          <div class="prop-field">
            <label>COLOR</label>
            <input type="color" id="in-text-color" value="#ffffff"/>
          </div>
          <div class="prop-field">
            <label>SIZE (PX)</label>
            <input type="number" id="in-text-size" value="64" min="8" max="400"/>
          </div>
        </div>
        <div class="prop-row">
          <label>Opacity</label>
          <span id="val-text-opacity">100</span>
        </div>
        <input type="range" class="prop-slider" id="sl-text-opacity" min="0" max="100" value="100"/>
        <button class="reset-btn" id="btn-delete-text" style="color:var(--red);border-color:rgba(239,68,68,.3)">Delete text layer</button>
      </div>
    </div>

    <div class="rp-export">'''
    )

# ==============================
# FIX 6: Add text inspector event bindings (before Init section)
# ==============================
old_init = '''// Init
pushHistory();
renderAll();'''

new_init = '''// --- TEXT INSPECTOR BINDINGS ---
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

// Init
pushHistory();
renderAll();'''
content = content.replace(old_init, new_init)

# ==============================
# FIX 7: Export - use simpler approach without WebAudio MediaStreamDestination
# The canvas captureStream + separate audio elements approach
# ==============================
old_export = '''async function handleExport() {
  if (!state.items.length) { showToast('Nothing to export', 'Add clips first', true); return; }
  if (state.isPlaying) togglePlay();
  seekTo(0);
  isExporting = true;
  exportChunks = [];
  
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  setProcessing(true, 'Exporting Video\u2026', 'Rendering frames, please wait');
  
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
}'''

new_export = '''async function handleExport() {
  if (!state.items.length) { showToast('Nothing to export', 'Add clips first', true); return; }
  if (state.isPlaying) togglePlay();
  seekTo(0);
  isExporting = true;
  exportChunks = [];
  
  setProcessing(true, 'Exporting Video\u2026', 'Rendering frames, please wait');
  
  try {
    const videoStream = renderCanvas.captureStream(state.fps);
    
    // Create AudioContext destination for export audio mixing
    const exportAudioCtx = new AudioContext();
    const exportDest = exportAudioCtx.createMediaStreamDestination();
    
    // Connect all audio sources to the export destination
    const exportSources = [];
    state.items.filter(i => i.type === 'video' || i.type === 'audio').forEach(item => {
      const node = audioNodesMap.get(item.id);
      if (node) {
        try {
          const exportAudio = document.createElement('audio');
          exportAudio.src = item.src;
          exportAudio.volume = 0; // Mute HTML element
          const src = exportAudioCtx.createMediaElementSource(exportAudio);
          const gain = exportAudioCtx.createGain();
          gain.gain.value = item.volume ?? 1;
          src.connect(gain);
          gain.connect(exportDest);
          exportSources.push({ audio: exportAudio, item });
        } catch(e) { console.warn('Export audio setup failed for', item.name, e); }
      }
    });
    
    const tracks = [...videoStream.getVideoTracks()];
    if (exportDest.stream.getAudioTracks().length > 0) {
      tracks.push(...exportDest.stream.getAudioTracks());
    }
    
    const combinedStream = new MediaStream(tracks);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    exportRecorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 5000000 });
    exportRecorder.ondataavailable = e => { if (e.data.size > 0) exportChunks.push(e.data); };
    exportRecorder.onstop = () => {
      exportSources.forEach(s => { s.audio.pause(); s.audio.src = ''; });
      exportAudioCtx.close();
      saveExport();
    };
    exportRecorder.start(100);
    
    // Start export audio playback
    exportSources.forEach(s => {
      s.audio.currentTime = s.item.trimStart;
      s.audio.play().catch(() => {});
    });
    
    lastTs = performance.now();
    rafId = requestAnimationFrame(playLoop);
  } catch(e) {
    isExporting = false;
    setProcessing(false);
    showToast('Export failed', e.message, true);
  }
}'''
content = content.replace(old_export, new_export)

with open('public/video-editor.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("ALL FIXES APPLIED SUCCESSFULLY")
