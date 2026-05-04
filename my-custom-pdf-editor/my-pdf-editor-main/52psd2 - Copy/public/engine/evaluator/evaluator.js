import { TokenScanner } from './token_scanner.js';
import { LayoutEngine } from './layout_engine.js';

/**
 * @module OperatorEvaluator
 * @description The VM for PDF content streams. 
 * Converts binary PDF operators into high-level rendering instructions for the CanvasBackend.
 */
export class OperatorEvaluator {
    constructor(fontMap = {}, imageMap = {}) {
        this.fontMap = fontMap;
        this.imageMap = imageMap;
        this.currentFontObj = null;
    }

    getOperatorList(streamData) {
        const scanner = new TokenScanner(streamData);
        let token;
        const list = [];
        const textItems = [];

        // Global Graphics State
        let CTM = [1, 0, 0, 1, 0, 0];
        const stateStack = [];

        function multiplyMatrix(m1, m2) {
            return [
                m1[0] * m2[0] + m1[1] * m2[2],
                m1[0] * m2[1] + m1[1] * m2[3],
                m1[2] * m2[0] + m1[3] * m2[2],
                m1[2] * m2[1] + m1[3] * m2[3],
                m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
                m1[4] * m2[1] + m1[5] * m2[3] + m2[5]
            ];
        }

        // Text State
        let Tm = [1, 0, 0, 1, 0, 0];  // text matrix
        let Tlm = [1, 0, 0, 1, 0, 0]; // text line matrix
        // ... (rest of the vars)
        let Tfs = 12; // font size
        let Th = 1.0; // horizontal scaling
        let Ts = 0;   // text rise
        let Tc = 0;   // character spacing
        let Tw = 0;   // word spacing
        let Tl = 0;   // text leading
        let fontName = 'Arial';

        while ((token = scanner.nextToken()) !== null) {
            const { cmd, args } = token;

            try {
                switch (cmd) {
                    // Graphics State
                    case 'q':
                        list.push({ fn: 'save', args: [] });
                        stateStack.push({ CTM: CTM.slice() });
                        break;
                    case 'Q':
                        list.push({ fn: 'restore', args: [] });
                        if (stateStack.length > 0) {
                            const state = stateStack.pop();
                            CTM = state.CTM;
                        }
                        break;
                    case 'cm': {
                        const m = args.map(Number);
                        list.push({ fn: 'transform', args: m });
                        CTM = multiplyMatrix(m, CTM);
                        break;
                    }
                    case 'w': list.push({ fn: 'setLineWidth', args: [Number(args[0])] }); break;
                    case 'J': list.push({ fn: 'setLineCap', args: [Number(args[0])] }); break;
                    case 'j': list.push({ fn: 'setLineJoin', args: [Number(args[0])] }); break;
                    case 'M': list.push({ fn: 'setMiterLimit', args: [Number(args[0])] }); break;
                    case 'd': list.push({ fn: 'setLineDash', args: [args[0], Number(args[1])] }); break;
                    case 'ri': break; // rendering intent — ignore
                    case 'i': break;  // flatness — ignore

                    // Color State (pdf.js: src/core/colorspace.js)
                    case 'g': list.push({ fn: 'setFillColor', args: [Math.round(args[0] * 255), Math.round(args[0] * 255), Math.round(args[0] * 255)] }); break;
                    case 'G': list.push({ fn: 'setStrokeColor', args: [Math.round(args[0] * 255), Math.round(args[0] * 255), Math.round(args[0] * 255)] }); break;
                    case 'rg': list.push({ fn: 'setFillColor', args: args.map(v => Math.round(v * 255)) }); break;
                    case 'RG': list.push({ fn: 'setStrokeColor', args: args.map(v => Math.round(v * 255)) }); break;
                    case 'k': {
                        const [c, m, y, k] = args.map(Number);
                        const r = Math.round(255 * (1 - c) * (1 - k)), g = Math.round(255 * (1 - m) * (1 - k)), b = Math.round(255 * (1 - y) * (1 - k));
                        list.push({ fn: 'setFillColor', args: [r, g, b] }); break;
                    }
                    case 'K': {
                        const [c, m, y, k] = args.map(Number);
                        const r = Math.round(255 * (1 - c) * (1 - k)), g = Math.round(255 * (1 - m) * (1 - k)), b = Math.round(255 * (1 - y) * (1 - k));
                        list.push({ fn: 'setStrokeColor', args: [r, g, b] }); break;
                    }
                    // Colorspace operators — SC/sc/SCN/scn apply color in current colorspace
                    // For now: treat as RGB/gray, same as rg/g (DeviceRGB/DeviceGray default)
                    case 'CS': case 'cs': break; // Set colorspace name — stored but not yet processed
                    case 'SC':
                    case 'SCN': {
                        if (args.length === 1) list.push({ fn: 'setStrokeColor', args: [Math.round(args[0] * 255), Math.round(args[0] * 255), Math.round(args[0] * 255)] });
                        else if (args.length >= 3) list.push({ fn: 'setStrokeColor', args: [Math.round(args[0] * 255), Math.round(args[1] * 255), Math.round(args[2] * 255)] });
                        break;
                    }
                    case 'sc':
                    case 'scn': {
                        if (args.length === 1) list.push({ fn: 'setFillColor', args: [Math.round(args[0] * 255), Math.round(args[0] * 255), Math.round(args[0] * 255)] });
                        else if (args.length >= 3) list.push({ fn: 'setFillColor', args: [Math.round(args[0] * 255), Math.round(args[1] * 255), Math.round(args[2] * 255)] });
                        break;
                    }

                    // Path Construction & Painting
                    case 're': list.push({ fn: 'beginPath', args: [] }, { fn: 'rect', args: args.map(Number) }); break;
                    case 'f':
                    case 'f*':
                    case 'F': list.push({ fn: 'fill', args: [cmd === 'f*' ? 'evenodd' : 'nonzero'] }); break;
                    case 'S': list.push({ fn: 'stroke', args: [] }); break;
                    case 's': list.push({ fn: 'closePath', args: [] }, { fn: 'stroke', args: [] }); break;
                    case 'm': list.push({ fn: 'beginPath', args: [] }, { fn: 'moveTo', args: [Number(args[0]), Number(args[1])] }); break;
                    case 'l': list.push({ fn: 'lineTo', args: [Number(args[0]), Number(args[1])] }); break;
                    case 'h': list.push({ fn: 'closePath', args: [] }); break;
                    // Bezier curves (c=full, v=implicit first ctrl, y=implicit second ctrl)
                    case 'c': list.push({ fn: 'bezierCurveTo', args: args.map(Number) }); break;
                    case 'v': {
                        // first control point = current point — we approximate by repeating last moveTo impl in canvas
                        const [cx2, cy2, x3, y3] = args.map(Number);
                        list.push({ fn: 'bezierCurveV', args: [cx2, cy2, x3, y3] }); break;
                    }
                    case 'y': {
                        const [cx1, cy1, x3, y3] = args.map(Number);
                        list.push({ fn: 'bezierCurveY', args: [cx1, cy1, x3, y3] }); break;
                    }
                    case 'B': list.push({ fn: 'fill', args: ['nonzero'] }, { fn: 'stroke', args: [] }); break;
                    case 'B*': list.push({ fn: 'fill', args: ['evenodd'] }, { fn: 'stroke', args: [] }); break;
                    case 'b': list.push({ fn: 'closePath', args: [] }, { fn: 'fill', args: ['nonzero'] }, { fn: 'stroke', args: [] }); break;
                    case 'b*': list.push({ fn: 'closePath', args: [] }, { fn: 'fill', args: ['evenodd'] }, { fn: 'stroke', args: [] }); break;
                    case 'n': list.push({ fn: 'endPath', args: [] }); break;
                    // Clipping paths
                    case 'W': list.push({ fn: 'clip', args: ['nonzero'] }); break;
                    case 'W*': list.push({ fn: 'clip', args: ['evenodd'] }); break;

                    // Object Execution
                    // Form XObjects & Images
                    case 'Do': {
                        const name = String(args[0]?.name ?? args[0] ?? '').replace(/^\//, '');
                        const xobj = this.imageMap && this.imageMap[name];
                        // Check if it's a Form XObject (has operatorList property)
                        if (xobj && xobj.operatorList) {
                            // Inline the Form XObject's operator list
                            list.push({ fn: 'save', args: [] });
                            if (xobj.matrix && Array.isArray(xobj.matrix) && xobj.matrix.length === 6) {
                                list.push({ fn: 'transform', args: xobj.matrix });
                            }
                            list.push(...xobj.operatorList);
                            list.push({ fn: 'restore', args: [] });
                        } else {
                            list.push({ fn: 'drawImage', args: [name] });
                        }
                        break;
                    }

                    // Inline Images (BI/ID/EI) — parsed by TokenScanner into { params, bytes }
                    case 'BI': {
                        const [params, imgBytes] = args;
                        if (imgBytes && imgBytes.length > 0) {
                            list.push({ fn: 'drawInlineImage', args: [params || {}, imgBytes] });
                        }
                        break;
                    }

                    // Marked Content — ignore (structure only, no visual output)
                    case 'BMC': case 'BDC': case 'EMC': case 'MP': case 'DP':
                    case 'BX': case 'EX':
                        break;

                    // Shading — produce placeholder (complex, needs pattern.js port)
                    case 'sh': {
                        const name = String(args[0]?.name ?? args[0] ?? "").replace(/^\//, '');
                        list.push({ fn: 'sh', args: [name] });
                        break;
                    }

                    // Text State Operators
                    case 'BT': 
                        Tm = [1, 0, 0, 1, 0, 0]; Tlm = [1, 0, 0, 1, 0, 0]; 
                        this.currentBTStart = token.startIndex;
                        break;
                    case 'ET': 
                        this.currentETEnd = token.endIndex;
                        break;
                    case 'Tc': Tc = Number(args[0]); break;
                    case 'Tw': Tw = Number(args[0]); break;
                    case 'Tz': Th = Number(args[0]) / 100; break;
                    case 'TL': Tl = Number(args[0]); break;
                    case 'Ts': Ts = Number(args[0]); break;
                    case 'Tr': /* Text Rendering Mode */ break; // Optional placeholder for stroke/fill modes
                    case 'Tf':
                        fontName = String(args[0]?.name ?? args[0] ?? "").replace(/^\//, '');
                        this.currentFontObj = this.fontMap[fontName] || { defaultWidth: 1000, glyphs: {}, toUnicode: {} };
                        Tfs = Number(args[1]) || 12;
                        break;

                    case 'Tm':
                        if (args.length === 6) {
                            Tm = args.map(Number);
                            Tlm = Tm.slice();
                        }
                        break;
                    case 'Td':
                        if (args.length === 2) {
                            const tx = Number(args[0]), ty = Number(args[1]);
                            Tlm[4] += tx * Tlm[0] + ty * Tlm[2];
                            Tlm[5] += tx * Tlm[1] + ty * Tlm[3];
                            Tm = Tlm.slice();
                        }
                        break;
                    case 'TD':
                        if (args.length === 2) {
                            Tl = -Number(args[1]);
                            const tx = Number(args[0]), ty = Number(args[1]);
                            Tlm[4] += tx * Tlm[0] + ty * Tlm[2];
                            Tlm[5] += tx * Tlm[1] + ty * Tlm[3];
                            Tm = Tlm.slice();
                        }
                        break;
                    case 'T*':
                        Tlm[4] += 0 * Tlm[0] + (-Tl) * Tlm[2];
                        Tlm[5] += 0 * Tlm[1] + (-Tl) * Tlm[3];
                        Tm = Tlm.slice();
                        break;

                    // Text Rendering
                    case 'Tj':
                    case 'TJ':
                    case "'":
                    case '"': {
                        if (cmd === "'") {
                            Tlm[4] += 0 * Tlm[0] + (-Tl) * Tlm[2]; Tlm[5] += 0 * Tlm[1] + (-Tl) * Tlm[3];
                            Tm = Tlm.slice();
                        } else if (cmd === '"') {
                            Tw = Number(args[0]); Tc = Number(args[1]);
                            Tlm[4] += 0 * Tlm[0] + (-Tl) * Tlm[2]; Tlm[5] += 0 * Tlm[1] + (-Tl) * Tlm[3];
                            Tm = Tlm.slice(); args = args.slice(2);
                        }
                        const fo = this.currentFontObj || { defaultWidth: 1000, glyphs: {}, toUnicode: {} };
                        const emit = (str) => {
                            let i = 0;
                            while (i < str.length) {
                                let cid;
                                let charCode;
                                if (fo.isType0 && i + 1 < str.length) {
                                    // 16-bit CID extraction for Asian/Type0 fonts
                                    cid = (str.charCodeAt(i) << 8) | str.charCodeAt(i + 1);
                                    charCode = cid;
                                    i += 2;
                                } else {
                                    cid = str.charCodeAt(i);
                                    charCode = cid;
                                    i++;
                                }

                                // 1. Try ToUnicode CMap (Highest Priority for Copy/Paste)
                                let glyph = null;
                                if (fo.toUnicode && fo.toUnicode[cid]) {
                                    glyph = fo.toUnicode[cid];
                                }
                                // 2. Try Standard Encoding array
                                else if (fo.encoding && fo.encoding[cid]) {
                                    glyph = String.fromCodePoint(fo.encoding[cid]);
                                }
                                // 3. Fallback to ASCII/WinAnsi
                                else if (cid >= 0x20 && cid <= 0xFF) {
                                    glyph = String.fromCharCode(cid);
                                }
                                // 4. Unknown character block
                                else {
                                    glyph = '□';
                                }

                                // Fetch real width from embedded PDF widths array
                                let w = fo.defaultWidth || 1000;
                                if (fo.glyphs && fo.glyphs[cid] !== undefined) {
                                    w = fo.glyphs[cid]; // Pre-parsed CID/Type0 widths
                                } else if (fo.widths && fo.widths.length > 0) {
                                    const index = cid - (fo.firstChar || 0);
                                    if (index >= 0 && index < fo.widths.length) {
                                        w = fo.widths[index];
                                    }
                                }
                                // Calculate Trm glyph matrix: [Tfs*Th 0 0 Tfs 0 Ts] * Tm
                                const a = Tfs * Th * Tm[0];
                                const b = Tfs * Th * Tm[1];
                                const c = Tfs * Tm[2];
                                const d = Tfs * Tm[3];
                                const e = Ts * Tm[2] + Tm[4];
                                const f = Ts * Tm[3] + Tm[5];

                                // Calculate individual horizontal advance in text space
                                let tx = ((w / 1000) * Tfs) + Tc;
                                if (glyph === ' ' || cid === 32) tx += Tw;
                                tx *= Th;

                                // Calculate absolute coordinates using the global CTM
                                const absX = e * CTM[0] + f * CTM[2] + CTM[4];
                                const absY = e * CTM[1] + f * CTM[3] + CTM[5];

                                // The scale from the CTM applied to the font metrics
                                const ctmScaleX = Math.sqrt(CTM[0] * CTM[0] + CTM[1] * CTM[1]);
                                const ctmScaleY = Math.sqrt(CTM[2] * CTM[2] + CTM[3] * CTM[3]);

                                list.push({ fn: 'fillText', args: [glyph, a, b, c, d, e, f, fontName] });
                                textItems.push({
                                    text: glyph,
                                    x: absX,
                                    y: absY,
                                    fontSize: Tfs * ctmScaleY,
                                    fontFamily: fontName,
                                    scaleX: Tm[0] * Th * ctmScaleX,
                                    scaleY: Tm[3] * ctmScaleY,
                                    // True visual width in absolute page coordinates
                                    width: Math.abs(tx * Tm[0]) * ctmScaleX,
                                    ascent: fo.ascent || 800,
                                    descent: fo.descent || -200,
                                    capHeight: fo.capHeight || 700,
                                    // Phase 5 Stream Reconstruction Bindings
                                    sourceBTStart: this.currentBTStart,
                                    sourceETEnd: this.currentETEnd
                                });

                                // Advance Tm
                                Tm[4] += tx * Tm[0];
                                Tm[5] += tx * Tm[1];
                            }
                        };

                        if (cmd === 'TJ') {
                            const kerningGroup = [];
                            for (const tok of args) {
                                if (typeof tok === 'string') {
                                    emit(tok);
                                    kerningGroup.push(tok);
                                }
                                else if (typeof tok === 'number') {
                                    // Kerning is in thousandths of a unit
                                    const tx = -(tok / 1000) * Tfs * Th;
                                    Tm[4] += tx * Tm[0];
                                    Tm[5] += tx * Tm[1];
                                    kerningGroup.push(tok);
                                }
                            }
                            // Attach the source TJ kerning array to the last emitted characters
                            // so the LayoutEngine can bind them securely instead of guessing gaps.
                            if (textItems.length > 0 && kerningGroup.length > 0) {
                                textItems[textItems.length - 1].kerningArray = kerningGroup;
                            }
                        } else {
                            emit(args[0] || '');
                        }
                        break;
                    }

                    // Graphics State Expansion — matches pdf.js ExtGState handling
                    // Reference: pdf.js src/core/evaluator.js setGState()
                    case 'gs': {
                        const name = String(args[0]?.name ?? args[0] ?? "").replace(/^\//, '');
                        if (this.imageMap && this.imageMap[name]) {
                            const gs = this.imageMap[name];
                            // Opacity
                            if (gs.ca !== undefined) list.push({ fn: 'setOpacity', args: [gs.ca] });
                            if (gs.CA !== undefined) list.push({ fn: 'setOpacity', args: [gs.CA] });
                            // SMask
                            if (gs.SMask !== undefined) list.push({ fn: 'setSMask', args: [gs.SMask] });
                            // Blend Mode (BM) — normalize PDF names to HTML5 compositeOperation
                            if (gs.BM !== undefined) {
                                const bmMap = {
                                    'Normal': 'source-over', 'Compatible': 'source-over',
                                    'Multiply': 'multiply', 'Screen': 'screen',
                                    'Overlay': 'overlay', 'Darken': 'darken', 'Lighten': 'lighten',
                                    'ColorDodge': 'color-dodge', 'ColorBurn': 'color-burn',
                                    'HardLight': 'hard-light', 'SoftLight': 'soft-light',
                                    'Difference': 'difference', 'Exclusion': 'exclusion',
                                    'Hue': 'hue', 'Saturation': 'saturation',
                                    'Color': 'color', 'Luminosity': 'luminosity',
                                };
                                const bmName = gs.BM?.name || gs.BM;
                                const htmlBm = bmMap[bmName] || 'source-over';
                                list.push({ fn: 'setBlendMode', args: [htmlBm] });
                            }
                        }
                        break;
                    }
                    case 'ca':
                    case 'CA': {
                        list.push({ fn: 'setOpacity', args: [Number(args[0])] });
                        break;
                    }
                }
            } catch (err) { }
        }

        return { operatorList: list, textItems: textItems };
    }
}
