
import { OperatorEvaluator } from '../../evaluator/evaluator.js';
import { FontEngine } from '../../graphics/fonts/font_engine.js';

/**
 * @module PageInterpreter
 * @description Orchestrates the rendering of a single PDF page.
 * Resolves all indirect references in the resource chain, normalizes PDF data types
 * to plain JS, evaluates content stream operators, and paints to the backend.
 */
export class PageInterpreter {
    constructor(page, backend, editorState = null, pageIndex = 0) {
        this.page = page;
        this.backend = backend;
        this.editorState = editorState;
        this.pageIndex = pageIndex;
    }

    /**
     * Converts any PDF object to a plain JS value.
     * - PDFNumber  → number
     * - PDFName    → string
     * - PDFArray   → plain JS array (recursive)
     * - plain JS   → unchanged
     */
    _toJS(val) {
        if (val === null || val === undefined) return val;
        if (typeof val.value === 'number') return val.value;        // PDFNumber
        if (typeof val.name === 'string') return val.name;          // PDFName
        if (Array.isArray(val.elements)) return val.elements.map(e => this._toJS(e)); // PDFArray
        if (typeof val === 'number' || typeof val === 'string') return val;
        if (Array.isArray(val)) return val.map(e => this._toJS(e));
        return val;
    }

    /**
     * Resolves a value through the document xref if it's an indirect reference.
     */
    async _resolve(val) {
        if (!val || !this.page.doc) return val;
        return this.page.doc._resolve(val);
    }

    /**
     * Executes the content stream of the page.
     * @param {Uint8Array} contentBytes - The raw bytes of the content stream.
     */
    async execute(contentBytes) {
        if (!contentBytes || contentBytes.length === 0) return;

        try {
            // 1. Resolve Resources  (Resources itself may be a PDFRef)
            const resourcesRaw = await this.page.loadResources();
            const resources = (resourcesRaw && typeof resourcesRaw._resolve === 'function')
                ? resourcesRaw
                : resourcesRaw;

            // 2. Resolve Font and XObject sub-dictionaries (also commonly PDFRefs)
            const fontDictRaw = resources && typeof resources.get === 'function' ? resources.get('Font') : null;
            const xobjDictRaw = resources && typeof resources.get === 'function' ? resources.get('XObject') : null;
            const fontDict = await this._resolve(fontDictRaw);
            const xobjDict = await this._resolve(xobjDictRaw);

            const fontMap = await this._buildFontMap(fontDict);
            const imageMap = await this._buildXObjectMap(xobjDict, fontMap);

            // 3. Evaluate Operators
            const evaluator = new OperatorEvaluator(fontMap, imageMap);
            const { operatorList, textItems } = evaluator.getOperatorList(contentBytes);

            // 4. Normalize MediaBox and Rotate to plain JS  (CRITICAL: PDFArray is NOT a JS array)
            const mediaBoxRaw = this.page.dict.get('MediaBox');
            const mediaBox = this._toJS(mediaBoxRaw) || [0, 0, 612, 792];
            const rotateRaw = this.page.dict.get('Rotate');
            const rotate = this._toJS(rotateRaw) || 0;

            // 5. Hand off to backend
            this.backend.imageMap = imageMap;
            this.backend.fontMap = fontMap;
            await this.backend.draw(operatorList, this.backend.scale || 1.0, mediaBox, rotate);

            // 6. Text layer
            if (this.backend.textLayer) {
                this._renderTextLayer(textItems);
            }
        } catch (err) {
            console.error(`[PageInterpreter] Page ${this.pageIndex} render error:`, err);
        }
    }

