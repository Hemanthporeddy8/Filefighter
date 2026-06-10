/**
 * public/video-editor/engine/export-engine.js
 * 
 * Central ExportEngine manager.
 * Implements real-time canvas capture with Web Audio API mixing.
 * Standardized MediaRecorder output is fully compatible with all browsers and devices.
 */

import { stateMachine, EditorStates } from './state-machine.js';

class ExportEngine {
  constructor() {
    this.isExporting = false;
    this.cancelled = false;
    this.recorder = null;
  }

  /**
   * Universal real-time MediaRecorder and Web Audio export.
   * Works offline and on all mobile and desktop devices (iOS, Safari, Firefox).
   */
  async exportProject(state, renderFrameFn, onProgress, onComplete, onError) {
    if (this.isExporting) return;
    this.isExporting = true;
    this.cancelled = false;

    // 1. Enter export mode state
    stateMachine.transitionTo(EditorStates.EXPORTING);

    try {
      const renderCanvas = document.getElementById('preview-img-canvas');
      if (!renderCanvas) throw new Error('Canvas element not found.');

      // 2. Initialize Web Audio mixer destination
      if (typeof window.getAudioContext === 'undefined') {
        throw new Error('Web Audio Context is not initialized.');
      }
      
      const ctx = window.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const centralMixer = window.centralMixerNode;
      if (!centralMixer) throw new Error('Web Audio mixer node not found.');

      // Mute local speaker output during export to keep it silent
      try {
        centralMixer.disconnect(ctx.destination);
      } catch (e) {}

      // Create stream destination node to mix soundtracks
      const dest = ctx.createMediaStreamDestination();
      centralMixer.connect(dest);

      // 3. Combine canvas stream (video) and destination stream (audio)
      const canvasStream = renderCanvas.captureStream ? renderCanvas.captureStream(state.fps) : renderCanvas.mozCaptureStream(state.fps);
      const mixedStream = new MediaStream();

      canvasStream.getVideoTracks().forEach(t => mixedStream.addTrack(t));
      dest.stream.getAudioTracks().forEach(t => mixedStream.addTrack(t));

      // 4. Select MIME type compatible with device
      let mimeType = 'video/webm';
      const preferredFmt = state.exportFormat || 'webm';
      if (preferredFmt === 'mp4') {
        mimeType = MediaRecorder.isTypeSupported('video/mp4') 
          ? 'video/mp4' 
          : MediaRecorder.isTypeSupported('video/webm;codecs=h264')
          ? 'video/webm;codecs=h264'
          : 'video/webm';
      } else {
        mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';
      }

      console.log(`[ExportEngine] Recording combined streams: ${mimeType} @ ${state.fps}fps`);

      this.recorder = new MediaRecorder(mixedStream, {
        mimeType,
        videoBitsPerSecond: 4_000_000 // 4 Mbps high quality
      });

      const chunks = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      // 5. Seek to beginning and prep decoders
      state.globalTime = 0;
      await new Promise(r => setTimeout(r, 400));

      this.recorder.start();

      // Start timeline playback loop
      stateMachine.transitionTo(EditorStates.PLAYING);

      const totalDur = state.totalDuration;

      const progressInterval = setInterval(() => {
        if (this.cancelled) {
          clearInterval(progressInterval);
          this._finalize(state, ctx, dest, onError);
          return;
        }

        const elapsed = state.globalTime;
        const pct = Math.min(99, Math.round((elapsed / totalDur) * 100));
        onProgress(pct);

        // Stop if we hit the end of the duration or state transitions away
        if (elapsed >= totalDur - 0.05 || !stateMachine.is(EditorStates.PLAYING)) {
          clearInterval(progressInterval);
          onProgress(100);

          this.recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            onComplete(blob);
            this._finalize(state, ctx, dest);
          };
          this.recorder.stop();
        }
      }, 100);

    } catch (e) {
      console.error('[ExportEngine] Export execution crashed:', e);
      onError(e.message || 'Export error');
      this.isExporting = false;
      stateMachine.transitionTo(EditorStates.IDLE);
    }
  }

  _finalize(state, ctx, dest, onError = null) {
    this.isExporting = false;
    this.recorder = null;
    stateMachine.transitionTo(EditorStates.IDLE);
    state.globalTime = 0;

    // Restore Web Audio graph (reconnect speakers)
    const centralMixer = window.centralMixerNode;
    if (centralMixer) {
      try {
        centralMixer.disconnect(dest);
      } catch (e) {}
      try {
        centralMixer.disconnect(ctx.destination);
      } catch (e) {}
      centralMixer.connect(ctx.destination);
    }

    if (onError && this.cancelled) {
      onError('Export cancelled by user.');
    }
  }

  cancel() {
    this.cancelled = true;
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
  }
}

export const exportEngine = new ExportEngine();
