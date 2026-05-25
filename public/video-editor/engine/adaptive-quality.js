/**
 * public/video-editor/engine/adaptive-quality.js
 * 
 * Central quality coordinator. Sets and downgrades active rendering configs.
 * Translates device tiers into physical rendering boundaries (resolution, FPS, decoder budgets).
 */

import { DeviceClasses } from './device-profiler.js';

export const QualityProfiles = {
  [DeviceClasses.LOW_END]: {
    previewHeight: 180,
    targetFps: 15,
    maxDecoders: 1,
    enableShadows: false,
    enableComplexFilters: false,
    waveformDensity: 0.15,
    thumbnailQuality: 'first-only', // Only generate first filmstrip frame
    aggressiveCleanup: true
  },
  [DeviceClasses.MID_RANGE]: {
    previewHeight: 360,
    targetFps: 24,
    maxDecoders: 2,
    enableShadows: true,
    enableComplexFilters: true,
    waveformDensity: 0.5,
    thumbnailQuality: 'sampled',
    aggressiveCleanup: false
  },
  [DeviceClasses.HIGH_END]: {
    previewHeight: 540,
    targetFps: 30,
    maxDecoders: 4,
    enableShadows: true,
    enableComplexFilters: true,
    waveformDensity: 1.0,
    thumbnailQuality: 'full',
    aggressiveCleanup: false
  }
};

class AdaptiveQualityManager {
  constructor() {
    this.currentTier = DeviceClasses.MID_RANGE;
    this.activeConfig = { ...QualityProfiles[DeviceClasses.MID_RANGE] };
    this.canvasElement = null;
  }

  initialize(deviceClass, canvasElement) {
    this.currentTier = deviceClass;
    this.canvasElement = canvasElement;
    this.activeConfig = { ...QualityProfiles[deviceClass] };
    this.applyResolution();
    console.log(`[AdaptiveQuality] Configured profile: ${this.currentTier}`, this.activeConfig);
  }

  applyResolution() {
    if (!this.canvasElement) return;
    
    // Set preview canvas resolution based on active profile
    const aspect = 16 / 9; // Core aspect ratio of Editroy
    const h = this.activeConfig.previewHeight;
    const w = Math.round(h * aspect);
    
    if (this.canvasElement.width !== w || this.canvasElement.height !== h) {
      this.canvasElement.width = w;
      this.canvasElement.height = h;
      console.log(`[AdaptiveQuality] Canvas resolution set to: ${w}x${h} (Aspect Ratio: 16:9)`);
    }
  }

  downgradeProfile() {
    if (this.currentTier === DeviceClasses.HIGH_END) {
      this.currentTier = DeviceClasses.MID_RANGE;
      this.activeConfig = { ...QualityProfiles[DeviceClasses.MID_RANGE] };
      this.applyResolution();
      console.warn('[AdaptiveQuality] Downgraded quality profile: HIGH_END ➔ MID_RANGE due to performance constraints');
      return true;
    } else if (this.currentTier === DeviceClasses.MID_RANGE) {
      this.currentTier = DeviceClasses.LOW_END;
      this.activeConfig = { ...QualityProfiles[DeviceClasses.LOW_END] };
      this.applyResolution();
      console.warn('[AdaptiveQuality] Emergency downgrade: MID_RANGE ➔ LOW_END. Throttled limits applied.');
      return true;
    }
    return false;
  }
}

export const adaptiveQuality = new AdaptiveQualityManager();
