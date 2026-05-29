'use strict';

const BatchTab = (() => {
  let _files=[], _results=[];
  let _editIndex=-1, _editOriginalImageData=null, _editResult=null, _editMaskCanvas=null;
  let _editActiveTool='brush', _editIsDrawing=false;
  let _editLastX=0, _editLastY=0;
  const $=id=>document.getElementById(id);

  function init(){
    $('batchInput').addEventListener('change',e=>{ if(e.target.files.length) _load(e.target.files); });
    $('batchDrop').addEventListener('click',()=>$('batchInput').click());
    makeDragTarget($('batchDrop'),files=>{
      const imgs=Array.from(files).filter(f=>f.type.startsWith('image/'));
      if(imgs.length) _load(imgs);
    });
    $('btnBatchProcess').addEventListener('click',_processAll);
    $('btnBatchDl').addEventListener('click',_downloadZip);
    $('btnBatchClear').addEventListener('click',_clear);

    // Click handler for processed batch cards to open modal
    $('batchGrid').addEventListener('click', e => {
      const card = e.target.closest('.bi');
      if (!card) return;
      const index = parseInt(card.id.replace('bi', ''));
      const ov = $('bio' + index);
      if (ov && ov.classList.contains('done')) {
        _openEditModal(index);
      }
    });

    $('btnCloseBatchModal').addEventListener('click', _closeEditModal);
    $('mBtnCancel').addEventListener('click', _closeEditModal);
    $('mBtnSave').addEventListener('click', _saveEditModal);

    $('mBtnBrush').addEventListener('click', () => {
      _editActiveTool = 'brush';
      $('mBtnBrush').classList.add('active');
      $('mBtnEraser').classList.remove('active');
    });
    $('mBtnEraser').addEventListener('click', () => {
      _editActiveTool = 'eraser';
      $('mBtnEraser').classList.add('active');
      $('mBtnBrush').classList.remove('active');
    });
    $('mBrushSize').addEventListener('input', e => {
      $('mBrushSizeVal').textContent = e.target.value + 'px';
    });

    const mCanvas = $('batchModalCanvas');
    mCanvas.addEventListener('mousedown', _mStartDrawing);
    mCanvas.addEventListener('mousemove', _mDrawMove);
    mCanvas.addEventListener('mouseup', _mStopDrawing);
    mCanvas.addEventListener('mouseleave', () => { _mStopDrawing(); _mResetCursor(); });

    mCanvas.addEventListener('touchstart', e => { e.preventDefault(); _mStartDrawing(e); }, { passive: false });
    mCanvas.addEventListener('touchmove', e => { e.preventDefault(); _mDrawMove(e); }, { passive: false });
    mCanvas.addEventListener('touchend', e => { e.preventDefault(); _mStopDrawing(); _mResetCursor(); }, { passive: false });
  }

  function _load(fileList){
    _files=Array.from(fileList).slice(0,100);
    _results=new Array(_files.length).fill(null);
    _renderGrid();
    $('batchCount').textContent=_files.length+' images';
    $('batchToolbar').style.display='flex';
    $('btnBatchProcess').disabled=!NexusModel.ready();
    $('btnBatchDl').disabled=true;
  }

  function _renderGrid(){
    const g=$('batchGrid'); g.innerHTML='';
    _files.forEach((f,i)=>{
      const d=document.createElement('div'); d.className='bi'; d.id='bi'+i;
      const img=document.createElement('img');
      img.src=URL.createObjectURL(f); img.loading='lazy';
      const ov=document.createElement('div');
      ov.className='bi-overlay pending'; ov.textContent='Pending'; ov.id='bio'+i;
      d.append(img,ov); g.appendChild(d);
    });
  }

  async function _processAll(){
    if(!NexusModel.ready()||!_files.length) return;
    $('btnBatchProcess').disabled=true;
    let done=0,errors=0;
    for(let i=0;i<_files.length;i++){
      const ov=$('bio'+i);
      ov.className='bi-overlay working'; ov.textContent='⏳';
      try{
        const img=await loadImageFile(_files[i]);
        const imgData=imageToImageData(img);
        const tensor=preprocessImageData(imgData);
        const alpha=await NexusModel.infer(tensor);
        _results[i]=applyAlphaMask(imgData,alpha);
        // Show result thumbnail
        const c=document.createElement('canvas');
        renderToCanvas(c,_results[i],null);
        $('bi'+i).querySelector('img').src=c.toDataURL('image/png');
        ov.className='bi-overlay done'; ov.textContent=''; done++;
      } catch(e){
        ov.className='bi-overlay err'; ov.textContent='❌'; errors++;
      }
      $('batchCount').textContent=done+' done · '+errors+' err · '+(_files.length-done-errors)+' left';
      await new Promise(r=>setTimeout(r,0));
    }
    $('btnBatchDl').disabled=false;
    showToast('Batch done: '+done+' ✅ '+errors+' ❌', done>0?'success':'error');
  }

  async function _downloadZip(){
    const ready=_results.filter(Boolean);
    if(!ready.length)return;
    showToast('Packing ZIP…');
    const zip=new JSZip();
    const folder=zip.folder('editroy_batch');
    for(let i=0;i<_results.length;i++){
      if(!_results[i])continue;
      const c=document.createElement('canvas');
      renderToCanvas(c,_results[i],null);
      const blob=await canvasToBlob(c);
      const name=_files[i].name.replace(/\.[^.]+$/,'')+'_nobg.png';
      folder.file(name,await blob.arrayBuffer());
    }
    const zb=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(zb); a.download='editroy_batch.zip'; a.click();
    showToast('ZIP downloaded!','success');
  }

  function _clear(){
    _files=[]; _results=[];
    $('batchGrid').innerHTML='';
    $('batchToolbar').style.display='none';
    $('batchInput').value='';
  }

  async function _openEditModal(index){
    _editIndex = index;
    const res = _results[index];
    if(!res) return;

    // Create a copy of the result so edits are draft
    const resCopy = new ImageData(new Uint8ClampedArray(res.data), res.width, res.height);
    _editResult = resCopy;

    try {
      showToast('Opening editor…');
      const img = await loadImageFile(_files[index]);
      _editOriginalImageData = imageToImageData(img);

      // Create mask canvas
      _editMaskCanvas = document.createElement('canvas');
      _editMaskCanvas.width = res.width;
      _editMaskCanvas.height = res.height;
      const mCtx = _editMaskCanvas.getContext('2d');
      const mData = mCtx.createImageData(res.width, res.height);
      for(let i=0; i < res.width * res.height; i++){
        const a = res.data[i*4+3];
        mData.data[i*4] = 255;
        mData.data[i*4+1] = 255;
        mData.data[i*4+2] = 255;
        mData.data[i*4+3] = a;
      }
      mCtx.putImageData(mData, 0, 0);

      _editActiveTool = 'brush';
      $('mBtnBrush').classList.add('active');
      $('mBtnEraser').classList.remove('active');
      $('mBrushSize').value = 20;
      $('mBrushSizeVal').textContent = '20px';

      renderToCanvas($('batchModalCanvas'), _editResult, null);
      $('batchModalTitle').textContent = 'Edit: ' + _files[index].name;
      $('batchModal').style.display = 'flex';
    } catch(e) {
      console.error(e);
      showToast('Failed to load editor','error');
    }
  }

  function _closeEditModal(){
    $('batchModal').style.display = 'none';
    _mResetCursor();
    _editOriginalImageData = null;
    _editResult = null;
    _editMaskCanvas = null;
    _editIndex = -1;
  }

  function _saveEditModal(){
    if(_editIndex !== -1 && _editResult) {
      _results[_editIndex] = _editResult;
      // Redraw thumbnail
      const c = document.createElement('canvas');
      renderToCanvas(c, _editResult, null);
      $('bi'+_editIndex).querySelector('img').src = c.toDataURL('image/png');
      showToast('Changes saved!');
    }
    _closeEditModal();
  }

  function _mGetMousePos(e){
    const canvas = $('batchModalCanvas');
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

  function _mStartDrawing(e){
    if(!_editResult || !_editMaskCanvas) return;
    _editIsDrawing = true;
    const pos = _mGetMousePos(e);
    _editLastX = pos.x;
    _editLastY = pos.y;
    _mDraw(pos.x, pos.y, pos.x, pos.y);
  }

  function _mDrawMove(e){
    _mUpdateCursorSize(e);
    if(!_editIsDrawing) return;
    const pos = _mGetMousePos(e);
    _mDraw(_editLastX, _editLastY, pos.x, pos.y);
    _editLastX = pos.x;
    _editLastY = pos.y;
  }

  function _mStopDrawing(){
    _editIsDrawing = false;
  }

  function _mDraw(x1, y1, x2, y2){
    if(!_editMaskCanvas) return;
    const mCtx = _editMaskCanvas.getContext('2d');
    const size = parseInt($('mBrushSize').value);
    
    mCtx.lineWidth = size;
    mCtx.lineCap = 'round';
    mCtx.lineJoin = 'round';
    
    if(_editActiveTool === 'brush'){
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
    
    _mUpdateResultFromMaskCanvas();
  }

  function _mUpdateResultFromMaskCanvas(){
    if(!_editResult || !_editOriginalImageData) return;
    const mCtx = _editMaskCanvas.getContext('2d');
    const mData = mCtx.getImageData(0, 0, _editMaskCanvas.width, _editMaskCanvas.height);
    
    for(let i=0; i<_editResult.data.length; i+=4){
      _editResult.data[i]   = _editOriginalImageData.data[i];
      _editResult.data[i+1] = _editOriginalImageData.data[i+1];
      _editResult.data[i+2] = _editOriginalImageData.data[i+2];
      _editResult.data[i+3] = mData.data[i+3];
    }
    renderToCanvas($('batchModalCanvas'), _editResult, null);
  }

  function _mUpdateCursorSize(e){
    const canvas = $('batchModalCanvas');
    const rect = canvas.getBoundingClientRect();
    const cur = $('cursor');
    if(!cur) return;
    
    const size = parseInt($('mBrushSize').value);
    const cssBrushSize = size * (rect.width / canvas.width);
    
    cur.style.width = cssBrushSize + 'px';
    cur.style.height = cssBrushSize + 'px';
    
    if(_editActiveTool === 'brush'){
      cur.style.borderColor = 'var(--accent)';
    }else{
      cur.style.borderColor = 'var(--red)';
    }
  }

  function _mResetCursor(){
    const cur = $('cursor');
    if(!cur) return;
    cur.style.width = '';
    cur.style.height = '';
    cur.style.borderColor = '';
  }

  function onModelLoad(){ if(_files.length) $('btnBatchProcess').disabled=false; }

  return { init, onModelLoad };
})();
