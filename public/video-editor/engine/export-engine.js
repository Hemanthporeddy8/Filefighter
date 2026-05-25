/**
 * public/video-editor/engine/export-engine.js
 * 
 * Central ExportEngine manager.
 * Implements chunked, non-blocking render sweeps, adaptive resolution ceilings,
 * cancellation bounds, and an airtight 10s watchdog recovery timeout.
 */

import { stateMachine, EditorStates } from './state-machine.js';
import { adaptiveQuality } from './adaptive-quality.js';
import { DeviceClasses } from './device-profiler.js';

class ExportEngine {
  constructor() {
    this.isExporting = false;
    this.cancelled = false;
    this._watchdogTimer = null;
    this._lastFrameTs = 0;
  }

  /**
   * Automatically select best export settings based on active device capabilities.
   * Low-end devices are constrained to a fast, reliable 480p export to ensure success.
   */
  getRecommendedSettings(originalW, originalH) {
    const tier = adaptiveQuality.currentTier;
    
    if (tier === DeviceClasses.LOW_END) {
      return { width: 854, height: 480, fps: 24, bitrate: 1200 * 1024 }; // 480p standard
    } else if (tier === DeviceClasses.MID_RANGE) {
      return { width: Math.min(originalW, 1280), height: Math.min(originalH, 720), fps: 24, bitrate: 2500 * 1024 }; // 720p maximum
    } else {
      return { width: originalW, height: originalH, fps: 30, bitrate: 5000 * 1024 }; // Full 1080p+ original
    }
  }

  /**
   * Executes chunk-based, non-blocking rendering.
   * Yields processing cycles back to the main UI thread to prevent browser freezes.
   */
  async exportProject(state, renderFrameFn, onProgress, onComplete, onError) {
    if (this.isExporting) return;

    this.isExporting = true;
    this.cancelled = false;
    stateMachine.transitionTo(EditorStates.EXPORTING);

    const duration = state.totalDuration;
    const settings = this.getRecommendedSettings(state.exportWidth || 1280, state.exportHeight || 720);
    const totalFrames = Math.ceil(duration * settings.fps);
    const timePerFrame = 1 / settings.fps;

    console.log(`[ExportEngine] Staging export: ${settings.width}x${settings.height} @ ${settings.fps}fps. Total frames: ${totalFrames}`);

    // Set canvas dimensions to match export settings
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = settings.width;
    renderCanvas.height = settings.height;
    const renderCtx = renderCanvas.getContext('2d');

    const stream = renderCanvas.captureStream ? renderCanvas.captureStream(settings.fps) : renderCanvas.mozCaptureStream(settings.fps);
    
    if (!window.MediaRecorder) {
      onError('MediaRecorder not supported by this browser.');
      this._cleanup();
      return;
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: settings.bitrate
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.start();

    // 1. Setup Watchdog timer (Phase 10 / Warning Watchdog)
    this._resetWatchdog(onError);

    try {
      let currentFrame = 0;
      
      const renderNextFrame = async () => {
        if (this.cancelled) {
          recorder.stop();
          onError('Export cancelled by user.');
          this._cleanup();
          return;
        }

        if (currentFrame >= totalFrames) {
          recorder.stop();
          setTimeout(() => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            onComplete(blob);
            this._cleanup();
          }, 100);
          return;
        }

        // Kick watchdog
        this._feedWatchdog();

        // Seek state timecode
        const time = currentFrame * timePerFrame;
        state.globalTime = time;

        // Render the frame onto export canvas
        renderFrameFn(renderCtx, renderCanvas);

        // Update progress callback
        currentFrame++;
        onProgress(Math.round((currentFrame / totalFrames) * 100));

        // Yield after every frame render to preserve main thread responsiveness
        if (currentFrame % 4 === 0) {
          setTimeout(renderNextFrame, 0); // Complete event loop yield
        } else {
          // Microtask yield
          await Promise.resolve();
          renderNextFrame();
        }
      };

      await renderNextFrame();

    } catch (e) {
      console.error('[ExportEngine] Export execution crashed:', e);
      onError(e.message || 'Export error');
      this._cleanup();
    }
  }

  _resetWatchdog(onError) {
    this._feedWatchdog();
    this._watchdogTimer = setInterval(() => {
      const now = performance.now();
      // Watchdog fails if more than 10 seconds pass since last frame (Phase 10 / Warning Watchdog)
      if (now - this._lastFrameTs > 10000) {
        console.error('[ExportEngine] Watchdog timeout: Render thread frozen for > 10s.');
        clearInterval(this._watchdogTimer);
        this.cancelled = true;
        onError('Export aborted: Rendering engine watchdog timeout (hardware pipeline frozen).');
        this._cleanup();
      }
    }, 2000);
  }

  _feedWatchdog() {
    this._lastFrameTs = performance.now();
  }

  cancel() {
    this.cancelled = true;
  }

  _cleanup() {
    this.isExporting = false;
    if (this._watchdogTimer) {
      clearInterval(this._watchdogTimer);
      this._watchdogTimer = null;
    }
    stateMachine.transitionTo(EditorStates.IDLE);
    console.log('[ExportEngine] Released export locks.');
  }
}

export const exportEngine = new ExportEngine();
