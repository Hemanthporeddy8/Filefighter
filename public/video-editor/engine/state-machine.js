/**
 * public/video-editor/engine/state-machine.js
 * 
 * Centralized, isolated state machine for managing video editor status.
 * Prevents race conditions, overlapping asynchronous actions, and double render triggers.
 */

export const EditorStates = {
  IDLE: 'IDLE',
  IMPORTING: 'IMPORTING',
  PLAYING: 'PLAYING',
  EXPORTING: 'EXPORTING',
  SAFE_MODE: 'SAFE_MODE'
};

class StateMachine {
  constructor() {
    this._state = EditorStates.IDLE;
    this._listeners = new Set();
  }

  get state() {
    return this._state;
  }

  transitionTo(newState) {
    if (!EditorStates[newState]) {
      console.error(`[StateMachine] Invalid target state: ${newState}`);
      return false;
    }

    if (this._state === newState) return true;

    // Validate valid transitions to safeguard execution order
    if (this._state === EditorStates.EXPORTING && newState === EditorStates.PLAYING) {
      console.warn(`[StateMachine] Blocked invalid transition: EXPORTING -> PLAYING`);
      return false;
    }

    if (this._state === EditorStates.IMPORTING && newState === EditorStates.PLAYING) {
      console.warn(`[StateMachine] Blocked active playback during media import`);
      return false;
    }

    const oldState = this._state;
    this._state = newState;
    console.log(`[StateMachine] Transition: ${oldState} ➔ ${newState}`);
    
    // Notify listeners
    this._listeners.forEach(fn => fn(newState, oldState));
    return true;
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  is(checkState) {
    return this._state === checkState;
  }
}

export const stateMachine = new StateMachine();
