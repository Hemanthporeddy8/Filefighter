content = open('public/video-editor.html', encoding='utf-8').read()

responsive_css = (
    "\n/* RESPONSIVE / MOBILE LAYOUT */\n"
    "html,body{max-width:100vw;overflow-x:hidden}\n"
    "img,video,canvas{max-width:100%;height:auto}\n"

    "@media (max-width:900px){\n"
    "  .app{grid-template-columns:44px 180px 1fr;grid-template-areas:'topbar topbar topbar' 'rail lpanel preview' 'rail tl tl'}\n"
    "  .right-panel{display:none}\n"
    "  .left-panel{width:180px}\n"
    "}\n"

    "@media (max-width:600px){\n"
    "  .app{grid-template-rows:44px 1fr 180px var(--timeline-h,160px);grid-template-columns:1fr;"
    "grid-template-areas:'topbar' 'preview' 'lpanel' 'tl';height:100dvh}\n"
    "  .icon-rail{display:none}\n"
    "  .right-panel{display:none}\n"
    "  .left-panel{border-right:none;border-top:1px solid var(--border);flex-direction:row;"
    "overflow-x:auto;overflow-y:hidden;height:180px;width:100%;-webkit-overflow-scrolling:touch}\n"
    "  .tab-panel{flex-direction:row;overflow-x:auto}\n"
    "  .panel-body{flex-direction:row;padding:6px;gap:6px;flex-wrap:nowrap}\n"
    "  .clip-item{flex-shrink:0;width:130px;flex-direction:column;align-items:flex-start}\n"
    "  .topbar{padding:0 8px;gap:4px;overflow-x:auto}\n"
    "  .topbar-left{gap:2px}\n"
    "  .topbar-right{gap:2px}\n"
    "  .tb-btn{padding:0 5px;font-size:11px;height:26px}\n"
    "  .logo-name{font-size:12px}\n"
    "  .export-btn{padding:0 10px;font-size:11px;height:26px}\n"
    "  .timeline-area{min-height:120px}\n"
    "  .tl-clip{min-width:60px;min-height:40px}\n"
    "  .tb-btn,.rail-btn,.panel-hdr-btn{min-height:36px}\n"
    "}\n"

    "@media (max-width:380px){\n"
    "  .logo-icon{width:22px;height:22px}\n"
    "  .logo-name{display:none}\n"
    "  .timecode span{font-size:10px}\n"
    "}\n"

    "@supports(padding:env(safe-area-inset-top)){\n"
    "  .app{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);"
    "padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}\n"
    "}\n"
)

content = content.replace(
    '</style>\n</head>',
    responsive_css + '</style>\n<link rel="manifest" href="/manifest.json"/>\n</head>'
)

open('public/video-editor.html', 'w', encoding='utf-8').write(content)
print('Done')
