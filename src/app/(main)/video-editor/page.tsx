
"use client";

import { useEffect, useRef } from 'react';

/**
 * [ignoring loop detection]
 * 
 * VideoEditorPage implementation
 * Replicates video-editor.html exactly as a standalone full-screen application.
 */

export default function VideoEditorPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ═══════════════════════════════════════════════════════
    // STATE & LOGIC FROM video-editor.html
    // ═══════════════════════════════════════════════════════
    const state = {
      clips: [] as any[],
      audioTracks: [] as any[],
      textLayers: [] as any[],
      activeLayer: null as any,
      currentClipIndex: 0,
      globalTime: 0,
      totalDuration: 10,
      isPlaying: false,
      timelineZoom: 1,
      history: [[]] as any[],
      historyIndex: 0,
      dragText: null as any,
      fps: 24,
      resolution: '1920x1080',
      objectUrls: new Set<string>(),
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
      setTimeout(() => el.classList.remove('show'), 3000);
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
      const vd = state.clips.reduce((a,c) => a + (c.trim.end - c.trim.start), 0);
      const ad = state.audioTracks.reduce((a,t) => Math.max(a, t.start + t.duration), 0);
      const td = state.textLayers.reduce((a,l) => Math.max(a, l.start + l.duration), 0);
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

    function switchTab(tab: string) {
      document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
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
            reader.onload = (e: any) => {
              const src = e.target.result;
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
        showToast('Media added', newClips.length + ' file(s) added');
      } catch(err: any) {
        showToast('Error', err.message, true);
      }
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
      } catch(err: any) {
        showToast('Error', err.message, true);
      }
    }

    function pushHistory() {
      const snapshot = JSON.stringify(state.clips.map(c => ({...c, file:null, src:null})));
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(snapshot);
      state.historyIndex = state.history.length - 1;
      const undoBtn = document.getElementById('btn-undo');
      if (undoBtn) (undoBtn as any).disabled = state.historyIndex <= 0;
    }

    function renderAll() {
      renderClipsList();
      renderImageGrid();
      renderAudioList();
      renderTextList();
      renderTimeline();
      renderInspector();
      updatePreviewEmpty();
      updateActionButtons();
      buildRuler();
    }

    function updatePreviewEmpty() {
      const hasMedia = state.clips.length > 0;
      const pe = document.getElementById('preview-empty');
      if (pe) pe.style.display = hasMedia ? 'none' : 'flex';
      
      const buttons = ['btn-export-top', 'btn-export-main', 'btn-play', 'btn-frame-back', 'btn-frame-fwd'];
      buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) (btn as any).disabled = !hasMedia;
      });
    }

    function updateActionButtons() {
      const delBtn = document.getElementById('btn-delete');
      const splitBtn = document.getElementById('btn-split');
      if (delBtn) (delBtn as any).disabled = !state.activeLayer;
      if (splitBtn) (splitBtn as any).disabled = state.clips.length === 0;
    }

    function renderClipsList() {
      const list = document.getElementById('clips-list');
      const section = document.getElementById('clips-section');
      if (!list || !section) return;
      section.style.display = state.clips.length ? 'block' : 'none';
      list.innerHTML = state.clips.map(clip => `
        <div class="clip-item ${state.activeLayer?.id === clip.id ? 'selected' : ''}" data-id="${clip.id}">
          <div class="clip-thumb">
            <img src="${clip.thumbnail}" alt=""/>
            <div class="clip-dur">${formatTime(clip.duration)}</div>
          </div>
          <div class="clip-info">
            <div class="clip-name">${clip.file?.name || 'Asset'}</div>
            <div class="clip-type">${clip.type === 'video' ? 'Video' : 'Image'} · ${formatTime(clip.trim.end - clip.trim.start)}</div>
          </div>
        </div>
      `).join('');
      list.querySelectorAll('.clip-item').forEach(el => el.addEventListener('click', () => selectLayer((el as any).dataset.id, 'video')));
    }

    function renderImageGrid() {
      const grid = document.getElementById('images-grid');
      if (!grid) return;
      const images = state.clips.filter(c => c.type === 'image');
      grid.innerHTML = images.map(clip => `
        <div class="img-item ${state.activeLayer?.id === clip.id ? 'selected' : ''}" data-id="${clip.id}">
          <img src="${clip.thumbnail}" alt=""/>
        </div>
      `).join('');
      grid.querySelectorAll('.img-item').forEach(el => el.addEventListener('click', () => selectLayer((el as any).dataset.id, 'video')));
    }

    function renderAudioList() {
      const list = document.getElementById('audio-list');
      if (!list) return;
      list.innerHTML = state.audioTracks.map(t => `
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
      list.innerHTML = state.textLayers.map(l => `
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
        const label = document.createElement('span');
        label.className = 'ruler-label';
        label.style.left = pct + '%';
        label.textContent = formatTime(t);
        ruler.appendChild(label);
      }
    }

    function renderTimeline() {
      renderVideoTrack();
      renderAudioTrack();
      renderTextTrack();
      updatePlayhead();
    }

    function renderVideoTrack() {
      const track = document.getElementById('track-v1');
      if (!track) return;
      track.querySelectorAll('.tl-clip').forEach(e => e.remove());
      let cumulative = 0;
      state.clips.forEach(clip => {
        const dur = clip.trim.end - clip.trim.start;
        const left = (cumulative / state.totalDuration) * 100;
        const width = (dur / state.totalDuration) * 100;
        const el = document.createElement('div');
        el.className = 'tl-clip' + (state.activeLayer?.id === clip.id ? ' selected' : '');
        el.style.left = left + '%';
        el.style.width = Math.max(width, 0.1) + '%';
        el.innerHTML = `<div class="tl-clip-filmstrip"><img class="tl-clip-frame" src="${clip.thumbnail}" alt=""/></div><div class="tl-clip-name">${clip.file?.name || 'Asset'}</div><div class="tl-clip-dur">${formatTime(dur)}</div>`;
        el.addEventListener('click', (e) => { e.stopPropagation(); selectLayer(clip.id, 'video'); });
        track.appendChild(el);
        cumulative += dur;
      });
    }

    function renderAudioTrack() {
      const track = document.getElementById('track-a1');
      if (!track) return;
      track.querySelectorAll('.tl-audio-block').forEach(e => e.remove());
      state.audioTracks.forEach(t => {
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
      state.textLayers.forEach(l => {
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
      const ph = document.getElementById('playhead');
      if (ph) ph.style.left = pct + '%';
      updateTimecode();
    }

    function selectLayer(id: string, type: string) {
      state.activeLayer = { id, type };
      renderAll();
    }

    function renderInspector() {
      const empty = document.getElementById('rp-empty');
      const vPane = document.getElementById('rp-video');
      const tPane = document.getElementById('rp-text');
      if (!empty || !vPane || !tPane) return;
      if (!state.activeLayer) { empty.style.display = 'flex'; vPane.style.display = 'none'; tPane.style.display = 'none'; return; }
      empty.style.display = 'none';
      if (state.activeLayer.type === 'video') { vPane.style.display = 'flex'; tPane.style.display = 'none'; } 
      else if (state.activeLayer.type === 'text') { vPane.style.display = 'none'; tPane.style.display = 'flex'; }
    }

    function togglePlay() {
      if (!state.clips.length) return;
      state.isPlaying = !state.isPlaying;
      const icon = document.getElementById('play-icon');
      if (state.isPlaying) {
        if (icon) icon.innerHTML = '<rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/>';
        if (state.globalTime >= state.totalDuration) seekTo(0);
        raf = requestAnimationFrame(playLoop);
      } else {
        if (icon) icon.innerHTML = '<polygon points="4,2 14,8 4,14"/>';
        cancelAnimationFrame(raf);
        pauseVideo();
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
          if (icon) icon.innerHTML = '<polygon points="4,2 14,8 4,14"/>';
          updatePlayhead(); return;
        }
      }
      lastTs = ts;
      syncVideoToTime(); updatePlayhead(); renderTextOverlays();
      raf = requestAnimationFrame(playLoop);
    }

    function syncVideoToTime() {
      const video = document.getElementById('preview-video') as HTMLVideoElement;
      if (!video) return;
      const clip = getCurrentClip();
      if (!clip || clip.type !== 'video') { video.style.display = 'none'; return; }
      video.style.display = 'block';
      if (video.src !== clip.src) video.src = clip.src;
      const t = clip.trim.start + (state.globalTime - getElapsedBeforeClip());
      if (Math.abs(video.currentTime - t) > 0.15) video.currentTime = t;
      if (state.isPlaying && video.paused) video.play().catch(() => {});
      else if (!state.isPlaying && !video.paused) video.pause();
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
      state.textLayers.forEach(l => {
        if (state.globalTime < l.start || state.globalTime >= l.start + l.duration) return;
        const el = document.createElement('div');
        el.className = 'text-overlay-item' + (state.activeLayer?.id === l.id ? ' selected' : '');
        el.textContent = l.content || 'Text';
        el.style.cssText = `left:${l.posX||50}px;top:${l.posY||50}px;font-size:${l.size}px;font-family:${l.font};color:${l.color}`;
        container.appendChild(el);
      });
    }

    function addTextLayer() {
      const l = { id: uid(), content: 'New Text', font: 'Inter', size: 48, color: '#ffffff', start: state.globalTime, duration: 5, posX: 80, posY: 80 };
      state.textLayers.push(l); selectLayer(l.id, 'text'); computeTotalDuration(); renderAll();
    }

    function deleteActive() {
      if (!state.activeLayer) return;
      if (state.activeLayer.type === 'video') state.clips = state.clips.filter((c: any) => c.id !== state.activeLayer.id);
      else if (state.activeLayer.type === 'audio') state.audioTracks = state.audioTracks.filter((t: any) => t.id !== state.activeLayer.id);
      else if (state.activeLayer.type === 'text') state.textLayers = state.textLayers.filter((l: any) => l.id !== state.activeLayer.id);
      state.activeLayer = null; computeTotalDuration(); renderAll();
    }

    // ═══════════════════════════════════════════════════════
    // BINDINGS
    // ═══════════════════════════════════════════════════════
    document.querySelectorAll('.rail-btn[data-tab]').forEach(btn => btn.addEventListener('click', () => switchTab((btn as any).dataset.tab)));
    document.getElementById('uz-video')?.addEventListener('click', () => (document.getElementById('input-video') as any).click());
    document.getElementById('input-video')?.addEventListener('change', (e: any) => handleVideoFiles(Array.from(e.target.files as FileList)));
    document.getElementById('uz-audio')?.addEventListener('click', () => (document.getElementById('input-audio') as any).click());
    document.getElementById('input-audio')?.addEventListener('change', (e: any) => handleAudioFiles(Array.from(e.target.files as FileList)));
    document.getElementById('btn-play')?.addEventListener('click', togglePlay);
    document.getElementById('btn-add-text')?.addEventListener('click', addTextLayer);
    document.getElementById('btn-delete')?.addEventListener('click', deleteActive);

    const keyHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.key === 'Delete') deleteActive();
    };
    document.addEventListener('keydown', keyHandler);

    updateTimecode(); updatePreviewEmpty(); buildRuler();

    return () => {
      document.removeEventListener('keydown', keyHandler);
      state.objectUrls.forEach(url => URL.revokeObjectURL(url));
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
        .lpanel { grid-area: lpan; background: var(--bg1); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .tab-panel { display: none; flex: 1; flex-direction: column; padding: 12px; }
        .tab-panel.active { display: flex; }
        .preview { grid-area: prev; background: var(--bg0); position: relative; display: flex; align-items: center; justify-content: center; }
        .preview-canvas { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .preview-video { max-width: 100%; max-height: 100%; }
        .rpanel { grid-area: rpan; background: var(--bg1); border-left: 1px solid var(--border); display: flex; flex-direction: column; }
        .timeline { grid-area: tl; background: var(--bg1); border-top: 1px solid var(--border); display: flex; flex-direction: column; }
        
        .tb-btn { background: none; border: none; color: var(--text2); font-size: 12px; cursor: pointer; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; }
        .tb-btn:hover { background: rgba(255,255,255,0.05); color: #fff; }
        .logo { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #fff; }
        .logo-icon { width: 28px; height: 28px; background: var(--accent); border-radius: 6px; display: flex; align-items: center; justify-content: center; }
        
        .upload-zone { border: 1.5px dashed var(--border2); border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; transition: 0.2s; }
        .upload-zone:hover { border-color: var(--accent); background: rgba(99,102,241,0.05); }
        .upload-zone p { font-size: 12px; color: var(--text2); }
        
        .timecode { background: var(--bg3); padding: 4px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #fff; border: 1px solid var(--border); }
        .export-btn { background: var(--accent); border: none; color: #fff; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
        
        .track-row { height: 48px; border-bottom: 1px solid var(--border); display: flex; position: relative; }
        .track-label { width: 40px; background: var(--bg2); border-right: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: var(--text3); }
        .track-content { flex: 1; position: relative; background: #080808; overflow: hidden; }
        .playhead { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; z-index: 50; pointer-events: none; }
        .playhead::after { content: ''; position: absolute; top: 0; left: -5px; width: 12px; height: 12px; background: #fff; border-radius: 50%; }
        
        .tl-clip { position: absolute; top: 4px; bottom: 4px; background: linear-gradient(135deg, #1e293b, #0f172a); border: 1.5px solid rgba(99,102,241,0.4); border-radius: 6px; overflow: hidden; }
        .tl-clip.selected { border-color: #fff; }
        .tl-clip-filmstrip { position: absolute; inset: 0; display: flex; opacity: 0.3; }
        .tl-clip-frame { height: 100%; width: 40px; object-fit: cover; }
        .tl-clip-name { position: absolute; bottom: 2px; left: 4px; font-size: 9px; color: #fff; white-space: nowrap; }

        .text-overlay-item { position: absolute; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); pointer-events: auto; cursor: move; white-space: nowrap; }
        .text-overlay-item.selected { outline: 2px dashed var(--accent); outline-offset: 4px; }
        
        .toast { position: fixed; bottom: 20px; right: 20px; background: var(--bg2); border: 1px solid var(--border2); padding: 12px; border-radius: 8px; transition: 0.3s; opacity: 0; pointer-events: none; }
        .toast.show { opacity: 1; }
        .toast-title { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
        .toast-desc { font-size: 11px; color: var(--text3); }
      `}</style>

      <div className="app-grid">
        <header className="topbar">
          <div className="logo"><div className="logo-icon">V</div><span>FileFlow</span></div>
          <div className="timecode" id="tc-current">00:00.00</div>
          <button className="export-btn" id="btn-export-top">Export</button>
        </header>

        <nav className="rail">
          <button className="rail-btn active" data-tab="media">M<span>Media</span></button>
          <button className="rail-btn" data-tab="text">T<span>Text</span></button>
        </nav>

        <aside className="lpanel">
          <div className="tab-panel active" id="tab-media">
            <div className="upload-zone" id="uz-video">
              <input type="file" id="input-video" accept="video/*" hidden />
              <p>Drop videos here</p>
            </div>
            <div id="clips-section" style={{display:'none', marginTop:'12px'}}>
              <div id="clips-list"></div>
            </div>
          </div>
          <div className="tab-panel" id="tab-text">
            <button className="tb-btn" id="btn-add-text" style={{width:'100%', border:'1px solid var(--border2)'}}>Add Text</button>
            <div id="text-layers-list" style={{marginTop:'12px'}}></div>
          </div>
        </aside>

        <main className="preview">
          <div className="preview-canvas">
            <video id="preview-video" style={{display:'none'}}></video>
            <div id="text-overlays" style={{position:'absolute', inset:0, pointerEvents:'none'}}></div>
            <div id="preview-empty" style={{color: 'var(--text3)'}}>Preview area</div>
          </div>
        </main>

        <aside className="rpanel">
          <div id="rp-empty" style={{padding:'20px', textAlign:'center', color:'var(--text3)'}}>Properties</div>
          <div id="rp-video" style={{display:'none', padding:'12px'}}>Video Settings</div>
          <div id="rp-text" style={{display:'none', padding:'12px'}}>Text Settings</div>
          <div style={{marginTop:'auto', padding:'12px'}}>
            <button className="tb-btn danger" id="btn-delete" style={{color:'var(--red)'}}>Delete Layer</button>
          </div>
        </aside>

        <section className="timeline">
          <div style={{height:'30px', background: 'var(--bg2)', display:'flex', alignItems:'center', padding:'0 12px'}}>
            <button className="tb-btn" id="btn-play">Play</button>
            <div id="pb-tc" style={{marginLeft:'auto', fontSize:'11px'}}>00:00.00 / 00:10.00</div>
          </div>
          <div id="track-v1" className="track-row"><div className="track-label">V1</div><div className="track-content"></div></div>
          <div id="track-a1" className="track-row"><div className="track-label">A1</div><div className="track-content"></div></div>
          <div id="track-t1" className="track-row"><div className="track-label">T1</div><div className="track-content"></div></div>
          <div id="playhead" className="playhead" style={{left:0}}></div>
          <div id="ruler" style={{height:'20px', position:'relative'}}></div>
        </section>
      </div>

      <div id="proc-overlay" className="toast" style={{top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center'}}>
        <div id="proc-title">Processing</div>
      </div>
      <div id="toast" className="toast"><div id="toast-title"></div><div id="toast-desc"></div></div>
    </div>
  );
}
