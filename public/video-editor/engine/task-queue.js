/**
 * public/video-editor/engine/task-queue.js
 * 
 * Central background yielding task scheduler.
 * Executes heavy parsing, thumbnails, and waveforms in small sequential batches.
 * Seamlessly pauses during active play/drag states to prevent UI stutters.
 */

import { stateMachine, EditorStates } from './state-machine.js';

class BackgroundTaskQueue {
  constructor() {
    this._queue = []; // Array of { id, priority, fn, onCancel }
    this._activeTask = null;
    this._isPaused = false;
    this._running = false;
    
    // Automatically suspend background work during playback
    stateMachine.onChange((state) => {
      if (state === EditorStates.PLAYING) {
        this.pause();
      } else {
        this.resume();
      }
    });
  }

  enqueue(id, fn, priority = 0, onCancel = null) {
    // Remove duplicate task IDs if re-queued
    this.cancel(id);

    this._queue.push({ id, fn, priority, onCancel });
    // Sort descending by priority (higher priority runs first)
    this._queue.sort((a, b) => b.priority - a.priority);

    console.log(`[TaskQueue] Enqueued task: ${id} (Total queued: ${this._queue.length})`);
    
    if (!this._running && !this._isPaused) {
      this._startProcessing();
    }
  }

  cancel(id) {
    const index = this._queue.findIndex(t => t.id === id);
    if (index !== -1) {
      const task = this._queue[index];
      if (task.onCancel) task.onCancel();
      this._queue.splice(index, 1);
      console.log(`[TaskQueue] Cancelled queued task: ${id}`);
    }
  }

  pause() {
    if (this._isPaused) return;
    this._isPaused = true;
    console.log('[TaskQueue] Suspended background background-tasks to prioritize real-time UI/playback smoothness.');
  }

  resume() {
    if (!this._isPaused) return;
    this._isPaused = false;
    console.log('[TaskQueue] Resumed background queues.');
    if (!this._running && this._queue.length > 0) {
      this._startProcessing();
    }
  }

  _startProcessing() {
    this._running = true;
    this._processNext();
  }

  _processNext() {
    if (this._isPaused || this._queue.length === 0) {
      this._running = false;
      return;
    }

    const task = this._queue.shift();
    this._activeTask = task;

    const executeTask = async () => {
      try {
        await task.fn();
      } catch (e) {
        console.error(`[TaskQueue] Task failed: ${task.id}`, e);
      } finally {
        this._activeTask = null;
        
        // Yield control back to browser immediately before starting next task
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => this._processNext(), { timeout: 100 });
        } else {
          setTimeout(() => this._processNext(), 16); // Safari fallback to allow a draw cycle
        }
      }
    };

    executeTask();
  }

  clear() {
    this._queue.forEach(t => { if (t.onCancel) t.onCancel(); });
    this._queue = [];
    this._activeTask = null;
    this._running = false;
  }
}

export const taskQueue = new BackgroundTaskQueue();
