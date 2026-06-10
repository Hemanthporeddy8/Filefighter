/**
 * public/video-editor/engine/ai-remover.js
 * 
 * Central AI Video & Image Background Remover module.
 * Dynamically loads ONNX Runtime and model states locally.
 * Preprocesses image buffers and compiles transparent PNG/WebM files.
 */

const MEAN = [0.485, 0.456, 0.406];
const STD  = [0.229, 0.224, 0.225];
const MODEL_SIZE = 512;

class AiBackgroundRemover {
  constructor() {
    this.isLoaded = false;
    this._session = null;
    
    // Model URLs served locally
    this.MODEL_URL_INT8 = '/background-remover/models/manthnet_nexus_v2_int8.onnx';
    this.MODEL_URL_FP32 = '/background-remover/models/manthnet_nexus_v2.onnx';
    this.MODEL_DATA_FP32 = '/background-remover/models/manthnet_nexus_v2.onnx.data';
  }

  isDeviceSuitable() {
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
    const isMobile = /Mobi|Android|iPhone|iPad|Macintosh/i.test(navigator.userAgent) && ('ontouchstart' in window);
    if (isMobile) return false;
    return true;
  }

  async loadModelSparsely() {
    return await this.loadModel();
  }

  async ensureOrtLoaded() {
    if (typeof window.ort !== 'undefined') return;
    console.log('[AiBackgroundRemover] Loading ONNX Runtime Web...');
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.min.js';
      script.onload = () => {
        const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        ort.env.wasm.numThreads = isMobileDevice ? 1 : Math.min(navigator.hardwareConcurrency || 2, 4);
        ort.env.wasm.simd = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load ONNX Runtime Web library.'));
      document.head.appendChild(script);
    });
  }

  async checkWebGPUSupport() {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch (e) {
      return false;
    }
  }

  async loadModel(onProgress) {
    if (this.isLoaded) return true;
    
    await this.ensureOrtLoaded();
    const hasWebGPU = await this.checkWebGPUSupport();
    
    if (hasWebGPU) {
      console.log('[AiBackgroundRemover] WebGPU detected! Loading FP32 model on GPU...');
      if (onProgress) onProgress(0.1, 'Loading GPU model...');
      
      try {
        this._session = await ort.InferenceSession.create(this.MODEL_URL_FP32, {
          executionProviders: ['webgpu'],
          graphOptimizationLevel: 'all',
          externalData: [
            {
              path: 'manthnet_nexus_v2.onnx.data',
              data: this.MODEL_DATA_FP32
            }
          ]
        });
        this.isLoaded = true;
        if (onProgress) onProgress(1.0, 'Model Loaded (GPU Accelerated)');
        return true;
      } catch (webgpuErr) {
        console.warn('[AiBackgroundRemover] WebGPU load failed, falling back to CPU/WASM:', webgpuErr);
      }
    }
    
    console.log('[AiBackgroundRemover] Using CPU/WASM provider. Downloading INT8 model...');
    if (onProgress) onProgress(0.1, 'Downloading INT8 model...');
    
    try {
      const res = await fetch(this.MODEL_URL_INT8);
      if (!res.ok) throw new Error('INT8 model file not found');
      
      const total = parseInt(res.headers.get('Content-Length') || '0');
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total && onProgress) {
          onProgress(received / total * 0.7, `Downloading model... ${(received / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB`);
        }
      }
      
      if (onProgress) onProgress(0.75, 'Compiling WebAssembly engine...');
      await new Promise(r => setTimeout(r, 50));
      
      const buffer = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }
      
      this._session = await ort.InferenceSession.create(buffer.buffer, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });
      this.isLoaded = true;
      if (onProgress) onProgress(1.0, 'Model Loaded (WASM CPU Mode)');
      return true;
    } catch (cpuErr) {
      console.error('[AiBackgroundRemover] WASM load failed:', cpuErr);
      throw cpuErr;
    }
  }

  async infer(tensorData) {
    if (!this._session) throw new Error('AI Model is not loaded.');
    const tensor = new ort.Tensor('float32', tensorData, [1, 3, MODEL_SIZE, MODEL_SIZE]);
    const output = await this._session.run({ input: tensor });
    const alpha = output['alpha'] || output[Object.keys(output)[0]];
    return alpha.data;
  }

  loadImageFile(fileOrUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = (fileOrUrl instanceof File) ? URL.createObjectURL(fileOrUrl) : fileOrUrl;
    });
  }

  imageToImageData(img, w, h) {
    const c = document.createElement('canvas');
    const maxDim = 2048;
    const origW = img.naturalWidth || img.width || 0;
    const origH = img.naturalHeight || img.height || 0;
    let width = w || origW;
    let height = h || origH;

    if (!w && !h && (width > maxDim || height > maxDim)) {
      if (width > height) {
        height = Math.round(height * maxDim / width);
        width = maxDim;
      } else {
        width = Math.round(width * maxDim / height);
        height = maxDim;
      }
    }

    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff'; // White BG compositing avoids JPG black artifacting
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);

    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    imgData.origW = origW;
    imgData.origH = origH;
    return imgData;
  }

  preprocessImageData(imageData) {
    const src = document.createElement('canvas');
    src.width = imageData.width; src.height = imageData.height;
    const srcCtx = src.getContext('2d', { willReadFrequently: true });
    srcCtx.putImageData(imageData, 0, 0);

    const dst = document.createElement('canvas');
    dst.width = MODEL_SIZE; dst.height = MODEL_SIZE;
    const dstCtx = dst.getContext('2d', { willReadFrequently: true });
    dstCtx.imageSmoothingEnabled = true;
    dstCtx.imageSmoothingQuality = 'high';
    dstCtx.drawImage(src, 0, 0, MODEL_SIZE, MODEL_SIZE);
    
    const resized = dstCtx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
    const { data: px } = resized;
    const np = MODEL_SIZE * MODEL_SIZE;
    const t = new Float32Array(3 * np);
    
    for (let i = 0; i < np; i++) {
      t[0 * np + i] = (px[i * 4    ] / 255 - MEAN[0]) / STD[0];
      t[1 * np + i] = (px[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
      t[2 * np + i] = (px[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
    }
    return t;
  }

  dilateAlpha(alpha, w, h, radius = 1) {
    const temp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let maxVal = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), w - 1);
          const val = alpha[y * w + nx];
          if (val > maxVal) maxVal = val;
        }
        temp[y * w + x] = maxVal;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let maxVal = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = Math.min(Math.max(y + dy, 0), h - 1);
          const val = temp[ny * w + x];
          if (val > maxVal) maxVal = val;
        }
        alpha[y * w + x] = maxVal;
      }
    }
  }

  applyAlphaMask(imageData, alphaFlat, mode = 'photo') {
    const { width: ow, height: oh, data: px } = imageData;
    const ms = MODEL_SIZE;

    const alphaFull = new Float32Array(ow * oh);
    for (let py = 0; py < oh; py++) {
      for (let px2 = 0; px2 < ow; px2++) {
        const mx = (px2 / Math.max(ow - 1, 1)) * (ms - 1);
        const my = (py / Math.max(oh - 1, 1)) * (ms - 1);
        const x0 = Math.floor(mx), x1 = Math.min(x0 + 1, ms - 1);
        const y0 = Math.floor(my), y1 = Math.min(y0 + 1, ms - 1);
        const tx = mx - x0, ty = my - y0;
        alphaFull[py * ow + px2] =
          (1 - tx) * (1 - ty) * alphaFlat[y0 * ms + x0] +
          tx * (1 - ty) * alphaFlat[y0 * ms + x1] +
          (1 - tx) * ty * alphaFlat[y1 * ms + x0] +
          tx * ty * alphaFlat[y1 * ms + x1];
      }
    }

    this.dilateAlpha(alphaFull, ow, oh, 1);

    let sharpness = 4;
    let threshold = 0.28;
    if (mode === 'illustration') {
      sharpness = 2;
      threshold = 0.12;
    }

    const minVal = 1 / (1 + Math.exp(sharpness * threshold));
    const maxVal = 1 / (1 + Math.exp(-sharpness * (1 - threshold)));
    const range = maxVal - minVal;

    for (let i = 0; i < alphaFull.length; i++) {
      const s = 1 / (1 + Math.exp(-sharpness * (alphaFull[i] - threshold)));
      alphaFull[i] = (s - minVal) / range;
    }

    for (let i = 0; i < ow * oh; i++) {
      px[i * 4 + 3] = Math.round(Math.min(Math.max(alphaFull[i], 0), 1) * 255);
    }
    return imageData;
  }

  async saveTransparentPNG(result, originalImg) {
    const origW = result.origW || originalImg.naturalWidth || originalImg.width;
    const origH = result.origH || originalImg.naturalHeight || originalImg.height;

    const c = document.createElement('canvas');
    c.width = origW;
    c.height = origH;
    const ctx = c.getContext('2d');
    ctx.drawImage(originalImg, 0, 0, origW, origH);
    const fullData = ctx.getImageData(0, 0, origW, origH);

    const upsampledAlpha = new Float32Array(origW * origH);
    const rw = result.width;
    const rh = result.height;

    for (let py = 0; py < origH; py++) {
      for (let px = 0; px < origW; px++) {
        const mx = (px / Math.max(origW - 1, 1)) * (rw - 1);
        const my = (py / Math.max(origH - 1, 1)) * (rh - 1);
        const x0 = Math.floor(mx), x1 = Math.min(x0 + 1, rw - 1);
        const y0 = Math.floor(my), y1 = Math.min(y0 + 1, rh - 1);
        const tx = mx - x0, ty = my - y0;

        const a00 = result.data[(y0 * rw + x0) * 4 + 3] / 255;
        const a10 = result.data[(y0 * rw + x1) * 4 + 3] / 255;
        const a01 = result.data[(y1 * rw + x0) * 4 + 3] / 255;
        const a11 = result.data[(y1 * rw + x1) * 4 + 3] / 255;

        upsampledAlpha[py * origW + px] =
          (1 - tx) * (1 - ty) * a00 +
          tx * (1 - ty) * a10 +
          (1 - tx) * ty * a01 +
          tx * ty * a11;
      }
    }

    for (let i = 0; i < origW * origH; i++) {
      fullData.data[i * 4 + 3] = Math.round(Math.min(Math.max(upsampledAlpha[i], 0), 1) * 255);
    }
    ctx.putImageData(fullData, 0, 0);
    return new Promise(r => c.toBlob(r, 'image/png'));
  }

  seekVideo(vid, ts) {
    return new Promise(res => {
      if (Math.abs(vid.currentTime - ts) < 0.015) { res(); return; }
      vid.onseeked = () => {
        vid.onseeked = null;
        setTimeout(res, 45); // small paint delay
      };
      vid.currentTime = ts;
    });
  }

  applyChromaKey(imageData, keyColorHex, similarity, smoothness, spill) {
    const { data } = imageData;
    const keyColor = this.hexToRgb(keyColorHex);
    
    // Normalize parameters
    const tol = (similarity / 100) * 255;
    const smooth = (smoothness / 100) * 255;
    const spillReduction = spill / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      // Calculate color distance (RGB Euclidean distance)
      const dist = Math.sqrt((r - keyColor.r) ** 2 + (g - keyColor.g) ** 2 + (b - keyColor.b) ** 2);
      
      let alpha = 255;
      if (dist < tol) {
        alpha = 0;
      } else if (dist < tol + smooth) {
        alpha = Math.round(((dist - tol) / smooth) * 255);
      }
      
      // Spill suppression (reduces green/blue outline spill on subject)
      if (alpha > 0) {
        if (keyColor.g > keyColor.r && keyColor.g > keyColor.b) {
          // Green spill suppression: clamp green channel to average of red/blue
          const avgRedBlue = (r + b) / 2;
          if (g > avgRedBlue) {
            const factor = spillReduction * (1 - alpha / 255);
            data[i+1] = Math.round(g * (1 - factor) + avgRedBlue * factor);
          }
        } else if (keyColor.b > keyColor.r && keyColor.b > keyColor.g) {
          // Blue spill suppression: clamp blue channel to average of red/green
          const avgRedGreen = (r + g) / 2;
          if (b > avgRedGreen) {
            const factor = spillReduction * (1 - alpha / 255);
            data[i+2] = Math.round(b * (1 - factor) + avgRedGreen * factor);
          }
        }
      }
      
      data[i+3] = Math.min(data[i+3], alpha);
    }
    return imageData;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 255, b: 0 };
  }

  async removeBackground(item, onProgress, options = {}) {
    const method = options.method || 'ai';

    if (method === 'ai') {
      await this.loadModel((pct, msg) => {
        if (onProgress) onProgress(pct * 0.25, `Initializing AI Model: ${msg}`);
      });
    }

    if (item.type === 'image') {
      if (onProgress) onProgress(0.3, 'Loading image file...');
      const img = await this.loadImageFile(item.file || item.src);
      
      if (onProgress) onProgress(0.5, 'Analyzing image pixels...');
      const imgData = this.imageToImageData(img);
      
      let blob;
      if (method === 'chroma') {
        if (onProgress) onProgress(0.7, 'Applying Chroma Key...');
        const keyed = this.applyChromaKey(imgData, options.keyColor, options.similarity, options.smoothness, options.spill);
        if (onProgress) onProgress(0.9, 'Assembling transparent PNG...');
        blob = await this.saveTransparentPNG(keyed, img);
      } else {
        const tensor = this.preprocessImageData(imgData);
        if (onProgress) onProgress(0.7, 'Running AI inference...');
        const alpha = await this.infer(tensor);
        const masked = this.applyAlphaMask(imgData, alpha);
        if (onProgress) onProgress(0.9, 'Assembling transparent PNG...');
        blob = await this.saveTransparentPNG(masked, img);
      }
      
      if (onProgress) onProgress(1.0, 'Background removed!');
      return new File([blob], item.name.replace(/\.[^/.]+$/, "") + "_nobg.png", { type: "image/png" });
    }
    
    if (item.type === 'video') {
      if (typeof VideoEncoder === 'undefined') {
        throw new Error('WebCodecs VideoEncoder is not supported in this browser. Please use Chrome, Edge or Opera for video background removal.');
      }
      
      const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/webm-muxer/+esm');
      
      if (onProgress) onProgress(0.3, 'Analyzing video track metadata...');
      const vid = document.createElement('video');
      vid.src = item.src;
      vid.preload = 'metadata';
      await new Promise(r => { vid.onloadedmetadata = r; vid.onerror = r; });
      
      const W = Math.round(vid.videoWidth * 0.5); // Downscale slightly for speed and memory efficiency
      const H = Math.round(vid.videoHeight * 0.5);
      const dur = vid.duration;
      const fps = 24;
      const step = 1 / fps;
      const totalFrames = Math.ceil(dur / step);
      
      const cap = document.createElement('canvas');
      cap.width = W; cap.height = H;
      const capCtx = cap.getContext('2d', { willReadFrequently: true });
      
      const out = document.createElement('canvas');
      out.width = W; out.height = H;
      const outCtx = out.getContext('2d');
      
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'V_VP9', width: W, height: H }
      });
      
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error('[VideoEncoder] error:', e)
      });
      
      encoder.configure({
        codec: 'vp09.00.10.08',
        width: W,
        height: H,
        bitrate: 2_000_000,
        latencyMode: 'quality'
      });
      
      for (let i = 0; i < totalFrames; i++) {
        const ts = i * step;
        await this.seekVideo(vid, ts);
        
        capCtx.fillStyle = '#ffffff';
        capCtx.fillRect(0, 0, W, H);
        capCtx.drawImage(vid, 0, 0, W, H);
        
        const imgData = capCtx.getImageData(0, 0, W, H);
        
        let masked;
        if (method === 'chroma') {
          masked = this.applyChromaKey(imgData, options.keyColor, options.similarity, options.smoothness, options.spill);
        } else {
          const tensor = this.preprocessImageData(imgData);
          const alpha = await this.infer(tensor);
          masked = this.applyAlphaMask(imgData, alpha);
        }
        
        outCtx.clearRect(0, 0, W, H);
        const tmp = document.createElement('canvas');
        tmp.width = W; tmp.height = H;
        tmp.getContext('2d').putImageData(masked, 0, 0);
        outCtx.drawImage(tmp, 0, 0);
        
        const timestamp = Math.round(i * (1_000_000 / fps));
        const frame = new VideoFrame(out, { timestamp });
        encoder.encode(frame, { keyFrame: i % 24 === 0 });
        frame.close();
        
        const pct = 0.25 + ((i + 1) / totalFrames) * 0.75;
        if (onProgress) onProgress(pct, `Processing Video Frame ${i + 1}/${totalFrames}`);
        await new Promise(r => setTimeout(r, 10)); // Yield to keep UI active
      }
      
      await encoder.flush();
      encoder.close();
      muxer.finalize();
      
      const webmBlob = new Blob([muxer.target.buffer], { type: 'video/webm' });
      if (onProgress) onProgress(1.0, 'Background removed!');
      return new File([webmBlob], item.name.replace(/\.[^/.]+$/, "") + "_nobg.webm", { type: "video/webm" });
    }
    
    throw new Error('Unsupported item type.');
  }
}

export const aiBackgroundRemover = new AiBackgroundRemover();
