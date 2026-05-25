/**
 * public/video-editor/engine/decoder-pool.js
 * 
 * Central VideoDecoderPool manager. Enforces active video budget bounds to prevent
 * browser media pipeline overload, hardware decoder starvation, and browser crashes.
 */

import { adaptiveQuality } from './adaptive-quality.js';

class VideoDecoderPool {
  constructor() {
    this._pool = new Map(); // itemId ➔ HTMLVideoElement
  }

  get activeCount() {
    return this._pool.size;
  }

  /**
   * Fetch or instantiate a video element for an item.
   * If budget ceiling is reached, purges the oldest unused decoder.
   */
  get(item) {
    if (this._pool.has(item.id)) {
      return this._pool.get(item.id);
    }

    const budget = adaptiveQuality.activeConfig.maxDecoders || 2;

    // Budget enforcement
    if (this._pool.size >= budget) {
      this._pruneOldestDecoder();
    }

    const vid = document.createElement('video');
    vid.src = item.proxySrc || item.src; // Automatically leverage proxy if generated!
    vid.muted = true;
    vid.preload = 'auto'; // Preload active clips for immediate rendering
    vid.playsInline = true;

    // Redraw canvas as soon as metadata or initial frames arrive
    vid.onloadedmetadata = () => {
      import('/video-editor/engine/render-scheduler.js').then(({ renderScheduler }) => {
        renderScheduler.triggerSingleUpdate();
      });
    };
    vid.oncanplay = () => {
      import('/video-editor/engine/render-scheduler.js').then(({ renderScheduler }) => {
        renderScheduler.triggerSingleUpdate();
      });
    };
    
    // Disable heavy hardware processing states if low-end
    if (adaptiveQuality.activeConfig.aggressiveCleanup) {
      vid.disablePictureInPicture = true;
    }

    this._pool.set(item.id, vid);
    console.log(`[DecoderPool] Registered decoder for clip: ${item.name} (Active decoders: ${this._pool.size}/${budget})`);
    return vid;
  }

  _pruneOldestDecoder() {
    // Find the first key (first added, FIFO) and destroy it to release hardware budget
    const oldestId = this._pool.keys().next().value;
    if (oldestId) {
      this.remove(oldestId);
      console.log(`[DecoderPool] Pruned oldest video decoder to respect system hardware budget bounds`);
    }
  }

  remove(itemId) {
    const vid = this._pool.get(itemId);
    if (vid) {
      vid.pause();
      vid.removeAttribute('src'); // Fully clear video link
      vid.load(); // Forces garbage collection of the hardware decoder channel
      this._pool.delete(itemId);
    }
  }

  pauseAll() {
    for (const vid of this._pool.values()) {
      if (!vid.paused) vid.pause();
    }
  }

  /**
   * Defer preloads: Only load/decode clips that are within a 2-second range of the playhead.
   * Pause offscreen/inactive clips immediately to free up hardware rendering resources.
   */
  pruneInactive(globalTime, timelineItems) {
    const PRELOAD_BUFFER = 2.0; // seconds

    for (const [id, vid] of this._pool.entries()) {
      const item = timelineItems.find(i => i.id === id);
      if (!item) {
        this.remove(id);
        continue;
      }

      const isInsideVisibleRange = globalTime >= (item.start - PRELOAD_BUFFER) && globalTime < (item.start + item.duration + PRELOAD_BUFFER);
      const isCurrentlyPlaying = globalTime >= item.start && globalTime < (item.start + item.duration);

      // Pause rendering immediately if out of active region
      if (!isCurrentlyPlaying && !vid.paused) {
        vid.pause();
      }

      // If scrolled far out of view, destroy the decoder completely
      if (!isInsideVisibleRange) {
        this.remove(id);
        console.log(`[DecoderPool] Unloaded inactive offscreen decoder: ${item.name}`);
      }
    }
  }

  clear() {
    for (const id of this._pool.keys()) {
      this.remove(id);
    }
    this._pool.clear();
  }
}

export const decoderPool = new VideoDecoderPool();
