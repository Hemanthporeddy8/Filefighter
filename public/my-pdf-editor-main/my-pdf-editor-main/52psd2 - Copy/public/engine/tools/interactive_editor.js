// Phase 8: Senior Engine Architecture

// ── PDF font name → CSS font family ──────────────────────────────────────────
const PDF_FONT_TO_CSS = {
    'Helvetica': 'Helvetica, Arial, sans-serif',
    'Helvetica-Bold': 'Helvetica, Arial, sans-serif',
    'Helvetica-Oblique': 'Helvetica, Arial, sans-serif',
    'Helvetica-BoldOblique': 'Helvetica, Arial, sans-serif',
    'Arial': 'Arial, sans-serif',
    'Arial-Bold': 'Arial, sans-serif',
    'Arial-BoldMT': 'Arial, sans-serif',
    'ArialMT': 'Arial, sans-serif',
    'Arial-ItalicMT': 'Arial, sans-serif',
    'Arial-BoldItalicMT': 'Arial, sans-serif',
    'Times-Roman': '"Times New Roman", Times, serif',
    'Times-Bold': '"Times New Roman", Times, serif',
    'Times-Italic': '"Times New Roman", Times, serif',
    'Times-BoldItalic': '"Times New Roman", Times, serif',
    'TimesNewRoman': '"Times New Roman", Times, serif',
    'TimesNewRomanPS': '"Times New Roman", Times, serif',
    'TimesNewRomanPSMT': '"Times New Roman", Times, serif',
    'Courier': '"Courier New", Courier, monospace',
    'Courier-Bold': '"Courier New", Courier, monospace',
    'Courier-Oblique': '"Courier New", Courier, monospace',
    'Courier-BoldOblique': '"Courier New", Courier, monospace',
    'CourierNew': '"Courier New", Courier, monospace',
    'CourierNewPSMT': '"Courier New", Courier, monospace',
    'Calibri': 'Calibri, "Trebuchet MS", sans-serif',
    'Calibri-Bold': 'Calibri, "Trebuchet MS", sans-serif',
    'Calibri-Italic': 'Calibri, "Trebuchet MS", sans-serif',
    'Calibri-BoldItalic': 'Calibri, "Trebuchet MS", sans-serif',
    'Georgia': 'Georgia, serif',
    'Georgia-Bold': 'Georgia, serif',
    'Georgia-Italic': 'Georgia, serif',
    'Verdana': 'Verdana, Geneva, sans-serif',
    'Verdana-Bold': 'Verdana, Geneva, sans-serif',
};

function resolveCSSFont(pdfFontName) {
    if (!pdfFontName) return 'Arial, sans-serif';
    
    // Priority 0: Injected @font-face families (prefixed with PDF_)
    if (pdfFontName.startsWith('PDF_')) return `"${pdfFontName}", Arial, sans-serif`;

    const base = pdfFontName.replace(/^[A-Z]{6}\+/, '');
    if (PDF_FONT_TO_CSS[base]) return PDF_FONT_TO_CSS[base];
    const lower = base.toLowerCase();
    if (lower.includes('helvetica') || lower.includes('arial')) return 'Arial, sans-serif';
    if (lower.includes('times')) return '"Times New Roman", Times, serif';
    if (lower.includes('courier')) return '"Courier New", Courier, monospace';
    if (lower.includes('georgia')) return 'Georgia, serif';
    if (lower.includes('verdana')) return 'Verdana, sans-serif';
    if (lower.includes('calibri')) return 'Calibri, sans-serif';
    return 'Arial, sans-serif';
}

function isBoldFont(name) {
    if (!name) return false;
    return /bold|heavy|black/i.test(name);
}
function isItalicFont(name) {
    if (!name) return false;
    return /italic|oblique/i.test(name);
}

export class InteractiveEditor {
    constructor(container, backend) {
        this.container = container;
        this.backend = backend;
        this.activeBlock = null;
        this._docClickHandler = null;
        this._initStyles();
    }

