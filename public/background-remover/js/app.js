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
  // LAZY LOAD MODEL FROM SERVER
  // Model downloads only when user clicks load,
  // or when they choose their first file.
  // ══════════════════════════════════════════
  let _loadingPromise = null;

  async function ensureModelLoaded() {
    if (NexusModel.ready()) return true;
    if (_loadingPromise) return _loadingPromise;

    _loadingPromise = (async () => {
      const dot      = document.getElementById('msDot');
      const msText   = document.getElementById('msText');
      const bar      = document.getElementById('topProgress');
      const barFill  = document.getElementById('topProgressFill');
      const aiMsg    = document.getElementById('aiLoadingMsg');
      const aiText   = document.getElementById('aiLoadingText');

      dot.className      = 'ms-dot loading';
      msText.textContent = 'Loading AI…';
      bar.style.display  = 'block';
      if (aiMsg) aiMsg.style.display = 'flex';

      try {
        await NexusModel.autoLoad((pct, msg) => {
          barFill.style.width = Math.round(pct * 100) + '%';
          if (aiText) aiText.textContent = msg;
          msText.textContent = msg;
        });

        dot.className      = 'ms-dot ready';
        msText.textContent = 'AI Ready';
        if (aiMsg) aiMsg.style.display = 'none';
        setTimeout(() => { bar.style.display = 'none'; }, 1000);

        // Notify all tabs
        ImageTab.onModelLoad();
        VideoTab.onModelLoad();
        BatchTab.onModelLoad();

        showToast('✅ AI model ready!', 'success');
        return true;
      } catch (err) {
        dot.className      = 'ms-dot error';
        msText.textContent = 'Model error';
        if (aiText) aiText.textContent = '❌ ' + err.message;
        barFill.style.background = '#ff3e3e';
        barFill.style.width = '100%';
        _loadingPromise = null; // allow retrying
        console.error('[App] Model load failed:', err);
        showToast('⚠️ Model error: ' + err.message, 'error');
        throw err;
      }
    })();

    return _loadingPromise;
  }

  window.ensureModelLoaded = ensureModelLoaded;

  const dot      = document.getElementById('msDot');
  const msText   = document.getElementById('msText');
  const pill     = document.getElementById('modelStatusPill');

  // Set standby state initially
  dot.className      = 'ms-dot';
  msText.textContent = 'AI Standby (Click to Load)';
  if (pill) {
    pill.style.cursor = 'pointer';
    pill.addEventListener('click', () => ensureModelLoaded());
  }

});
