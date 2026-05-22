content = open('public/video-editor.html', encoding='utf-8').read()
checks = [
    ('pps() function defined', 'function pps()' in content),
    ('timeToPx() defined', 'function timeToPx' in content),
    ('pxToTime() defined', 'function pxToTime' in content),
    ('state.tlZoom added', 'tlZoom: 1.0' in content),
    ('BASE_PPS constant', 'BASE_PPS = 80' in content),
    ('tracks-inner dynamic width', 'inner.style.width = totalPx' in content),
    ('Auto-scroll schedular', '_scheduleAutoScroll' in content),
    ('Smooth lerp scroll', 'LERP = 0.18' in content),
    ('Edge drag auto-scroll', '_startEdgeDragScroll' in content),
    ('Zoom setTlZoom()', 'function setTlZoom' in content),
    ('Zoom label updates', 'Math.round(state.tlZoom * 100)' in content),
    ('Ctrl+wheel zoom', 'e.ctrlKey' in content),
    ('Pinch-to-zoom', 'lastPinchDist' in content),
    ('Ruler pixel ticks', 'timeToPx(t)' in content and 'ruler-tick' in content),
    ('Playhead pixel left', "px + 'px'" in content),
    ('Auto-scroll during playback', '_autoScrollDuringPlayback' in content),
    ('Drag uses pxToTime()', 'pxToTime(dx)' in content),
    ('Clip pixel position in render', 'timeToPx(item.start)' in content),
    ('Clip pixel width in render', 'timeToPx(item.duration)' in content),
    ('Zoom in btn wired', 'btn-zoom-in' in content and 'setTlZoom' in content),
    ('Zoom out btn wired', 'btn-zoom-out' in content and 'setTlZoom' in content),
]
passed = sum(1 for _, ok in checks if ok)
print(f'RESULTS: {passed}/{len(checks)} passed')
for label, ok in checks:
    print(('  PASS ' if ok else '  FAIL ') + label)
