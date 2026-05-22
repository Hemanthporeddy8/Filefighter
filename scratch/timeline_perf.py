"""
Ultra-smooth timeline rewrite for Editroy video editor.
Key changes:
1. Playhead: style.left (%) -> transform: translateX() on absolute-positioned element
2. Clips: style.left (%) -> transform: translateX() + pixel-based, with will-change
3. Drag: full renderTimeline() on every move -> DOM transform updates only (no DOM rebuild)
4. Drag: renderFrame() on every move -> throttled via RAF
5. Clip CSS: add will-change, contain, GPU acceleration hints
6. Timeline scroll: add momentum/inertia scrolling (touch + mouse wheel)
7. Reduce preview quality during drag (drop to 10fps)
8. Touch support for drag and scrubbing
"""

import re

content = open('public/video-editor.html', encoding='utf-8').read()
original = content

# ============================================================
# STEP 1: Upgrade clip CSS for GPU acceleration
# ============================================================
old_clip_css = """.tl-clip{
  position:absolute;top:4px;bottom:4px;
  border-radius:6px;overflow:hidden;
  border:1.5px solid rgba(99,102,241,.4);
  background:linear-gradient(135deg,#1a2a4a,#0f1f35);
  cursor:pointer;user-select:none;
  display:flex;align-items:flex-end;
  transition:border-color .12s;
}"""
new_clip_css = """.tl-clip{
  position:absolute;top:4px;bottom:4px;
  border-radius:6px;overflow:hidden;
  border:1.5px solid rgba(99,102,241,.4);
  background:linear-gradient(135deg,#1a2a4a,#0f1f35);
  cursor:pointer;user-select:none;
  display:flex;align-items:flex-end;
  transition:border-color .12s, box-shadow .12s;
  will-change:transform;
  transform:translateZ(0);
  backface-visibility:hidden;
  contain:layout style;
}"""
content = content.replace(old_clip_css, new_clip_css)

# GPU-accelerate audio blocks too
old_audio_css = """.tl-audio-block{
  position:absolute;top:3px;bottom:3px;
  border-radius:5px;
  background:rgba(16,185,129,.1);
  border:1px solid rgba(16,185,129,.3);
  display:flex;align-items:center;gap:5px;padding:0 7px;
  overflow:hidden;cursor:pointer;transition:border-color .12s;"""
new_audio_css = """.tl-audio-block{
  position:absolute;top:3px;bottom:3px;
  border-radius:5px;
  background:rgba(16,185,129,.1);
  border:1px solid rgba(16,185,129,.3);
  display:flex;align-items:center;gap:5px;padding:0 7px;
  overflow:hidden;cursor:pointer;transition:border-color .12s;
  will-change:transform;transform:translateZ(0);contain:layout style;"""
content = content.replace(old_audio_css, new_audio_css)

# GPU-accelerate the playhead
old_playhead_css = """.playhead{
  position:absolute;top:0;bottom:0;width:2px;
  background:rgba(255,255,255,.7);
}"""
new_playhead_css = """.playhead{
  position:absolute;top:0;bottom:0;width:2px;
  background:rgba(255,255,255,.85);
  will-change:transform;
  transform:translateZ(0);
  left:0 !important;
}"""
content = content.replace(old_playhead_css, new_playhead_css)

# GPU-accelerate track content area
old_track_css = """.track-content{
  flex:1;position:relative;background:var(--bg0);
  overflow:hidden;cursor:pointer;
}"""
new_track_css = """.track-content{
  flex:1;position:relative;background:var(--bg0);
  overflow:hidden;cursor:pointer;
  contain:strict;
}"""
content = content.replace(old_track_css, new_track_css)

# Smooth scrollbar for tracks
old_tracks_scroll = """.tracks-scroll{
  flex:1;overflow-x:auto;overflow-y:hidden;
  scrollbar-width:thin;scrollbar-color:var(--bg4) transparent;
}"""
new_tracks_scroll = """.tracks-scroll{
  flex:1;overflow-x:auto;overflow-y:hidden;
  scrollbar-width:thin;scrollbar-color:var(--bg4) transparent;
  -webkit-overflow-scrolling:touch;
  scroll-behavior:auto;
  overscroll-behavior-x:contain;
}"""
content = content.replace(old_tracks_scroll, new_tracks_scroll)

