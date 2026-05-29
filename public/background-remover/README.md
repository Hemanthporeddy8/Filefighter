# NexusCut Pro v2 — Deployment & Operation Guide

NexusCut is a professional, client-side, serverless AI Background Remover for images, videos, and batch actions. It runs entirely inside the user's browser using WebGPU hardware acceleration and WebAssembly fallbacks.

---

## 🚀 How to Start Locally

Browsers block visual asset loading (`fetch` requests) when opening files directly from the hard drive (`file://` protocol). Therefore, a lightweight local web server is required.

### Option A: Using Python (Recommended & Already Running)
If you have Python installed, open your terminal in the project directory and run:
```bash
python -m http.server 8000
```
Then open your browser and navigate to:
👉 **`http://localhost:8000`**

### Option B: Using Node.js / npm
If you prefer Node.js, install a simple static server:
```bash
npm install -g serve
serve -s . -l 8000
```
Then open: **`http://localhost:8000`**

---

## 🎨 Professional Features Built-in

### 1. Single Image Tab (Manual Repair)
* **Automatic AI Cutout:** Removes backgrounds instantly using the local ONNX model.
* **Default Transparent Mode:** Opens the result over a transparent background by default.
* **Manual Brush & Eraser:** Click **Brush (Restore)** to paint back background pixels or **Eraser** to crop out mistakes.
* **Dynamic Cursor Sizing:** Hovering over the canvas automatically resizes the custom cursor ring to show the brush width in real-time. The ring glows **green** for Brush and **red** for Eraser.

### 2. Video Tab (Chroma Key & Custom Backplate)
* **High-Speed Hardware Encoding:** Sequential frame-by-frame processing using built-in WebGPU models and native browser `VideoEncoder` (WebCodecs) compiling directly to high-bitrate **8 Mbps VP9 WebM** files.
* **Chroma Key:** Compose your subject over solid backdrops in real-time.
* **Custom Backplate Image:** Composites custom uploaded images behind the subject, automatically resizing them to fit the video aspect ratio.
* **Live Video Preview:** Watch the finished video inside the app's output player before downloading.

### 3. Batch Tab (Interactive Bulk Modal Editor)
* **Bulk Processing:** Drop and process up to 100 images in parallel.
* **✏️ Edit & Repair Hover:** Hovering over any completed card transitions to an interactive edit overlay.
* **Glassmorphic Editor Modal:** Clicking a card opens a full-screen canvas editor modal. You can paint manual brush/eraser corrections and save the changes instantly to update the batch download file.

---

## 📦 Project External Dependencies

The codebase has **zero local npm server-side dependencies** and relies on exactly **4 fast CDN assets**:
1. **ONNX Runtime Web (`ort.min.js`):** Client-side AI execution (WebGPU/CPU).
2. **JSZip (`jszip.min.js`):** Packs completed batch folders and frame sequences into single zip file downloads.
3. **Webm-Muxer (`webm-muxer`):** Light WebM multiplexer that compiles processed video frames.
4. **Google Fonts:** Premium industrial typography (`Bebas Neue`, `DM Sans`, `DM Mono`).

---

## 🤖 Model Directory Layout

The browser dynamically checks the hardware capability of the user's PC:
* **High-end GPUs (FP16 Support):** Lazy-loads the high-quality FP32 model (`models/manthnet_nexus_v2.onnx` and external weights `models/manthnet_nexus_v2.onnx.data`) directly on the GPU.
* **Older GPUs/CPU (WASM Fallback):** Automatically loads the lightweight 6.5MB quantized CPU model (`models/manthnet_nexus_v2_int8.onnx`).

```
nexuscut_pro_v2/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── utils.js
│   ├── model.js
│   ├── image.js
│   ├── video.js
│   ├── batch.js
│   └── app.js
└── models/
    ├── manthnet_nexus_v2.onnx
    ├── manthnet_nexus_v2.onnx.data
    └── manthnet_nexus_v2_int8.onnx
```

---

## 🛡️ Production Deployment (.com)

NexusCut is **100% static client-side code**. You do not need expensive GPU servers or complex backends!

1. **Static Hosts (Highly Recommended):**
   Drag and drop the folder into **Netlify**, **Vercel**, or **GitHub Pages**. It will load globally in milliseconds.
2. **CORS Headers:**
   If you decide to host the models on an external CDN (like Amazon S3 or Cloudflare R2), make sure to enable this header on the CDN to allow the browser to fetch the model weights:
   ```http
   Access-Control-Allow-Origin: *
   ```
