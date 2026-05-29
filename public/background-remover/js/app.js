'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  // ── Cursor ──
  initCursor();

  // ── Tabs ──
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
    });
  });

  // ── Init tabs ──
  ImageTab.init();
  VideoTab.init();
  BatchTab.init();
  GenerateTab.init();

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', e=>{
    if(e.key==='Enter'&&!e.repeat){
      const btn=document.getElementById('btnProcess');
      if(!btn.disabled) btn.click();
    }
  });

  // ── Paste from clipboard ──
  document.addEventListener('paste', async e=>{
    const item=Array.from(e.clipboardData.items).find(i=>i.type.startsWith('image/'));
    if(!item) return;
    if(!document.getElementById('tab-image').classList.contains('active')) return;
    const file=item.getAsFile();
    if(!file) return;
    const dt=new DataTransfer(); dt.items.add(file);
    const fi=document.getElementById('imgInput');
    fi.files=dt.files; fi.dispatchEvent(new Event('change'));
    showToast('Image pasted from clipboard');
  });

  // ══════════════════════════════════════════
  // AUTO-LOAD MODEL FROM SERVER
  // No user interaction needed — model downloads
  // automatically when page loads.
  // ══════════════════════════════════════════
  const dot      = document.getElementById('msDot');
  const msText   = document.getElementById('msText');
  const bar      = document.getElementById('topProgress');
  const barFill  = document.getElementById('topProgressFill');
  const aiMsg    = document.getElementById('aiLoadingMsg');
  const aiText   = document.getElementById('aiLoadingText');

  // Show loading UI
  dot.className      = 'ms-dot loading';
  msText.textContent = 'Loading AI…';
  bar.style.display  = 'block';
  aiMsg.style.display= 'flex';

  try {
    await NexusModel.autoLoad((pct, msg) => {
      barFill.style.width = Math.round(pct * 100) + '%';
      aiText.textContent  = msg;
      msText.textContent  = msg;
    });

    // ── Model ready ──
    dot.className      = 'ms-dot ready';
    msText.textContent = 'AI Ready';
    aiMsg.style.display= 'none';

    setTimeout(()=>{ bar.style.display='none'; }, 1000);

    // Notify all tabs
    ImageTab.onModelLoad();
    VideoTab.onModelLoad();
    BatchTab.onModelLoad();

    showToast('✅ AI model ready!', 'success');

  } catch(err) {
    // ── Model failed ──
    dot.className      = 'ms-dot error';
    msText.textContent = 'Model error';
    aiText.textContent = '❌ ' + err.message;
    barFill.style.background = '#ff3e3e';
    barFill.style.width = '100%';
    console.error('[App] Model load failed:', err);
    showToast('⚠️ Model error — make sure the models folder contains the required model files', 'error');
  }

});
