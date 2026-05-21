import re

with open('public/video-editor.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ==============================
# FIX 1: Images default to 30% scale (small overlay, not full canvas)
# ==============================
content = content.replace(
    """resolve({ id: uid(), type: 'image', name: file.name, file, src, thumbnail: src, 
          start: getNextStartTime('v2'), duration: 5, trimStart: 0, trimEnd: 5, track: 'v2',
          filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
          transform: {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, blendMode:'normal', opacity:100, volume: 1 });""",
    """resolve({ id: uid(), type: 'image', name: file.name, file, src, thumbnail: src, 
          start: getNextStartTime('v2'), duration: 5, trimStart: 0, trimEnd: 5, track: 'v2',
          filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
          transform: {x:0,y:0,scaleX:0.3,scaleY:0.3,rotation:0}, blendMode:'normal', opacity:100, volume: 1,
          transition: {fadeIn: 0.5, fadeOut: 0.5} });"""
)

# Also add transition field to video items
content = content.replace(
    """filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
            trim: {start:0, end:vid.duration}, transform: {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, blendMode:'normal', opacity:100, volume: 1 });""",
    """filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
            trim: {start:0, end:vid.duration}, transform: {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, blendMode:'normal', opacity:100, volume: 1,
            transition: {fadeIn: 0, fadeOut: 0} });"""
)

# ==============================
# FIX 2: drawVisual - apply transition fade and handle image scaling properly
# ==============================
old_draw = """function drawVisual(item, localTime) {
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
      vid.muted = true; // Muted for canvas drawing only - audio handled by separate elements
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
}"""

new_draw = """function drawVisual(item, localTime) {
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
}"""
content = content.replace(old_draw, new_draw)

# ==============================
# FIX 3: Update Transform panel HTML to add Transition fields
# ==============================
old_transform_pane = """      <div class="rp-pane" id="pane-transform">
        <div class="prop-grid-2">
          <div class="prop-field"><label>Position X</label><input type="number" id="in-pos-x" value="0"/></div>
          <div class="prop-field"><label>Position Y</label><input type="number" id="in-pos-y" value="0"/></div>
          <div class="prop-field"><label>Scale X</label><input type="number" id="in-scale-x" value="1" step="0.1"/></div>
          <div class="prop-field"><label>Scale Y</label><input type="number" id="in-scale-y" value="1" step="0.1"/></div>
          <div class="prop-field prop-field--full"><label>Rotation (deg)</label><input type="number" id="in-rotation" value="0"/></div>
        </div>
      </div>"""

new_transform_pane = """      <div class="rp-pane" id="pane-transform">
        <div class="prop-grid-2">
          <div class="prop-field"><label>Position X</label><input type="number" id="in-pos-x" value="0"/></div>
          <div class="prop-field"><label>Position Y</label><input type="number" id="in-pos-y" value="0"/></div>
          <div class="prop-field"><label>Scale X</label><input type="number" id="in-scale-x" value="1" step="0.05" min="0.05" max="5"/></div>
          <div class="prop-field"><label>Scale Y</label><input type="number" id="in-scale-y" value="1" step="0.05" min="0.05" max="5"/></div>
          <div class="prop-field prop-field--full"><label>Rotation (deg)</label><input type="number" id="in-rotation" value="0"/></div>
        </div>
        <div class="section-label" style="margin-top:8px;margin-bottom:4px">TRANSITIONS</div>
        <div class="prop-grid-2">
          <div class="prop-field"><label>Fade In (sec)</label><input type="number" id="in-fade-in" value="0" step="0.1" min="0" max="5"/></div>
          <div class="prop-field"><label>Fade Out (sec)</label><input type="number" id="in-fade-out" value="0" step="0.1" min="0" max="5"/></div>
        </div>
        <button class="reset-btn" id="btn-reset-transform">\u21ba Reset transform</button>
      </div>"""
content = content.replace(old_transform_pane, new_transform_pane)

# ==============================
# FIX 4: renderInspector - populate Transform & Blend values for selected item
# ==============================
# Find the line that sets trim values and add transform/blend population after it
old_trim_lines = """    const ts = document.getElementById('in-trim-start'); if(ts) ts.value = item.trimStart.toFixed(2);
    const te = document.getElementById('in-trim-end'); if(te) te.value = item.trimEnd.toFixed(2);"""

new_trim_lines = """    const ts = document.getElementById('in-trim-start'); if(ts) ts.value = item.trimStart.toFixed(2);
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
    const bl = document.getElementById('sel-blend'); if(bl) bl.value = item.blendMode || 'normal';"""
content = content.replace(old_trim_lines, new_trim_lines)

# ==============================
# FIX 5: Add Transform/Blend/Transition input event bindings
# ==============================
# Add before the "// --- TEXT INSPECTOR BINDINGS ---" section
old_text_bindings = "// --- TEXT INSPECTOR BINDINGS ---"
new_text_bindings = """// --- TRANSFORM INPUT BINDINGS ---
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

// --- TEXT INSPECTOR BINDINGS ---"""
content = content.replace(old_text_bindings, new_text_bindings)

with open('public/video-editor.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("ALL FIXES APPLIED SUCCESSFULLY")
