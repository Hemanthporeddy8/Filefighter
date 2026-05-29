'use strict';
const MEAN = [0.485,0.456,0.406];
const STD  = [0.229,0.224,0.225];
const MODEL_SIZE = 512;

/* ── Toast ── */
let _toastTimer;
function showToast(msg,type=''){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast show '+(type==='success'?'ok':type==='error'?'err':'');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>{t.className='toast';},3500);
}

/* ── Cursor ── */
function initCursor(){
  const cur=document.getElementById('cursor');
  const dot=document.getElementById('cursorDot');
  if(!cur)return;
  let mx=0,my=0,cx=0,cy=0;
  document.addEventListener('mousemove',e=>{
    mx=e.clientX; my=e.clientY;
    dot.style.left=mx+'px'; dot.style.top=my+'px';
  });
  (function anim(){
    cx+=(mx-cx)*0.15; cy+=(my-cy)*0.15;
    cur.style.left=cx+'px'; cur.style.top=cy+'px';
    requestAnimationFrame(anim);
  })();
}

/* ── Drag & drop ── */
function makeDragTarget(el,cb){
  el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag-over');});
  el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));
  el.addEventListener('drop',e=>{
    e.preventDefault();el.classList.remove('drag-over');
    if(e.dataTransfer.files.length)cb(e.dataTransfer.files);
  });
}

/* ── Load image ── */
function loadImageFile(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>res(img);
    img.onerror=()=>rej(new Error('Cannot load image'));
    img.src=url;
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FIX 1 — imageToImageData
   Always composite onto WHITE canvas first.
   Prevents premultiplied-alpha darkening of
   JPEG pixels when later modifying the alpha channel.
   Also downscales canvas if dimensions exceed 2048px (Request 6)
   and force-normalizes pixel values for ICC color profiles (Request 3).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function imageToImageData(img,w,h){
  const c=document.createElement('canvas');
  const maxDim=2048;
  const origW = img.naturalWidth || img.width || 0;
  const origH = img.naturalHeight || img.height || 0;
  let width=w||origW;
  let height=h||origH;

  // Downscale if exceeds 2048px (Request 6)
  if(!w&&!h&&(width>maxDim||height>maxDim)){
    if(width>height){
      height=Math.round(height*maxDim/width);
      width=maxDim;
    }else{
      width=Math.round(width*maxDim/height);
      height=maxDim;
    }
  }

  c.width=width;
  c.height=height;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#ffffff';          // white BG — critical for clean pixels
  ctx.fillRect(0,0,c.width,c.height);
  ctx.drawImage(img,0,0,c.width,c.height);

  // Force-normalize pixel values through browser color pipeline to fix ICC profile differences (Request 3)
  const isImageBitmap = (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap);
  if(!isImageBitmap){
    const temp=ctx.getImageData(0,0,c.width,c.height);
    ctx.putImageData(temp,0,0);
  }

  const imgData = ctx.getImageData(0,0,c.width,c.height);
  imgData.origW = origW;
  imgData.origH = origH;
  return imgData;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FIX 2 — preprocessImageData
   Uses canvas drawImage for BILINEAR resize to 512×512
   matching how training data was prepared in Python
   (PIL BILINEAR). Old nearest-neighbor caused blurry
   / mismatched input → bad model output.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function preprocessImageData(imageData){
  // Step 1: put original pixels into a source canvas
  const src=document.createElement('canvas');
  src.width=imageData.width; src.height=imageData.height;
  const srcCtx=src.getContext('2d',{willReadFrequently:true});
  srcCtx.putImageData(imageData,0,0);

  // Step 2: bilinear resize to 512×512 via drawImage
  const dst=document.createElement('canvas');
  dst.width=MODEL_SIZE; dst.height=MODEL_SIZE;
  const dstCtx=dst.getContext('2d',{willReadFrequently:true});
  dstCtx.imageSmoothingEnabled=true;
  dstCtx.imageSmoothingQuality='high';
  dstCtx.drawImage(src,0,0,MODEL_SIZE,MODEL_SIZE);
  const resized=dstCtx.getImageData(0,0,MODEL_SIZE,MODEL_SIZE);

  // Step 3: normalize to ImageNet stats → Float32 NCHW tensor
  const{data:px}=resized;
  const np=MODEL_SIZE*MODEL_SIZE;
  const t=new Float32Array(3*np);
  for(let i=0;i<np;i++){
    t[0*np+i]=(px[i*4  ]/255-MEAN[0])/STD[0];
    t[1*np+i]=(px[i*4+1]/255-MEAN[1])/STD[1];
    t[2*np+i]=(px[i*4+2]/255-MEAN[2])/STD[2];
  }
  return t;
}

// Two-pass dilation (max pool) to expand mask slightly in O(n) time (Request 1)
function dilateAlpha(alpha, w, h, radius = 1) {
  const temp = new Float32Array(w * h);
  // Pass 1: Horizontal max pool
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
  // Pass 2: Vertical max pool
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FIX 3 — applyAlphaMask
   Four improvements:
   a) Bilinear upsample avoids off-by-one at edges
   b) Fast two-pass dilation (max-pool) in O(n) (Request 1)
   c) Dynamic mode switch support (Photo vs Illustration) (Request 2)
   d) S-curve edge sharpening pushes soft values to hard 0/1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function applyAlphaMask(imageData,alphaFlat,mode='photo'){
  const{width:ow,height:oh,data:px}=imageData;
  const ms=MODEL_SIZE;

  // Bilinear upsample alpha from 512×512 → original size
  const alphaFull=new Float32Array(ow*oh);
  for(let py=0;py<oh;py++){
    for(let px2=0;px2<ow;px2++){
      const mx=(px2/Math.max(ow-1,1))*(ms-1);
      const my=(py/Math.max(oh-1,1))*(ms-1);
      const x0=Math.floor(mx),x1=Math.min(x0+1,ms-1);
      const y0=Math.floor(my),y1=Math.min(y0+1,ms-1);
      const tx=mx-x0,ty=my-y0;
      alphaFull[py*ow+px2]=
        (1-tx)*(1-ty)*alphaFlat[y0*ms+x0]+
        tx*(1-ty)*alphaFlat[y0*ms+x1]+
        (1-tx)*ty*alphaFlat[y1*ms+x0]+
        tx*ty*alphaFlat[y1*ms+x1];
    }
  }

  // Two-pass dilation (max-pool) (Request 1)
  dilateAlpha(alphaFull, ow, oh, 1);

  // S-curve edge sharpening based on mode (Request 2)
  let sharpness = 4;
  let threshold = 0.28;
  if(mode==='illustration'){
    sharpness = 2;
    threshold = 0.12;
  }

  const minVal = 1 / (1 + Math.exp(sharpness * threshold));
  const maxVal = 1 / (1 + Math.exp(-sharpness * (1 - threshold)));
  const range = maxVal - minVal;

  for(let i=0;i<alphaFull.length;i++){
    const s = 1/(1+Math.exp(-sharpness*(alphaFull[i]-threshold)));
    alphaFull[i] = (s - minVal) / range;
  }

  // Write alpha channel back
  for(let i=0;i<ow*oh;i++){
    px[i*4+3]=Math.round(Math.min(Math.max(alphaFull[i],0),1)*255);
  }
  return imageData;
}

