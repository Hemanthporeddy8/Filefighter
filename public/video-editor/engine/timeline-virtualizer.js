/**
 * public/video-editor/engine/timeline-virtualizer.js
 * 
 * Viewport-Virtualized Timeline Render Engine.
 * Dynamically recycling DOM nodes and rendering ONLY visible clips.
 * Promo tracks to GPU layers via will-change and strict containment bounds.
 */

class TimelineVirtualizer {
  constructor() {
    this.state = null;
    this.timeToPxFn = null;
    this.pxToTimeFn = null;
    this._nodeMap = new Map(); // Track clipId ➔ DOMElement
  }

  initialize(globalState, timeToPxFn, pxToTimeFn) {
    this.state = globalState;
    this.timeToPxFn = timeToPxFn;
    this.pxToTimeFn = pxToTimeFn;
    
    // Add GPU containment classes/styles to timeline tracks once on launch
    document.addEventListener('DOMContentLoaded', () => {
      this._applyGpuAccelerationStyles();
    });
  }

  _applyGpuAccelerationStyles() {
    const tracks = document.querySelectorAll('.track-lane');
    tracks.forEach(track => {
      // GPU promos and strict repaint containment bounds (Phase 5)
      track.style.willChange = 'transform';
      track.style.contain = 'strict';
      track.style.position = 'relative';
    });
  }

