content = open('public/video-editor.html', encoding='utf-8').read()
checks = [
    ('Preview canvas 480x270', 'renderCanvas.width = 480'),
    ('24fps throttle', 'TARGET_FPS = 24'),
    ('Mobile detection', 'function isMobile()'),
    ('File size limit 200MB', 'MAX_FILE_SIZE_MB = 200'),
    ('Duration limit 10min', 'MAX_DURATION_MIN = 10'),
    ('Upload count limit 5', 'MAX_UPLOAD_COUNT = 5'),
    ('History limit 15', 'MAX_HISTORY = 15'),
    ('Export safety check', 'estimatedMB > 800'),
    ('Export cancel support', 'exportCancelled'),
    ('Tab hidden skip render', 'document.hidden'),
    ('Export ETA shown', 'remaining'),
    ('Memory cleanup on delete', 'URL.revokeObjectURL'),
    ('PWA mobile meta', 'apple-mobile-web-app-capable'),
    ('Visibility API', 'visibilitychange'),
    ('Export canvas resize', 'prevW = renderCanvas.width'),
    ('Timeline debounce', 'renderTimelineDebounced'),
    ('Export start time ETA', 'exportStartTime'),
]
all_pass = True
for label, search in checks:
    found = search in content
    status = 'PASS' if found else 'FAIL'
    if not found:
        all_pass = False
    print(status + ' ' + label)

print('')
print('ALL PASS' if all_pass else 'SOME FAILED - check above')
