'use strict';

// ══════════════════════════════════════════════════
// MODEL.JS
// Auto-downloads model from your server.
// For deployment: put manthnet_nexus_v2_int8.onnx
// in the same folder as index.html on your server.
// Users never upload anything.
// ══════════════════════════════════════════════════

const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
ort.env.wasm.numThreads = isMobileDevice ? 1 : Math.min(navigator.hardwareConcurrency || 2, 4);
ort.env.wasm.simd = true;

const NexusModel = (() => {
  let _session = null;

  // ── Paths to your models in the models directory ──
  const MODEL_URL_INT8 = '/background-remover/models/manthnet_nexus_v2_int8.onnx';
  const MODEL_URL_FP32 = '/background-remover/models/manthnet_nexus_v2.onnx';

  function ready(){ return !!_session; }

  async function checkWebGPUSupport() {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch (e) {
      return false;
    }
  }

  async function autoLoad(onProgress){
    try {
      const hasWebGPU = await checkWebGPUSupport();
      
      if (hasWebGPU) {
        console.log('[NexusModel] WebGPU detected! Lazy loading high-performance FP32 model on GPU...');
        if(onProgress) onProgress(0.1, 'Loading hardware-accelerated model (WebGPU)…');
        
        try {
          // Load FP32 model directly by URL on WebGPU (bypasses INT8 download entirely)
          _session = await ort.InferenceSession.create(MODEL_URL_FP32, {
            executionProviders: ['webgpu'],
            graphOptimizationLevel: 'all',
            externalData: [
              {
                path: 'manthnet_nexus_v2.onnx.data',
                data: '/background-remover/models/manthnet_nexus_v2.onnx.data'
              }
            ]
          });
          
          console.log('[NexusModel] FP32 model successfully loaded on WebGPU!');
          if(onProgress) onProgress(1.0, 'AI Ready (GPU Accelerated)');
          return true;
        } catch (webgpuErr) {
          console.warn('[NexusModel] WebGPU session creation failed, falling back to CPU:', webgpuErr);
        }
      }
      
      // WASM / Potato PC fallback (lazy loads INT8 model on CPU)
      console.log('[NexusModel] Using CPU/WASM fallback. Loading INT8 quantized model...');
      if(onProgress) onProgress(0.1, 'Loading quantized model (CPU)…');
      
      try {
        // Fetch with progress tracking for the INT8 model
        const res = await fetch(MODEL_URL_INT8);
        if(!res.ok) throw new Error('INT8 model file not found');

        const total  = parseInt(res.headers.get('Content-Length') || '0');
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;

        while(true){
          const {done, value} = await reader.read();
          if(done) break;
          chunks.push(value);
          received += value.length;
          if(total && onProgress){
            onProgress(received/total * 0.7,
              `Downloading model… ${fmtBytes(received)} / ${fmtBytes(total)}`);
          }
        }

        if(onProgress) onProgress(0.75, 'Compiling AI engine…');
        await new Promise(r=>setTimeout(r,30));

        // Combine chunks
        const buffer = new Uint8Array(received);
        let offset = 0;
        for(const chunk of chunks){ buffer.set(chunk, offset); offset+=chunk.length; }

        _session = await ort.InferenceSession.create(buffer.buffer, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });

        console.log('[NexusModel] INT8 quantized model loaded successfully on CPU!');
        if(onProgress) onProgress(1.0, 'AI Ready (CPU Mode)');
        return true;
      } catch (int8Err) {
        console.warn('[NexusModel] INT8 model load failed, falling back to FP32 on CPU:', int8Err);
        if(onProgress) onProgress(0.8, 'Loading high-compatibility CPU model…');
        await new Promise(r=>setTimeout(r,50));

        _session = await ort.InferenceSession.create(MODEL_URL_FP32, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          externalData: [
            {
              path: 'manthnet_nexus_v2.onnx.data',
              data: '/background-remover/models/manthnet_nexus_v2.onnx.data'
            }
          ]
        });

        console.log('[NexusModel] FP32 model loaded successfully on CPU!');
        if(onProgress) onProgress(1.0, 'AI Ready (CPU High Compatibility Mode)');
        return true;
      }
    } catch(err){
      console.error('[NexusModel] All model loads failed:', err);
      throw err;
    }
  }

  async function infer(tensorData){
    if(!_session) throw new Error('Model not loaded');
    const tensor = new ort.Tensor('float32', tensorData, [1,3,MODEL_SIZE,MODEL_SIZE]);
    const output = await _session.run({input: tensor});
    const alpha  = output['alpha'] || output[Object.keys(output)[0]];
    return alpha.data;
  }

  return { ready, autoLoad, infer };
})();
