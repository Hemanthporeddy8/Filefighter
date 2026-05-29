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
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function imageToImageData(img,w,h){
  const c=document.createElement('canvas');
  c.width=w||img.naturalWidth;
  c.height=h||img.naturalHeight;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#ffffff';          // white BG — critical for clean pixels
  ctx.fillRect(0,0,c.width,c.height);
  ctx.drawImage(img,0,0,c.width,c.height);
  return ctx.getImageData(0,0,c.width,c.height);
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FIX 3 — applyAlphaMask
   Two improvements over the old version:
   a) Bilinear upsample uses (ow-1) denominator
      → avoids off-by-one at image edges
   b) S-curve sharpening pushes soft 0.1–0.9 values
      toward hard 0/1 → clean crisp edges instead
      of blurry semi-transparent fringe
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function applyAlphaMask(imageData,alphaFlat){
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

  // S-curve edge sharpening — cleans fringe without losing detail
  const sharpness=10, threshold=0.45;
  for(let i=0;i<alphaFull.length;i++){
    alphaFull[i]=1/(1+Math.exp(-sharpness*(alphaFull[i]-threshold)));
  }

  // Write alpha channel back
  for(let i=0;i<ow*oh;i++){
    px[i*4+3]=Math.round(Math.min(Math.max(alphaFull[i],0),1)*255);
  }
  return imageData;
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