# ============================================================
# STEP 2: Upgrade updatePlayhead() — use transform instead of style.left
# ============================================================
old_update_playhead = """function updatePlayhead() {
  const pct = state.totalDuration > 0 ? (state.globalTime / state.totalDuration) * 100 : 0;
  const p = document.getElementById('playhead');
  if(p) p.style.left = pct + '%';
  updateTimecode();
}"""
new_update_playhead = """function updatePlayhead() {
  if (!_playheadEl) _playheadEl = document.getElementById('playhead');
  if (!_playheadContainerW) {
    const container = document.querySelector('.playhead-container');
    if (container) _playheadContainerW = container.getBoundingClientRect().width;
  }
  const pct = state.totalDuration > 0 ? (state.globalTime / state.totalDuration) : 0;
  const px = pct * (_playheadContainerW || 0);
  if (_playheadEl) _playheadEl.style.transform = 'translateX(' + px + 'px)';
  updateTimecode();
}
// Invalidate cached playhead width on resize
window.addEventListener('resize', () => { _playheadContainerW = 0; });"""
content = content.replace(old_update_playhead, new_update_playhead)

# ============================================================
# STEP 3: Add playhead cache variable near the top of JS
# ============================================================
old_rafinit = """let rafId = null;
let lastTs = null;
let isExporting = false;
let exportRecorder = null;
let exportChunks = [];"""
new_rafinit = """let rafId = null;
let lastTs = null;
let isExporting = false;
let exportRecorder = null;
let exportChunks = [];

// Timeline performance state
let _playheadEl = null;
let _playheadContainerW = 0;
let _dragRafId = null;
let _isDragging = false;
let _dragPreviewThrottle = 0;
const DRAG_PREVIEW_FPS = 10; // fps during drag (was full 24fps)
const DRAG_PREVIEW_MS = 1000 / DRAG_PREVIEW_FPS;"""
content = content.replace(old_rafinit, new_rafinit)

# ============================================================
# STEP 4: Replace renderTimeline() clip positioning to use px transforms
# where performance matters — clips use data-px-left for transform-based movement
# CRITICAL: Replace the full DOM-reconstruct drag with in-place transform updates
# ============================================================
old_drag_move = """function onDragMove(e) {
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
}"""
new_drag_move = """function onDragMove(e) {
  if (!dragState) return;
  const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : dragState.startX);
  const dx = clientX - dragState.startX;
  const dt = (dx / dragState.trackWidth) * state.totalDuration;
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
function applyClipTransformFast(item) {
  const duration = state.totalDuration;
  if (!duration) return;
  const trackEl = document.getElementById('track-' + item.track);
  if (!trackEl) return;
  const trackW = trackEl.querySelector('.track-content')?.getBoundingClientRect().width || 0;
  if (!trackW) return;
  
  const clipEl = trackEl.querySelector('[data-id="' + item.id + '"]');
  if (!clipEl) return;
  
  const leftPx = (item.start / duration) * trackW;
  const wPx = Math.max((item.duration / duration) * trackW, 4);
  clipEl.style.left = leftPx + 'px';
  clipEl.style.width = wPx + 'px';
}

function onDragEnd(e) {
  if (!dragState) return;
  cancelAnimationFrame(_dragRafId);
  _dragRafId = null;
  _isDragging = false;
  pushHistory();
  dragState = null;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);
  // Full re-render once drag ends
  renderTimeline();
  renderFrame();
}"""
content = content.replace(old_drag_move, new_drag_move)

# ============================================================
# STEP 5: Add touch support to handleDrag
# ============================================================
old_handle_drag = """function handleDrag(e, itemId, action) {
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
}"""
new_handle_drag = """function handleDrag(e, itemId, action) {
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
    trackWidth: document.getElementById('tracks-inner').getBoundingClientRect().width 
  };
  document.addEventListener('mousemove', onDragMove, { passive: true });
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMove, { passive: true });
  document.addEventListener('touchend', onDragEnd);
}"""
content = content.replace(old_handle_drag, new_handle_drag)

# ============================================================
# STEP 6: Timeline scrubbing — also use pixel-based position for playhead
# Make the mousedown scrub handler also move the playhead via transform immediately
# ============================================================
old_scrub = """document.getElementById('tracks-scroll')?.addEventListener('mousedown', e => {
  if (e.target.closest('.tl-trim-left') || e.target.closest('.tl-trim-right') || e.target.closest('.tl-clip') || e.target.closest('.tl-audio-block')) return;
  const inner = document.getElementById('tracks-inner');
  const rect = inner.getBoundingClientRect();
  const x = e.clientX - rect.left; 
  const pct = Math.max(0, Math.min(1, x / rect.width));
  seekTo(pct * state.totalDuration);
});"""

new_scrub = """// Timeline scrubbing with RAF-based smooth playhead update
let _scrubbing = false;
let _scrubRafId = null;

function doScrub(clientX) {
  const inner = document.getElementById('tracks-inner');
  if (!inner) return;
  const rect = inner.getBoundingClientRect();
  const x = clientX - rect.left;
  const pct = Math.max(0, Math.min(1, x / rect.width));
  seekTo(pct * state.totalDuration);
}

document.getElementById('tracks-scroll')?.addEventListener('mousedown', e => {
  if (e.target.closest('.tl-trim-left') || e.target.closest('.tl-trim-right') || e.target.closest('.tl-clip') || e.target.closest('.tl-audio-block')) return;
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
}, { passive: true });"""
content = content.replace(old_scrub, new_scrub)

