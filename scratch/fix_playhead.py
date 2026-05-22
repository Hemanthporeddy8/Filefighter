content = open('public/video-editor.html', encoding='utf-8').read()

# Fix playhead HTML inline style
content = content.replace(
    'class="playhead" id="playhead" style="left:0"',
    'class="playhead" id="playhead" style="transform:translateX(0)"'
)

# Remove conflicting left:0 !important from CSS
content = content.replace(
    '  will-change:transform;\n  transform:translateZ(0);\n  left:0 !important;\n}',
    '  will-change:transform;\n  transform:translateZ(0);\n}'
)

open('public/video-editor.html', 'w', encoding='utf-8').write(content)
print('Fixed:', 'transform:translateX(0)' in content)
