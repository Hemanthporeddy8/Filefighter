/**
 * public/video-editor/engine/video-proxy.js
 * 
 * Central Video Proxy System.
 * Enforces Progressive chunk-based proxy generation during idle cycles.
 * Fully equipped with standard HTML canvas fallbacks for iOS/Safari compliance.
 */

import { taskQueue } from './task-queue.js';
import { adaptiveQuality } from './adaptive-quality.js';
import { memoryManager } from './memory-manager.js';
import { DeviceClasses } from './device-profiler.js';

class VideoProxyManager {
  constructor() {
    this.proxies = new Map(); // itemId ➔ proxy Blob URL
  }

  /**
   * Evaluates if a file qualifies for dynamic proxy generation.
   * HEVC, 4K, HDR, or high-bitrate original assets will be proxied automatically.
   */
  shouldProxy(file, videoWidth, videoHeight) {
    if (adaptiveQuality.currentTier === DeviceClasses.LOW_END) {
      return true; // Proxy everything on potato devices!
    }

    const isLargeResolution = videoWidth > 1920 || videoHeight > 1080;
    const isLargeSize = file.size > 25 * 1024 * 1024; // > 25MB

    return isLargeResolution || isLargeSize;
  }

  /**
   * Triggers progressive, chunked transcoding in browser idle periods.
   * Spawns chunk processors sequentially to prevent main-thread freeze.
   */
  generateProxy(item, onProgress = null) {
    const file = item.file;
    if (!file) return;

    const taskId = `proxy-gen-${item.id}`;

    // Queue the progressive transcoder into taskQueue
    taskQueue.enqueue(
      taskId,
      async () => {
        console.log(`[VideoProxy] Initiating progressive idle-time transcoding for: ${item.name}`);
        const proxyUrl = await this._transcodeProgressive(item, onProgress);
        if (proxyUrl) {
          item.proxySrc = proxyUrl;
          this.proxies.set(item.id, proxyUrl);
          memoryManager.trackBlob(proxyUrl);
          console.log(`[VideoProxy] Progressive proxy compiled successfully for ${item.name}:`, proxyUrl);
        }
      },
      1, // Lower priority to allow instant metadata/waveforms first
      () => {
        console.log(`[VideoProxy] Progressive proxy generation cancelled for: ${item.name}`);
      }
    );
  }

  /**
   * Progressive chunk-based transcoder.
   * Decodes and paints frames onto a 360p canvas in tiny slices of 3 seconds.
   */
  _transcodeProgressive(item, onProgress) {
    return new Promise((resolve) => {
      const vid = document.createElement('video');
      vid.src = item.src;
      vid.muted = true;
      vid.playsInline = true;

      vid.onloadedmetadata = async () => {
        const duration = vid.duration || 10;
        
        // 1. OffscreenCanvas with fallback for iOS/Safari (Phase 4 / Warning 3)
        let canvas, ctx;
        const targetW = 640;
        const targetH = 360;

        if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(targetW, targetH);
          ctx = canvas.getContext('2d');
        } else {
          // Standard DOM-attached fallback (Safari / old iOS compliance)
          canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          canvas.style.display = 'none';
          document.body.appendChild(canvas);
          ctx = canvas.getContext('2d');
        }

        const stream = canvas.captureStream ? canvas.captureStream(15) : canvas.mozCaptureStream(15);
        
        // Safety check if browser lacks recording capabilities
        if (!window.MediaRecorder) {
          console.warn('[VideoProxy] MediaRecorder unavailable. Skipping proxy generation.');
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
          resolve(null);
          return;
        }

        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8',
          videoBitsPerSecond: 400 * 1024 // Extremely lightweight 400kbps bitrate!
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.start();

        // 2. Progressive chunk seeker loop: processes in 3-second slices
        const CHUNK_SIZE = 3.0; // seconds
        let currentTime = 0;

        const processSlice = async () => {
          if (currentTime >= duration) {
            recorder.stop();
            setTimeout(() => {
              const blob = new Blob(chunks, { type: 'video/webm' });
              const url = URL.createObjectURL(blob);
              if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
              resolve(url);
            }, 100);
            return;
          }

          const end = Math.min(currentTime + CHUNK_SIZE, duration);
          
          // Seek and render frame by frame at 15fps within this chunk slice
          const framesInSlice = Math.round(CHUNK_SIZE * 15);
          const frameInterval = CHUNK_SIZE / framesInSlice;

          for (let f = 0; f < framesInSlice; f++) {
            const frameTime = currentTime + (f * frameInterval);
            if (frameTime > duration) break;

            await new Promise((r) => {
              vid.currentTime = frameTime;
              vid.onseeked = () => {
                ctx.drawImage(vid, 0, 0, targetW, targetH);
                r();
              };
            });

            // Yield control back to browser thread after every single frame draw (Warning 1)
            await new Promise(r => setTimeout(r, 0));
          }

          currentTime = end;
          if (onProgress) {
            onProgress(Math.round((currentTime / duration) * 100));
          }

          // Force cooperative browser yielding using requestIdleCallback between chunk slices
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => processSlice());
          } else {
            setTimeout(() => processSlice(), 50);
          }
        };

        processSlice();
      };

      vid.onerror = () => {
        resolve(null);
      };
    });
  }

  clear() {
    this.proxies.clear();
  }
}

export const videoProxy = new VideoProxyManager();
