with open('public/video-editor.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ==============================
# FIX 1: Remove default fade-in from images and text (set to 0)
# ==============================
content = content.replace(
    "transition: {fadeIn: 0.5, fadeOut: 0.5} });",
    "transition: {fadeIn: 0, fadeOut: 0} });"
)
content = content.replace(
    "transition: { fadeIn: 0.3, fadeOut: 0.3 }",
    "transition: { fadeIn: 0, fadeOut: 0 }"
)

# ==============================
# FIX 2: Move zoom bar from bottom of preview to top (inside topbar right)
# Remove from preview area, add to topbar-right zone
# ==============================
# Remove from preview
content = content.replace(
    """    <div class="preview-zoom-bar">
      <button class="pz-btn" id="pz-out" title="Zoom out">−</button>
      <input type="range" class="pz-slider" id="pz-slider" min="20" max="200" value="100"/>
      <button class="pz-btn" id="pz-in" title="Zoom in">+</button>
      <span class="pz-val" id="pz-val">100%</span>
      <button class="pz-btn" id="pz-fit" title="Fit to view">Fit</button>
    </div>
    <div class="preview-canvas" id="preview-canvas">""",
    """    <div class="preview-canvas" id="preview-canvas">"""
)

# Add to topbar-right (before the Export button div)
content = content.replace(
    """    </div>
    <div class="topbar-right">""",
    """    </div>
    <div class="topbar-right">
      <div class="preview-zoom-bar" style="position:static;transform:none;background:none;border:none;backdrop-filter:none;padding:0;gap:4px">
        <button class="pz-btn" id="pz-out" title="Zoom out">−</button>
        <input type="range" class="pz-slider" id="pz-slider" min="20" max="200" value="100"/>
        <button class="pz-btn" id="pz-in" title="Zoom in">+</button>
        <span class="pz-val" id="pz-val">100%</span>
        <button class="pz-btn" id="pz-fit" title="Fit">Fit</button>
      </div>
      <div class="topbar-sep"></div>"""
)

# Fix the preview-area: remove flex-direction:column since zoom bar is no longer inside
content = content.replace(
    """.preview-area{
  grid-area:preview;
  background:var(--bg0);
  display:flex;align-items:center;justify-content:center;
  position:relative;overflow:hidden;
  flex-direction:column;
}""",
    """.preview-area{
  grid-area:preview;
  background:var(--bg0);
  display:flex;align-items:center;justify-content:center;
  position:relative;overflow:hidden;
}"""
)

# Make pz-slider wider in topbar
content = content.replace(
    ".pz-slider{width:80px;height:3px;appearance:none;-webkit-appearance:none;background:var(--bg4);border-radius:2px;outline:none;cursor:pointer}",
    ".pz-slider{width:70px;height:3px;appearance:none;-webkit-appearance:none;background:var(--bg4);border-radius:2px;outline:none;cursor:pointer}"
)

# ==============================
# FIX 3: Timeline resizer - add draggable handle to resize timeline height
# ==============================
# Add resizer CSS before timeline-section CSS
content = content.replace(
    """.timeline-section{
  grid-area:tl;
  background:var(--bg1);
  border-top:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden;
}""",
    """.timeline-resizer{
  grid-area:tl;
  height:4px;background:transparent;cursor:ns-resize;
  position:relative;z-index:50;
  border-top:2px solid var(--border);
  transition:background .15s;
}
.timeline-resizer:hover,.timeline-resizer.dragging{background:var(--accent);}
.timeline-section{
  grid-area:tl;
  background:var(--bg1);
  border-top:none;
  display:flex;flex-direction:column;overflow:hidden;
}"""
)

# Change grid: timeline row uses CSS variable for flexible height
content = content.replace(
    "  grid-template-rows:44px 1fr 280px;",
    "  grid-template-rows:44px 1fr var(--timeline-h, 280px);"
)
content = content.replace(
    '  grid-template-areas:\n    "topbar topbar topbar topbar"\n    "rail   lpanel preview rpanel"\n    "rail   tl     tl      tl";',
    '  grid-template-areas:\n    "topbar topbar topbar topbar"\n    "rail   lpanel preview rpanel"\n    "rail   tl     tl      tl";'
)

# Add resizer div before timeline section
content = content.replace(
    "  <!-- ══════════════ TIMELINE ══════════════ -->",
    "  <!-- ══════════════ TIMELINE RESIZER ══════════════ -->\n  <div class=\"timeline-resizer\" id=\"timeline-resizer\"></div>\n\n  <!-- ══════════════ TIMELINE ══════════════ -->"
)

# ==============================
# FIX 4: Add selection handles (resize corners) on canvas for selected items
# Replace the canvas drag section entirely with a full drag+resize version
# ==============================

old_canvas_code = """// --- CANVAS MOUSE DRAG (move items by clicking on preview) ---
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
}, { passive: false });"""

new_canvas_code = """// --- CANVAS INTERACTION (drag to move, handle to resize) ---
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
  if (!item || item.type === 'audio') { selOverlay.style.display = 'none'; return; }
  
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

// Patch renderAll to also update selection overlay
const _origRenderAll = renderAll;
function renderAll() {
  _origRenderAll(); 
  updateSelectionOverlay();
}

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
})();"""

content = content.replace(old_canvas_code, new_canvas_code)

# Patch renderAll call also to update overlay after renderFrame
# Find renderFrame and make it call updateSelectionOverlay too
content = content.replace(
    "  pc.getContext('2d').drawImage(renderCanvas, 0, 0);\n}",
    "  pc.getContext('2d').drawImage(renderCanvas, 0, 0);\n  if (typeof updateSelectionOverlay === 'function') updateSelectionOverlay();\n}",
    1  # only replace first occurrence (in renderFrame)
)

with open('public/video-editor.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("ALL FIXES APPLIED SUCCESSFULLY")
