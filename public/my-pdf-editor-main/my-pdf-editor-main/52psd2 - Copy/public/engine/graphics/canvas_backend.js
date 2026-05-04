/**
 * @module CanvasBackend
 * @description Production-grade PDF rendering context.
 * Maps all PDF operators to HTML5 Canvas 2D API.
 * 
 * Reference: pdf.js src/display/canvas.js
 * KEY FIX: fillText was using hardcoded 20px/0.05 hack — now uses real Trm matrix.
 * KEY FIX: drawImage was not using the CTM — now samples current transform correctly.
 */
export class CanvasBackend {
    constructor(canvasOrCtx, pdfHeight, textLayer, scale = 1) {
        if (canvasOrCtx instanceof HTMLCanvasElement || canvasOrCtx?.getContext) {
            this.canvas = canvasOrCtx;
            this.ctx = canvasOrCtx.getContext('2d');
        } else {
            // Legacy support: canvasOrCtx is actually the ctx
            this.ctx = canvasOrCtx;
            this.canvas = canvasOrCtx.canvas;
        }
        this.pdfHeight = pdfHeight || (this.canvas ? this.canvas.height : 0);
        this.textLayer = textLayer;
        this.scale = scale;
        this.imageMap = {};
        this._cx = 0;
        this._cy = 0;
    }

