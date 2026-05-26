/**
 * public/video-editor/engine/memory-manager.js
 * 
 * Central Memory Manager. Revokes Object Blobs upon clip deletion, frees canvas 
 * frames, and adaptively clears image caches if estimated RAM budget is exceeded.
 */

import { adaptiveQuality } from './adaptive-quality.js';
import { decoderPool } from './decoder-pool.js';
import { DeviceClasses } from './device-profiler.js';

// Absolute RAM thresholds per hardware tier in Megabytes
export const MemoryBudgets = {
  [DeviceClasses.LOW_END]: 700,
  [DeviceClasses.MID_RANGE]: 1500,
  [DeviceClasses.HIGH_END]: 4000
};

class MemoryManager {
  constructor() {
    this._blobUrls = new Set();
    this.imageCache = new Map();
    this.audioNodesMap = new Map();
  }

  trackBlob(url) {
    if (url && url.startsWith('blob:')) {
      this._blobUrls.add(url);
    }
    return url;
  }

  /**
   * Clears all system memory and releases all registered Blob resources
   * when deleting a clip to force native browser garbage collection.
   */
  freeClipResources(item, sharedOptions = {}) {
    const { srcShared = false, proxyShared = false, thumbShared = false } = sharedOptions;

    // 1. Revoke the Blob URLs only if no other timeline item is using them
    if (item.src && item.src.startsWith('blob:') && !srcShared) {
      URL.revokeObjectURL(item.src);
      this._blobUrls.delete(item.src);
    }
    
    if (item.proxySrc && item.proxySrc.startsWith('blob:') && !proxyShared) {
      URL.revokeObjectURL(item.proxySrc);
      this._blobUrls.delete(item.proxySrc);
    }

    if (item.thumbnail && item.thumbnail.startsWith('blob:') && !thumbShared) {
      URL.revokeObjectURL(item.thumbnail);
      this._blobUrls.delete(item.thumbnail);
    }

    // 2. Clear out decoder pool elements
    decoderPool.remove(item.id);

    // 3. Clear image cache refs
    this.imageCache.delete(item.id);

    // 4. Destroy audio contexts/nodes to free WebAudio resources
    const node = this.audioNodesMap.get(item.id);
    if (node) {
      node.audio.pause();
      node.audio.removeAttribute('src');
      node.audio.load();
      this.audioNodesMap.delete(item.id);
    }

    console.log(`[MemoryManager] Cleaned up and released resource allocations for clip: ${item.name}`);
    this.checkMemoryPressure();
  }

  /**
   * Adaptive RAM watcher. Triggers severe quality down-steps if estimated
   * size exceeds allocated system memory budget.
   */
  checkMemoryPressure() {
    let estimatedSizeMB = 0;
    
    // Estimate based on active items
    estimatedSizeMB += decoderPool.activeCount * 25; // ~25MB average per active hardware decoding channel
    estimatedSizeMB += this.imageCache.size * 5;     // ~5MB average per cached image element
    estimatedSizeMB += this._blobUrls.size * 40;     // ~40MB estimate per original/proxy video blob in active memory

    const budget = MemoryBudgets[adaptiveQuality.currentTier] || 1500;

    console.log(`[MemoryManager] Estimated RAM consumption: ${estimatedSizeMB}MB / Budget Limit: ${budget}MB`);

    if (estimatedSizeMB > budget) {
      console.warn(`[MemoryManager] Memory budget exceeded (${estimatedSizeMB}MB > ${budget}MB)! Running aggressive garbage collection...`);
      
      // 1. Purge all inactive image cache entries
      this.imageCache.clear();
      
      // 2. Command decoder pool to immediately wipe all inactive decoders
      decoderPool.clear();

      // 3. Force downscale the preview canvas to save back-buffer footprint
      adaptiveQuality.downgradeProfile();
    }
  }

  clearAll() {
    // Wipe everything
    for (const url of this._blobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch(e) {}
    }
    this._blobUrls.clear();
    
    decoderPool.clear();
    this.imageCache.clear();

    for (const node of this.audioNodesMap.values()) {
      node.audio.pause();
      node.audio.removeAttribute('src');
      node.audio.load();
    }
    this.audioNodesMap.clear();

    console.log('[MemoryManager] Released all project-level memory locks.');
  }
}

export const memoryManager = new MemoryManager();
