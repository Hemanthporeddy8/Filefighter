"""
TIMELINE VIEWPORT ARCHITECTURE REWRITE
=======================================
Converts from: percentage-width / infinite scroll 
Converts to:   pixels-per-second / fixed viewport / camera system

Architecture:
  - BASE_PPS = 80  (pixels per second at 1× zoom)
  - state.tlZoom  = zoom multiplier (0.25 – 8×)
  - pps()         = BASE_PPS * state.tlZoom  (computed pixels/sec)
  - tracks-inner width = pps() * totalDuration  (total px content)
  - tracks-scroll.scrollLeft = viewport camera position
  - Clips positioned at:  left = item.start * pps()
                          width = item.duration * pps()
  - Playhead at:          left = globalTime * pps()  (no transform, pixel-absolute)
  - Auto-scroll:          RAF loop keeps playhead in center 20%-80% band
  - Ruler:                ticks at pixel positions, not %
  - Zoom:                 re-render with new pps(), scroll to keep center point
"""

import re

content = open('public/video-editor.html', encoding='utf-8').read()

# ─────────────────────────────────────────────────────────────
# 1. STATE: add tlZoom
# ─────────────────────────────────────────────────────────────
old_state = """const state = {
  items: [], // Array of { id, type, file, src, start, duration, trimStart, trimEnd, track, volume, filters, transform, 
  activeLayer: null,
  globalTime: 0,
  totalDuration: 30, // Default timeline length
  isPlaying: false,
  history: [],
  historyIndex: -1,
  masterVolume: 1,
  fps: 30,
};"""
new_state = """const state = {
  items: [], // Array of { id, type, file, src, start, duration, trimStart, trimEnd, track, volume, filters, transform, thumbnail }
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
function pxToTime(px) { return px / pps(); }"""
content = content.replace(old_state, new_state)