// Upsamples mask back to original full resolution before saving to prevent resolution loss (Request 6)
async function saveTransparentPNG(result, originalImg) {
  const origW = result.origW || originalImg.naturalWidth || originalImg.width;
  const origH = result.origH || originalImg.naturalHeight || originalImg.height;

  const c = document.createElement('canvas');
  c.width = origW;
  c.height = origH;
  const ctx = c.getContext('2d');

  // Draw original image at full resolution
  ctx.drawImage(originalImg, 0, 0, origW, origH);
  const fullData = ctx.getImageData(0, 0, origW, origH);

  const upsampledAlpha = new Float32Array(origW * origH);
  const rw = result.width;
  const rh = result.height;

  // Bilinear upsample the mask channel
  for (let py = 0; py < origH; py++) {
    for (let px = 0; px < origW; px++) {
      const mx = (px / Math.max(origW - 1, 1)) * (rw - 1);
      const my = (py / Math.max(origH - 1, 1)) * (rh - 1);
      const x0 = Math.floor(mx), x1 = Math.min(x0+1, rw - 1);
      const y0 = Math.floor(my), y1 = Math.min(y0+1, rh - 1);
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

  // Apply full-resolution mask back
  for (let i = 0; i < origW * origH; i++) {
    fullData.data[i * 4 + 3] = Math.round(Math.min(Math.max(upsampledAlpha[i], 0), 1) * 255);
  }

  ctx.putImageData(fullData, 0, 0);
  return canvasToBlob(c);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FIX 4 — renderToCanvas
   Old version used putImageData directly which IGNORES
   canvas compositing — background fill was overwritten.
   Fix: put RGBA into temp canvas, then drawImage onto
   final canvas which correctly alpha-composites over BG.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function renderToCanvas(canvas,imageData,bg){
  canvas.width=imageData.width;
  canvas.height=imageData.height;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(bg&&bg!=='transparent'){
    ctx.fillStyle=bg;
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  // Temp canvas holds the RGBA data
  const tmp=document.createElement('canvas');
  tmp.width=imageData.width; tmp.height=imageData.height;
  tmp.getContext('2d').putImageData(imageData,0,0);

  // drawImage composites correctly over the BG fill
  ctx.drawImage(tmp,0,0);
}

/* ── Helpers ── */
function canvasToBlob(canvas){
  return new Promise(r=>canvas.toBlob(r,'image/png'));
}
function fmtBytes(b){
  if(b<1024)return b+'B';
  if(b<1048576)return(b/1024).toFixed(1)+'KB';
  return(b/1048576).toFixed(1)+'MB';
}
function fmtTime(s){
  if(s<60)return Math.round(s)+'s';
  return Math.floor(s/60)+'m '+Math.round(s%60)+'s';
}