    _initStyles() {
        if (document.getElementById('god-engine-editor-styles')) return;
        const style = document.createElement('style');
        style.id = 'god-engine-editor-styles';
        style.innerHTML = `
            .engine-edit-block {
                position: absolute;
                border: 1px solid transparent;
                cursor: text;
                box-sizing: border-box;
                padding: 0; margin: 0;
                border-radius: 2px;
                white-space: pre-wrap; /* allow wrapping in PDF layer */
                overflow: hidden;
                line-height: 1; /* Force tight line height */
                vertical-align: top;
                word-break: break-word;
                display: flex;
                align-items: flex-end; /* Align text to the bottom/baseline as PDF draws it */
            }
            .engine-edit-block:hover {
                border: 1px dashed rgba(0,123,255,0.5);
            }
            .engine-edit-block.selected {
                border: 1px solid #007bff;
                box-shadow: 0 0 0 2px rgba(0,123,255,0.15);
                cursor: move;
            }
            .engine-edit-block.editing {
                border: 1px solid #0056b3;
                box-shadow: 0 0 0 2px rgba(0,86,179,0.2);
                overflow: visible;
                white-space: pre-wrap;
                cursor: text;
                outline: none;
                z-index: 1000;
                min-width: 20px;
                min-height: 1em;
            }
            .engine-resizer {
                width: 9px; height: 9px;
                background: #007bff;
                border: 2px solid white;
                border-radius: 50%;
                position: absolute;
                right: -5px; bottom: -5px;
                cursor: nwse-resize;
                display: none;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                z-index: 1002;
            }
            .engine-edit-block.selected .engine-resizer,
            .engine-edit-block.editing  .engine-resizer { display: block; }
            .engine-floating-toolbar {
                position: absolute;
                top: -42px; left: 50%;
                transform: translateX(-50%);
                background: #1e1e1e;
                padding: 4px 8px;
                border-radius: 6px;
                display: none;
                gap: 2px;
                align-items: center;
                box-shadow: 0 4px 16px rgba(0,0,0,0.3);
                z-index: 1003;
                pointer-events: auto;
                white-space: nowrap;
            }
            .engine-edit-block.editing .engine-floating-toolbar { display: flex; }
            .toolbar-btn {
                cursor: pointer;
                padding: 3px 7px;
                border-radius: 4px;
                font-size: 13px;
                font-family: Arial, sans-serif;
                font-weight: bold;
                color: #fff;
                background: transparent;
                border: none;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 26px; height: 26px;
            }
            .toolbar-btn:hover { background: rgba(255,255,255,0.15); }
            .toolbar-btn.tb-active { background: rgba(255,255,255,0.25); }
            .toolbar-divider { width:1px; height:18px; background:rgba(255,255,255,0.2); margin:0 2px; }
            .toolbar-color-wrap {
                position: relative;
                width: 26px; height: 26px;
                display: flex; align-items: center; justify-content: center;
            }
            .toolbar-color-wrap input[type=color] {
                position: absolute; opacity: 0;
                width: 100%; height: 100%;
                cursor: pointer; border: none; padding: 0;
            }
            .toolbar-color-swatch {
                width: 14px; height: 14px;
                border-radius: 50%;
                background: #fff;
                border: 2px solid rgba(255,255,255,0.5);
                pointer-events: none;
            }
            .engine-char {
                display: inline-block;
                white-space: pre;
                /* Provide transparent structural geometry for proper cursor hit-testing */
                color: transparent; 
            }
        `;
        document.head.appendChild(style);
    }

    setup(textItems) {
        const layoutEngine = new LayoutEngine();
        const paragraphs = layoutEngine.processTextItems(textItems);
        
        this.container.innerHTML = '';
        this.container.style.pointerEvents = 'auto';

        if (this._docClickHandler) {
            document.removeEventListener('mousedown', this._docClickHandler);
        }
        this._docClickHandler = (e) => {
            if (!e.target.closest('.engine-edit-block') &&
                !e.target.closest('.engine-floating-toolbar')) {
                this._deactivateAll();
            }
        };
        document.addEventListener('mousedown', this._docClickHandler);

        paragraphs.forEach((p, idx) => {
            // Phase 6: Ghost Masking
            // Mask the original vector text on the canvas under this block
            if (this.backend && typeof this.backend.maskRect === 'function') {
                this.backend.maskRect(p.x, p.y, p.width, p.height);
            }
            this.container.appendChild(this._createBlock(p, idx));
        });
    }