  /**
   * Refreshes the timeline track DOMs using strict viewport virtualization rules.
   * Keeps track of scroll coordinates and only processes/draws clips within scroll boundaries.
   */
  virtualizeTimeline() {
    if (!this.state || !this.timeToPxFn) return;

    const scrollContainer = document.getElementById('tracks-scroll');
    if (!scrollContainer) return;

    const scrollLeft = scrollContainer.scrollLeft;
    const viewportWidth = scrollContainer.clientWidth;
    const viewStartPx = scrollLeft - 200; // 200px buffer to prevent clipping gaps on swift scrolls
    const viewEndPx = scrollLeft + viewportWidth + 200;

    const viewStartTime = this.pxToTimeFn(viewStartPx);
    const viewEndTime = this.pxToTimeFn(viewEndPx);

    // 1. Rescale inner container width based on total zoom
    const totalPx = Math.max(this.timeToPxFn(this.state.totalDuration), viewportWidth);
    const inner = document.getElementById('tracks-inner');
    if (inner && inner.style.width !== totalPx + 'px') {
      inner.style.width = totalPx + 'px';
    }

    // 2. Virtualize each track layer (fx1, v2, v1, a1, t1)
    ['fx1', 'v2', 'v1', 'a1', 't1'].forEach(trackId => {
      const track = document.getElementById('track-' + trackId);
      if (!track) return;

      const trackItems = this.state.items.filter(i => i.track === trackId);
      
      // Update background placeholder visibility
      const emptyEl = track.querySelector('.track-empty');
      if (emptyEl) {
        emptyEl.style.display = trackItems.length > 0 ? 'none' : 'flex';
      }

      // Filter visible items matching the scroll window
      const visibleItems = trackItems.filter(item => {
        const itemEnd = item.start + item.duration;
        return (item.start >= viewStartTime && item.start <= viewEndTime) || 
               (itemEnd >= viewStartTime && itemEnd <= viewEndTime) ||
               (item.start <= viewStartTime && itemEnd >= viewEndTime);
      });

      const visibleIds = new Set(visibleItems.map(i => i.id));

      // Remove DOM elements of clips that scrolled out of view
      track.querySelectorAll('.tl-clip, .tl-audio-block, .tl-fx-block').forEach(el => {
        const clipId = el.dataset.id;
        if (!visibleIds.has(clipId)) {
          el.remove();
          this._nodeMap.delete(clipId);
        }
      });

      // Render/Update nodes for visible items only
      visibleItems.forEach(item => {
        let el = this._nodeMap.get(item.id);
        const isSelected = this.state.activeLayer === item.id;
        
        // Target coordinates in pixels
        const leftPx = this.timeToPxFn(item.start);
        const widthPx = Math.max(this.timeToPxFn(item.duration), 4);

        if (!el) {
          // Re-instantiate a fresh, recycled element
          el = document.createElement('div');
          el.dataset.id = item.id;
          el.setAttribute('draggable', 'false');

          // Double tap triggers split handler on clip
          el.addEventListener('mousedown', e => {
            if (e.button === 2) return; // Ignore right-clicks on mousedown
            e.preventDefault(); e.stopPropagation();
            if (e.target.dataset.action) this.state.handleDrag(e, item.id, e.target.dataset.action);
            else this.state.handleDrag(e, item.id, 'move');
          });

          el.addEventListener('touchstart', e => {
            e.stopPropagation();
            if (e.target.dataset.action) this.state.handleDrag(e, item.id, e.target.dataset.action);
            else this.state.handleDrag(e, item.id, 'move');
          }, { passive: true });

          el.addEventListener('contextmenu', e => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.showTimelineContextMenu === 'function') {
              window.showTimelineContextMenu(e, item.id);
            }
          });

          track.appendChild(el);
          this._nodeMap.set(item.id, el);
        } else if (el.parentElement !== track) {
          // Element exists in nodeMap but is detached or in wrong track —
          // this happens after undo/redo, history restore, or track changes.
          // Force re-append to the correct track so it becomes visible.
          track.appendChild(el);
        }

        // Apply HTML template once or if it has modified parameters
        const isAudio = trackId === 'a1';
        const isFx = trackId === 'fx1';
        const isOffline = item.type !== 'text' && item.type !== 'effect' && !item.src;
        
        let expectedClass = 'tl-clip';
        if (isAudio) expectedClass = 'tl-audio-block';
        else if (isFx) expectedClass = 'tl-fx-block';
        
        if (isSelected) expectedClass += ' selected';
        if (isOffline) expectedClass += ' offline';
        
        if (el.className !== expectedClass) {
          el.className = expectedClass;
        }

        const expectedHTML = isAudio 
          ? `<span class="tl-audio-name">${item.name}</span>
             <div class="tl-trim-left" data-action="trim-start"></div>
             <div class="tl-trim-right" data-action="trim-end"></div>`
          : (isFx
              ? `<span class="tl-fx-name">✨ ${item.name}</span>
                 <div class="tl-trim-left" data-action="trim-start"></div>
                 <div class="tl-trim-right" data-action="trim-end"></div>`
              : `${item.thumbnail ? `<div class="tl-clip-filmstrip"><img class="tl-clip-frame" src="${item.thumbnail}" draggable="false"/></div>` : ''}
                 <div class="tl-clip-name">${item.name}</div>
                 <div class="tl-trim-left" data-action="trim-start"></div>
                 <div class="tl-trim-right" data-action="trim-end"></div>`);

        if (el.innerHTML !== expectedHTML) {
          el.innerHTML = expectedHTML;
        }

        // Strict pixel coordinates (avoiding thrashing reflow updates)
        const leftStyle = leftPx + 'px';
        const widthStyle = widthPx + 'px';
        
        if (el.style.left !== leftStyle) el.style.left = leftStyle;
        if (el.style.width !== widthStyle) el.style.width = widthStyle;
      });
    });
  }

  // Rapidly update ONLY the active dragged clip's offset using translate to bypass reflow loop
  updateDragNodeOffset(itemId, newStart) {
    const el = this._nodeMap.get(itemId);
    if (el && this.timeToPxFn) {
      const leftPx = this.timeToPxFn(newStart);
      el.style.left = leftPx + 'px';
    }
  }

  clearRecycler() {
    // Remove all cached DOM elements from the DOM before clearing the map
    for (const el of this._nodeMap.values()) {
      if (el.parentElement) el.remove();
    }
    this._nodeMap.clear();
  }
}

export const timelineVirtualizer = new TimelineVirtualizer();