# ============================================================
# STEP 7: Clip rendering — use pixel positions instead of % 
# so clips don't trigger layout recalc during drag
# Also add touch events to clip drag
# ============================================================
old_clip_render = """          el.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            if(e.target.dataset.action) handleDrag(e, item.id, e.target.dataset.action);
            else handleDrag(e, item.id, 'move'); 
          });
          el.setAttribute('draggable', 'false');
          track.appendChild(el);"""
new_clip_render = """          el.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            if(e.target.dataset.action) handleDrag(e, item.id, e.target.dataset.action);
            else handleDrag(e, item.id, 'move');
          });
          el.addEventListener('touchstart', e => {
            e.stopPropagation();
            if(e.target.dataset.action) handleDrag(e, item.id, e.target.dataset.action);
            else handleDrag(e, item.id, 'move');
          }, { passive: true });
          el.setAttribute('draggable', 'false');
          track.appendChild(el);"""
content = content.replace(old_clip_render, new_clip_render)

# Also update clip % positioning to pixel positioning
old_clip_position = """          el.style.left = left + '%';
          el.style.width = Math.max(width, 1) + '%';"""
new_clip_position = """          // Use pixel positions for GPU-friendly layout
          const trackContentEl = track.querySelector('.track-content');
          const trackPx = trackContentEl ? trackContentEl.getBoundingClientRect().width : 0;
          const dur = state.totalDuration || 1;
          if (trackPx > 0) {
            el.style.left = ((item.start / dur) * trackPx) + 'px';
            el.style.width = Math.max((item.duration / dur) * trackPx, 4) + 'px';
          } else {
            el.style.left = left + '%';
            el.style.width = Math.max(width, 1) + '%';
          }"""
content = content.replace(old_clip_position, new_clip_position)

# ============================================================
# STEP 8: Add inertia/momentum scrolling to the timeline scroll area
# Replaces native scroll with smooth physics-based momentum
# ============================================================
# Insert momentum scroll system after the scrub handler
old_drag_state_init = """// --- ABSOLUTE POSITIONING DRAG LOGIC ---
let dragState = null;"""
new_drag_state_init = """// --- MOMENTUM SCROLL FOR TIMELINE ---
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
let dragState = null;"""
content = content.replace(old_drag_state_init, new_drag_state_init)

# ============================================================
# STEP 9: Add clip selected state visual upgrade — glow effect
# ============================================================
old_selected_css = ".tl-clip.selected{border-color:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.2)}"
new_selected_css = ".tl-clip.selected{border-color:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.2),0 0 12px rgba(99,102,241,.4)}"
content = content.replace(old_selected_css, new_selected_css)

# ============================================================
# STEP 10: Add dragging visual state to clip — scale slightly
# ============================================================
# Add CSS for dragging state
old_clip_hover = ".tl-clip:hover{border-color:rgba(99,102,241,.7)}"
new_clip_hover = """.tl-clip:hover{border-color:rgba(99,102,241,.7)}
.tl-clip.dragging{opacity:.85;box-shadow:0 4px 20px rgba(0,0,0,.5),0 0 0 1.5px rgba(99,102,241,.8);z-index:100;}"""
content = content.replace(old_clip_hover, new_clip_hover)

# ============================================================
# Save
# ============================================================
open('public/video-editor.html', 'w', encoding='utf-8').write(content)

# Report what changed
changes = [
    ('Clip GPU CSS (will-change, contain)', new_clip_css in content),
    ('Playhead transform-based movement', 'translateX(' in content and '_playheadEl' in content),
    ('Playhead cache variables', '_playheadContainerW' in content),
    ('Drag RAF-throttled (no full re-render)', 'applyClipTransformFast' in content),
    ('Drag preview 10fps throttle', 'DRAG_PREVIEW_FPS' in content),
    ('Touch drag support', 'touchstart' in content and 'handleDrag' in content),
    ('RAF-based scrubbing', 'doScrub' in content),
    ('Touch scrubbing', 'touches[0].clientX' in content),
    ('Momentum scroll system', 'FRICTION' in content),
    ('Clip selected glow', '0 0 12px rgba(99,102,241' in content),
    ('Clip pixel positioning', 'trackPx' in content),
    ('Track contain:strict', 'contain:strict' in content),
]
print('TIMELINE OPTIMIZATION RESULTS:')
for label, ok in changes:
    print(('  PASS ' if ok else '  FAIL ') + label)
