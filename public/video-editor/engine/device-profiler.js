/**
 * public/video-editor/engine/device-profiler.js
 * 
 * Central hardware profiler and thermal manager.
 * Detects device hardware bounds and monitors thermal health in real-time.
 */

export const DeviceClasses = {
  LOW_END: 'LOW_END',
  MID_RANGE: 'MID_RANGE',
  HIGH_END: 'HIGH_END'
};

class DeviceProfiler {
  constructor() {
    this.profile = {
      ram: 4, // Default fallback
      cores: 4,
      gpu: 'Unknown GPU',
      isMobile: false,
      resolution: 'unknown',
      webGL: false,
      webGPU: false,
      benchmarkFps: 60,
      deviceClass: DeviceClasses.MID_RANGE
    };

    this.thermalMetrics = {
      fpsHistory: [],
      latencyHistory: [],
      isThrottled: false
    };
  }

  async profileDevice() {
    try {
      // 1. RAM & Cores Detection
      if (navigator.deviceMemory) this.profile.ram = navigator.deviceMemory;
      if (navigator.hardwareConcurrency) this.profile.cores = navigator.hardwareConcurrency;

      // 2. Mobile Regex
      const ua = navigator.userAgent;
      this.profile.isMobile = /Mobi|Android|iPhone|iPad|Macintosh/i.test(ua) && ('ontouchstart' in window);

      // 3. Screen Dimensions
      this.profile.resolution = `${window.screen.width}x${window.screen.height}`;

      // 4. WebGL and GPU identification (with safety fallback for blocked permissions)
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        this.profile.webGL = true;
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          this.profile.gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown GPU';
        }
      }

      // 5. WebGPU Detection
      if (navigator.gpu) this.profile.webGPU = true;

      // 6. Async FPS Benchmark timings
      this.profile.benchmarkFps = await this._runFpsBenchmark();

      // 7. Classify Hardware Tier
      this._classifyDevice();

      console.log('[DeviceProfiler] Completed device profile:', this.profile);
    } catch (e) {
      console.warn('[DeviceProfiler] Hardware profile failed, falling back to MID_RANGE profile:', e);
      this.profile.deviceClass = DeviceClasses.MID_RANGE;
    }

    return this.profile;
  }

  _classifyDevice() {
    const isMobile = this.profile.isMobile;
    const ram = this.profile.ram;
    const cores = this.profile.cores;
    const fps = this.profile.benchmarkFps;
    const gpuLower = this.profile.gpu.toLowerCase();

    // Check high-end parameters
    const hasHighEndGpu = gpuLower.includes('nvidia') || gpuLower.includes('radeon') || gpuLower.includes('apple') || gpuLower.includes('geforce');
    const isHighEnd = ram >= 8 && cores >= 8 && fps >= 55 && !isMobile && hasHighEndGpu;

    // Check low-end parameters
    const isLowEnd = ram <= 2 || cores <= 2 || fps < 35 || isMobile;

    if (isHighEnd) {
      this.profile.deviceClass = DeviceClasses.HIGH_END;
    } else if (isLowEnd) {
      this.profile.deviceClass = DeviceClasses.LOW_END;
    } else {
      this.profile.deviceClass = DeviceClasses.MID_RANGE;
    }
  }

  _runFpsBenchmark() {
    return new Promise((resolve) => {
      let count = 0;
      let start = performance.now();
      const frames = 20;

      function tick() {
        count++;
        if (count < frames) {
          requestAnimationFrame(tick);
        } else {
          const duration = performance.now() - start;
          const fps = Math.round((frames * 1000) / duration);
          resolve(Math.min(fps, 60)); // Clamp to 60fps max for benchmark
        }
      }
      requestAnimationFrame(tick);
    });
  }

  // --- Phase 11: Thermal and Latency protection watcher ---
  recordFrameRender(durationMs) {
    this.thermalMetrics.latencyHistory.push(durationMs);
    if (this.thermalMetrics.latencyHistory.length > 40) {
      this.thermalMetrics.latencyHistory.shift();
    }

    // Monitor for sudden severe latency collapses (throttling symptoms)
    const recentLatency = this.thermalMetrics.latencyHistory.slice(-15);
    const avgLatency = recentLatency.reduce((a, b) => a + b, 0) / (recentLatency.length || 1);
    
    // Throttling warning: sustained latency spike > 120ms
    if (avgLatency > 120 && recentLatency.length >= 10 && !this.thermalMetrics.isThrottled) {
      this.thermalMetrics.isThrottled = true;
      console.warn(`[DeviceProfiler] Severe thermal/render throttling detected: Avg frame latency ${avgLatency.toFixed(1)}ms`);
      return true; // Trigger downgrade warning
    }

    if (avgLatency < 45 && this.thermalMetrics.isThrottled) {
      this.thermalMetrics.isThrottled = false;
      console.log('[DeviceProfiler] Render thermal/latency recovered.');
    }

    return false;
  }
}

export const deviceProfiler = new DeviceProfiler();
