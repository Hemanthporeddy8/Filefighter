// Editroy Service Worker v1.1
// Handles offline caching, faster loads, and PWA install support

const CACHE_NAME = 'editroy-v2';
const STATIC_CACHE = 'editroy-static-v2';

// Assets to cache on install (app shell)
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/video-editor',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/ai-tools',
  '/ai-tools/index.html',
  '/ai-tools/css/style.css',
  '/ai-tools/js/app.js',
  '/ai-tools/js/utils.js',
  '/ai-tools/js/model.js',
  '/ai-tools/js/image.js',
  '/ai-tools/js/video.js',
  '/ai-tools/js/batch.js',
  '/ai-tools/js/generate.js',
  '/background-remover',
  '/background-remover/index.html',
  '/background-remover/css/style.css',
  '/background-remover/js/app.js',
  '/background-remover/js/utils.js',
  '/background-remover/js/model.js',
  '/background-remover/js/image.js',
  '/background-remover/js/video.js',
  '/background-remover/js/batch.js',
  '/background-remover/js/generate.js',
  '/pdf-editor',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/index.html',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/app.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/lib/pdfjs/pdf.min.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/lib/pdfjs/pdf.worker.min.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/export_engine.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/ast/ast_parser.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/ast/pdf_document.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/ast/pdf_objects.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/ast/random_access_reader.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/core/evaluator/page_interpreter.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/core/persistence/annotation_manager.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/core/persistence/text_manager.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/core/writer/incremental_writer.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/decoders/advanced_decoders.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/decoders/flate_decoder.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/decoders/image_decoders.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/decoders/standard_fonts.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/evaluator/evaluator.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/evaluator/layout_engine.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/evaluator/text_reflow.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/evaluator/token_scanner.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/graphics/canvas_backend.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/graphics/fonts/font_engine.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/security/md5.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/security/pdf_crypto.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/security/rc4.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/tools/interactive_editor.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/tools/office_bridge.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/tools/tool_registry.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/tools/universal_mutator.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/tools/watermark_ui.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/worker/pdf_worker.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/writer/content_stream_writer.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/writer/docx_writer.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/writer/pdf_writer.js',
  '/my-pdf-editor-main/my-pdf-editor-main/52psd2 - Copy/public/engine/writer/xlsx_writer.js',
  '/video-editor/index.html',
  '/video-editor/index.js',
  '/video-editor/engine/adaptive-quality.js',
  '/video-editor/engine/ai-remover.js',
  '/video-editor/engine/decoder-pool.js',
  '/video-editor/engine/device-profiler.js',
  '/video-editor/engine/export-engine.js',
  '/video-editor/engine/memory-manager.js',
  '/video-editor/engine/render-scheduler.js',
  '/video-editor/engine/session-store.js',
  '/video-editor/engine/state-machine.js',
  '/video-editor/engine/task-queue.js',
  '/video-editor/engine/timeline-virtualizer.js',
  '/video-editor/engine/video-proxy.js',
  '/video-editor/workers/audio-processor.js',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache failed for some assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API/dynamic, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Allow caching of specific cross-origin assets (e.g. CDNs)
  const isCdnRequest = url.origin === 'https://cdn.jsdelivr.net' || url.origin === 'https://cdnjs.cloudflare.com';
  if (url.origin !== self.location.origin && !isCdnRequest) return;

  // API routes: always go to network, no caching
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Static assets (fonts, icons, images, tools scripts/models): cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/ai-tools/') ||
    url.pathname.startsWith('/background-remover/') ||
    url.pathname.startsWith('/video-editor/') ||
    url.pathname.startsWith('/my-pdf-editor-main/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.wasm') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.onnx') ||
    url.pathname.endsWith('.data') ||
    isCdnRequest
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Pages: network-first with offline fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        // Cache successful page responses
        if (res.ok && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => {
        // Offline fallback: serve cached version if available
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Fallback to home if nothing cached
          return caches.match('/');
        });
      })
  );
});

// Background sync (future: sync edits when back online)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
});

// Push notifications (future)
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  self.registration.showNotification(data.title || 'Editroy', {
    body: data.body || 'You have a new notification.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  });
});