    _createBlock(p, id) {
        const div = document.createElement('div');
        div.className = 'engine-edit-block';
        div.dataset.id = id;
        div.contentEditable = 'false';

        const scale = window.currentScale || 1;
        const pdfH = this.backend?.pdfHeight || 842;
        const offsetX = this.backend?.pageOffsetX || 0;

        const cssLeft = (p.x - offsetX) * scale;
        // p.y is now Bottom-Left. Top-Edge is p.y + p.height.
        const cssTop = (pdfH - (p.y + p.height)) * scale;

        const cssFont = resolveCSSFont(p.fontFamily);
        const fontW = isBoldFont(p.fontFamily) ? 'bold' : 'normal';
        const fontS = isItalicFont(p.fontFamily) ? 'italic' : 'normal';

        div.style.left = `${cssLeft.toFixed(2)}px`;
        div.style.top = `${cssTop.toFixed(2)}px`;
        div.style.width = `${(p.width * scale).toFixed(2)}px`;
        div.style.height = `${(p.height * scale).toFixed(2)}px`;
        div.style.fontSize = `${(p.fontSize * scale).toFixed(2)}px`;
        div.style.lineHeight = `${(p.height * scale).toFixed(2)}px`;
        div.style.fontFamily = cssFont;
        div.style.fontWeight = fontW;
        div.style.fontStyle = fontS;
        
        // Zero-Distortion: Force browser text to match PDF width exactly
        // We use a temporary span to measure the browser's natural rendering width
        const measurer = document.createElement('span');
        measurer.style.font = `${div.style.fontWeight} ${div.style.fontStyle} ${div.style.fontSize} ${div.style.fontFamily}`;
        measurer.style.visibility = 'hidden';
        measurer.style.position = 'absolute';
        measurer.style.whiteSpace = 'pre';
        measurer.innerText = p.text;
        document.body.appendChild(measurer);
        const naturalWidth = measurer.offsetWidth;
        document.body.removeChild(measurer);

        if (naturalWidth > 0) {
            const ratio = (p.width * scale) / naturalWidth;
            // Use scaleX to stretch/squash the font to match the PDF vector metrics
            div.style.transformOrigin = 'left center';
            div.style.transform = `scaleX(${ratio.toFixed(4)})`;
        }

        div.style.color = 'transparent'; // Use transparent text to allow vector background visibility
        div.style.background = 'transparent';

        div.dataset.pdfX = p.x;
        div.dataset.pdfY = p.y;
        div.dataset.pdfWidth = p.width;
        div.dataset.pdfHeight = p.height;
        div.dataset.fontSize = p.fontSize;
        div.dataset.fontFamily = p.fontFamily || '';
        
        // Phase 8: AST Source Tracking
        // Store the original BT/ET splicing bounds on the DOM element for the ExportEngine
        if (p.tokens && p.tokens[0]) {
            div.dataset.sourceBTStart = p.tokens[0].sourceBTStart;
            div.dataset.sourceETEnd = p.tokens[0].sourceETEnd;
        }

        // DOM Editing Layer (Phase 3): Track the Character Index Model tokens
        if (p.tokens && Array.isArray(p.tokens)) {
            // Save the exact character tokens for Incremental Writer
            div.dataset.tokens = JSON.stringify(p.tokens);

            p.tokens.forEach((t, i) => {
                const span = document.createElement('span');
                span.className = 'engine-char';
                span.dataset.index = i;
                span.innerText = t.text;
                div.appendChild(span);
            });
        } else {
            div.innerText = p.text;
        }

        const resizer = document.createElement('div');
        resizer.className = 'engine-resizer';
        div.appendChild(resizer);

        div.appendChild(this._createToolbar(div));

        div.addEventListener('mousedown', (e) => this._onMouseDown(e, div));
        div.addEventListener('dblclick', (e) => { e.stopPropagation(); this._startEditing(div); });
        div.addEventListener('blur', () => this._stopEditing(div));
        div.addEventListener('keydown', (e) => { if (e.key === 'Escape') div.blur(); });

        return div;
    }

