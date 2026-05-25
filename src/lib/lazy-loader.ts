/**
 * src/lib/lazy-loader.ts
 * 
 * Central utility for on-demand lazy loading of heavy libraries.
 * Caches loaded modules so they only load once per session.
 * Provides type-safe dynamic imports for the most common heavy dependencies.
 */

type ModuleCache = Record<string, Promise<unknown>>;
const _cache: ModuleCache = {};

/**
 * Load a module once, cache the promise so subsequent calls
 * return the same module without re-fetching.
 */
function once<T>(key: string, loader: () => Promise<T>): Promise<T> {
  if (!_cache[key]) {
    _cache[key] = loader();
  }
  return _cache[key] as Promise<T>;
}

// ── Specific lazy loaders ─────────────────────────────────────

/** jsPDF — only load when user triggers a PDF download */
export const loadJsPDF = () =>
  once('jspdf', () => import('jspdf').then(m => m.default));

/** QRCodeCanvas — only load when QR display is needed */
export const loadQRCodeCanvas = () =>
  once('qrcode.react', () => import('qrcode.react').then(m => m.QRCodeCanvas));

/** formatDistanceToNow from date-fns — lazy */
export const loadFormatDistanceToNow = () =>
  once('date-fns/formatDistanceToNow', () =>
    import('date-fns').then(m => m.formatDistanceToNow)
  );

/** react-image-crop — only load when crop tool is activated */
export const loadReactImageCrop = () =>
  once('react-image-crop', () => import('react-image-crop'));

/**
 * Idly preload a module during browser idle time.
 * Safe to call speculatively — won't block UI.
 */
export function idlePreload(loader: () => Promise<unknown>, timeoutMs = 5000): void {
  if (typeof window === 'undefined') return;
  const run = () => loader().catch(() => {}); // Silently ignore errors
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run, { timeout: timeoutMs });
  } else {
    setTimeout(run, 2000); // Safari fallback
  }
}

/**
 * Detect if the current device is low-end.
 * Used to decide whether to preload or wait.
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  // @ts-ignore — hardwareConcurrency not in all TS defs
  const cores = navigator.hardwareConcurrency ?? 4;
  // @ts-ignore — deviceMemory not in all TS defs  
  const ram = (navigator as any).deviceMemory ?? 4;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return cores <= 2 || ram <= 2 || isMobile;
}
