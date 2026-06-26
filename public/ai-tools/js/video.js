'use strict';

// ═══════════════════════════════════════════════════════════
// VIDEO.JS — Background removal for video
//
// OUTPUT OPTIONS:
//   1. WebM video  (MediaRecorder — Chrome/Edge, direct download)
//   2. MP4 video   (via ffmpeg.wasm — best compatibility)
//   3. PNG frames  ZIP (fallback for all browsers)
//
// The UI tries WebM first (fastest, no extra lib needed).
// User can also choose ZIP frames if they want to edit in
// Premiere / DaVinci / After Effects.
// ═══════════════════════════════════════════════════════════

const VideoTab = (() => {
  let _file=null, _frames=[], _stopped=false, _bgImg=null;
  let _videoBlob=null; // final WebM blob
  const $=id=>document.getElementById(id);

  // Check if WebCodecs VideoEncoder is supported
  const WEBM_SUPPORTED = typeof VideoEncoder !== 'undefined';

  function init(){
    $('vidInput').addEventListener('change',e=>{ if(e.target.files[0]) _loadVid(e.target.files[0]); });
    makeDragTarget($('vidDrop'),files=>{
      const f=Array.from(files).find(f=>f.type.startsWith('video/'));
      if(f) _loadVid(f);
    });
    $('vidDrop').addEventListener('click',()=>$('vidInput').click());

    $('vbgImgInput').addEventListener('change',async e=>{
      if(!e.target.files[0])return;
      const img=await loadImageFile(e.target.files[0]);
      _bgImg=img;
      $('vbgImgName').textContent = e.target.files[0].name;
      showToast('Background image loaded');
    });

    $('vFrameSkip').addEventListener('input',()=>{
      $('vFrameSkipVal').textContent=$('vFrameSkip').value;
    });

    $('btnProcessVid').addEventListener('click',_process);
    $('btnStopVid').addEventListener('click',()=>{ _stopped=true; });
    $('btnDlVid').addEventListener('click',_downloadVideo);
    $('btnDlZip').addEventListener('click',_downloadZip);
  }

  function _loadVid(file){
    _file=file; _frames=[]; _videoBlob=null;
    $('vidOutputEl').src='';
    $('vidOutputEl').style.display='none';
    const url=URL.createObjectURL(file);
    const vid=$('vidEl');
    vid.src=url; vid.style.display='block';
    $('vidIdle').style.display='none';
    vid.onloadedmetadata=()=>{
      $('vidFilename').textContent=file.name;
      $('vidFilemeta').textContent=
         `${vid.videoWidth}×${vid.videoHeight} · ${vid.duration.toFixed(1)}s · ${fmtBytes(file.size)}`;
      $('vidLoadedInfo').style.display='block';
      $('btnProcessVid').disabled=false;
      // Show which output format is available
      $('vidOutputNote').textContent = WEBM_SUPPORTED
        ? '✅ Will export as WebM video (Chrome/Edge)'
        : '⚠️ WebM not supported — will export PNG frames ZIP';
      showToast('Video loaded: '+file.name);
      
      // Lazy load model in background
      if(window.ensureModelLoaded) window.ensureModelLoaded().catch(()=>{});
    };
  }

  async function _process(){
    if(window.ensureModelLoaded) {
      try {
        await window.ensureModelLoaded();
      } catch(e) {
        return;
      }
    }
    if(!NexusModel.ready()||!_file) return;
    _stopped=false; _frames=[]; _videoBlob=null;
    $('vidOutputEl').src='';
    $('vidOutputEl').style.display='none';

    $('btnProcessVid').style.display='none';
    $('btnStopVid').style.display='';
    $('vidProgress').style.display='';
    $('vidDone').style.display='none';

    const vid    = $('vidEl');
    const scale  = parseFloat($('vResolution').value);
    const skip   = parseInt($('vFrameSkip').value);
    const W      = Math.round(vid.videoWidth  * scale);
    const H      = Math.round(vid.videoHeight * scale);
    const fps    = 30;
    const step   = (1+skip) / fps;
    const dur    = vid.duration;
    const total  = Math.ceil(dur / step);
    const bgMode = document.querySelector('input[name="vbg"]:checked').value;
    const bgColor= $('vbgColor').value;

    if(bgMode==='image'&&!_bgImg){
      showToast('Please select a background image first','error');
      $('vbgImgInput').click();
      return;
    }

    // Extract audio track from original video (Request 3)
    let audioBuffer = null;
    if (typeof AudioContext !== 'undefined' && typeof AudioEncoder !== 'undefined') {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(URL.createObjectURL(_file));
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioCtx.close();
      } catch (e) {
        console.warn('[VideoTab] Could not extract audio from video:', e);
      }
    }

    // Capture canvas (reads video frames)
    const cap=document.createElement('canvas');
    cap.width=W; cap.height=H;
    const capCtx=cap.getContext('2d',{willReadFrequently:true});

    // Output canvas (draws composited result)
    const out=document.createElement('canvas');
    out.width=W; out.height=H;
    const outCtx=out.getContext('2d');

    // Live preview
    const liveC=$('vpLive');
    liveC.width=200; liveC.height=Math.round(200*H/W);
    const liveCtx=liveC.getContext('2d');

    // ── Setup WebCodecs VideoEncoder + webm-muxer if supported ──
    let encoder = null, muxer = null, audioEncoder = null;
    const outputFps = Math.max(1, Math.round(fps/(1+skip)));

    if(WEBM_SUPPORTED){
      try {
        const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/webm-muxer/+esm');
        
        const muxerConfig = {
          target: new ArrayBufferTarget(),
          video: {
            codec: 'V_VP9',
            width: W,
            height: H
          }
        };

        if (audioBuffer) {
          muxerConfig.audio = {
            codec: 'A_OPUS',
            numberOfChannels: audioBuffer.numberOfChannels,
            sampleRate: audioBuffer.sampleRate
          };
        }

        muxer = new Muxer(muxerConfig);

        encoder = new VideoEncoder({
          output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
          error: (e) => console.error('[VideoEncoder] Error:', e)
        });

        encoder.configure({
          codec: 'vp09.00.10.08',
          width: W,
          height: H,
          bitrate: 8_000_000, // 8 Mbps — pristine professional quality
          latencyMode: 'quality'
        });

        if (audioBuffer && typeof AudioEncoder !== 'undefined') {
          audioEncoder = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
            error: (e) => console.error('[AudioEncoder] Error:', e)
          });
          audioEncoder.configure({
            codec: 'opus',
            numberOfChannels: audioBuffer.numberOfChannels,
            sampleRate: audioBuffer.sampleRate,
            bitrate: 128000
          });
        }
      } catch (err) {
        console.error('[VideoTab] WebCodecs initialization failed:', err);
      }
    }

    const t0=performance.now();

    for(let i=0;i<total&&!_stopped;i++){
      const ts=i*step;
      if(ts>dur) break;

      await _seekTo(vid,ts);

      // ── Capture frame ──
      if (bgMode === 'color') {
        capCtx.clearRect(0, 0, W, H);
      } else {
        capCtx.fillStyle='#ffffff'; // white BG for clean pixels
        capCtx.fillRect(0,0,W,H);
      }
      capCtx.drawImage(vid,0,0,W,H);
      const imgData=capCtx.getImageData(0,0,W,H);

      let result;
      if (bgMode === 'color') {
        // Chroma Key Mode (Bypasses AI segmentation entirely = zero lag)
        result = applyChromaKey(imgData, bgColor);
      } else {
        // AI Segmenter Mode
        const tensor=preprocessImageData(imgData);
        const alpha=await NexusModel.infer(tensor);

        // Re-read fresh (white BG)
        capCtx.fillStyle='#ffffff';
        capCtx.fillRect(0,0,W,H);
        capCtx.drawImage(vid,0,0,W,H);
        const fresh=capCtx.getImageData(0,0,W,H);
        result=applyAlphaMask(fresh,alpha);
      }

      // ── Composite background ──
      outCtx.clearRect(0,0,W,H);

      if(bgMode==='image'&&_bgImg){
        outCtx.drawImage(_bgImg,0,0,W,H);
      }
      // Draw the RGBA result (composites alpha over BG)
      const tmpC=document.createElement('canvas');
      tmpC.width=W; tmpC.height=H;
      tmpC.getContext('2d').putImageData(result,0,0);
      outCtx.drawImage(tmpC,0,0);

      // ── Store frame (for ZIP fallback) ──
      _frames.push(result);

      // ── Encode frame via WebCodecs ──
      if (encoder) {
        const timestamp = Math.round(i * (1_000_000 / outputFps));
        const frame = new VideoFrame(out, { timestamp });
        encoder.encode(frame, { keyFrame: i % 30 === 0 });
        frame.close();
      }

      // ── Live preview ──
      liveCtx.clearRect(0,0,liveC.width,liveC.height);
      liveCtx.drawImage(out,0,0,liveC.width,liveC.height);

      // ── Progress ──
      const pct=(i+1)/total;
      const elapsed=(performance.now()-t0)/1000;
      const fpsCur=(i+1)/elapsed;
      const eta=(total-i-1)/Math.max(fpsCur,0.01);
      $('vpFill').style.width=(pct*100).toFixed(1)+'%';
      $('vpPct').textContent=Math.round(pct*100)+'%';
      $('vpFrames').textContent=(i+1)+'/'+total;
      $('vpFps').textContent=fpsCur.toFixed(1)+' fps';
      $('vpEta').textContent='ETA '+fmtTime(eta);

      // Smart throttle pacing: if smooth mode is active, sleep 45ms to let CPU cool down & prevent interface lag
      const throttleCheckbox = $('vThrottle');
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      let delayMs = (throttleCheckbox && throttleCheckbox.checked) ? 45 : 1;
      if (isMobile) {
        delayMs = Math.max(delayMs, 40); // Enforce at least 40ms on mobile
      }
      await new Promise(r=>setTimeout(r, delayMs)); // yield to UI
    }

    // ── Finalize WebCodecs encoder & Muxer ──
    if (encoder) {
      await encoder.flush();
      encoder.close();

      // Encode and mux audio track (Request 3)
      if (audioEncoder && audioBuffer) {
        try {
          const sampleRate = audioBuffer.sampleRate;
          const numberOfChannels = audioBuffer.numberOfChannels;
          const totalSamples = audioBuffer.length;
          const chunkSize = 4096;
          let offset = 0;

          while (offset < totalSamples) {
            const currentChunkSize = Math.min(chunkSize, totalSamples - offset);
            const planarData = new Float32Array(numberOfChannels * currentChunkSize);
            for (let ch = 0; ch < numberOfChannels; ch++) {
              const channelData = audioBuffer.getChannelData(ch);
              const sub = channelData.subarray(offset, offset + currentChunkSize);
              planarData.set(sub, ch * currentChunkSize);
            }

            const audioData = new AudioData({
              format: 'f32-planar',
              sampleRate: sampleRate,
              numberOfFrames: currentChunkSize,
              numberOfChannels: numberOfChannels,
              timestamp: Math.round((offset / sampleRate) * 1_000_000),
              data: planarData
            });

            audioEncoder.encode(audioData);
            audioData.close();
            offset += currentChunkSize;
          }

          await audioEncoder.flush();
          audioEncoder.close();
        } catch (audioErr) {
          console.error('[VideoTab] Audio encoding failed:', audioErr);
        }
      }
      
      muxer.finalize();
      const buffer = muxer.target.buffer;
      _videoBlob = new Blob([buffer], { type: 'video/webm' });
    }

    $('btnStopVid').style.display='none';
    $('btnProcessVid').style.display='';

    const total_t=(performance.now()-t0)/1000;

    if(!_stopped){
      $('vidDone').style.display='';
      $('vidDoneMsg').textContent=`✅ ${_frames.length} frames · ${fmtTime(total_t)}`;

      // Show correct download button
      if(_videoBlob){
        $('btnDlVid').style.display='';
        $('btnDlVid').textContent='⬇ Download WebM Video';
        $('btnDlZip').style.display='';

        // Show completed video preview player
        const url = URL.createObjectURL(_videoBlob);
        $('vidOutputEl').src = url;
        $('vidOutputEl').style.display = 'block';
      } else {
        $('btnDlVid').style.display='none';
        $('btnDlZip').style.display='';
        $('btnDlZip').textContent='⬇ Download PNG Frames ZIP';
        $('vidOutputEl').style.display = 'none';
      }
      showToast('Video done! '+_frames.length+' frames','success');
    } else {
      showToast('Stopped at '+_frames.length+' frames','error');
    }
  }

  function _seekTo(vid,ts){
    return new Promise(res=>{
      if(Math.abs(vid.currentTime-ts)<0.015){res();return;}
      vid.onseeked=()=>{
        vid.onseeked=null;
        // A short 40ms delay gives the GPU/decoder time to fully paint the seeked frame.
        setTimeout(res, 40);
      };
      vid.currentTime=ts;
    });
  }

  function showLocalAdOverlay(fileName, downloadCallback) {
    const existingBodyChildren = Array.from(document.body.children);

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: rgba(10, 10, 10, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      color: #f0f0f0;
      font-family: 'Inter', system-ui, sans-serif;
    `;
    
    const card = document.createElement('div');
    card.style.cssText = `
      background: #141414;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 28px 24px;
      width: 100%;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5);
    `;
    
    const spinnerContainer = document.createElement('div');
    spinnerContainer.style.cssText = `
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      margin-bottom: 24px;
      border: 4px solid rgba(200, 241, 53, 0.15);
      border-top-color: #c8f135;
      border-radius: 50%;
      animation: ad-spin-local 1s linear infinite;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ad-spin-local { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      @keyframes ad-counter-spin-local { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
    `;
    document.head.appendChild(style);
    
    const countLabel = document.createElement('span');
    countLabel.style.cssText = `
      position: absolute;
      font-size: 1.25rem;
      font-weight: 700;
      color: #c8f135;
      animation: ad-counter-spin-local 1s linear infinite;
    `;
    
    let countdown = 5;
    countLabel.textContent = countdown;
    spinnerContainer.appendChild(countLabel);
    card.appendChild(spinnerContainer);
    
    const title = document.createElement('h3');
    title.textContent = 'Generating Your File...';
    title.style.cssText = 'font-size: 1.25rem; font-weight: 700; margin: 0 0 8px; color: #fff;';
    card.appendChild(title);
    
    const sub = document.createElement('p');
    sub.textContent = `We are preparing "${fileName}" for you. This free service is supported by ads.`;
    sub.style.cssText = 'font-size: 0.875rem; color: rgba(240, 240, 240, 0.55); margin: 0 0 24px; line-height: 1.5;';
    card.appendChild(sub);

    const adInfo = document.createElement('div');
    adInfo.style.cssText = 'font-size: 0.75rem; color: rgba(255, 255, 255, 0.3); padding: 12px; border: 1px dashed rgba(255, 255, 255, 0.08); border-radius: 8px; margin-bottom: 24px;';
    adInfo.textContent = 'Sponsored Advertisement';
    card.appendChild(adInfo);

    const btn = document.createElement('button');
    btn.textContent = 'Please wait...';
    btn.disabled = true;
    btn.style.cssText = 'width: 100%; padding: 10px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); border: none; border-radius: 8px; font-weight: 600; cursor: not-allowed;';
    card.appendChild(btn);
    
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    
    // Load clean Monetag Vignette Banner script dynamically
    const script = document.createElement('script');
    script.dataset.zone = '11108858';
    script.src = 'https://n6wxm.com/vignette.min.js';
    const target = [document.documentElement, document.body].filter(Boolean).pop();
    if (target) target.appendChild(script);

    const interval = setInterval(() => {
      countdown--;
      countLabel.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(interval);
        spinnerContainer.innerHTML = '✓';
        spinnerContainer.style.borderColor = '#c8f135';
        spinnerContainer.style.animation = 'none';
        spinnerContainer.style.color = '#c8f135';
        spinnerContainer.style.fontSize = '2rem';
        spinnerContainer.style.fontWeight = 'bold';
        
        title.textContent = 'Download Ready!';
        sub.textContent = 'Your file download has started automatically.';
        
        btn.textContent = 'Done / Close';
        btn.disabled = false;
        btn.style.cssText = 'width: 100%; padding: 10px; background: #c8f135; color: #0a0a0a; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;';
        btn.onclick = () => {
          if (document.body.contains(overlay)) document.body.removeChild(overlay);
          if (target && target.contains(script)) target.removeChild(script);
          
          // 1. Clean up any push notification banners injected by the Monetag script
          const currentBodyChildren = Array.from(document.body.children);
          currentBodyChildren.forEach(child => {
            if (!existingBodyChildren.includes(child) && child !== overlay && child !== script) {
              child.remove();
            }
          });

          // 2. Remove any iframe, div, or element that is fixed/absolute and has high z-index
          const preserve = ['cursor', 'cursorDot', 'toast', 'procOverlay', 'batchModal'];
          document.querySelectorAll('div, iframe, [style*="position: fixed"], [style*="z-index"]').forEach(el => {
            const style = window.getComputedStyle(el);
            const pos = style.position;
            const z = parseInt(style.zIndex);
            if ((pos === 'fixed' || pos === 'absolute') && z && z > 1000) {
              if (!preserve.includes(el.id) && el !== overlay && !el.closest('#batchModal') && !el.closest('#procOverlay')) {
                el.remove();
              }
            }
          });

          // 3. Clear any dynamically created bodies/iframes containing the ad tag domain
          document.querySelectorAll('iframe').forEach(ifr => {
            try {
              if (ifr.src.includes('nap5k.com') || ifr.src.includes('n6wxm.com') || ifr.src.includes('vignette') || ifr.src.includes('tag.min.js')) {
                ifr.remove();
              }
            } catch(e) {}
          });
        };
        
        downloadCallback();
      }
    }, 1000);
  }

  // ── Download WebM video ──
  function _downloadVideo(){
    if(!_videoBlob) return;

    const executeDownload = () => {
      const a=document.createElement('a');
      a.href=URL.createObjectURL(_videoBlob);
      a.download='editroy_nobg.webm';
      a.click();
      showToast('WebM video downloaded!','success');
    };

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'start-export-ad', fileName: 'editroy_nobg.webm' }, '*');
      const onAdComplete = (e) => {
        if (e.data && e.data.type === 'ad-completed') {
          window.removeEventListener('message', onAdComplete);
          executeDownload();
        }
      };
      window.addEventListener('message', onAdComplete);
    } else {
      showLocalAdOverlay('editroy_nobg.webm', executeDownload);
    }
  }

  // ── Download ZIP of PNG frames (fallback / for NLEs) ──
  async function _downloadZip(){
    if(!_frames.length) return;

    const executeDownload = async () => {
      showToast('Building ZIP…');
      const zip=new JSZip();
      const folder=zip.folder('editroy_frames');
      for(let i=0;i<_frames.length;i++){
        const c=document.createElement('canvas');
        c.width=_frames[i].width; c.height=_frames[i].height;
        c.getContext('2d').putImageData(_frames[i],0,0);
        const blob=await canvasToBlob(c);
        folder.file('frame_'+String(i).padStart(5,'0')+'.png',await blob.arrayBuffer());
        if(i%15===0){
          $('vidDoneMsg').textContent=`Packing ${i}/${_frames.length}…`;
          await new Promise(r=>setTimeout(r,0));
        }
      }
      const zb=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(zb); a.download='editroy_frames.zip'; a.click();
      $('vidDoneMsg').textContent='✅ ZIP Downloaded!';
      showToast('ZIP downloaded!','success');
    };

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'start-export-ad', fileName: 'editroy_frames.zip' }, '*');
      const onAdComplete = (e) => {
        if (e.data && e.data.type === 'ad-completed') {
          window.removeEventListener('message', onAdComplete);
          executeDownload();
        }
      };
      window.addEventListener('message', onAdComplete);
    } else {
      showLocalAdOverlay('editroy_frames.zip', executeDownload);
    }
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 255, b: 0 };
  }

  function applyChromaKey(imageData, keyColorHex) {
    const { data } = imageData;
    const keyColor = hexToRgb(keyColorHex);
    
    const similarity = 40; 
    const smoothness = 12;
    const spill = 45;
    
    const tol = (similarity / 100) * 255;
    const smooth = (smoothness / 100) * 255;
    const spillReduction = spill / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      const dist = Math.sqrt((r - keyColor.r) ** 2 + (g - keyColor.g) ** 2 + (b - keyColor.b) ** 2);
      
      let alpha = 255;
      if (dist < tol) {
        alpha = 0;
      } else if (dist < tol + smooth) {
        alpha = Math.round(((dist - tol) / smooth) * 255);
      }
      
      if (alpha > 0) {
        if (keyColor.g > keyColor.r && keyColor.g > keyColor.b) {
          const avgRedBlue = (r + b) / 2;
          if (g > avgRedBlue) {
            const factor = spillReduction * (1 - alpha / 255);
            data[i+1] = Math.round(g * (1 - factor) + avgRedBlue * factor);
          }
        } else if (keyColor.b > keyColor.r && keyColor.b > keyColor.g) {
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

  function onModelLoad(){ if(_file) $('btnProcessVid').disabled=false; }
  return { init, onModelLoad };
})();