    _createToolbar(block) {
        const bar = document.createElement('div');
        bar.className = 'engine-floating-toolbar';

        const boldBtn = this._mkBtn('B', () => { const on = block.style.fontWeight === 'bold'; block.style.fontWeight = on ? 'normal' : 'bold'; boldBtn.classList.toggle('tb-active', !on); });
        boldBtn.style.fontWeight = 'bold';
        const italicBtn = this._mkBtn('<i>I</i>', () => { const on = block.style.fontStyle === 'italic'; block.style.fontStyle = on ? 'normal' : 'italic'; italicBtn.classList.toggle('tb-active', !on); });
        italicBtn.style.fontStyle = 'italic';
        const underBtn = this._mkBtn('<u>U</u>', () => { const on = block.style.textDecoration.includes('underline'); block.style.textDecoration = on ? block.style.textDecoration.replace('underline', '').trim() : (block.style.textDecoration + ' underline').trim(); underBtn.classList.toggle('tb-active', !on); });

        const d1 = this._divider();

        const szDown = this._mkBtn('A−', () => { block.style.fontSize = `${Math.max(4, parseFloat(block.style.fontSize) - 2)}px`; });
        szDown.style.fontSize = '11px';
        const szUp = this._mkBtn('A+', () => { block.style.fontSize = `${parseFloat(block.style.fontSize) + 2}px`; });
        szUp.style.fontSize = '11px';

        const d2 = this._divider();

        // Color picker
        const colorWrap = document.createElement('div');
        colorWrap.className = 'toolbar-color-wrap';
        colorWrap.title = 'Text color';
        const swatch = document.createElement('div');
        swatch.className = 'toolbar-color-swatch';
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#000000';
        colorInput.addEventListener('input', (e) => { block.style.color = e.target.value; swatch.style.background = e.target.value; });
        colorInput.addEventListener('mousedown', e => e.stopPropagation());
        colorWrap.append(swatch, colorInput);

        const d3 = this._divider();

        const delBtn = this._mkBtn('✕', () => { block.remove(); this._notifyChange(); });
        delBtn.style.color = '#ff6b6b';

        bar.append(boldBtn, italicBtn, underBtn, d1, szDown, szUp, d2, colorWrap, d3, delBtn);
        return bar;
    }

    _mkBtn(html, action) {
        const btn = document.createElement('button');
        btn.className = 'toolbar-btn';
        btn.innerHTML = html;
        btn.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
        btn.onclick = (e) => { e.stopPropagation(); action(); this._notifyChange(); };
        return btn;
    }

    _divider() {
        const d = document.createElement('div');
        d.className = 'toolbar-divider';
        return d;
    }

