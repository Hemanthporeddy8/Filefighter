content = open('public/video-editor.html', encoding='utf-8').read()
lines = content.split('\n')
results = []
for i, l in enumerate(lines):
    stripped = l.strip()
    if any(x in stripped for x in ['renderTimeline','playhead','tl-scroll','dragClip','scrubbing','tlScroll','updatePlayhead','tl-row','tl-clip','tl-track']):
        results.append(f'{i+1}: {l[:130]}')
for r in results[:120]:
    print(r)
