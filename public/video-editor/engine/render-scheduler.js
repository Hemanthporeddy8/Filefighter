/**
 * public/video-editor/engine/render-scheduler.js
 * 
 * Central RenderScheduler requestAnimationFrame loop.
 * Orchestrates canvas draws, maintains frame telemetry, auto-pauses when tab
 * is hidden, and ensures tight audio-to-video synchronization.
 */

import { stateMachine, EditorStates } from './state-machine.js';
import { adaptiveQuality } from './adaptive-quality.js';
import { deviceProfiler } from './device-profiler.js';
import { decoderPool } from './decoder-pool.js';
import { memoryManager } from './memory-manager.js';

class RenderScheduler {
  constructor() {
    this._rafId = null;
    this._lastTs = 0;
    this._lastDrawTs = 0;
    this._drawCount = 0;
    
    this.state = null; // References the editor's global state
    this.renderFn = null; // Callback for actual canvas drawing
    this.updateMediaPlaybackFn = null; // Callback for audio/video plays
    this.updatePlayheadFn = null; // Callback for playhead positions
    
    // Automatically manage play loop states on state changes
    stateMachine.onChange((state) => {
      if (state === EditorStates.PLAYING) {
        this.start();
      } else {
        this.stop();
      }
    });

    // AIRTIGHT tab-hidden handler: Stop sound immediately and pause canvas
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          console.log('[RenderScheduler] Tab hidden. Freezing all hardware playback rendering.');
          this.stopMediaSound();
        } else {
          console.log('[RenderScheduler] Tab visible. Restoring render scheduler.');
          if (stateMachine.is(EditorStates.PLAYING)) {
            this._lastTs = performance.now();
            this.start();
          }
        }
      });
    }
  }

  initialize(globalState, renderFn, updateMediaPlaybackFn, updatePlayheadFn) {
    this.state = globalState;
    this.renderFn = renderFn;
    this.updateMediaPlaybackFn = updateMediaPlaybackFn;
    this.updatePlayheadFn = updatePlayheadFn;
  }

  start() {
    if (this._rafId) return;
    this._lastTs = performance.now();
    this._lastDrawTs = 0;
    this._loop(performance.now());
  }

  stop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.stopMediaSound();
  }

  stopMediaSound() {
    decoderPool.pauseAll();
    for (const node of memoryManager.audioNodesMap.values()) {
      if (!node.audio.paused) node.audio.pause();
    }
  }

  _loop(ts) {
    // Stop rendering completely if page is tab-hidden (unless exporting)
    if (document.hidden && !stateMachine.is(EditorStates.EXPORTING)) {
      this.stopMediaSound();
      this._rafId = requestAnimationFrame((t) => this._loop(t));
      return;
    }

    const elapsed = ts - this._lastTs;
    this._lastTs = ts;

    // Advance timeline head time
    if (stateMachine.is(EditorStates.PLAYING) && this.state) {
      const dt = elapsed / 1000;
      this.state.globalTime += dt;

      // Handle timeline end bounds
      if (this.state.globalTime >= this.state.totalDuration) {
        this.state.globalTime = 0;
        stateMachine.transitionTo(EditorStates.IDLE);
        if (this.updatePlayheadFn) this.updatePlayheadFn();
        return;
      }
    }

    // Dynamic FPS throttling based on active quality profile config
    const targetFps = adaptiveQuality.activeConfig.targetFps || 24;
    const interval = 1000 / targetFps;

    if (ts - this._lastDrawTs >= interval) {
      this._lastDrawTs = ts;
      
      const renderStart = performance.now();
      if (this.renderFn) this.renderFn();
      const renderDuration = performance.now() - renderStart;

      // Telemetry: check for rendering bottlenecks (Phase 11)
      const warning = deviceProfiler.recordFrameRender(renderDuration);
      if (warning) {
        const downgraded = adaptiveQuality.downgradeProfile();
        if (downgraded && this.state && this.state.showToast) {
          this.state.showToast('⚠️ Safe Mode Active', 'Lowered preview parameters to cool down processor.', true);
        }
      }

      // Check decoder pooling and RAM boundaries periodically (~every 3 seconds)
      this._drawCount++;
      if (this._drawCount % (targetFps * 3) === 0) {
        decoderPool.pruneInactive(this.state.globalTime, this.state.items);
        memoryManager.checkMemoryPressure();
      }
    }

    // Media element syncing & Playhead tracking
    if (this.updateMediaPlaybackFn) this.updateMediaPlaybackFn();
    if (this.updatePlayheadFn) this.updatePlayheadFn();

    // Guard recursion: only schedule next frame if actively playing/exporting
    if (stateMachine.is(EditorStates.PLAYING) || stateMachine.is(EditorStates.EXPORTING)) {
      this._rafId = requestAnimationFrame((t) => this._loop(t));
    }
  }

  // Single rendering frame seek updates
  triggerSingleUpdate() {
    if (this.renderFn) this.renderFn();
    if (this.updateMediaPlaybackFn) this.updateMediaPlaybackFn();
    if (this.updatePlayheadFn) this.updatePlayheadFn();
  }
}

export const renderScheduler = new RenderScheduler();
