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
      if(!$('inputPreview').style.display||$('inputPreview').style.display==='none')
        $('imgInput').click();
    });
    $('btnProcess').addEventListener('click',_process);
    $('btnDownload').addEventListener('click',_download);
    $('btnCopy').addEventListener('click',_copy);
    $('clearBtn').addEventListener('click',_clear);

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
    try{
      _img=await loadImageFile(file);
      _result=null;
      _maskCanvas=null;
      _originalImageData=null;
      $('inputPreview').src=_img.src;
      $('inputPreview').style.display='block';
      $('dropIdle').style.display='none';
      $('clearBtn').style.display='';
      $('outputCanvas').style.display='none';
      $('outputIdle').style.display='';
      $('statChips').style.display='none';
      $('bgRow').style.visibility='hidden';
      $('editRow').style.display='none';
      _updateBtns();
      showToast(_img.naturalWidth+'×'+_img.naturalHeight+' loaded');
    }catch(e){ showToast('Failed to load image','error'); }
  }

  async function _process(){
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
      _result=applyAlphaMask(fresh,alpha);

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

  async function _download(){
    if(!_result) return;
    // Always download transparent PNG
    const c=document.createElement('canvas');
    c.width=_result.width; c.height=_result.height;
    c.getContext('2d').putImageData(_result,0,0);
    const blob=await canvasToBlob(c);
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download='nexuscut_nobg.png'; a.click();
    showToast('Downloaded!','success');
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
    $('btnProcess').disabled=!(NexusModel.ready()&&_img);
    $('btnDownload').disabled=!_result;
    $('btnCopy').disabled=!_result;
  }

  function onModelLoad(){ _updateBtns(); }
  return { init, onModelLoad };
})();