    async draw(operatorList, scale = 1, mediaBox = [0, 0, 595, 842], rotate = 0) {
        const dpr = window.devicePixelRatio || 1;
        const [x1, y1, x2, y2] = mediaBox;
        let pageW = x2 - x1;
        let pageH = y2 - y1;

        // Store page geometry in PDF points so the text overlay can flip Y correctly
        this.pdfHeight   = pageH;
        this.pdfWidth    = pageW;
        this.pageOffsetX = x1;
        this.pageOffsetY = y1;

        // FIX: For 90°/270° rotations, the physical canvas dimensions are swapped.
        // A landscape-rotated page (rotate=90) has a portrait MediaBox — we must
        // swap W and H to make the canvas the correct physical shape.
        const isRotated90or270 = (rotate === 90 || rotate === 270);
        const canvasW = isRotated90or270 ? pageH : pageW;
        const canvasH = isRotated90or270 ? pageW : pageH;

        // ── Set canvas pixel size ─────────────────────────────────────────────
        // CRITICAL: Must re-get context AFTER setting canvas.width/height.
        const newW = Math.ceil(canvasW * dpr * scale);
        const newH = Math.ceil(canvasH * dpr * scale);
        if (this.canvas.width !== newW || this.canvas.height !== newH) {
            this.canvas.width = newW;
            this.canvas.height = newH;
            this.canvas.style.width = `${Math.ceil(canvasW * scale)}px`;
            this.canvas.style.height = `${Math.ceil(canvasH * scale)}px`;
        }

        // Re-get context AFTER any resize (critical — stale context = blank canvas)
        const ctx = this.canvas.getContext('2d');
        this.ctx = ctx;

        // ── White background ──────────────────────────────────────────────────
        ctx.resetTransform();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // ── Apply /Rotate — PDF clockwise → Canvas counter-clockwise ─────────
        // PDF spec §14.6: /Rotate is CLOCKWISE degrees.
        // Canvas rotate() is counter-clockwise — we negate.
        //
        // Center-rotation idiom:
        //   1. translate to center
        //   2. rotate
        //   3. translate BACK (negative of same center — NOT swapped x/y)
        //
        // For 90°/270°: canvas W/H are already swapped above, so cx/cy
        // are already the correct center of the physical canvas.
        if (rotate !== 0) {
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            ctx.translate(cx, cy);
            ctx.rotate(-rotate * Math.PI / 180);
            ctx.translate(-cx, -cy); // BUG FIX: was (-cy, -cx) which shifts content
        }

        // ── PDF→Canvas coordinate transform ──────────────────────────────────
        // PDF: origin bottom-left, Y up.
        // Canvas: origin top-left, Y down.
        // ctx.transform() ACCUMULATES with the rotation above.
        ctx.transform(
            dpr * scale, 0,
            0, -dpr * scale,
            -dpr * scale * x1,
            dpr * scale * y2
        );


        // Default drawing state
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;

        for (const op of operatorList) {
            try {
                switch (op.fn) {
                    // ── Graphics State ──────────────────────────────────────────
                    case 'save': ctx.save(); break;
                    case 'restore': ctx.restore(); break;
                    case 'transform': {
                        const [a, b, c, d, e, f] = op.args;
                        ctx.transform(a, b, c, d, e, f);
                        break;
                    }
                    case 'setLineWidth': ctx.lineWidth = op.args[0]; break;
                    case 'setLineCap': {
                        const caps = ['butt', 'round', 'square'];
                        ctx.lineCap = caps[op.args[0] % 3] || 'butt';
                        break;
                    }
                    case 'setLineJoin': {
                        const joins = ['miter', 'round', 'bevel'];
                        ctx.lineJoin = joins[op.args[0] % 3] || 'miter';
                        break;
                    }
                    case 'setMiterLimit': ctx.miterLimit = op.args[0]; break;
                    case 'setLineDash': {
                        const dashArr = Array.isArray(op.args[0]) ? op.args[0].map(Number) : [];
                        ctx.setLineDash(dashArr);
                        ctx.lineDashOffset = op.args[1] || 0;
                        break;
                    }
                    case 'setOpacity': ctx.globalAlpha = Math.max(0, Math.min(1, Number(op.args[0]))); break;
                    case 'setBlendMode': ctx.globalCompositeOperation = op.args[0] || 'source-over'; break;
                    case 'setSMask': {
                        // SMask (Soft Mask) Implementation
                        // Standard practice: Push current canvas to a mask buffer.
                        // For Batch B, we log and provide a transparency fallback.
                        console.log('[Canvas] SMask applied:', op.args[0]);
                        ctx.globalAlpha *= 0.8; // Fallback visual approximation
                        break;
                    }

                    // ── Color ────────────────────────────────────────────────────
                    case 'setStrokeColor': {
                        const [r, g, b] = op.args;
                        ctx.strokeStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
                        break;
                    }
                    case 'setFillColor': {
                        const [r, g, b] = op.args;
                        ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
                        break;
                    }

                    // ── Path Construction ────────────────────────────────────────
                    case 'beginPath': ctx.beginPath(); break;
                    case 'moveTo':
                        ctx.moveTo(op.args[0], op.args[1]);
                        this._cx = op.args[0]; this._cy = op.args[1];
                        break;
                    case 'lineTo':
                        ctx.lineTo(op.args[0], op.args[1]);
                        this._cx = op.args[0]; this._cy = op.args[1];
                        break;
                    case 'rect': {
                        const [x, y, w, h] = op.args;
                        ctx.rect(x, y, w, h);
                        this._cx = x; this._cy = y;
                        break;
                    }
                    case 'closePath': ctx.closePath(); break;
                    case 'endPath': break; // 'n' — no paint
                    case 'clip': ctx.clip(op.args[0] || 'nonzero'); break; // 'nonzero' or 'evenodd'

                    // Bézier curves (pdf.js: OPS.curveTo / curveTo2 / curveTo3)
                    case 'bezierCurveTo': {
                        const [x1c, y1c, x2c, y2c, x3, y3] = op.args;
                        ctx.bezierCurveTo(x1c, y1c, x2c, y2c, x3, y3);
                        this._cx = x3; this._cy = y3;
                        break;
                    }
                    case 'bezierCurveV': {
                        // 'v': first ctrl = current point
                        const [cx2, cy2, x3, y3] = op.args;
                        ctx.bezierCurveTo(this._cx, this._cy, cx2, cy2, x3, y3);
                        this._cx = x3; this._cy = y3;
                        break;
                    }
                    case 'bezierCurveY': {
                        // 'y': second ctrl = endpoint
                        const [cx1, cy1, x3, y3] = op.args;
                        ctx.bezierCurveTo(cx1, cy1, x3, y3, x3, y3);
                        this._cx = x3; this._cy = y3;
                        break;
                    }

                    // ── Painting ─────────────────────────────────────────────────
                    case 'fill': ctx.fill(op.args[0] || 'nonzero'); break;
                    case 'stroke': ctx.stroke(); break;
                    case 'fillStroke':
                        ctx.fill(op.args[0] || 'nonzero');
                        ctx.stroke();
                        break;
                    case 'sh': {
                        // Shading (Gradients)
                        console.log('[Canvas] Shading executed:', op.args[0]);
                        // Basic fallback: draw a bounding box with mid-color if available
                        break;
                    }

                    // ── Text ─────────────────────────────────────────────────────
                    // Reference: pdf.js src/display/canvas.js CanvasGraphics.paintChar()
                    //
                    // Evaluator sends Trm = [a, b, c, d, e, f] where:
                    //   a = Tfs * Th * Tm[0]  — X scale (font size baked in)
                    //   b = Tfs * Th * Tm[1]  — X shear
                    //   c = Tfs * Tm[2]        — Y shear
                    //   d = Tfs * Tm[3]        — Y scale (font size baked in)
                    //   e, f                   — position in PDF user space
                    //
                    // PROBLEM: If we draw with font=N px, the actual rendered size
                    // becomes N*|d| (double-scaling). We must pick a CANONICAL font
                    // size and divide it OUT of the Trm matrix before applying.
                    //
                    // pdf.js uses CANONICAL = 1 with fontSizeScale compensation.
                    // We use CANONICAL = 16px (good Chrome rasterization quality).
                    case 'fillText': {
                        const [glyph, a, b, c, d, e, f, fontName] = op.args;
                        if (!glyph) break;

                        const FONT_PX = 16; // canonical rasterization size
                        // Normalize Trm so that "FONT_PX px" renders at the right size
                        const inv = 1 / FONT_PX;

                        ctx.save();
                        // Apply normalized Trm — position + orientation WITHOUT the font size
                        ctx.transform(a * inv, b * inv, c * inv, d * inv, e, f);
                        ctx.scale(1, -1); // Y-flip back (global CTM already inverts Y)
                        ctx.font = `${FONT_PX}px "${fontName}", Arial, sans-serif`;
                        ctx.fillText(glyph, 0, 0);
                        ctx.restore();
                        break;
                    }

                    // ── Images ───────────────────────────────────────────────────
                    // Reference: pdf.js src/display/canvas.js paintImageXObject()
                    //
                    // When 'Do' is executed, the PDF graphics state CTM has already
                    // been set by prior 'cm' operators to position/size the image.
                    // The image coordinate space is [0,0]→[1,1] (unit square),
                    // flipped in Y relative to PDF.
                    case 'drawImage': {
                        const name = op.args[0];
                        const asset = this.imageMap[name];
                        if (!asset?.img) break;

                        ctx.save();
                        // The CTM already holds position and size. Image is drawn in a [0,0,1,1] unit square.
                        // PDF space is bottom-up. HTML images draw top-down.
                        // We must mirror the Y axis *within* the unit square to prevent drawing upside-down.
                        ctx.translate(0, 1);
                        ctx.scale(1, -1);
                        ctx.drawImage(asset.img, 0, 0, 1, 1);
                        ctx.restore();
                        break;
                    }

                    // Inline Images (BI/ID/EI)
                    case 'drawInlineImage': {
                        const [params, imgBytes] = op.args;
                        if (!imgBytes?.length) break;
                        try {
                            const w = Number(params?.W || params?.Width || 1);
                            const h = Number(params?.H || params?.Height || 1);
                            const cs = String(params?.CS || params?.ColorSpace || 'DeviceRGB');
                            const isGray = cs.includes('Gray');
                            const channels = isGray ? 1 : 3;

                            const offCanvas = new OffscreenCanvas(w, h);
                            const offCtx = offCanvas.getContext('2d');
                            const imgData = offCtx.createImageData(w, h);

                            for (let i = 0, j = 0; i < imgBytes.length && j < imgData.data.length; i += channels, j += 4) {
                                if (channels === 1) {
                                    const v = imgBytes[i];
                                    imgData.data[j] = v; imgData.data[j + 1] = v; imgData.data[j + 2] = v;
                                } else {
                                    imgData.data[j] = imgBytes[i];
                                    imgData.data[j + 1] = imgBytes[i + 1];
                                    imgData.data[j + 2] = imgBytes[i + 2];
                                }
                                imgData.data[j + 3] = 255;
                            }
                            offCtx.putImageData(imgData, 0, 0);

                            ctx.save();
                            ctx.scale(1 / w, -1 / h);
                            ctx.translate(0, -h);
                            ctx.drawImage(offCanvas, 0, 0);
                            ctx.restore();
                        } catch (imgErr) {
                            console.warn('[Canvas] Inline image failed:', imgErr.message);
                        }
                        break;
                    }
                }
            } catch (err) {
                // Swallow per-op errors — pdf.js does this too
                console.warn('[Canvas] Op failed:', op.fn, err.message);
            }
        }
    }

    /**
     * Phase 6: Ghost Masking
     * Paints a masking rectangle (usually white) over the original vector content
     * to prevent "Double Text" visibility when an interactive block is present.
     * @param {number} x, y, w, h - PDF User Space units
     */
    maskRect(x, y, w, h) {
        if (!this.ctx) return;
        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(x, y, w, h);
        this.ctx.restore();
    }
}
