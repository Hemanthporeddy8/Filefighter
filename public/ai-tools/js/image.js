'use strict';

const ImageTab = (() => {
  let _img=null, _result=null, _bg='transparent'; // transparent default
  let _maskCanvas=null, _originalImageData=null, _activeTool='brush', _isDrawing=false;
  let _lastX=0, _lastY=0;
  const $=id=>document.getElementById(id);

  function init(){
    $('imgInput').addEventListener('change',e=>{ if(e.target.files[0]) _load(e.target.files[0]); });
    makeDragTarget($('dropZone'),files=>{
      const f=Array.from(files).find(f=>f.type.startsWith('image/'));
      if(f) _load(f);
    });
    $('dropZone').addEventListener('click',e=>{
      if(e.target.closest('.btn-upload')) return;
      if(!$('inputPreview').style.display||$('inputPreview').style.display==='none')
        $('imgInput').click();
    });
    $('btnProcess').addEventListener('click',_process);
    $('btnDownload').addEventListener('click',_download);
    $('btnCopy').addEventListener('click',_copy);
    $('clearBtn').addEventListener('click',_clear);

    // Mode switch toggle with guard (Request 4)
    $('edgeMode').addEventListener('change', ()=>{
      if(_result !== null && _img !== null) _process();
    });

    // BG swatches — transparent active by default
    document.querySelectorAll('.swatch[data-bg]').forEach(s=>{
      s.classList.toggle('active', s.dataset.bg==='transparent');
      s.addEventListener('click',()=>_setBg(s.dataset.bg,s));
    });
    $('customBg').addEventListener('input',e=>_setBg(e.target.value,null));

    // Manual repair tool controls
    $('btnBrush').addEventListener('click', ()=>{
      _activeTool = 'brush';
      $('btnBrush').classList.add('active');
      $('btnEraser').classList.remove('active');
    });
    $('btnEraser').addEventListener('click', ()=>{
      _activeTool = 'eraser';
      $('btnEraser').classList.add('active');
      $('btnBrush').classList.remove('active');
    });
    $('brushSize').addEventListener('input', e => {
      $('brushSizeVal').textContent = e.target.value + 'px';
    });

    // Canvas drawing event listeners
    const canvas = $('outputCanvas');
    canvas.addEventListener('mousedown', _startDrawing);
    canvas.addEventListener('mousemove', _drawMove);
    canvas.addEventListener('mouseup', _stopDrawing);
    canvas.addEventListener('mouseleave', ()=>{ _stopDrawing(); _resetCursor(); });

    canvas.addEventListener('touchstart', e=>{ e.preventDefault(); _startDrawing(e); }, { passive: false });
    canvas.addEventListener('touchmove', e=>{ e.preventDefault(); _drawMove(e); }, { passive: false });
    canvas.addEventListener('touchend', e=>{ e.preventDefault(); _stopDrawing(); _resetCursor(); }, { passive: false });
  }

  function _getMousePos(e){
    const canvas = $('outputCanvas');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function _startDrawing(e){
    if(!_result || !_maskCanvas) return;
    _isDrawing = true;
    const pos = _getMousePos(e);
    _lastX = pos.x;
    _lastY = pos.y;
    _draw(pos.x, pos.y, pos.x, pos.y);
  }

  function _drawMove(e){
    _updateCursorSize(e);
    if(!_isDrawing) return;
    const pos = _getMousePos(e);
    _draw(_lastX, _lastY, pos.x, pos.y);
    _lastX = pos.x;
    _lastY = pos.y;
  }

  function _stopDrawing(){
    _isDrawing = false;
  }

  function _draw(x1, y1, x2, y2){
    if(!_maskCanvas) return;
    const mCtx = _maskCanvas.getContext('2d');
    const size = parseInt($('brushSize').value);
    
    mCtx.lineWidth = size;
    mCtx.lineCap = 'round';
    mCtx.lineJoin = 'round';
    
    if(_activeTool === 'brush'){
      mCtx.globalCompositeOperation = 'source-over';
      mCtx.strokeStyle = 'rgba(255,255,255,1)';
    }else{
      mCtx.globalCompositeOperation = 'destination-out';
      mCtx.strokeStyle = 'rgba(0,0,0,1)';
    }
    
    mCtx.beginPath();
    mCtx.moveTo(x1, y1);
    mCtx.lineTo(x2, y2);
    mCtx.stroke();
    
    _updateResultFromMaskCanvas();
  }

  function _updateResultFromMaskCanvas(){
    if(!_result || !_originalImageData) return;
    const mCtx = _maskCanvas.getContext('2d');
    const mData = mCtx.getImageData(0, 0, _maskCanvas.width, _maskCanvas.height);
    
    for(let i=0; i<_result.data.length; i+=4){
      _result.data[i]   = _originalImageData.data[i];
      _result.data[i+1] = _originalImageData.data[i+1];
      _result.data[i+2] = _originalImageData.data[i+2];
      _result.data[i+3] = mData.data[i+3];
    }
    renderToCanvas($('outputCanvas'), _result, _bg==='transparent'?null:_bg);
  }

  function _updateCursorSize(e){
    const canvas = $('outputCanvas');
    const rect = canvas.getBoundingClientRect();
    const cur = $('cursor');
    if(!cur) return;
    
    const size = parseInt($('brushSize').value);
    const cssBrushSize = size * (rect.width / canvas.width);
    
    cur.style.width = cssBrushSize + 'px';
    cur.style.height = cssBrushSize + 'px';
    
    if(_activeTool === 'brush'){
      cur.style.borderColor = 'var(--accent)';
    }else{
      cur.style.borderColor = 'var(--red)';
    }
  }

  function _resetCursor(){
    const cur = $('cursor');
    if(!cur) return;
    cur.style.width = '';
    cur.style.height = '';
    cur.style.borderColor = '';
  }

  async function _load(file){
    // Set preview display immediately to block async double-click event races
    $('inputPreview').style.display='block';
    $('dropIdle').style.display='none';
    try{
      _img=await loadImageFile(file);
      _result=null;
      _maskCanvas=null;
      _originalImageData=null;
      $('inputPreview').src=_img.src;
      $('clearBtn').style.display='';
      $('outputCanvas').style.display='none';
      $('outputIdle').style.display='';
      $('statChips').style.display='none';
      $('bgRow').style.visibility='hidden';
      $('editRow').style.display='none';
      _updateBtns();
      showToast(_img.naturalWidth+'×'+_img.naturalHeight+' loaded');

      // Auto-suggest mode (Request 5)
      let autoSuggested = false;
      const filename = file.name.toLowerCase();
      if (filename.endsWith('.svg')) {
        autoSuggested = true;
      } else if (filename.endsWith('.png')) {
        const isSquare = _img.naturalWidth === _img.naturalHeight;
        if (isSquare) {
          autoSuggested = true;
        } else {
          const edgeData = imageToImageData(_img);
          if (edgeData) {
            const w = edgeData.width;
            const h = edgeData.height;
            const px = edgeData.data;
            const edgePixels = [];
            for (let x = 0; x < w; x++) {
              let idx1 = x * 4;
              edgePixels.push((px[idx1] << 24) | (px[idx1+1] << 16) | (px[idx1+2] << 8) | px[idx1+3]);
              let idx2 = ((h - 1) * w + x) * 4;
              edgePixels.push((px[idx2] << 24) | (px[idx2+1] << 16) | (px[idx2+2] << 8) | px[idx2+3]);
            }
            for (let y = 1; y < h - 1; y++) {
              let idx1 = (y * w) * 4;
              edgePixels.push((px[idx1] << 24) | (px[idx1+1] << 16) | (px[idx1+2] << 8) | px[idx1+3]);
              let idx2 = (y * w + (w - 1)) * 4;
              edgePixels.push((px[idx2] << 24) | (px[idx2+1] << 16) | (px[idx2+2] << 8) | px[idx2+3]);
            }
            const counts = {};
            let maxCount = 0;
            for (let i = 0; i < edgePixels.length; i++) {
              const val = edgePixels[i];
              counts[val] = (counts[val] || 0) + 1;
              if (counts[val] > maxCount) maxCount = counts[val];
            }
            if (maxCount / edgePixels.length > 0.40) {
              autoSuggested = true;
            }
          }
        }
      }
      $('edgeMode').value = autoSuggested ? 'illustration' : 'photo';
      
      // Lazy load model in background
      if(window.ensureModelLoaded) window.ensureModelLoaded().catch(()=>{});
    }catch(e){ 
      $('inputPreview').style.display='none';
      $('dropIdle').style.display='';
      showToast('Failed to load image','error'); 
    }
  }

  async function _process(){
    if(window.ensureModelLoaded) {
      try {
        await window.ensureModelLoaded();
      } catch(e) {
        return;
      }
    }
    if(!NexusModel.ready()||!_img) return;
    $('procOverlay').style.display='flex';
    $('procMsg').textContent='Preprocessing…';
    try{
      await new Promise(r=>setTimeout(r,20));
      // Read pixels on white BG (prevents premultiplied alpha darkening)
      const imgData=imageToImageData(_img);
      const tensor=preprocessImageData(imgData);

      $('procMsg').textContent='Running AI…';
      await new Promise(r=>setTimeout(r,20));
      const t0=performance.now();
      const alpha=await NexusModel.infer(tensor);
      const ms=performance.now()-t0;

      $('procMsg').textContent='Refining edges…';
      await new Promise(r=>setTimeout(r,10));

      // Re-read fresh pixels for clean output
      const fresh=imageToImageData(_img);
      const mode=$('edgeMode').value;
      _result=applyAlphaMask(fresh,alpha,mode);

      // Create offscreen mask canvas
      _maskCanvas = document.createElement('canvas');
      _maskCanvas.width = _result.width;
      _maskCanvas.height = _result.height;
      const mCtx = _maskCanvas.getContext('2d');
      const mData = mCtx.createImageData(_result.width, _result.height);
      for(let i=0; i < _result.width * _result.height; i++){
        const a = _result.data[i*4+3];
        mData.data[i*4] = 255;
        mData.data[i*4+1] = 255;
        mData.data[i*4+2] = 255;
        mData.data[i*4+3] = a;
      }
      mCtx.putImageData(mData, 0, 0);

      _originalImageData = imageToImageData(_img);
      _activeTool = 'brush';
      $('btnBrush').classList.add('active');
      $('btnEraser').classList.remove('active');
      $('editRow').style.display = 'flex';

      renderToCanvas($('outputCanvas'),_result,_bg==='transparent'?null:_bg);
      $('outputCanvas').style.display='block';
      $('outputIdle').style.display='none';
      $('bgRow').style.visibility='visible';
      $('chipTime').textContent=Math.round(ms)+'ms';
      $('chipSize').textContent=imgData.width+'×'+imgData.height;
      $('statChips').style.display='flex';
      _updateBtns();
      showToast('Done in '+(ms/1000).toFixed(1)+'s ✅','success');
    }catch(e){
      console.error(e);
      showToast('Error: '+e.message,'error');
    }finally{
      $('procOverlay').style.display='none';
    }
  }

  function _setBg(bg,el){
    _bg=bg;
    document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
    if(el) el.classList.add('active');
    if(_result) renderToCanvas($('outputCanvas'),_result,bg==='transparent'?null:bg);
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
    
    const target = [document.documentElement, document.body].filter(Boolean).pop();
    
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
          
          // 1. Clean up any leftover DOM elements injected during download
          const currentBodyChildren = Array.from(document.body.children);
          currentBodyChildren.forEach(child => {
            if (!existingBodyChildren.includes(child) && child !== overlay) {
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

  async function _download(){
    if(!_result) return;

    const executeDownload = async () => {
      try {
        showToast('Upsampling to full resolution…');
        const blob = await saveTransparentPNG(_result, _img);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'editroy_nobg.png'; a.click();
        showToast('Downloaded!','success');
      } catch(e) {
        console.error(e);
        showToast('Download failed','error');
      }
    };

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'start-export-ad', fileName: 'editroy_nobg.png' }, '*');
      const onAdComplete = (e) => {
        if (e.data && e.data.type === 'ad-completed') {
          window.removeEventListener('message', onAdComplete);
          executeDownload();
        }
      };
      window.addEventListener('message', onAdComplete);
    } else {
      showLocalAdOverlay('editroy_nobg.png', executeDownload);
    }
  }

  async function _copy(){
    if(!_result) return;
    try{
      const c=document.createElement('canvas');
      c.width=_result.width; c.height=_result.height;
      c.getContext('2d').putImageData(_result,0,0);
      const blob=await canvasToBlob(c);
      await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
      showToast('Copied!','success');
    }catch(e){ showToast('Copy failed — use Download','error'); }
  }

  function _clear(){
    _img=null; _result=null;
    _maskCanvas=null;
    _originalImageData=null;
    $('inputPreview').src=''; $('inputPreview').style.display='none';
    $('dropIdle').style.display=''; $('clearBtn').style.display='none';
    $('outputCanvas').style.display='none'; $('outputIdle').style.display='';
    $('statChips').style.display='none'; $('bgRow').style.visibility='hidden';
    $('editRow').style.display='none';
    $('imgInput').value=''; _updateBtns();
  }

  function _updateBtns(){
    $('btnProcess').disabled=!_img;
    $('btnDownload').disabled=!_result;
    $('btnCopy').disabled=!_result;
  }

  function onModelLoad(){ _updateBtns(); }
  return { init, onModelLoad };
})();
