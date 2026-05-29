'use strict';

const GenerateTab = (() => {
  let _vocab = null;
  let _transformerSession = null;
  let _decoderSession = null;
  let _isGenerating = false;
  let _modelsLoaded = false;
  let _isWebGPU = false; // Flag to track if sessions compiled on GPU
  
  const $=id=>document.getElementById(id);

  function init() {
    $('btnGenerate').addEventListener('click', _generate);
    $('btnDownloadGen').addEventListener('click', _download);
    
    // Enable generation button when text is entered and model ready
    $('genPrompt').addEventListener('input', e => {
      _updateBtnState();
    });

    // Lazy load the models only when the user clicks the "Generate" tab
    document.querySelectorAll('.tab-btn[data-tab="generate"]').forEach(btn => {
      btn.addEventListener('click', _lazyLoadModels);
    });
  }

  async function _checkWebGPUSupport() {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch (e) {
      return false;
    }
  }

  async function _lazyLoadModels() {
    if (_modelsLoaded) return;
    $('genIdle').textContent = "Initializing text-to-image AI engine...";
    
    try {
      showToast("Loading Text-to-Image models...");
      
      // 1. Fetch vocabulary JSON
      const res = await fetch('models/vocab.json');
      if (!res.ok) throw new Error('Vocabulary JSON file not found');
      _vocab = await res.json();
      
      // 2. Load ONNX sessions
      const hasWebGPU = await _checkWebGPUSupport();
      let loadedWebGPU = false;
      
      if (hasWebGPU) {
        console.log('[GenerateTab] WebGPU detected! Attempting to load T2I models with GPU acceleration...');
        try {
          _transformerSession = await ort.InferenceSession.create('models/text_transformer.onnx', {
            executionProviders: ['webgpu'],
            graphOptimizationLevel: 'all',
            externalData: [
              {
                path: 'text_transformer.onnx.data',
                data: './models/text_transformer.onnx.data'
              }
            ]
          });
          
          _decoderSession = await ort.InferenceSession.create('models/vqvae_decoder.onnx', {
            executionProviders: ['webgpu'],
            graphOptimizationLevel: 'all',
            externalData: [
              {
                path: 'vqvae_decoder.onnx.data',
                data: './models/vqvae_decoder.onnx.data'
              }
            ]
          });
          
          loadedWebGPU = true;
          _isWebGPU = true;
          console.log('[GenerateTab] T2I models loaded successfully on WebGPU!');
        } catch (webgpuErr) {
          console.warn('[GenerateTab] WebGPU session creation failed, falling back to CPU:', webgpuErr);
        }
      }
      
      if (!loadedWebGPU) {
        console.log('[GenerateTab] Loading T2I models on CPU (WASM fallback)...');
        _isWebGPU = false;
        
        _transformerSession = await ort.InferenceSession.create('models/text_transformer.onnx', {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          externalData: [
            {
              path: 'text_transformer.onnx.data',
              data: './models/text_transformer.onnx.data'
            }
          ]
        });
        
        _decoderSession = await ort.InferenceSession.create('models/vqvae_decoder.onnx', {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          externalData: [
            {
              path: 'vqvae_decoder.onnx.data',
              data: './models/vqvae_decoder.onnx.data'
            }
          ]
        });
        
        console.log('[GenerateTab] T2I models loaded successfully on WASM CPU!');
      }
      
      _modelsLoaded = true;
      _updateBtnState();
      $('genIdle').textContent = "AI engine ready! Type a prompt and click Generate.";
      showToast("T2I Engine ready!", "success");
    } catch(e) {
      console.error(e);
      $('genIdle').textContent = "Failed to load models. Make sure they are inside /models/ directory.";
      showToast("Failed to load T2I models", "error");
    }
  }

  function _updateBtnState() {
    const hasPrompt = $('genPrompt').value.trim().length > 0;
    $('btnGenerate').disabled = !_modelsLoaded || hasPrompt === false || _isGenerating;
  }

  async function _generate() {
    if (_isGenerating || !_modelsLoaded) return;
    
    const prompt = $('genPrompt').value.trim();
    if (!prompt) return;

    _isGenerating = true;
    _updateBtnState();
    $('genOverlay').style.display = 'flex';
    $('genMsg').textContent = 'Tokenizing prompt…';

    await new Promise(r => setTimeout(r, 20));

    try {
      // 1. Tokenize prompt to Vocab indices [1, 32]
      const words = prompt.toLowerCase().split(' ').slice(0, 32);
      const textIndices = new BigInt64Array(32).fill(0n);
      words.forEach((w, i) => {
        textIndices[i] = BigInt(_vocab[w] || 1); // 1 = <UNK>
      });

      // 2. Pre-allocate Tensors and Arrays for high-performance generation
      const textTensor = new ort.Tensor('int64', textIndices, [1, 32]);
      
      const imgTokens = new BigInt64Array(1025);
      imgTokens[0] = 512n; // SOS token is 512

      const totalTokens = parseInt($('genSpeed').value) || 1024;

      // Pre-allocate backing buffer for GPU padded flow
      const imgSeqInput = _isWebGPU ? new BigInt64Array(1024).fill(0n) : null;

      console.log(`[GenerateTab] Starting generation loop: totalSteps=${totalTokens}, useWebGPUPadding=${_isWebGPU}`);
      const startTime = performance.now();

      const temp = 0.8; // Creatively coherent sampling temperature

      for (let step = 0; step < totalTokens; step++) {
        if (step % 50 === 0) {
          const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);
          $('genMsg').textContent = `Synthesizing pixels: ${Math.round((step / totalTokens) * 100)}% (${elapsedSec}s)`;
          await new Promise(r => setTimeout(r, 0)); // Yield to keep browser responsive
        }

        let imgTensor;
        let offset;

        if (_isWebGPU) {
          // WebGPU FLOW: Fixed shape [1, 1024] to completely prevent GPU shader compile lags
          imgSeqInput[step] = imgTokens[step];
          imgTensor = new ort.Tensor('int64', imgSeqInput, [1, 1024]);
          offset = step * 512;
        } else {
          // CPU WASM FLOW: Dynamic shape [1, currentLength] starting from 0 to preserve positions & run 4x faster!
          const currentLength = step + 1;
          const currentTokensView = imgTokens.subarray(0, currentLength);
          imgTensor = new ort.Tensor('int64', currentTokensView, [1, currentLength]);
          offset = (currentLength - 1) * 512;
        }

        const feeds = { text_seq: textTensor, img_seq: imgTensor };
        const outputs = await _transformerSession.run(feeds);
        
        // Read logits of the current step
        const logits = outputs.logits.data; 

        // TEMPERATURE SAMPLING (Prevents deterministic loop traps like solid background index 156)
        const expLogits = new Float32Array(512);
        let sumExp = 0;
        
        // Find max logit for numerical scaling stability
        let maxLogit = -Infinity;
        for (let k = 0; k < 512; k++) {
          const val = logits[offset + k];
          if (val > maxLogit) {
            maxLogit = val;
          }
        }

        for (let k = 0; k < 512; k++) {
          const val = Math.exp((logits[offset + k] - maxLogit) / temp);
          expLogits[k] = val;
          sumExp += val;
        }

        // Select token using weighted random probability sampling
        const r = Math.random() * sumExp;
        let runningSum = 0;
        let nextToken = 0;
        for (let k = 0; k < 512; k++) {
          runningSum += expLogits[k];
          if (r <= runningSum) {
            nextToken = k;
            break;
          }
        }

        imgTokens[step + 1] = BigInt(nextToken);
      }

      const totalTimeSec = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`[GenerateTab] Autoregressive loop completed in ${totalTimeSec}s`);

      $('genMsg').textContent = 'Decoding layout…';
      await new Promise(r => setTimeout(r, 10));

      // 3. Decode the 1024 visual tokens to an RGB Image using VQ-VAE decoder
      const finalIndices = new BigInt64Array(1024);
      if (totalTokens === 256) {
        // Upsample 16x16 (256 tokens) -> 32x32 (1024 tokens)
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const token = imgTokens[1 + (y * 16 + x)];
            const ty = y * 2;
            const tx = x * 2;
            finalIndices[ty * 32 + tx]         = token;
            finalIndices[ty * 32 + (tx + 1)]     = token;
            finalIndices[(ty + 1) * 32 + tx]     = token;
            finalIndices[(ty + 1) * 32 + (tx + 1)] = token;
          }
        }
      } else if (totalTokens === 64) {
        // Upsample 8x8 (64 tokens) -> 32x32 (1024 tokens)
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const token = imgTokens[1 + (y * 8 + x)];
            for (let dy = 0; dy < 4; dy++) {
              for (let dx = 0; dx < 4; dx++) {
                finalIndices[(y * 4 + dy) * 32 + (x * 4 + dx)] = token;
              }
            }
          }
        }
      } else {
        // Full 1024 synthesis
        finalIndices.set(imgTokens.subarray(1, 1025));
      }
      
      const indicesTensor = new ort.Tensor('int64', finalIndices, [1, 32, 32]);

      const decoderOutput = await _decoderSession.run({ indices: indicesTensor });
      const imageFloatData = decoderOutput.image.data; // Float32 tensor [1, 3, 256, 256]

      // 4. Render Float32 RGB output to the canvas
      _paintToCanvas(imageFloatData);

      $('genCanvas').style.display = 'block';
      $('genIdle').style.display = 'none';
      $('btnDownloadGen').disabled = false;
      showToast("Image generated successfully!", "success");

    } catch(e) {
      console.error(e);
      showToast("Error generating image", "error");
    } finally {
      _isGenerating = false;
      _updateBtnState();
      $('genOverlay').style.display = 'none';
    }
  }

  function _paintToCanvas(data) {
    const canvas = $('genCanvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(256, 256);
    
    // ONNX output is NCHW: Channel-First [3, 256, 256]
    // We map it to Browser Canvas RGBA Channel-Last [256, 256, 4]
    const np = 256 * 256;
    for (let i = 0; i < np; i++) {
      const r = Math.round(Math.min(Math.max(data[0 * np + i], 0), 1) * 255);
      const g = Math.round(Math.min(Math.max(data[1 * np + i], 0), 1) * 255);
      const b = Math.round(Math.min(Math.max(data[2 * np + i], 0), 1) * 255);
      
      imgData.data[i * 4]     = r;
      imgData.data[i * 4 + 1] = g;
      imgData.data[i * 4 + 2] = b;
      imgData.data[i * 4 + 3] = 255; // Opaque alpha
    }
    ctx.putImageData(imgData, 0, 0);
  }

  async function _download() {
    const canvas = $('genCanvas');
    const blob = await canvasToBlob(canvas);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'generated_image.png';
    a.click();
    showToast("Downloaded!", "success");
  }

  return { init };
})();