# ─────────────────────────────────────────────────────────────
# 2. PERFORMANCE STATE: remove old _playheadContainerW, keep the rest
# ─────────────────────────────────────────────────────────────
old_perf = """// Timeline performance state
let _playheadEl = null;
let _playheadContainerW = 0;
let _dragRafId = null;
let _isDragging = false;
let _dragPreviewThrottle = 0;
const DRAG_PREVIEW_FPS = 10; // fps during drag (was full 24fps)
const DRAG_PREVIEW_MS = 1000 / DRAG_PREVIEW_FPS;"""
new_perf = """// Timeline performance state
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
content = content.replace(old_perf, new_perf)

# ─────────────────────────────────────────────────────────────
# 3. REWRITE updatePlayhead() — pixel-based, no transform
# ─────────────────────────────────────────────────────────────
old_update_playhead = """function updatePlayhead() {
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
new_update_playhead = """function updatePlayhead() {
  if (!_playheadEl) _playheadEl = document.getElementById('playhead');
  const px = timeToPx(state.globalTime);
  if (_playheadEl) {
    _playheadEl.style.left = px + 'px';
    _playheadEl.style.transform = '';   // pixel-absolute, no transform offset
  }
  updateTimecode();
  // Auto-scroll the viewport to keep playhead visible
  _scheduleAutoScroll();
}"""
content = content.replace(old_update_playhead, new_update_playhead)

# ─────────────────────────────────────────────────────────────
# 4. ADD _scheduleAutoScroll and smooth scroll helpers
# ─────────────────────────────────────────────────────────────
auto_scroll_system = """
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
"""

# Insert after the updatePlayhead function
content = content.replace(
    'function updatePlayhead() {\n  if (!_playheadEl) _playheadEl = document.getElementById(\'playhead\');\n  const px = timeToPx(state.globalTime);\n  if (_playheadEl) {\n    _playheadEl.style.left = px + \'px\';\n    _playheadEl.style.transform = \'\';   // pixel-absolute, no transform offset\n  }\n  updateTimecode();\n  // Auto-scroll the viewport to keep playhead visible\n  _scheduleAutoScroll();\n}',
    'function updatePlayhead() {\n  if (!_playheadEl) _playheadEl = document.getElementById(\'playhead\');\n  const px = timeToPx(state.globalTime);\n  if (_playheadEl) {\n    _playheadEl.style.left = px + \'px\';\n    _playheadEl.style.transform = \'\';   // pixel-absolute, no transform offset\n  }\n  updateTimecode();\n  // Auto-scroll the viewport to keep playhead visible\n  _scheduleAutoScroll();\n}\n' + auto_scroll_system
)

# ─────────────────────────────────────────────────────────────
# 5. REWRITE renderTimeline() — pixel-based positioning
# ─────────────────────────────────────────────────────────────
old_render_tl_body = """function renderTimeline() {
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
          // Use pixel positions for GPU-friendly layout
          const trackContentEl = track.querySelector('.track-content');
          const trackPx = trackContentEl ? trackContentEl.getBoundingClientRect().width : 0;
          const dur = state.totalDuration || 1;
          if (trackPx > 0) {
            el.style.left = ((item.start / dur) * trackPx) + 'px';
            el.style.width = Math.max((item.duration / dur) * trackPx, 4) + 'px';
          } else {
            el.style.left = left + '%';
            el.style.width = Math.max(width, 1) + '%';
          }
          
          el.addEventListener('mousedown', e => {
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
          track.appendChild(el);
      });
  });"""
new_render_tl_body = """function renderTimeline() {
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
  });"""

content = content.replace(old_render_tl_body, new_render_tl_body)

# ─────────────────────────────────────────────────────────────
# 6. REWRITE buildRuler() — pixel-based ticks
# ─────────────────────────────────────────────────────────────
old_ruler = """function buildRuler() {
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
}"""
new_ruler = """function buildRuler() {
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
}"""
content = content.replace(old_ruler, new_ruler)

# ─────────────────────────────────────────────────────────────
# 7. REWRITE applyClipTransformFast() — uses pps()
# ─────────────────────────────────────────────────────────────
old_fast = """// Apply clip position/width update via DOM mutation (no full re-render)
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
}"""
new_fast = """// Apply clip position/width update via DOM mutation (no full re-render)
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
}"""
content = content.replace(old_fast, new_fast)

# ─────────────────────────────────────────────────────────────
# 8. REWRITE handleDrag to use pps() for time calculation
# ─────────────────────────────────────────────────────────────
old_drag_setup = """  const startX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  dragState = { 
    type: action, 
    item, 
    startX,
    startStart: item.start, 
    startDuration: item.duration,
    startTrimStart: item.trimStart, 
    startTrimEnd: item.trimEnd, 
    trackWidth: document.getElementById('tracks-inner').getBoundingClientRect().width 
  };"""
new_drag_setup = """  const startX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
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
  };"""
content = content.replace(old_drag_setup, new_drag_setup)

# Update onDragMove to use pps() based time-delta
old_drag_move_body = """  const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : dragState.startX);
  const dx = clientX - dragState.startX;
  const dt = (dx / dragState.trackWidth) * state.totalDuration;
  const item = dragState.item;"""
new_drag_move_body = """  const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : dragState.startX);
  const dx = clientX - dragState.startX;
  const dt = pxToTime(dx); // Pixel delta → time delta via pps()
  const item = dragState.item;
  // Update edge-drag scroll position
  if (typeof _startEdgeDragScroll === 'function') _startEdgeDragScroll(clientX);"""
content = content.replace(old_drag_move_body, new_drag_move_body)

# ─────────────────────────────────────────────────────────────
# 9. REWRITE timeline scrubbing to use pxToTime()
# ─────────────────────────────────────────────────────────────
old_scrub_fn = """function doScrub(clientX) {
  const inner = document.getElementById('tracks-inner');
  if (!inner) return;
  const rect = inner.getBoundingClientRect();
  const x = clientX - rect.left;
  const pct = Math.max(0, Math.min(1, x / rect.width));
  seekTo(pct * state.totalDuration);
}"""
new_scrub_fn = """function doScrub(clientX) {
  const scrollEl = document.getElementById('tracks-scroll');
  if (!scrollEl) return;
  const rect = scrollEl.getBoundingClientRect();
  // x relative to tracks-inner (accounting for scroll)
  const x = (clientX - rect.left) + scrollEl.scrollLeft;
  const t = Math.max(0, Math.min(state.totalDuration, pxToTime(x)));
  seekTo(t);
}"""
content = content.replace(old_scrub_fn, new_scrub_fn)

# Also fix the tracks-scroll mousedown scrub entry-point rect (was using inner, now uses scroll)
old_scrub_td = """document.getElementById('tracks-scroll')?.addEventListener('mousedown', e => {
  if (e.target.closest('.tl-trim-left') || e.target.closest('.tl-trim-right') || e.target.closest('.tl-clip') || e.target.closest('.tl-audio-block')) return;
  _scrubbing = true;
  doScrub(e.clientX);"""
new_scrub_td = """document.getElementById('tracks-scroll')?.addEventListener('mousedown', e => {
  if (e.target.closest('.tl-trim-left') || e.target.closest('.tl-trim-right') || e.target.closest('.tl-clip') || e.target.closest('.tl-audio-block')) return;
  if (e.target.closest('.tl-clip')) return;
  _scrubbing = true;
  doScrub(e.clientX);"""
content = content.replace(old_scrub_td, new_scrub_td)

# ─────────────────────────────────────────────────────────────
# 10. ZOOM SYSTEM — wire btn-zoom-in / btn-zoom-out to pps
# ─────────────────────────────────────────────────────────────
zoom_system = """
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
"""

# Insert zoom system after buildRuler function
content = content.replace(
    '// --- TRANSFORM INPUT BINDINGS ---',
    zoom_system + '\n// --- TRANSFORM INPUT BINDINGS ---'
)

# ─────────────────────────────────────────────────────────────
# 11. PLAYBACK LOOP — call auto-scroll during playback
# ─────────────────────────────────────────────────────────────
old_play_head_call = """  updatePlayhead();
  if (!state.isPlaying) {"""
new_play_head_call = """  updatePlayhead();
  if (state.isPlaying) _autoScrollDuringPlayback();
  if (!state.isPlaying) {"""
content = content.replace(old_play_head_call, new_play_head_call, 1)

# ─────────────────────────────────────────────────────────────
# 12. CSS: tracks-inner needs auto width, not min-width
# ─────────────────────────────────────────────────────────────
old_inner_css = """.tracks-inner{
  position:relative;min-height:100%;min-width:100%;
}"""
new_inner_css = """.tracks-inner{
  position:relative;min-height:100%;
  /* width is set dynamically by renderTimeline() / setTlZoom() */
  width:100%;
  will-change:contents;
}"""
content = content.replace(old_inner_css, new_inner_css)

# ─────────────────────────────────────────────────────────────
# 13. CSS: ruler also needs to be properly sized
# ─────────────────────────────────────────────────────────────
old_ruler_css = """.ruler{
  flex:1;position:relative;overflow:hidden;
}"""
new_ruler_css = """.ruler{
  flex:1;position:relative;overflow:hidden;
  /* width set dynamically by buildRuler() */
}"""
content = content.replace(old_ruler_css, new_ruler_css)

# ─────────────────────────────────────────────────────────────
# 14. Playhead CSS: absolute left (pixel), no transform
# ─────────────────────────────────────────────────────────────
old_playhead_css = """.playhead{
  position:absolute;top:0;bottom:0;width:2px;
  background:rgba(255,255,255,.85);
  will-change:transform;
  transform:translateZ(0);
}"""
new_playhead_css = """.playhead{
  position:absolute;top:0;bottom:0;width:2px;
  background:#fff;
  will-change:left;
  pointer-events:none;
  z-index:20;
}"""
content = content.replace(old_playhead_css, new_playhead_css)

# ─────────────────────────────────────────────────────────────
# 15. Playhead container: same as tracks-inner width
# ─────────────────────────────────────────────────────────────
old_ph_container = """.playhead-container {
  position:absolute;top:0;bottom:0;
  left:48px; 
  width:calc(100% - 48px);
  z-index:30;pointer-events:none;
}"""
new_ph_container = """.playhead-container {
  position:absolute;top:0;bottom:0;left:0;
  width:100%;
  z-index:30;pointer-events:none;
  overflow:visible;
}"""
content = content.replace(old_ph_container, new_ph_container)

# ─────────────────────────────────────────────────────────────
# Save and verify
# ─────────────────────────────────────────────────────────────
open('public/video-editor.html', 'w', encoding='utf-8').write(content)

checks = [
    ('pps() function', 'function pps()' in content),
    ('timeToPx()', 'function timeToPx' in content),
    ('pxToTime()', 'function pxToTime' in content),
    ('state.tlZoom', 'state.tlZoom' in content),
    ('tracks-inner dynamic width', 'inner.style.width = totalPx' in content),
    ('Auto-scroll system', '_scheduleAutoScroll' in content),
    ('Smooth scroll lerp', 'LERP' in content),
    ('Edge-drag scroll', '_startEdgeDragScroll' in content),
    ('Zoom in/out wired', "btn-zoom-in" in content and "btn-zoom-out" in content and "setTlZoom" in content),
    ('Ctrl+wheel zoom', 'e.ctrlKey' in content),
    ('Pinch to zoom', 'lastPinchDist' in content),
    ('Ruler pixel-based', 'timeToPx(t)' in content and 'ruler-tick' in content),
    ('Playhead pixel left', "style.left = px + 'px'" in content),
    ('Auto-scroll during playback', '_autoScrollDuringPlayback' in content),
    ('Drag uses pxToTime', 'pxToTime(dx)' in content),
]
print('VIEWPORT ARCHITECTURE RESULTS:')
for label, ok in checks:
    print(('  PASS ' if ok else '  FAIL ') + label)
