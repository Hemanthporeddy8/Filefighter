with open('public/video-editor.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ==============================
# FIX 1: SPLIT - only split SELECTED item, not all. Fix audio after split.
# ==============================
old_split = """document.getElementById('btn-split')?.addEventListener('click', () => {
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
});"""

new_split = """document.getElementById('btn-split')?.addEventListener('click', () => {
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
});"""
content = content.replace(old_split, new_split)

# ==============================
# FIX 2: Text rendering - use pixel coordinates like images, not percentage
# ==============================
old_text_render = """    } else if (item.type === 'text') {
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
    }"""

new_text_render = """    } else if (item.type === 'text') {
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
    }"""
content = content.replace(old_text_render, new_text_render)

# ==============================
# FIX 3: Text default transform - use pixel coords (0,0 = center), add transition
# ==============================
old_text_add = """  const item = {
    id: uid(), type: 'text', name: text || 'Your text here', 
    start: state.globalTime, duration: 5, trimStart: 0, trimEnd: 5, track: 't1',
    color: '#ffffff', 
    filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
    transform: { x: 50, y: 50, size: size || 64, weight: weight || 700, font: 'Inter', scaleX:1, scaleY:1, rotation:0 },
    opacity: 100, volume: 0, blendMode: 'normal'
  };"""

new_text_add = """  const item = {
    id: uid(), type: 'text', name: text || 'Your text here', 
    start: state.globalTime, duration: 5, trimStart: 0, trimEnd: 5, track: 't1',
    color: '#ffffff', 
    filters: {brightness:100,contrast:100,saturate:100,grayscale:0,sepia:0,blur:0},
    transform: { x: 0, y: 0, size: size || 64, weight: weight || 700, font: 'Inter', scaleX:1, scaleY:1, rotation:0 },
    opacity: 100, volume: 0, blendMode: 'normal',
    transition: { fadeIn: 0.3, fadeOut: 0.3 }
  };"""
content = content.replace(old_text_add, new_text_add)

# ==============================
# FIX 4: Add preview zoom CSS + HTML 
# ==============================
# Add zoom controls to preview area
old_preview_html = """  <!-- ══════════════ PREVIEW ══════════════ -->
  <main class="preview-area" id="preview-area">
    <div class="preview-canvas" id="preview-canvas">"""

new_preview_html = """  <!-- ══════════════ PREVIEW ══════════════ -->
  <main class="preview-area" id="preview-area">
    <div class="preview-zoom-bar">
      <button class="pz-btn" id="pz-out" title="Zoom out">−</button>
      <input type="range" class="pz-slider" id="pz-slider" min="20" max="200" value="100"/>
      <button class="pz-btn" id="pz-in" title="Zoom in">+</button>
      <span class="pz-val" id="pz-val">100%</span>
      <button class="pz-btn" id="pz-fit" title="Fit to view">Fit</button>
    </div>
    <div class="preview-canvas" id="preview-canvas">"""
content = content.replace(old_preview_html, new_preview_html)

# Add zoom bar CSS
old_preview_css = """.preview-area{
  grid-area:preview;
  background:var(--bg0);
  display:flex;align-items:center;justify-content:center;
  position:relative;overflow:hidden;
}"""

new_preview_css = """.preview-area{
  grid-area:preview;
  background:var(--bg0);
  display:flex;align-items:center;justify-content:center;
  position:relative;overflow:hidden;
  flex-direction:column;
}
.preview-zoom-bar{
  position:absolute;bottom:8px;left:50%;transform:translateX(-50%);z-index:20;
  display:flex;align-items:center;gap:4px;
  background:rgba(17,17,17,.85);border:1px solid var(--border);border-radius:8px;padding:3px 8px;
  backdrop-filter:blur(6px);
}
.pz-btn{
  width:24px;height:24px;border-radius:5px;border:none;background:none;
  color:var(--text2);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;
  font-family:inherit;transition:all .1s;
}
.pz-btn:hover{background:var(--bg3);color:var(--text)}
.pz-slider{width:80px;height:3px;appearance:none;-webkit-appearance:none;background:var(--bg4);border-radius:2px;outline:none;cursor:pointer}
.pz-slider::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;border-radius:50%;background:#fff;cursor:pointer}
.pz-val{font-size:10px;color:var(--text3);min-width:32px;text-align:center;font-family:monospace}"""
content = content.replace(old_preview_css, new_preview_css)

# ==============================
# FIX 5: Add canvas mouse drag (move/resize on preview) + zoom JS
# Put this before "// Init" at the end
# ==============================
old_init = """// Init
pushHistory();
renderAll();"""

new_init = """// --- PREVIEW ZOOM ---
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

// --- CANVAS MOUSE DRAG (move items by clicking on preview) ---
let canvasDrag = null;
const previewCanvas = document.getElementById('preview-img-canvas');

previewCanvas?.addEventListener('mousedown', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if (!item || (item.type !== 'image' && item.type !== 'text')) return;
  
  e.preventDefault();
  const rect = previewCanvas.getBoundingClientRect();
  // Convert mouse position to renderCanvas coordinates
  const scaleFactorX = renderCanvas.width / rect.width;
  const scaleFactorY = renderCanvas.height / rect.height;
  
  canvasDrag = {
    item,
    startMouseX: e.clientX,
    startMouseY: e.clientY,
    startItemX: item.transform.x || 0,
    startItemY: item.transform.y || 0,
    scaleFactorX,
    scaleFactorY
  };
});

document.addEventListener('mousemove', e => {
  if (!canvasDrag) return;
  const dx = (e.clientX - canvasDrag.startMouseX) * canvasDrag.scaleFactorX;
  const dy = (e.clientY - canvasDrag.startMouseY) * canvasDrag.scaleFactorY;
  canvasDrag.item.transform.x = canvasDrag.startItemX + dx;
  canvasDrag.item.transform.y = canvasDrag.startItemY + dy;
  renderFrame();
  renderInspector();
});

document.addEventListener('mouseup', () => {
  if (canvasDrag) {
    pushHistory();
    canvasDrag = null;
  }
});

// Allow scroll-wheel to resize selected item on preview
previewCanvas?.addEventListener('wheel', e => {
  const item = state.items.find(i => i.id === state.activeLayer);
  if (!item || (item.type !== 'image' && item.type !== 'text')) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.02 : 0.02;
  item.transform.scaleX = Math.max(0.05, Math.min(5, (item.transform.scaleX ?? 1) + delta));
  item.transform.scaleY = Math.max(0.05, Math.min(5, (item.transform.scaleY ?? 1) + delta));
  renderFrame();
  renderInspector();
}, { passive: false });

// Init
pushHistory();
renderAll();"""
content = content.replace(old_init, new_init)

# ==============================
# FIX 6: Change cursor on preview canvas for selected overlays
# ==============================
content = content.replace(
    ".preview-img-canvas{\n  max-width:100%;max-height:100%;\n  border-radius:2px;display:none;\n  position:absolute;\n}",
    ".preview-img-canvas{\n  max-width:100%;max-height:100%;\n  border-radius:2px;display:none;\n  position:absolute;cursor:grab;\n}\n.preview-img-canvas:active{cursor:grabbing}"
)

with open('public/video-editor.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("ALL FIXES APPLIED SUCCESSFULLY")