    async _buildFontMap(fontDict) {
        const map = {};
        if (!fontDict || typeof fontDict.getKeys !== 'function') return map;

        const engine = new FontEngine();

        window.pdfFontMap = window.pdfFontMap || {};
        for (const key of fontDict.getKeys()) {
            try {
                const fontObj = await this._resolve(fontDict.get(key));
                if (!fontObj || typeof fontObj.get !== 'function') continue;

                const fontData = await engine.parseFont(fontObj, async (ref) => await this._resolve(ref));
                if (fontData) {
                    map[key] = fontData;
                    // Store for export: Mapping "PDF_Arial_abcde" -> "/F1"
                    const cleanFamily = fontData.name.replace(/"/g, '');
                    window.pdfFontMap[cleanFamily] = `/${key}`;
                }
            } catch (err) { console.warn(`[Engine] Failed to parse font ${key}:`, err); }
        }
        return map;
    }


    async _buildXObjectMap(xobjDict, pageFontMap) {
        const map = {};
        if (!xobjDict || typeof xobjDict.getKeys !== 'function') return map;

        for (const key of xobjDict.getKeys()) {
            try {
                const xobj = await this._resolve(xobjDict.get(key));
                if (!xobj) continue;

                const dict = xobj.dict || xobj;
                if (!dict || typeof dict.get !== 'function') continue;

                const subtype = this._toJS(dict.get('Subtype'));
                if (subtype === 'Image') {
                    let img = null;
                    if (xobj && typeof xobj.decode === 'function') {
                        const streamBytes = await xobj.decode();

                        const filterVal = this._toJS(dict.get('Filter'));
                        let isJpeg = false;
                        let mimeType = 'image/jpeg';

                        if (filterVal) {
                            if (Array.isArray(filterVal)) {
                                if (filterVal.includes('DCTDecode')) { isJpeg = true; mimeType = 'image/jpeg'; }
                                if (filterVal.includes('JPXDecode')) { isJpeg = true; mimeType = 'image/jp2'; }
                            } else {
                                if (filterVal === 'DCTDecode') { isJpeg = true; mimeType = 'image/jpeg'; }
                                if (filterVal === 'JPXDecode') { isJpeg = true; mimeType = 'image/jp2'; }
                            }
                        }

                        if (isJpeg && streamBytes && streamBytes.length > 0) {
                            const blob = new Blob([streamBytes], { type: mimeType });
                            const url = URL.createObjectURL(blob);
                            img = await new Promise((resolve) => {
                                const i = new Image();
                                i.onload = () => resolve(i);
                                i.onerror = () => {
                                    console.warn(`[Engine] Failed to load native image for XObject ${key}`);
                                    resolve(null);
                                };
                                i.src = url;
                            });
                        } else if (streamBytes && streamBytes.length > 0) {
                            // Raw Bitmap processing (FlateDecode, ASCIIHexDecode, etc.)
                            try {
                                const width = this._toJS(dict.get('Width')) || 1;
                                const height = this._toJS(dict.get('Height')) || 1;
                                let colorSpace = this._toJS(dict.get('ColorSpace'));
                                if (Array.isArray(colorSpace)) colorSpace = colorSpace[0];

                                const components = (colorSpace === 'DeviceRGB') ? 3 : (colorSpace === 'DeviceCMYK') ? 4 : 1;

                                const canvas = document.createElement('canvas');
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                const imgData = ctx.createImageData(width, height);
                                const out = imgData.data;

                                let srcIndex = 0;
                                let destIndex = 0;

                                for (let y = 0; y < height; y++) {
                                    for (let x = 0; x < width; x++) {
                                        if (srcIndex >= streamBytes.length) break;

                                        if (components === 1) { // Grayscale
                                            const gray = streamBytes[srcIndex++];
                                            out[destIndex++] = gray;
                                            out[destIndex++] = gray;
                                            out[destIndex++] = gray;
                                            out[destIndex++] = 255;
                                        } else if (components === 3) { // RGB
                                            out[destIndex++] = streamBytes[srcIndex++];
                                            out[destIndex++] = streamBytes[srcIndex++];
                                            out[destIndex++] = streamBytes[srcIndex++];
                                            out[destIndex++] = 255;
                                        } else if (components === 4) { // CMYK (Inverted)
                                            const c = streamBytes[srcIndex++];
                                            const m = streamBytes[srcIndex++];
                                            const yy = streamBytes[srcIndex++];
                                            const k = streamBytes[srcIndex++];

                                            // Crude CMYK to RGB (often PDFs invert the CMYK byte)
                                            out[destIndex++] = 255 - Math.min(255, c + k);
                                            out[destIndex++] = 255 - Math.min(255, m + k);
                                            out[destIndex++] = 255 - Math.min(255, yy + k);
                                            out[destIndex++] = 255;
                                        }
                                    }
                                }

                                ctx.putImageData(imgData, 0, 0);
                                const dataUrl = canvas.toDataURL('image/png');

                                img = await new Promise((resolve) => {
                                    const i = new Image();
                                    i.onload = () => resolve(i);
                                    i.onerror = () => resolve(null);
                                    i.src = dataUrl;
                                });
                            } catch (e) {
                                console.warn(`[Engine] Failed to decode raw bitmap ${key}:`, e);
                            }
                        }
                    }
                    map[key] = { type: 'image', dict, img };
                } else if (subtype === 'Form') {
                    // Phase 2 — Form XObject rendering
                    const streamBytes = await xobj.decode();

                    // Form Resources (Inherit from page if missing)
                    let formFontMap = pageFontMap;
                    let formImageMap = map;
                    const resRaw = dict.get('Resources');
                    if (resRaw) {
                        const res = await this._resolve(resRaw);
                        if (res && typeof res.get === 'function') {
                            const fDict = await this._resolve(res.get('Font'));
                            if (fDict) {
                                formFontMap = Object.assign({}, pageFontMap, await this._buildFontMap(fDict));
                            }
                            // Simplified XObject recursion to prevent deep infinite loops
                            const xDict = await this._resolve(res.get('XObject'));
                            if (xDict) {
                                formImageMap = Object.assign({}, map, await this._buildXObjectMap(xDict, formFontMap));
                            }
                        }
                    }

                    // Form Matrix
                    const matrixRaw = dict.get('Matrix');
                    const matrix = matrixRaw ? this._toJS(matrixRaw) : [1, 0, 0, 1, 0, 0];

                    const evaluator = new OperatorEvaluator(formFontMap, formImageMap);
                    const { operatorList } = evaluator.getOperatorList(streamBytes);

                    map[key] = { type: 'form', matrix, operatorList };
                }
            } catch (err) {
                console.warn(`[Engine] error parsing XObject ${key}:`, err);
            }
        }
        return map;
    }

    async _renderTextLayer(textItems) {
        if (!this.backend.textLayer || !textItems || textItems.length === 0) return;

        // CANVA-LEVEL: Check if we should use the Interactive Editor
        // We use dynamic import to avoid background worker crashes (Worker has no DOM)
        try {
            const { InteractiveEditor } = await import('../../tools/interactive_editor.js?v=5');
            const editor = new InteractiveEditor(this.backend.textLayer, this.backend);
            editor.setup(textItems);
        } catch (e) {
            // Fallback to static selection layer if DOM/InteractiveEditor is unavailable
            console.warn('[PageInterpreter] InteractiveEditor load failed, falling back to static layer.', e);
            this._renderStaticTextLayer(textItems);
        }
    }

    _renderStaticTextLayer(textItems) {
        const container = this.backend.textLayer;
        container.innerHTML = '';
        container.style.pointerEvents = 'auto';

        for (const item of textItems) {
            const span = document.createElement('span');
            span.textContent = item.text;
            span.style.position = 'absolute';
            span.style.left = `${item.x}px`;
            span.style.top = `${item.y}px`;
            span.style.fontSize = `${item.fontSize}px`;
            span.style.fontFamily = item.fontFamily || 'sans-serif';
            span.style.color = 'transparent';
            span.style.cursor = 'text';
            span.style.whiteSpace = 'pre';
            span.style.userSelect = 'text';

            if (item.width) {
                span.style.width = `${item.width}px`;
            }

            container.appendChild(span);
        }
    }
}
