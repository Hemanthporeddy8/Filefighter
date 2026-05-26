/**
 * public/video-editor/engine/session-store.js
 * 
 * Lightweight session persistent manager (IndexedDB/localStorage).
 * Saves lightweight JSON metadata ONLY, avoiding large binary video/blob data
 * as strictly requested in Warning 5 to prevent storage bloat and crashes.
 */

const STORAGE_KEY = 'editroy_editor_timeline_session';

class SessionStore {
  /**
   * Save the current timeline items (metadata ONLY, no raw binary blobs).
   */
  saveSession(items, totalDuration, masterVolume) {
    try {
      const serializableItems = items.map(item => {
        // Strip out active HTMLVideoElements and transient Blob URLs (re-bound on launch)
        const { file, src, proxySrc, thumbnail, ...rest } = item;
        const savedThumb = (thumbnail && thumbnail.startsWith('data:')) ? thumbnail : '';
        
        return {
          ...rest,
          thumbnail: savedThumb,
          // Save file reference names so PWA recovery can query re-links
          fileName: file ? file.name : (item.name || ''),
          fileSize: file ? file.size : 0,
          fileType: file ? file.type : ''
        };
      });

      const session = {
        items: serializableItems,
        totalDuration,
        masterVolume,
        savedAt: Date.now()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      console.log('[SessionStore] Automatically saved timeline metadata state to localStorage.');
    } catch (e) {
      console.error('[SessionStore] Session save failed:', e);
    }
  }

  /**
   * Retrieve the serialized session metadata.
   */
  loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw);
      console.log('[SessionStore] Restored timeline metadata from previous session saved at:', new Date(session.savedAt).toLocaleTimeString());
      return session;
    } catch (e) {
      console.error('[SessionStore] Session load failed:', e);
      return null;
    }
  }

  clearSession() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[SessionStore] Cleared local session store.');
    } catch (e) {
      console.error('[SessionStore] Session clear failed:', e);
    }
  }
}

export const sessionStore = new SessionStore();
