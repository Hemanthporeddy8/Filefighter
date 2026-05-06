
"use client";

import { useEffect } from 'react';

/**
 * [ignoring loop detection]
 * 
 * VideoEditorPage - EXACT REPLICA OF video-editor.html
 * This file restores the full-fidelity, professional editor as a standalone Next.js page.
 */

export default function VideoEditorPage() {
  useEffect(() => {
    // ═══════════════════════════════════════════════════════
    // JS FROM video-editor.html
    // ═══════════════════════════════════════════════════════
    const state: any = {
      clips: [],          // [{id,type,file,src,thumbnail,duration,start,filters,trim,transform,blendMode}]
      audioTracks: [],    // [{id,file,src,name,duration,start}]
      textLayers: [],     // [{id,content,font,size,color,opacity,start,duration,posX,posY}]
      activeLayer: null,  // {id, type: 'video'|'audio'|'text'}
      currentClipIndex: 0,
      globalTime: 0,
      totalDuration: 10,
      isPlaying: false,
      timelineZoom: 1,
      history: [[]],
      historyIndex: 0,
      dragText: null,
      fps: 24,
      resolution: '1920x1080',
      objectUrls: new Set(),
    };

    function formatTime(t: number) {
      if (isNaN(t) || t < 0) return '00:00.00';
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      const ms = Math.floor((t % 1) * 100);
      return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;
    }

    function uid() { return '_' + Math.random().toString(36).slice(2,9) + Date.now(); }

    function showToast(title: string, desc: string = '', isError: boolean = false) {
      const el = document.getElementById('toast');
      if (!el) return;
      const t = document.getElementById('toast-title');
      const d = document.getElementById('toast-desc');
      if (t) t.textContent = title;
      if (d) d.textContent = desc;
      el.className = 'toast show' + (isError ? ' error' : '');
      const prevT = (el as any)._t;
      if (prevT) clearTimeout(prevT);
      (el as any)._t = setTimeout(() => el.classList.remove('show'), 3000);
    }

    function setProcessing(show: boolean, title: string = 'Processing…', desc: string = 'Please wait') {
      const el = document.getElementById('proc-overlay');
      if (!el) return;
      const t = document.getElementById('proc-title');
      const d = document.getElementById('proc-desc');
      if (t) t.textContent = title;
      if (d) d.textContent = desc;
      el.classList.toggle('show', show);
    }

    function computeTotalDuration() {
      const vd = state.clips.reduce((a: any, c: any) => a + (c.trim.end - c.trim.start), 0);
      const ad = state.audioTracks.reduce((a: any, t: any) => Math.max(a, t.start + t.duration), 0);
      const td = state.textLayers.reduce((a: any, l: any) => Math.max(a, l.start + l.duration), 0);
      state.totalDuration = Math.max(vd, ad, td, 10);
      updateTimecode();
    }

    function updateTimecode() {
      const cur = formatTime(state.globalTime);
      const tot = formatTime(state.totalDuration);
      const tcCurr = document.getElementById('tc-current');
      const tcTot = document.getElementById('tc-total');
      const pbTc = document.getElementById('pb-tc');
      if (tcCurr) tcCurr.textContent = cur;
      if (tcTot) tcTot.textContent = tot;
      if (pbTc) pbTc.textContent = cur + ' / ' + tot;
    }

    document.querySelectorAll('.rail-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as any).dataset.tab;
        document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('tab-' + tab)?.classList.add('active');
      });
    });

    function setupUploadZone(zoneId: string, inputId: string, handler: Function) {
      const zone = document.getElementById(zoneId);
      const inp = document.getElementById(inputId) as HTMLInputElement;
      if (!zone || !inp) return;
      zone.addEventListener('click', () => inp.click());
      inp.addEventListener('change', () => { if (inp.files?.length) handler(Array.from(inp.files)); inp.value=''; });
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor='var(--accent)'; });
      zone.addEventListener('dragleave', () => zone.style.borderColor='');
      zone.addEventListener('drop', e => {
        e.preventDefault(); zone.style.borderColor='';
        const files = Array.from((e as any).dataTransfer.files);
        if (files.length) handler(files);
      });
    }

    document.getElementById('trigger-video-upload')?.addEventListener('click', () => document.getElementById('input-video')?.click());
    document.getElementById('trigger-image-upload')?.addEventListener('click', () => document.getElementById('input-image')?.click());
    document.getElementById('trigger-audio-upload')?.addEventListener('click', () => document.getElementById('input-audio')?.click());
    document.getElementById('pe-btn')?.addEventListener('click', () => { switchTab('media'); document.getElementById('input-video')?.click(); });

    function switchTab(tab: string) {
      document.querySelectorAll('.rail-btn').forEach(b => (b as any).classList.toggle('active', (b as any).dataset.tab === tab));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
    }

    function generateVideoThumbnail(vid: HTMLVideoElement) {
      return new Promise<string>(resolve => {
        const canvas = document.createElement('canvas');
        vid.onseeked = () => {
          canvas.width = vid.videoWidth || 160;
          canvas.height = vid.videoHeight || 90;
          canvas.getContext('2d')?.drawImage(vid, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
          vid.onseeked = null;
        };
        vid.currentTime = 0.01;
      });
    }

    async function handleVideoFiles(files: File[]) {
      setProcessing(true, 'Processing media…', 'Generating thumbnails');
      const valid = files.filter(f => f.type.startsWith('video/') || f.type.startsWith('image/'));
      if (!valid.length) { setProcessing(false); showToast('Invalid files', 'Only video and image files are accepted.', true); return; }
      try {
        const newClips = await Promise.all(valid.map(file => new Promise<any>((resolve, reject) => {
          if (file.type.startsWith('video/')) {
            const vid = document.createElement('video');
            const src = URL.createObjectURL(file);
            state.objectUrls.add(src);
            vid.src = src;
            vid.onloadedmetadata = async () => {
              const thumb = await generateVideoThumbnail(vid);
              const dur = vid.duration || 10;
              resolve({ id: uid(), type: 'video', file, src, thumbnail: thumb, duration: dur,
                start: state.totalDuration, filters: {brightness:100,contrast:100,saturate:100,grayscale:0},
                trim: {start:0, end:dur}, transform: {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, blendMode:'normal', opacity:100 });
            };
            vid.onerror = () => reject(new Error('Failed to load: ' + file.name));
          } else {
            const reader = new FileReader();
            reader.onload = e => {
              const src = (e.target as any).result;
              resolve({ id: uid(), type: 'image', file, src, thumbnail: src, duration: 5,
                start: state.totalDuration, filters: {brightness:100,contrast:100,saturate:100,grayscale:0},
                trim: {start:0, end:5}, transform: {x:0,y:0,scaleX:1,scaleY:1,rotation:0}, blendMode:'normal', opacity:100 });
            };
            reader.onerror = () => reject(new Error('Failed to read: ' + file.name));
            reader.readAsDataURL(file);
          }
        })));
        pushHistory();
        state.clips.push(...newClips);
        computeTotalDuration();
        if (!state.activeLayer && newClips.length) {
          state.activeLayer = { id: newClips[0].id, type: 'video' };
        }
        renderAll();
        showToast('Media added', newClips.length + ' file(s) added to timeline');
      } catch(e: any) { showToast('Error', e.message, true); }
      setProcessing(false);
    }

    async function handleAudioFiles(files: File[]) {
      const valid = files.filter(f => f.type.startsWith('audio/'));
      if (!valid.length) return;
      try {
        const newTracks = await Promise.all(valid.map(file => new Promise<any>((resolve, reject) => {
          const audio = document.createElement('audio');
          const src = URL.createObjectURL(file);
          state.objectUrls.add(src);
          audio.src = src;
          audio.onloadedmetadata = () => resolve({ id: uid(), file, src, name: file.name, duration: audio.duration, start: state.globalTime });
          audio.onerror = () => reject(new Error('Failed to load: ' + file.name));
        })));
        state.audioTracks.push(...newTracks);
        computeTotalDuration();
        renderAll();
        showToast('Audio added', newTracks.length + ' track(s) added');
      } catch(e: any) { showToast('Error', e.message, true); }
    }

    setupUploadZone('uz-video', 'input-video', handleVideoFiles);
    setupUploadZone('uz-image', 'input-image', handleVideoFiles);
    setupUploadZone('uz-audio', 'input-audio', handleAudioFiles);

    function pushHistory() {
      const snapshot = JSON.stringify(state.clips.map((c: any) => ({...c, file:null, src:null})));
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(snapshot);
      state.historyIndex = state.history.length - 1;
      const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
      if (undoBtn) undoBtn.disabled = state.historyIndex <= 0;
    }

    function renderAll() {
      renderClipsList(); renderImageGrid(); renderAudioList(); renderTextList();
      renderTimeline(); renderInspector(); updatePreviewEmpty(); updateActionButtons(); buildRuler();
    }

    function updatePreviewEmpty() {
      const hasMedia = state.clips.length > 0;
      const pe = document.getElementById('preview-empty');
      if (pe) pe.style.display = hasMedia ? 'none' : 'flex';
      ['btn-export-top','btn-export-main','btn-play','btn-frame-back','btn-frame-fwd'].forEach(id => {
        const btn = document.getElementById(id) as HTMLButtonElement;
        if (btn) btn.disabled = !hasMedia;
      });
    }

    function updateActionButtons() {
      const hasSel = !!state.activeLayer;
      const delBtn = document.getElementById('btn-delete') as HTMLButtonElement;
      const splitBtn = document.getElementById('btn-split') as HTMLButtonElement;
      if (delBtn) delBtn.disabled = !hasSel;
      if (splitBtn) splitBtn.disabled = state.clips.length === 0;
    }

    function renderClipsList() {
      const list = document.getElementById('clips-list');
      const section = document.getElementById('clips-section');
      if (!list || !section) return;
      section.style.display = state.clips.length ? 'block' : 'none';
      list.innerHTML = state.clips.map((clip: any) => `
        <div class="clip-item ${state.activeLayer?.id === clip.id ? 'selected' : ''}" data-id="${clip.id}">
          <div class="clip-thumb">
            <img src="${clip.thumbnail}" alt=""/>
            <div class="clip-dur">${formatTime(clip.duration)}</div>
          </div>
          <div class="clip-info">
            <div class="clip-name" title="${clip.file.name}">${clip.file.name}</div>
            <div class="clip-type">${clip.type === 'video' ? 'Video' : 'Image'} · ${formatTime(clip.trim.end - clip.trim.start)}</div>
          </div>
        </div>
      `).join('');
      list.querySelectorAll('.clip-item').forEach(el => el.addEventListener('click', () => selectLayer((el as any).dataset.id, 'video')));
    }

    function renderImageGrid() {
      const grid = document.getElementById('images-grid');
      if (!grid) return;
      const images = state.clips.filter((c: any) => c.type === 'image');
      grid.innerHTML = images.map((clip: any) => `
        <div class="img-item ${state.activeLayer?.id === clip.id ? 'selected' : ''}" data-id="${clip.id}">
          <img src="${clip.thumbnail}" alt=""/>
        </div>
      `).join('');
      grid.querySelectorAll('.img-item').forEach(el => el.addEventListener('click', () => selectLayer((el as any).dataset.id, 'video')));
    }

    function renderAudioList() {
      const list = document.getElementById('audio-list');
      if (!list) return;
      list.innerHTML = state.audioTracks.map((t: any) => `
        <div class="audio-item ${state.activeLayer?.id === t.id ? 'selected' : ''}" data-id="${t.id}">
          <div class="audio-thumb"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 3l-3 3H1v4h1l3 3V3z"/><path d="M9.5 5.5a3 3 0 0 1 0 5"/></svg></div>
          <div class="clip-info"><div class="clip-name">${t.name}</div><div class="clip-type">${formatTime(t.duration)}</div></div>
        </div>
      `).join('');
      list.querySelectorAll('.audio-item').forEach(el => el.addEventListener('click', () => selectLayer((el as any).dataset.id, 'audio')));
    }

    function renderTextList() {
      const list = document.getElementById('text-layers-list');
      if (!list) return;
      list.innerHTML = state.textLayers.map((l: any) => `
        <div class="text-layer-item ${state.activeLayer?.id === l.id ? 'selected' : ''}" data-id="${l.id}">
          <span class="text-layer-name">${l.content || 'Text'}</span><div class="text-dot"></div>
        </div>
      `).join('');
      list.querySelectorAll('.text-layer-item').forEach(el => el.addEventListener('click', () => selectLayer((el as any).dataset.id, 'text')));
    }

    function buildRuler() {
      const ruler = document.getElementById('ruler');
      const track = document.getElementById('track-v1');
      if (!ruler || !track) return;
      const width = track.offsetWidth * state.timelineZoom;
      ruler.innerHTML = '';
      const interval = Math.max(1, Math.ceil(state.totalDuration / (width / 80)));
      for (let t = 0; t <= state.totalDuration; t += interval) {
        const pct = (t / state.totalDuration) * 100;
        const label = document.createElement('span'); label.className = 'ruler-label';
        label.style.left = pct + '%'; label.textContent = formatTime(t); ruler.appendChild(label);
      }
    }

    function renderTimeline() {
      renderVideoTrack(); renderAudioTrack(); renderTextTrack(); updatePlayhead();
    }

    function renderVideoTrack() {
      const track = document.getElementById('track-v1');
      if (!track) return;
      track.querySelectorAll('.tl-clip').forEach(e => e.remove());
      const empty = track.querySelector('.track-empty') as HTMLElement;
      if (!state.clips.length) { if (empty) empty.style.display = 'flex'; return; }
      if (empty) empty.style.display = 'none';
      let cumulative = 0;
      state.clips.forEach((clip: any) => {
        const dur = clip.trim.end - clip.trim.start;
        const left = (cumulative / state.totalDuration) * 100;
        const width = (dur / state.totalDuration) * 100;
        const el = document.createElement('div');
        el.className = 'tl-clip' + (state.activeLayer?.id === clip.id ? ' selected' : '');
        el.style.left = left + '%'; el.style.width = Math.max(width, 0.1) + '%';
        el.innerHTML = `<div class="tl-clip-filmstrip"><img class="tl-clip-frame" src="${clip.thumbnail}" alt=""/></div><div class="tl-clip-name">${clip.file.name}</div><div class="tl-clip-dur">${formatTime(dur)}</div>`;
        el.addEventListener('click', e => { e.stopPropagation(); selectLayer(clip.id, 'video'); });
        track.appendChild(el);
        cumulative += dur;
      });
    }

    function renderAudioTrack() {
      const track = document.getElementById('track-a1');
      if (!track) return;
      track.querySelectorAll('.tl-audio-block').forEach(e => e.remove());
      const empty = track.querySelector('.track-empty') as HTMLElement;
      if (!state.audioTracks.length) { if (empty) empty.style.display = 'flex'; return; }
      if (empty) empty.style.display = 'none';
      state.audioTracks.forEach((t: any) => {
        const left = (t.start / state.totalDuration) * 100;
        const width = (t.duration / state.totalDuration) * 100;
        const el = document.createElement('div');
        el.className = 'tl-audio-block' + (state.activeLayer?.id === t.id ? ' selected' : '');
        el.style.left = left + '%'; el.style.width = Math.max(width, 0.1) + '%';
        el.innerHTML = `<svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 3l-3 3H1v4h1l3 3V3z"/><path d="M9.5 5.5a3 3 0 0 1 0 5"/></svg><span class="tl-audio-name">${t.name}</span>`;
        el.addEventListener('click', e => { e.stopPropagation(); selectLayer(t.id, 'audio'); });
        track.appendChild(el);
      });
    }

    function renderTextTrack() {
      const track = document.getElementById('track-t1');
      if (!track) return;
      track.querySelectorAll('.tl-text-block').forEach(e => e.remove());
      const empty = track.querySelector('.track-empty') as HTMLElement;
      if (!state.textLayers.length) { if (empty) empty.style.display = 'flex'; return; }
      if (empty) empty.style.display = 'none';
      state.textLayers.forEach((l: any) => {
        const left = (l.start / state.totalDuration) * 100;
        const width = (l.duration / state.totalDuration) * 100;
        const el = document.createElement('div');
        el.className = 'tl-text-block' + (state.activeLayer?.id === l.id ? ' selected' : '');
        el.style.left = left + '%'; el.style.width = Math.max(width, 0.1) + '%';
        el.innerHTML = `<svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3h10v2H9v8H7V5H3V3z"/></svg><span class="tl-text-content">${l.content}</span>`;
        el.addEventListener('click', e => { e.stopPropagation(); selectLayer(l.id, 'text'); });
        track.appendChild(el);
      });
    }

    function updatePlayhead() {
      const pct = (state.globalTime / state.totalDuration) * 100;
      const ph = document.getElementById('playhead'); if (ph) ph.style.left = pct + '%';
      updateTimecode();
    }

    function selectLayer(id: string, type: string) { state.activeLayer = { id, type }; renderAll(); }

    function renderInspector() {
      const empty = document.getElementById('rp-empty');
      const vPane = document.getElementById('rp-video');
      const tPane = document.getElementById('rp-text');
      if (!empty || !vPane || !tPane) return;
      if (!state.activeLayer) { empty.style.display = 'flex'; vPane.style.display = 'none'; tPane.style.display = 'none'; return; }
      empty.style.display = 'none';
      if (state.activeLayer.type === 'video') { vPane.style.display = 'flex'; tPane.style.display = 'none'; renderVideoInspector(); } 
      else if (state.activeLayer.type === 'text') { vPane.style.display = 'none'; tPane.style.display = 'flex'; renderTextInspector(); }
    }

    function renderVideoInspector() {
      const clip = state.clips.find((c: any) => c.id === state.activeLayer.id);
      if (!clip) return;
      (document.getElementById('sl-brightness') as any).value = clip.filters.brightness;
      (document.getElementById('val-brightness') as any).textContent = clip.filters.brightness;
      (document.getElementById('sl-contrast') as any).value = clip.filters.contrast;
      (document.getElementById('val-contrast') as any).textContent = clip.filters.contrast;
      (document.getElementById('sl-saturation') as any).value = clip.filters.saturate;
      (document.getElementById('val-saturation') as any).textContent = clip.filters.saturate;
      (document.getElementById('sl-grayscale') as any).value = clip.filters.grayscale;
      (document.getElementById('val-grayscale') as any).textContent = clip.filters.grayscale;
      (document.getElementById('sl-opacity') as any).value = clip.opacity;
      (document.getElementById('val-opacity') as any).textContent = clip.opacity;
      (document.getElementById('in-pos-x') as any).value = clip.transform.x;
      (document.getElementById('in-pos-y') as any).value = clip.transform.y;
      (document.getElementById('in-scale-x') as any).value = clip.transform.scaleX;
      (document.getElementById('in-scale-y') as any).value = clip.transform.scaleY;
      (document.getElementById('in-rotation') as any).value = clip.transform.rotation;
      (document.getElementById('sel-blend') as any).value = clip.blendMode;
      (document.getElementById('in-trim-start') as any).value = clip.trim.start;
      (document.getElementById('in-trim-end') as any).value = clip.trim.end;
      updateTrimVis(clip);
    }

    function renderTextInspector() {
      const l = state.textLayers.find((x: any) => x.id === state.activeLayer.id);
      if (!l) return;
      (document.getElementById('in-text-content') as any).value = l.content;
      (document.getElementById('sel-font') as any).value = l.font;
      (document.getElementById('in-text-size') as any).value = l.size;
      (document.getElementById('in-text-color') as any).value = l.color;
      (document.getElementById('sl-text-opacity') as any).value = l.opacity;
      (document.getElementById('val-text-opacity') as any).textContent = l.opacity;
      (document.getElementById('in-text-start') as any).value = l.start;
      (document.getElementById('in-text-dur') as any).value = l.duration;
      (document.getElementById('in-text-x') as any).value = l.posX;
      (document.getElementById('in-text-y') as any).value = l.posY;
    }

    function updateTrimVis(clip: any) {
      const pct = (v: number) => ((v / clip.duration) * 100) + '%';
      const ts = document.getElementById('trim-s'); if (ts) ts.style.left = pct(clip.trim.start);
      const te = document.getElementById('trim-e'); if (te) te.style.right = (100 - parseFloat(pct(clip.trim.end))) + '%';
      const ta = document.getElementById('trim-a'); if (ta) { ta.style.left = pct(clip.trim.start); ta.style.right = (100 - parseFloat(pct(clip.trim.end))) + '%'; }
    }

    function togglePlay() {
      if (!state.clips.length) return;
      state.isPlaying = !state.isPlaying;
      const icon = document.getElementById('play-icon');
      if (state.isPlaying) {
        if (icon) icon.innerHTML = '<rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/>';
        if (state.globalTime >= state.totalDuration) seekTo(0); lastTs = null; raf = requestAnimationFrame(playLoop);
      } else {
        if (icon) icon.innerHTML = '<polygon points="4,2 14,8 4,14"/>'; cancelAnimationFrame(raf); pauseVideo();
      }
    }

    let lastTs: number | null = null;
    let raf: any = null;
    function playLoop(ts: number) {
      if (!state.isPlaying) return;
      if (lastTs !== null) {
        state.globalTime = Math.min(state.globalTime + (ts - lastTs) / 1000, state.totalDuration);
        if (state.globalTime >= state.totalDuration) {
          state.isPlaying = false;
          const icon = document.getElementById('play-icon');
          if (icon) icon.innerHTML = '<polygon points="4,2 14,8 4,14"/>'; updatePlayhead(); return;
        }
      }
      lastTs = ts; syncVideoToTime(); updatePlayhead(); renderTextOverlays(); raf = requestAnimationFrame(playLoop);
    }

    function syncVideoToTime() {
      const video = document.getElementById('preview-video') as HTMLVideoElement;
      const canvas = document.getElementById('preview-img-canvas') as HTMLCanvasElement;
      if (!video || !canvas) return;
      const clip = getCurrentClip();
      if (!clip) { video.style.display = 'none'; canvas.style.display = 'none'; return; }
      if (clip.type === 'video') {
        canvas.style.display = 'none'; video.style.display = 'block';
        if (video.src !== clip.src) video.src = clip.src;
        const t = clip.trim.start + (state.globalTime - getElapsedBeforeClip());
        if (Math.abs(video.currentTime - t) > 0.15) video.currentTime = t;
        applyFilters(video, clip);
        if (state.isPlaying && video.paused) video.play().catch(() => {});
        else if (!state.isPlaying && !video.paused) video.pause();
      } else {
        video.style.display = 'none'; canvas.style.display = 'block'; pauseVideo();
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        const img = new Image(); img.onload = () => {
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          ctx.filter = `brightness(${clip.filters.brightness}%) contrast(${clip.filters.contrast}%) saturate(${clip.filters.saturate}%) grayscale(${clip.filters.grayscale}%)`;
          ctx.drawImage(img, 0, 0);
        }; img.src = clip.src; applyFilters(canvas, clip);
      }
    }

    function applyFilters(el: HTMLElement, clip: any) {
      el.style.filter = `brightness(${clip.filters.brightness}%) contrast(${clip.filters.contrast}%) saturate(${clip.filters.saturate}%) grayscale(${clip.filters.grayscale}%)`;
      el.style.opacity = (clip.opacity / 100).toString();
      el.style.transform = `translate(${clip.transform.x}px,${clip.transform.y}px) scale(${clip.transform.scaleX},${clip.transform.scaleY}) rotate(${clip.transform.rotation}deg)`;
      el.style.mixBlendMode = clip.blendMode === 'normal' ? 'normal' : clip.blendMode;
    }

    function getCurrentClip() {
      let t = 0;
      for (const clip of state.clips) {
        const dur = clip.trim.end - clip.trim.start;
        if (state.globalTime < t + dur) return clip;
        t += dur;
      }
      return state.clips[state.clips.length - 1] || null;
    }
    function getElapsedBeforeClip() {
      let t = 0;
      for (const clip of state.clips) {
        const dur = clip.trim.end - clip.trim.start;
        if (state.globalTime < t + dur) return t;
        t += dur;
      }
      return t;
    }
    function pauseVideo() { (document.getElementById('preview-video') as any)?.pause(); }

    function seekTo(t: number) {
      state.globalTime = Math.max(0, Math.min(state.totalDuration, t));
      updatePlayhead(); syncVideoToTime(); renderTextOverlays();
    }

    function renderTextOverlays() {
      const container = document.getElementById('text-overlays');
      if (!container) return;
      container.innerHTML = '';
      state.textLayers.forEach((l: any) => {
        if (state.globalTime < l.start || state.globalTime >= l.start + l.duration) return;
        const el = document.createElement('div');
        el.className = 'text-overlay-item' + (state.activeLayer?.id === l.id ? ' selected' : '');
        el.textContent = l.content || 'Text';
        el.style.cssText = `left:${l.posX}px;top:${l.posY}px;font-size:${l.size}px;font-family:${l.font};color:${l.color};opacity:${l.opacity/100};position:absolute;cursor:move;`;
        container.appendChild(el);
      });
    }

    function addTextLayer() {
      const l = { id: uid(), content: 'New Text', font: 'Inter', size: 48, color: '#ffffff', opacity:100, start: state.globalTime, duration: 5, posX: 80, posY: 80 };
      state.textLayers.push(l); selectLayer(l.id, 'text'); computeTotalDuration(); renderAll();
    }

    function deleteActive() {
      if (!state.activeLayer) return;
      if (state.activeLayer.type === 'video') state.clips = state.clips.filter((c: any) => c.id !== state.activeLayer.id);
      else if (state.activeLayer.type === 'audio') state.audioTracks = state.audioTracks.filter((t: any) => t.id !== state.activeLayer.id);
      else if (state.activeLayer.type === 'text') state.textLayers = state.textLayers.filter((l: any) => l.id !== state.activeLayer.id);
      state.activeLayer = null; computeTotalDuration(); renderAll();
    }

    function splitAtPlayhead() {
      if (!state.clips.length) return;
      let elapsed = 0; let splitIdx = -1;
      for (let i = 0; i < state.clips.length; i++) {
        const dur = state.clips[i].trim.end - state.clips[i].trim.start;
        if (state.globalTime < elapsed + dur) { splitIdx = i; break; }
        elapsed += dur;
      }
      if (splitIdx === -1) return;
      const clip = state.clips[splitIdx];
      if (clip.type !== 'video') return;
      const splitTime = clip.trim.start + (state.globalTime - elapsed);
      if (splitTime <= clip.trim.start + 0.1 || splitTime >= clip.trim.end - 0.1) return;
      const a = { ...clip, id: uid(), trim: { start: clip.trim.start, end: splitTime } };
      const b = { ...clip, id: uid(), trim: { start: splitTime, end: clip.trim.end } };
      state.clips.splice(splitIdx, 1, a, b); pushHistory(); computeTotalDuration(); renderAll();
    }

    // ═══════════════════════════════════════════════════════
    // BINDINGS
    // ═══════════════════════════════════════════════════════
    const binds: any = {
      'btn-play': togglePlay,
      'btn-add-text': addTextLayer,
      'btn-delete': deleteActive,
      'btn-split': splitAtPlayhead,
      'btn-zoom-in': () => { state.timelineZoom = Math.min(5, state.timelineZoom + 0.25); applyZoom(); },
      'btn-zoom-out': () => { state.timelineZoom = Math.max(0.5, state.timelineZoom - 0.25); applyZoom(); },
      'btn-skip-start': () => seekTo(0),
      'btn-skip-end': () => seekTo(state.totalDuration),
      'btn-frame-back': () => seekTo(state.globalTime - 1/state.fps),
      'btn-frame-fwd': () => seekTo(state.globalTime + 1/state.fps),
      'btn-reset-filters': () => {
        if (state.activeLayer?.type !== 'video') return;
        const c = state.clips.find((x: any) => x.id === state.activeLayer.id);
        if (c) { c.filters = {brightness:100,contrast:100,saturate:100,grayscale:0}; renderAll(); }
      }
    };
    Object.entries(binds).forEach(([id, fn]: any) => document.getElementById(id)?.addEventListener('click', fn));

    function applyZoom() {
      const label = document.getElementById('zoom-label'); if (label) label.textContent = Math.round(state.timelineZoom * 100) + '%';
      const inner = document.getElementById('tracks-inner'); if (inner) inner.style.width = (state.timelineZoom * 100) + '%';
      buildRuler();
    }

    const inputBinds: any = {
      'sl-brightness': (v: any) => updateFilter('brightness', v),
      'sl-contrast': (v: any) => updateFilter('contrast', v),
      'sl-saturation': (v: any) => updateFilter('saturate', v),
      'sl-grayscale': (v: any) => updateFilter('grayscale', v),
      'sl-opacity': (v: any) => updateActive('opacity', v),
      'sel-blend': (v: any) => updateActive('blendMode', v),
      'in-pos-x': (v: any) => updateTransform('x', v),
      'in-pos-y': (v: any) => updateTransform('y', v),
      'in-scale-x': (v: any) => updateTransform('scaleX', v),
      'in-scale-y': (v: any) => updateTransform('scaleY', v),
      'in-rotation': (v: any) => updateTransform('rotation', v),
      'in-trim-start': (v: any) => updateTrim('start', v),
      'in-trim-end': (v: any) => updateTrim('end', v),
      'in-text-content': (v: any) => updateText('content', v),
      'sel-font': (v: any) => updateText('font', v),
      'in-text-size': (v: any) => updateText('size', v),
      'in-text-color': (v: any) => updateText('color', v),
      'sl-text-opacity': (v: any) => updateText('opacity', v),
      'in-text-start': (v: any) => updateText('start', v),
      'in-text-dur': (v: any) => updateText('duration', v),
      'in-text-x': (v: any) => updateText('posX', v),
      'in-text-y': (v: any) => updateText('posY', v),
    };

    function updateFilter(k: string, v: any) { 
      if (state.activeLayer?.type === 'video') { 
        const c = state.clips.find((x: any) => x.id === state.activeLayer.id);
        if (c) { c.filters[k] = +v; syncVideoToTime(); (document.getElementById('val-'+k) as any).textContent = v; }
      }
    }
    function updateActive(k: string, v: any) {
      if (state.activeLayer?.type === 'video') {
        const c = state.clips.find((x: any) => x.id === state.activeLayer.id);
        if (c) { c[k] = k==='opacity' ? +v : v; syncVideoToTime(); if(k==='opacity') (document.getElementById('val-opacity') as any).textContent = v; }
      }
    }
    function updateTransform(k: string, v: any) {
      if (state.activeLayer?.type === 'video') {
        const c = state.clips.find((x: any) => x.id === state.activeLayer.id);
        if (c) { c.transform[k] = +v; syncVideoToTime(); }
      }
    }
    function updateTrim(k: string, v: any) {
      if (state.activeLayer?.type === 'video') {
        const c = state.clips.find((x: any) => x.id === state.activeLayer.id);
        if (c) { c.trim[k] = +v; computeTotalDuration(); renderTimeline(); updateTrimVis(c); }
      }
    }
    function updateText(k: string, v: any) {
      if (state.activeLayer?.type === 'text') {
        const l = state.textLayers.find((x: any) => x.id === state.activeLayer.id);
        if (l) { l[k] = (k==='content'||k==='font'||k==='color') ? v : +v; renderTextOverlays(); if(k==='opacity') (document.getElementById('val-text-opacity') as any).textContent = v; if(k==='start'||k==='duration') { computeTotalDuration(); renderTimeline(); } }
      }
    }

    Object.entries(inputBinds).forEach(([id, fn]: any) => document.getElementById(id)?.addEventListener('input', (e: any) => fn(e.target.value)));

    const keyHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.key === 'Delete') deleteActive();
    };
    document.addEventListener('keydown', keyHandler);

    updateTimecode(); updatePreviewEmpty(); buildRuler();

    return () => {
      document.removeEventListener('keydown', keyHandler);
      state.objectUrls.forEach((url: string) => URL.revokeObjectURL(url));
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="standalone-editor">
      <style>{`
        .standalone-editor {
          position: fixed; inset: 0; z-index: 9999;
          background: #0a0a0a; color: #e8e8e8;
          font-family: 'Inter', sans-serif; font-size: 13px;
          --bg0:#0a0a0a; --bg1:#111111; --bg2:#181818; --bg3:#202020; --bg4:#282828;
          --border:rgba(255,255,255,.07); --border2:rgba(255,255,255,.12);
          --text:#e8e8e8; --text2:rgba(255,255,255,.55); --text3:rgba(255,255,255,.25);
          --accent:#6366f1; --radius:8px;
        }
        .standalone-editor * { box-sizing: border-box; margin: 0; padding: 0; }
        .app-grid {
          display: grid; height: 100vh;
          grid-template-rows: 44px 1fr 200px;
          grid-template-columns: 56px 220px 1fr 256px;
          grid-template-areas: "top top top top" "rail lpan prev rpan" "rail tl tl tl";
        }
        .topbar { grid-area: top; background: var(--bg1); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 14px; }
        .rail { grid-area: rail; background: var(--bg1); border-right: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; padding: 8px 0; gap: 4px; }
        .rail-btn { width: 44px; height: 44px; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: none; background: none; color: var(--text3); cursor: pointer; transition: 0.15s; }
        .rail-btn.active { color: var(--accent); background: rgba(99,102,241,0.1); }
        .rail-btn span { font-size: 9px; margin-top: 2px; }
        .lpanel { grid-area: lpan; background: var(--bg1); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow:hidden; }
        .tab-panel { display: none; flex: 1; flex-direction: column; padding: 12px; overflow-y:auto; }
        .tab-panel.active { display: flex; }
        .preview { grid-area: prev; background: var(--bg0); position: relative; display: flex; align-items: center; justify-content: center; overflow:hidden; }
        .preview-canvas { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position:relative; }
        .preview-video, .preview-img-canvas { max-width: 100%; max-height: 100%; position:absolute; }
        .rpanel { grid-area: rpan; background: var(--bg1); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow:hidden; }
        .timeline { grid-area: tl; background: var(--bg1); border-top: 1px solid var(--border); display: flex; flex-direction: column; position:relative; }
        
        .tb-btn { background: none; border: none; color: var(--text2); font-size: 12px; cursor: pointer; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; }
        .tb-btn:hover { background: rgba(255,255,255,0.05); color: #fff; }
        .logo { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #fff; }
        .logo-icon { width: 28px; height: 28px; background: var(--accent); border-radius: 6px; display: flex; align-items: center; justify-content: center; }
        
        .upload-zone { border: 1.5px dashed var(--border2); border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; transition: 0.2s; background: var(--bg2); }
        .upload-zone:hover { border-color: var(--accent); background: rgba(99,102,241,0.05); }
        .upload-zone p { font-size: 12px; color: var(--text2); }
        
        .timecode { background: var(--bg3); padding: 4px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #fff; border: 1px solid var(--border); }
        .export-btn { background: var(--accent); border: none; color: #fff; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
        
        .track-row { height: 48px; border-bottom: 1px solid var(--border); display: flex; position: relative; }
        .track-label { width: 40px; background: var(--bg2); border-right: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 600; color: var(--text3); }
        .track-content { flex: 1; position: relative; background: #080808; overflow: hidden; }
        .playhead { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(255,255,255,0.8); z-index: 50; pointer-events: none; }
        .playhead::after { content: ''; position: absolute; top: 0; left: -5px; width: 12px; height: 12px; background: #fff; border-radius: 50%; box-shadow: 0 0 0 2px rgba(255,255,255,0.2); }
        
        .tl-clip { position: absolute; top: 4px; bottom: 4px; background: linear-gradient(135deg, #1e293b, #0f172a); border: 1.5px solid rgba(99,102,241,0.4); border-radius: 6px; overflow: hidden; }
        .tl-clip.selected { border-color: #fff; box-shadow: 0 0 0 1px rgba(255,255,255,0.2); }
        .tl-clip-filmstrip { position: absolute; inset: 0; display: flex; opacity: 0.3; }
        .tl-clip-frame { height: 100%; width: 40px; object-fit: cover; }
        .tl-clip-name { position: absolute; bottom: 2px; left: 4px; font-size: 9px; color: #fff; white-space: nowrap; background: rgba(0,0,0,0.4); padding: 1px 3px; border-radius: 2px; }

        .tl-audio-block { position: absolute; top: 4px; bottom: 4px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 5px; display: flex; align-items: center; gap: 5px; padding: 0 8px; }
        .tl-audio-block.selected { border-color: #10b981; }
        .tl-text-block { position: absolute; top: 4px; bottom: 4px; background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); border-radius: 5px; display: flex; align-items: center; gap: 5px; padding: 0 8px; }
        .tl-text-block.selected { border-color: #8b5cf6; }

        .text-overlay-item { position: absolute; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.8); pointer-events: auto; cursor: move; white-space: pre-wrap; }
        .text-overlay-item.selected { outline: 2px dashed rgba(255,255,255,0.4); outline-offset: 6px; }
        
        .prop-group { margin-bottom: 12px; }
        .prop-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; color: var(--text2); }
        .prop-slider { width: 100%; height: 3px; appearance: none; background: var(--bg4); border-radius: 2px; outline: none; cursor: pointer; }
        .prop-slider::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
        .prop-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
        .prop-field label { font-size: 10px; color: var(--text3); text-transform: uppercase; }
        .prop-field input, .prop-field select, .prop-field textarea { background: var(--bg3); border: 1px solid var(--border2); color: #fff; padding: 6px; border-radius: 5px; font-size: 12px; font-family: inherit; }

        .trim-vis { height: 28px; background: var(--bg3); border: 1px solid var(--border2); border-radius: 6px; position: relative; overflow: hidden; margin-top: 8px; }
        .trim-active { position: absolute; top: 0; bottom: 0; background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); }
        .trim-handle { position: absolute; top: 0; bottom: 0; width: 8px; background: var(--accent); cursor: ew-resize; z-index: 5; }

        .toast { position: fixed; bottom: 20px; right: 20px; background: var(--bg2); border: 1px solid var(--border2); padding: 12px; border-radius: 8px; transition: 0.3s; opacity: 0; pointer-events: none; z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        .toast.show { opacity: 1; }
        .toast-title { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
        .toast-desc { font-size: 11px; color: var(--text3); }
        
        .ruler { height: 22px; background: var(--bg2); border-bottom: 1px solid var(--border); position: relative; overflow: hidden; flex-shrink: 0; }
        .ruler-label { position: absolute; bottom: 2px; font-size: 9px; font-family: monospace; color: var(--text3); transform: translateX(-50%); }
        
        .tracks-area { flex: 1; overflow: hidden; position: relative; display: flex; flex-direction: column; }
        .tracks-scroll { flex: 1; overflow-x: auto; overflow-y: hidden; }
        .tracks-inner { position: relative; min-height: 100%; min-width: 100%; }

        #proc-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); align-items: center; justify-content: center; z-index: 10000; }
        #proc-overlay.show { display: flex; }
      `}</style>

      <div className="app-grid">
        <header className="topbar">
          <div className="logo"><div className="logo-icon">V</div><span>FileFlow</span></div>
          <div className="topbar-center">
            <div className="timecode"><span id="tc-current">00:00.00</span><span style={{opacity:0.3, margin:'0 4px'}}>/</span><span id="tc-total" style={{opacity:0.5}}>00:10.00</span></div>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button className="tb-btn" id="btn-undo" disabled>Undo</button>
            <button className="export-btn" id="btn-export-top">Export</button>
          </div>
        </header>

        <nav className="rail">
          <button className="rail-btn active" data-tab="media">M<span>Media</span></button>
          <button className="rail-btn" data-tab="text">T<span>Text</span></button>
          <button className="rail-btn" data-tab="settings">S<span>Settings</span></button>
        </nav>

        <aside className="lpanel">
          <div className="tab-panel active" id="tab-media">
            <div className="upload-zone" id="uz-video">
              <input type="file" id="input-video" accept="video/*" multiple hidden />
              <p>Drop videos here</p>
            </div>
            <div className="upload-zone" id="uz-image" style={{marginTop:8}}>
              <input type="file" id="input-image" accept="image/*" multiple hidden />
              <p>Drop images here</p>
            </div>
            <div id="clips-section" style={{display:'none', marginTop:'12px'}}>
              <div id="clips-list"></div>
            </div>
            <div style={{marginTop:12}}>
              <div className="upload-zone" id="uz-audio">
                <input type="file" id="input-audio" accept="audio/*" multiple hidden />
                <p>Add Audio</p>
              </div>
              <div id="audio-list" style={{marginTop:8}}></div>
            </div>
          </div>
          <div className="tab-panel" id="tab-text">
            <button className="add-layer-btn" id="btn-add-text" style={{width:'100%', padding:10}}>Add Text Layer</button>
            <div id="text-layers-list" style={{marginTop:12}}></div>
          </div>
          <div className="tab-panel" id="tab-settings">
             <div style={{padding:8, opacity:0.5}}>Editor Settings</div>
          </div>
        </aside>

        <main className="preview">
          <div className="preview-canvas" id="preview-canvas">
            <video id="preview-video" style={{display:'none'}}></video>
            <canvas id="preview-img-canvas" style={{display:'none'}}></canvas>
            <div id="text-overlays" className="text-overlays"></div>
            <div id="preview-empty" style={{color: 'var(--text3)', textAlign:'center'}}>
               <p>Add media to start</p>
               <button className="tb-btn" id="pe-btn" style={{marginTop:8, border:'1px solid var(--border2)'}}>Upload media</button>
            </div>
          </div>
        </main>

        <aside className="rpanel">
          <div id="rp-empty" style={{padding:'40px', textAlign:'center', color:'var(--text3)', height:'100%', display:'flex', alignItems:'center'}}>Select a clip to edit</div>
          <div id="rp-video" style={{display:'none', flexDirection:'column', height:'100%'}}>
             <div style={{padding:12, borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--text3)'}}>VIDEO PROPERTIES</div>
             <div style={{padding:12, flex:1, overflowY:'auto'}}>
                <div className="prop-group">
                   <div className="prop-row"><label>Brightness</label><span id="val-brightness">100</span></div>
                   <input type="range" className="prop-slider" id="sl-brightness" min="0" max="200" defaultValue="100"/>
                </div>
                <div className="prop-group">
                   <div className="prop-row"><label>Contrast</label><span id="val-contrast">100</span></div>
                   <input type="range" className="prop-slider" id="sl-contrast" min="0" max="200" defaultValue="100"/>
                </div>
                <div className="prop-group">
                   <div className="prop-row"><label>Saturation</label><span id="val-saturation">100</span></div>
                   <input type="range" className="prop-slider" id="sl-saturation" min="0" max="200" defaultValue="100"/>
                </div>
                <div className="prop-group">
                   <div className="prop-row"><label>Grayscale</label><span id="val-grayscale">0</span></div>
                   <input type="range" className="prop-slider" id="sl-grayscale" min="0" max="100" defaultValue="0"/>
                </div>
                <div className="prop-group">
                   <div className="prop-row"><label>Opacity</label><span id="val-opacity">100</span></div>
                   <input type="range" className="prop-slider" id="sl-opacity" min="0" max="100" defaultValue="100"/>
                </div>
                <button className="tb-btn" id="btn-reset-filters" style={{width:'100%', justifyContent:'center', border:'1px solid var(--border2)'}}>Reset Filters</button>
                
                <div style={{marginTop:20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                   <div className="prop-field"><label>X</label><input type="number" id="in-pos-x" defaultValue="0"/></div>
                   <div className="prop-field"><label>Y</label><input type="number" id="in-pos-y" defaultValue="0"/></div>
                   <div className="prop-field"><label>Scale X</label><input type="number" id="in-scale-x" defaultValue="1" step="0.1"/></div>
                   <div className="prop-field"><label>Scale Y</label><input type="number" id="in-scale-y" defaultValue="1" step="0.1"/></div>
                   <div className="prop-field" style={{gridColumn:'span 2'}}><label>Rotation</label><input type="number" id="in-rotation" defaultValue="0"/></div>
                </div>
                
                <div className="prop-field">
                   <label>Blend Mode</label>
                   <select id="sel-blend">
                      <option value="normal">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                   </select>
                </div>

                <div style={{marginTop:20}}>
                   <label style={{fontSize:10, color:'var(--text3)'}}>TRIM CLIP</label>
                   <div className="trim-vis" id="trim-vis">
                      <div className="trim-handle" id="trim-s" style={{left:0}}></div>
                      <div className="trim-active" id="trim-a" style={{left:0, right:0}}></div>
                      <div className="trim-handle" id="trim-e" style={{right:0}}></div>
                   </div>
                   <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8}}>
                      <input type="number" id="in-trim-start" defaultValue="0" step="0.1"/>
                      <input type="number" id="in-trim-end" defaultValue="10" step="0.1"/>
                   </div>
                </div>
             </div>
          </div>
          <div id="rp-text" style={{display:'none', flexDirection:'column', height:'100%'}}>
             <div style={{padding:12, borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:600, color:'var(--text3)'}}>TEXT PROPERTIES</div>
             <div style={{padding:12, flex:1, overflowY:'auto'}}>
                <div className="prop-field"><label>Content</label><textarea id="in-text-content" rows={3}></textarea></div>
                <div className="prop-field">
                   <label>Font</label>
                   <select id="sel-font">
                      <option value="Inter">Inter</option>
                      <option value="Arial">Arial</option>
                      <option value="Georgia">Georgia</option>
                   </select>
                </div>
                <div className="prop-grid-2" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                   <div className="prop-field"><label>Size</label><input type="number" id="in-text-size" defaultValue="48"/></div>
                   <div className="prop-field"><label>Color</label><input type="color" id="in-text-color" defaultValue="#ffffff"/></div>
                </div>
                <div className="prop-group">
                   <div className="prop-row"><label>Opacity</label><span id="val-text-opacity">100</span></div>
                   <input type="range" className="prop-slider" id="sl-text-opacity" min="0" max="100" defaultValue="100"/>
                </div>
                <div className="prop-grid-2" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                   <div className="prop-field"><label>Start (s)</label><input type="number" id="in-text-start" defaultValue="0"/></div>
                   <div className="prop-field"><label>Duration (s)</label><input type="number" id="in-text-dur" defaultValue="5"/></div>
                </div>
                <div className="prop-grid-2" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                   <div className="prop-field"><label>X</label><input type="number" id="in-text-x" defaultValue="50"/></div>
                   <div className="prop-field"><label>Y</label><input type="number" id="in-text-y" defaultValue="50"/></div>
                </div>
             </div>
          </div>
          <div style={{marginTop:'auto', padding:'12px', borderTop:'1px solid var(--border)'}}>
            <button className="tb-btn" id="btn-delete" style={{color:'var(--red)', width:'100%', justifyContent:'center'}}>Delete Selected</button>
            <button className="export-full-btn" id="btn-export-main" style={{marginTop:8}}>Export Video</button>
          </div>
        </aside>

        <section className="timeline">
          <div style={{height:'36px', background: 'var(--bg2)', display:'flex', alignItems:'center', padding:'0 12px', borderBottom:'1px solid var(--border)'}}>
            <button className="pb-btn" id="btn-play" disabled><span id="play-icon"><polygon points="4,2 14,8 4,14" fill="currentColor"/></span></button>
            <button className="pb-btn" id="btn-skip-start" style={{marginLeft:8}}>⏮</button>
            <button className="pb-btn" id="btn-skip-end">⏭</button>
            <div className="topbar-sep" style={{margin:'0 12px'}}></div>
            <button className="tb-btn" id="btn-split" disabled>Split</button>
            <div id="pb-tc" style={{marginLeft:'auto', fontSize:'11px', color:'var(--text3)', fontFamily:'monospace'}}>00:00.00 / 00:10.00</div>
            <div className="topbar-sep" style={{margin:'0 12px'}}></div>
            <button className="pb-btn" id="btn-zoom-out">－</button>
            <span id="zoom-label" style={{fontSize:10, width:34, textAlign:'center'}}>100%</span>
            <button className="pb-btn" id="btn-zoom-in">＋</button>
          </div>
          <div className="tracks-area">
             <div className="tracks-scroll" id="tracks-scroll">
                <div className="tracks-inner" id="tracks-inner">
                   <div id="playhead" className="playhead" style={{left:0}}></div>
                   <div id="ruler" className="ruler"></div>
                   <div className="track-row"><div className="track-label">V1</div><div className="track-content" id="track-v1"><div className="track-empty">Video clips here</div></div></div>
                   <div className="track-row" style={{height:32}}><div className="track-label">A1</div><div className="track-content" id="track-a1"><div className="track-empty">Audio tracks</div></div></div>
                   <div className="track-row" style={{height:26}}><div className="track-label">T1</div><div className="track-content" id="track-t1"><div className="track-empty">Text layers</div></div></div>
                </div>
             </div>
          </div>
        </section>
      </div>

      <div id="proc-overlay">
        <div style={{background:'var(--bg2)', padding:'24px 40px', borderRadius:12, textAlign:'center', border:'1px solid var(--border2)'}}>
           <div id="proc-title" style={{fontWeight:700, marginBottom:4}}>Processing…</div>
           <div id="proc-desc" style={{fontSize:11, color:'var(--text3)'}}>Please wait</div>
        </div>
      </div>
      <div id="toast" className="toast"><div id="toast-title"></div><div id="toast-desc"></div></div>
    </div>
  );
}