    _onMouseDown(e, block) {
        if (block.classList.contains('editing')) return;
        if (e.target.closest('.engine-floating-toolbar')) return;
        if (e.target.classList.contains('engine-resizer')) {
            e.stopPropagation();
            this._initResize(e, block);
            return;
        }
        e.stopPropagation();
        this._selectBlock(block);

        let startX = e.clientX, startY = e.clientY;
        let startL = parseFloat(block.style.left);
        let startT = parseFloat(block.style.top);
        const onMove = (me) => {
            block.style.left = `${startL + me.clientX - startX}px`;
            block.style.top = `${startT + me.clientY - startY}px`;
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            this._notifyChange();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    _selectBlock(block) {
        this.container.querySelectorAll('.engine-edit-block.selected').forEach(b => { if (b !== block) b.classList.remove('selected'); });
        block.classList.add('selected');
        this.activeBlock = block;
    }

    _deactivateAll() {
        this.container.querySelectorAll('.engine-edit-block').forEach(b => {
            b.classList.remove('selected', 'editing');
            b.contentEditable = 'false';
            b.style.color = 'transparent';
            b.style.background = 'transparent';
        });
        this.activeBlock = null;
    }

    _startEditing(block) {
        this._deactivateAll();
        block.classList.add('editing');
        block.contentEditable = 'true';
        block.style.color = '#000000';
        block.style.background = 'white';

        // Sync color picker swatch
        const picker = block.querySelector('input[type=color]');
        const swatch = block.querySelector('.toolbar-color-swatch');
        if (picker && swatch) { picker.value = '#000000'; swatch.style.background = '#000000'; }

        block.focus();
        // Put cursor at end
        const range = document.createRange();
        range.selectNodeContents(block);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        this.activeBlock = block;
    }

    _stopEditing(block) {
        if (!block.classList.contains('editing')) return;
        block.classList.remove('editing', 'selected');
        block.contentEditable = 'false';
        block.style.color = 'transparent';
        block.style.background = 'transparent';
        if (this.activeBlock === block) this.activeBlock = null;
        this._notifyChange();
    }

    _initResize(e, block) {
        const startX = e.clientX, startY = e.clientY;
        const startW = parseFloat(block.style.width);
        const startH = parseFloat(block.style.height);
        const onMove = (me) => {
            block.style.width = `${Math.max(20, startW + me.clientX - startX)}px`;
            block.style.height = `${Math.max(10, startH + me.clientY - startY)}px`;
            block.style.lineHeight = block.style.height;
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            this._notifyChange();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    _notifyChange() {
        const scale = window.currentScale || 1;
        const pdfH = this.backend?.pdfHeight || 842;
        const offsetX = this.backend?.pageOffsetX || 0;
        const event = new CustomEvent('engine:contentchange', {
            detail: {
                pageIndex: this.backend?.currentPageIndex ?? 0,
                blocks: Array.from(this.container.querySelectorAll('.engine-edit-block')).map(b => {
                    const cssLeft = parseFloat(b.style.left);
                    const cssTop = parseFloat(b.style.top);
                    const cssWidth = parseFloat(b.style.width);
                    const cssHeight = parseFloat(b.style.height);
                    const pdfX = (cssLeft / scale) + offsetX;
                    const pdfHeight = cssHeight / scale;
                    // cssTop/scale = DistFromTop.  pdfH - DistFromTop = TopEdgeY.
                    // pdfY = BottomEdgeY = TopEdgeY - pdfHeight.
                    const pdfY = (pdfH - (cssTop / scale)) - pdfHeight;

                    const textContent = b.innerText;
                    let tokens = null;
                    if (b.dataset.tokens) {
                        try {
                            const originalTokens = JSON.parse(b.dataset.tokens);
                            const origText = originalTokens.map(t => t.text).join('');

                            if (origText === textContent) {
                                tokens = originalTokens;
                            } else {
                                // Re-tokenize linearly based on new spacing
                                tokens = [];
                                const tpl = originalTokens[0] || { fontSize: parseFloat(b.style.fontSize) / scale, fontFamily: b.dataset.fontFamily, scaleX: 1, scaleY: 1 };
                                let curX = pdfX;
                                const stepW = (cssWidth / scale) / Math.max(1, textContent.length);

                                for (let i = 0; i < textContent.length; i++) {
                                    tokens.push({
                                        text: textContent[i],
                                        char: textContent[i], // Alias
                                        x: curX,
                                        y: pdfY,
                                        width: stepW,
                                        fontSize: tpl.fontSize,
                                        fontFamily: tpl.fontFamily,
                                        scaleX: tpl.scaleX,
                                        scaleY: tpl.scaleY,
                                        ascent: tpl.ascent,
                                        descent: tpl.descent,
                                        capHeight: tpl.capHeight,
                                        sourceBTStart: b.dataset.sourceBTStart ? parseInt(b.dataset.sourceBTStart) : undefined,
                                        sourceETEnd: b.dataset.sourceETEnd ? parseInt(b.dataset.sourceETEnd) : undefined
                                    });
                                    curX += stepW;
                                }
                            }
                        } catch (e) { }
                    }

                    return {
                        id: b.dataset.id,
                        x: pdfX, y: pdfY,
                        width: cssWidth / scale, height: pdfHeight,
                        fontSize: parseFloat(b.style.fontSize) / scale,
                        fontFamily: b.dataset.fontFamily || '',
                        fontWeight: b.style.fontWeight || 'normal',
                        fontStyle: b.style.fontStyle || 'normal',
                        color: (b.style.color && b.style.color !== 'transparent') ? b.style.color : '#000000',
                        text: textContent,
                        tokens: tokens,
                        sourceBTStart: b.dataset.sourceBTStart ? parseInt(b.dataset.sourceBTStart) : undefined,
                        sourceETEnd: b.dataset.sourceETEnd ? parseInt(b.dataset.sourceETEnd) : undefined
                    };
                })
            }
        });
        window.dispatchEvent(event);
    }
}
