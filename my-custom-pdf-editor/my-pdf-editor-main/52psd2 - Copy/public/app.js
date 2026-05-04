console.log("[Engine] app.js module initializing...");
import { PDFDocument } from './engine/ast/pdf_document.js';
// We will use dynamic imports for PageInterpreter and CanvasBackend to avoid scoping issues in this environment.
import { PDFDict, PDFArray, PDFRef, PDFNumber, PDFStream } from './engine/ast/pdf_objects.js';
import { AdvancedDecoders } from './engine/decoders/advanced_decoders.js';
import { AnnotationManager, annotationManager } from './engine/core/persistence/annotation_manager.js';
import { textManager } from './engine/core/persistence/text_manager.js';
import { IncrementalWriter } from './engine/core/writer/incremental_writer.js';
// TextBundler removed in Phase 8 Overhaul
import { UniversalMutator } from './engine/tools/universal_mutator.js';
import { ExportEngine } from './engine/export_engine.js';

window.executeNativeTool = async (toolId, file, params) => {
    console.log(`[NativeTool] Executing: ${toolId}`);
    try {
        const { PDFDocument } = await import('./engine/ast/pdf_document.js');
        const doc = await PDFDocument.load(file);

        // Helper to parse "1-3, 5" into [0, 1, 2, 4]
        const parsePageRanges = (str) => {
            if (Array.isArray(str)) return str;
            if (typeof str !== 'string') return [];
            const indices = new Set();
            const parts = str.split(',');
            for (const part of parts) {
                const p = part.trim();
                if (!p) continue;
                if (p.includes('-')) {
                    const [s, e] = p.split('-').map(n => parseInt(n.trim()));
                    if (!isNaN(s) && !isNaN(e)) {
                        for (let i = s; i <= e; i++) indices.add(i - 1);
                    }
                } else {
                    const n = parseInt(p);
                    if (!isNaN(n)) indices.add(n - 1);
                }
            }
            return Array.from(indices).filter(n => n >= 0);
        };

        let modifiedDoc = null;
        switch (toolId) {
            case 'merge': {
                const fileB = Array.isArray(params) ? params[0] : (params && params.fileB ? params.fileB : null);
                if (!fileB) {
                    const picker = document.createElement('input');
                    picker.type = 'file';
                    picker.accept = '.pdf';
                    picker.onchange = async (e) => {
                        const b = e.target.files[0];
                        if (b) window.executeNativeTool('merge', file, { fileB: b });
                    };
                    picker.click();
                    return;
                }
                const docB = await PDFDocument.load(fileB);
                modifiedDoc = await UniversalMutator.mergePdfs(doc, docB);
                break;
            }

            case 'split': {
                const selectedIndices = parsePageRanges(params);
                if (selectedIndices.length === 0) {
                    alert("Please provide valid page numbers to split (e.g., 1, 2, 3).");
                    return;
                }
                const [docA, docB] = await UniversalMutator.splitPdf(file, selectedIndices);
                const aBytes = await docA.save();
                const bBytes = await docB.save();

                // Trigger both downloads
                const download = (bytes, name) => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
                    a.download = name;
                    a.click();
                };
                download(aBytes, 'Split_Part1_SelectedPages.pdf');
                setTimeout(() => download(bBytes, 'Split_Part2_RemainingPages.pdf'), 1000);
                alert("✅ Split Successful! Two files downloaded.");
                return;
            }

            case 'delete-pages':
                const pagesToDel = parsePageRanges(params);
                modifiedDoc = await UniversalMutator.deletePages(doc, pagesToDel);
                break;

            case 'extract-pages':
                const pagesToKeep = parsePageRanges(params);
                modifiedDoc = await UniversalMutator.extractPages(doc, pagesToKeep);
                break;

            case 'reorder-pdf':
                const newOrderIndices = parsePageRanges(params);
                modifiedDoc = await UniversalMutator.reorderPages(doc, newOrderIndices);
                break;

            case 'rotate-pdf':
                const rot = parseInt(params) || 90;
                modifiedDoc = await UniversalMutator.rotatePages(doc, [], rot);
                break;

            case 'flatten-pdf':
                modifiedDoc = await UniversalMutator.flattenPdf(doc);
                break;

            case 'watermark':
                let wmParams = params;
                try {
                    // Try to parse JSON from the interactive UI builder
                    const config = JSON.parse(params);
                    wmParams = config;
                } catch (e) {
                    wmParams = params || "CONFIDENTIAL";
                }
                modifiedDoc = await UniversalMutator.addWatermark(doc, wmParams);
                break;

            case 'encrypt':
                modifiedDoc = await UniversalMutator.protectPdf(doc, params || "1234");
                break;

            case 'decrypt':
                modifiedDoc = await UniversalMutator.unlockPdf(doc, params || "1234");
                break;
        }

        if (modifiedDoc) {
            const bytes = await modifiedDoc.save();
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            if (uniToolResult) {
                uniToolResult.style.display = 'block';
                if (uniToolPreviewContainer) uniToolPreviewContainer.innerHTML = '';
            }

            let previewContainer = document.getElementById('uni-tool-result-preview');
            if (!previewContainer) {
                previewContainer = document.createElement('div');
                previewContainer.id = 'uni-tool-result-preview';
                previewContainer.style.marginTop = '20px';
                previewContainer.style.border = '1px solid #ccc';
                previewContainer.style.width = '100%';

                const toolsContainer = document.getElementById('uni-tool-container');
                if (toolsContainer) {
                    toolsContainer.appendChild(previewContainer);
                } else {
                    document.body.appendChild(previewContainer); // Fallback
                }
            }

            previewContainer.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;background:#eee;padding:10px;">
                    <strong>Result Preview</strong>
                    <button id="uni-tool-download-btn-preview" style="padding:8px 20px;background:#4CAF50;color:white;border:none;cursor:pointer;border-radius:4px;font-weight:bold;">Download Result</button>
                </div>
                <!-- Removed fixed heights so it doesn't artificially overflow its container -->
                <iframe src="${url}#view=FitH" style="width:100%; height:75vh; border:none; display:block;"></iframe>
            `;

            document.getElementById('uni-tool-download-btn-preview').onclick = () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `GodEngine_${toolId}_result.pdf`;
                a.click();
            };

            // Trigger UI Refresh for Previews
            if (window.triggerPhase6Export) triggerPhase6Export('pdf', blob);

            // Scroll to preview smoothly
            previewContainer.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (e) {
        console.error(e);
        alert(`Error executing ${toolId}: ${e.message}`);
    }
};

let currentDoc = null;
let currentPageIndex = 0;
let currentScale = 1.0;
let editorState = null;
let toolManager = null;
let selectionManager = null;
let currentBackend = null;
let selectedImage = null;
let selectedTextElement = null;

// Global State for Merge Tool
let mergeDocs = []; // Array of { name, doc, pageCount }


window.handleFileUpload = async (file) => {
    if (!file) return;

    const pdfToolbar = document.getElementById('toolbar');
    const mainContainer = document.getElementById('main-container');
    const controls = document.getElementById('main-nav');
    const docxContainer = document.getElementById('docx-editor-container');
    const xlsxContainer = document.getElementById('xlsx-editor-container');

    if (file.name.endsWith('.docx') || file.name.endsWith('.xlsx')) {
        const { OfficeBridge } = await import('./engine/tools/office_bridge.js');
        const ast = await OfficeBridge.import(file);

        // Hide PDF specific overlays
        if (pdfToolbar) pdfToolbar.style.display = 'none';

        const container = document.getElementById('canvas-container');
        container.innerHTML = '<div class="text-layer" id="text-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></div>';
        const textLayer = document.getElementById('text-layer');

        const { InteractiveEditor } = await import('./engine/tools/interactive_editor.js?v=5');
        const editor = new InteractiveEditor(textLayer, { currentPageIndex: 0 });
        editor.setup(ast.textItems);

        window.currentFileType = ast.type;
        if (ast.type === 'docx') {
            window.currentDocxEditor = { getDOM: () => textLayer };
        } else {
            window.currentXlsxEditor = { workbook: ast.workbook || { sheets: [ast.textItems] } };
        }

        document.getElementById('status').textContent = `Loaded ${ast.type.toUpperCase()}`;
        return;
    }

    // CANVA-LEVEL: Global listener for editor changes
    window.addEventListener('engine:contentchange', (e) => {
        const { pageIndex, blocks } = e.detail;
        const { textManager } = import('./engine/core/persistence/text_manager.js').then(m => {
            blocks.forEach(block => {
                m.textManager.recordEdit(pageIndex, block, block.text);
            });
        });
    });

    // PDF Mode
    docxContainer.style.display = 'none';
    xlsxContainer.style.display = 'none';

    // Ensure PDF Canvas exists (might have been removed by Office doc or renderAllPages)
    let pdfCanvas = document.getElementById('pdf-canvas');
    if (!pdfCanvas) {
        const wrapper = document.getElementById('canvas-wrapper');
        if (wrapper) {
            wrapper.innerHTML = '<div id="canvas-container" style="position: relative; background: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin: 0 auto; display: inline-block;"><canvas id="pdf-canvas" style="display: block;"></canvas><div id="text-layer" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: auto;"></div><div id="annotation-layer" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;"></div></div>';
            pdfCanvas = document.getElementById('pdf-canvas');
        }
    }

    // Show PDF UI only if we are using the main editor (not a standalone tool)
    if (!currentActiveToolId) {
        if (pdfToolbar) pdfToolbar.style.display = 'flex';
        if (mainContainer) mainContainer.style.display = 'flex';
        controls.style.display = 'block';
    }

    window.currentFileType = 'pdf';
    window.godEngineFileBuffer = file; // Stash for split operations

    // Phase 1 : Enterprise AST Loading (pdf-lib mapping structure)
    // Directly streaming from the native File Object (200MB safe)

    try {
        const doc = await PDFDocument.load(file);
        console.log("AST Successfully Mounted:", doc);

        currentDoc = doc;
        currentPageIndex = 0;
        currentScale = 1.0;

        /* Phase 1/2 Verification - Halting before legacy tools mount
        // Initialize Editor
        editorState = new EditorState(doc);
        toolManager = new ToolManager(editorState);
        selectionManager = new SelectionManager(editorState);

        // Subscribe to tool changes
        editorState.subscribe((event, data) => {
            if (event === 'toolChanged') {
                // Update active state in UI
                document.querySelectorAll('.tool-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.tool === data.toolId);
                });
            }
        });
        */

        controls.style.display = 'flex';
        updateZoomDisplay();

        // Render First Page via Phase 2: Web Worker OperatorList Pipeline
        const pdfCanvas = document.getElementById('pdf-canvas');
        const ctx = pdfCanvas.getContext('2d');

        // â”€â”€ Phase 10: Final Control Suite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // ── Phase 10: Final Control Suite (Dynamic DOM) ──────────────────────────
        let engineControls = document.getElementById('god-engine-controls');
        if (!engineControls) {
            engineControls = document.createElement('div');
            engineControls.id = 'god-engine-controls';
            engineControls.style.cssText = 'padding:10px; display:flex; gap:10px; justify-content:center; background:#f4f4f4; border-bottom:1px solid #ddd;';

            const btnStyle = 'padding:8px 16px; cursor:pointer; border:1px solid #ccc; background:white; border-radius:4px; font-family:sans-serif; display:flex; align-items:center; gap:5px;';

            const saveBtn = document.createElement('button');
            saveBtn.id = 'save-pdf';
            saveBtn.style.cssText = btnStyle;
            saveBtn.innerHTML = '💾 <b>Save PDF</b>';
            saveBtn.onclick = async () => {
                const status = document.getElementById('status');
                status.innerText = "Rebuilding AST Stream (Splicing)...";
                
                // Collect and normalize blocks for the ExportEngine
                const blocks = Array.from(document.querySelectorAll('.engine-edit-block')).map(b => ({
                    text: b.innerText,
                    x: parseFloat(b.dataset.pdfX),
                    y: parseFloat(b.dataset.pdfY),
                    width: parseFloat(b.dataset.pdfWidth),
                    height: parseFloat(b.dataset.pdfHeight),
                    fontSize: parseFloat(b.dataset.fontSize),
                    fontFamily: b.dataset.fontFamily,
                    sourceBTStart: b.dataset.sourceBTStart ? parseInt(b.dataset.sourceBTStart) : undefined,
                    sourceETEnd: b.dataset.sourceETEnd ? parseInt(b.dataset.sourceETEnd) : undefined
                }));

                const exporter = new ExportEngine(null, blocks);
                const blob = await exporter.generatePDFBlob();
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'GodEngine_Spliced_Professional.pdf';
                    a.click();
                    status.innerText = "PDF Saved Successfully";
                } else {
                    status.innerText = "Error in AST Splicing";
                }
            };

            const highlightBtn = document.createElement('button');
            highlightBtn.id = 'toggle-highlight';
            highlightBtn.style.cssText = btnStyle + 'background:#ffffcc;';
            highlightBtn.innerHTML = '🖍️ <b>Highlighter: OFF</b>';
            let highlighterActive = false;
            highlightBtn.onclick = () => {
                highlighterActive = !highlighterActive;
                highlightBtn.innerHTML = highlighterActive ? '🖍️ <b>Highlighter: ON</b>' : '🖍️ <b>Highlighter: OFF</b>';
                highlightBtn.style.background = highlighterActive ? '#ffff00' : '#ffffcc';
                highlightBtn.style.boxShadow = highlighterActive ? 'inset 0 0 5px rgba(0,0,0,0.3)' : 'none';
                window.engineHighlighterActive = highlighterActive; // Global flag for the mouseup listener
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.id = 'delete-page';
            deleteBtn.style.cssText = btnStyle + 'background:#fff0f0; color:#c00; border-color:#fcc;';
            deleteBtn.innerHTML = '🗑️ <b>Remove Page</b>';
            deleteBtn.onclick = () => {
                if (doc && doc.pages.length > 0) {
                    doc.removePage(0);
                    alert('Page removed. Click Save PDF to download.');
                }
            };

            engineControls.appendChild(saveBtn);
            engineControls.appendChild(highlightBtn);
            engineControls.appendChild(deleteBtn);
            pdfCanvas.parentElement.prepend(engineControls);

            // Phase 8: Wire Conversion Marquee Buttons
            const docxBtn = document.getElementById('convert-docx-btn');
            if (docxBtn) {
                docxBtn.onclick = async () => {
                    const status = document.getElementById('status');
                    status.innerText = "Converting to Word (Semantic)...";
                    
                    const blocks = Array.from(this.container.querySelectorAll('.engine-edit-block')).map(b => ({
                        text: b.innerText, x: parseFloat(b.dataset.pdfX), y: parseFloat(b.dataset.pdfY),
                        width: parseFloat(b.dataset.pdfWidth), height: parseFloat(b.dataset.pdfHeight),
                        fontSize: parseFloat(b.dataset.fontSize)
                    }));

                    const exporter = new ExportEngine(null, blocks);
                    const url = exporter.generateTargetWordDocument();
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'GodEngine_Export.doc';
                    a.click();
                    status.innerText = "Word Conversion Complete";
                };
            }

            const xlsxBtn = document.getElementById('convert-xlsx-btn');
            if (xlsxBtn) {
                xlsxBtn.onclick = async () => {
                    const status = document.getElementById('status');
                    status.innerText = "Calculating Grid Data (Excel)...";
                    
                    const blocks = Array.from(this.container.querySelectorAll('.engine-edit-block')).map(b => ({
                        text: b.innerText, x: parseFloat(b.dataset.pdfX), y: parseFloat(b.dataset.pdfY),
                        width: parseFloat(b.dataset.pdfWidth), height: parseFloat(b.dataset.pdfHeight),
                        fontSize: parseFloat(b.dataset.fontSize)
                    }));

                    const exporter = new ExportEngine(null, blocks);
                    const url = exporter.generateTargetExcelDocument();
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'GodEngine_Export.csv';
                    a.click();
                    status.innerText = "Excel Conversion Complete";
                };
            }
        }

        // --- Highlighter Event Listener ---
        document.addEventListener('mouseup', () => {
            if (!window.engineHighlighterActive) return;
            const sel = window.getSelection();
            if (!sel.rangeCount || sel.isCollapsed) return;

            const range = sel.getRangeAt(0);
            const rects = range.getClientRects();

            let container = sel.anchorNode.parentElement;
            while (container && !container.classList.contains('page-container')) {
                container = container.parentElement;
            }
            if (!container) return;

            const pageRect = container.getBoundingClientRect();

            const savedRects = [];
            for (let r of rects) {
                const highlight = document.createElement('div');
                highlight.className = 'pdf-highlight';
                highlight.style.cssText = `
                    position: absolute;
                    left: ${r.left - pageRect.left}px;
                    top: ${r.top - pageRect.top}px;
                    width: ${r.width}px;
                    height: ${r.height}px;
                    background-color: rgba(255, 255, 0, 0.4);
                    pointer-events: none;
                    z-index: 5;
                `;
                container.appendChild(highlight);

                // Track for persistence (Page coordinates)
                savedRects.push({
                    x: r.left - pageRect.left,
                    y: r.top - pageRect.top,
                    w: r.width,
                    h: r.height
                });
            }

            // Record to manager
            const pageIndex = parseInt(container.id.split('-').pop()) || 0;
            annotationManager.addHighlight(pageIndex, savedRects);

            sel.removeAllRanges();
        });

        if (!pdfCanvas) console.error("No Canvas found!");

        const dpr = window.devicePixelRatio || 1;

        // Spin up the background VM Thread
        const pdfWorker = new Worker('./engine/worker/pdf_worker.js', { type: 'module' });
        const { CanvasBackend } = await import('./engine/graphics/canvas_backend.js');
        const customBackend = new CanvasBackend(pdfCanvas);

        // â”€â”€ Page Navigation State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        currentPageIndex = 0;   // uses module-level var (line 6)

        /**
         * renderPage(pageIndex) â€” The canonical page rendering function.
         *
         * FIX 1: Reads MediaBox from the CORRECT page (not hardcoded pages[0]).
         * FIX 2: Reads /Rotate and passes it to the worker (was never read before).
         * FIX 3: Extracts Resources PER PAGE (each page can have different fonts/images).
         * FIX 4: FontFace injection uses page-specific fonts, cached to avoid duplicates.
         */
        window.renderPage = async (pageIndex) => {
            if (!doc || pageIndex < 0 || pageIndex >= doc.pages.length) return;
            currentPageIndex = pageIndex;
            const page = doc.pages[pageIndex];

            // â”€â”€ MediaBox â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            // Now inherited from parent /Pages via fixed _flattenPageTree
            let mediaBox = [0, 0, 595, 842];
            try {
                const mb = page.get('MediaBox');
                if (mb && mb.elements && mb.elements.length >= 4) {
                    mediaBox = mb.elements.map(v => Number(v.value ?? v));
                }
            } catch (_) { }

            // â”€â”€ /Rotate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            // PDF spec: clockwise rotation in degrees (0, 90, 180, 270)
            // BEFORE THIS FIX: /Rotate was never read â€” landscape PDFs rendered sideways
            let rotate = 0;
            try {
                const rotVal = page.get('Rotate');
                if (rotVal != null) {
                    rotate = ((Number(rotVal.value ?? rotVal) % 360) + 360) % 360;
                }
            } catch (_) { }

            // â”€â”€ Import decoders once â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            const { decodeStream } = await import('./engine/decoders/image_decoders.js');
            const { getStandardFontMetrics, getEncodingForName } = await import('./engine/decoders/standard_fonts.js');

            const decompressIfNeeded = async (bytes, stmObj) => {
                if (!bytes || !bytes.length) return bytes;
                let filters = [], paramsList = [];
                if (stmObj && stmObj.dict) {
                    const f = stmObj.dict.get('Filter');
                    const dp = stmObj.dict.get('DecodeParms');
                    if (f && f.elements) {
                        filters = f.elements.map(e => e?.name || e);
                        paramsList = dp?.elements?.map(p => {
                            if (!p || !p.map) return {};
                            const o = {};
                            for (const [k, v] of p.map.entries()) o[k] = Number(v?.value ?? v);
                            return o;
                        }) || [];
                    } else if (f) {
                        filters = [f?.name || f];
                        if (dp && dp.map) {
                            const o = {};
                            for (const [k, v] of dp.map.entries()) o[k] = Number(v?.value ?? v);
                            paramsList = [o];
                        }
                    }
                }
                if (!filters.length) return bytes;
                try { return await decodeStream(bytes, filters, paramsList); }
                catch (e) { console.warn('[Decoder]', e.message); return bytes; }
            };

            const getStreamBytes = async (streamObj, ref) => {
                if (!streamObj) return null;
                if (streamObj.buffer && streamObj.buffer.length > 0) return streamObj.buffer;
                if (!ref) return null;
                const offset = doc.parser.xref.get(`${ref.num ?? ref.value},${ref.gen ?? 0}`);
                if (typeof offset === 'number') {
                    try { return await doc._extractStreamBytes(await doc.reader.read(offset, 1048576), streamObj.dict); }
                    catch (e) { console.warn('[Engine] stream extract:', e.message); }
                }
                return null;
            };

            // â”€â”€ /Contents â€” decompress and merge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            const rawContentsRef = page.get('Contents');
            let streamBytes = null;
            if (rawContentsRef) {
                const resolved = await doc._resolve(rawContentsRef);
                if (resolved && resolved.elements) {
                    const parts = [];
                    for (const ref of resolved.elements) {
                        const stm = await doc._resolve(ref);
                        const raw = await getStreamBytes(stm, ref);
                        if (raw) parts.push(await decompressIfNeeded(raw, stm));
                    }
                    if (parts.length) {
                        const total = parts.reduce((s, p) => s + p.length, 0);
                        streamBytes = new Uint8Array(total);
                        let off = 0;
                        for (const p of parts) { streamBytes.set(p, off); off += p.length; }
                    }
                } else {
                    const stm = resolved;
                    const raw = await getStreamBytes(stm, rawContentsRef);
                    streamBytes = raw ? await decompressIfNeeded(raw, stm) : null;
                }
            }

            if (!streamBytes || !streamBytes.length) {
                console.warn(`[Engine] Page ${pageIndex + 1}: empty content stream`);
                return;
            }

            // â”€â”€ Font + Resource extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            let fontWidthsMap = {};
            let imageMap = {};
            try {
                const resRef = page.get('Resources');
                if (resRef) {
                    const res = await doc._resolve(resRef);

                    // Fonts
                    const fontsRef = res && res.get && res.get('Font');
                    if (fontsRef) {
                        const fontsObj = await doc._resolve(fontsRef);
                        if (fontsObj && fontsObj.map) {
                            for (let rawKey of fontsObj.map.keys()) {
                                const key = String(rawKey || '').replace(/^\//, '');
                                fontWidthsMap[key] = { defaultWidth: 1000, glyphs: {}, toUnicode: {} };
                                const fontDict = await doc._resolve(fontsObj.get(rawKey));
                                if (!fontDict) continue;

                                const baseFont = fontDict.get('BaseFont');
                                const fontName = (baseFont?.name || baseFont || '').replace(/^\//, '');
                                fontWidthsMap[key].name = fontName;

                                const std = getStandardFontMetrics(fontName);
                                if (std) { fontWidthsMap[key].defaultWidth = std.defaultWidth; fontWidthsMap[key].glyphs = { ...std.widths }; }
                                const encObj = fontDict.get('Encoding');
                                const encName = encObj?.name || encObj;
                                if (typeof encName === 'string') fontWidthsMap[key].encoding = getEncodingForName(encName);

                                // ToUnicode
                                const tuRef = fontDict.get('ToUnicode');
                                if (tuRef) {
                                    const tuObj = await doc._resolve(tuRef);
                                    let cmapBytes = await getStreamBytes(tuObj, tuRef);
                                    if (cmapBytes && tuObj && tuObj.dict) {
                                        const flt = tuObj.dict.get('Filter');
                                        if ((flt?.name || flt) === 'FlateDecode') {
                                            try { const { FlateDecoder } = await import('./engine/decoders/flate_decoder.js'); cmapBytes = await FlateDecoder.decode(cmapBytes); } catch (_) { }
                                        }
                                    }
                                    if (cmapBytes) {
                                        const cs = new TextDecoder().decode(new Uint8Array(cmapBytes));
                                        const bfcR = /beginbfchar([\s\S]*?)endbfchar/g;
                                        let m;
                                        while ((m = bfcR.exec(cs)) !== null) {
                                            const lr = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g; let lm;
                                            while ((lm = lr.exec(m[1])) !== null) fontWidthsMap[key].toUnicode[parseInt(lm[1], 16)] = String.fromCharCode(parseInt(lm[2], 16));
                                        }
                                        const bfrR = /beginbfrange([\s\S]*?)endbfrange/g;
                                        while ((m = bfrR.exec(cs)) !== null) {
                                            const rs = m[1];
                                            const lr = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g; let lm;
                                            while ((lm = lr.exec(rs)) !== null) {
                                                const [s, e2, u] = [parseInt(lm[1], 16), parseInt(lm[2], 16), parseInt(lm[3], 16)];
                                                for (let c = s; c <= e2; c++) fontWidthsMap[key].toUnicode[c] = String.fromCharCode(u + (c - s));
                                            }
                                            const ar = /<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+\[([\s\S]*?)\]/g;
                                            while ((lm = ar.exec(rs)) !== null) {
                                                const s = parseInt(lm[1], 16), e2 = parseInt(lm[2], 16);
                                                const unis = lm[3].match(/<([0-9a-fA-F]+)>/g) || [];
                                                for (let i = 0; i < unis.length && (s + i) <= e2; i++) fontWidthsMap[key].toUnicode[s + i] = String.fromCharCode(parseInt(unis[i].replace(/[<>]/g, ''), 16));
                                            }
                                        }
                                    }
                                }

                                // Glyph widths (Simple fonts)
                                const fc = fontDict.get('FirstChar');
                                const wr = fontDict.get('Widths');
                                if (fc && wr) {
                                    const first = Number(fc.value ?? fc);
                                    const wArr = await doc._resolve(wr);
                                    if (wArr?.elements) wArr.elements.forEach((v, i) => { fontWidthsMap[key].glyphs[first + i] = Number(v.value ?? v); });
                                }

                                // CID fonts
                                const descArrRef = fontDict.get('DescendantFonts');
                                if (descArrRef) {
                                    const descArr = await doc._resolve(descArrRef);
                                    if (descArr?.elements?.[0]) {
                                        const cid = await doc._resolve(descArr.elements[0]);
                                        fontWidthsMap[key].isMultiByte = true;
                                        const dw = cid.get('DW');
                                        if (dw) fontWidthsMap[key].defaultWidth = Number(dw.value ?? dw);
                                        const wRef2 = cid.get('W');
                                        if (wRef2) {
                                            const w = await doc._resolve(wRef2);
                                            if (w?.elements) {
                                                let i = 0;
                                                while (i < w.elements.length) {
                                                    const c1 = Number(w.elements[i++].value ?? w.elements[i - 1]);
                                                    const next = w.elements[i++];
                                                    if (!next) break;
                                                    if (next.elements) { next.elements.forEach((wv, idx) => { fontWidthsMap[key].glyphs[c1 + idx] = Number(wv.value ?? wv); }); }
                                                    else { const c2 = Number(next.value ?? next); const wv = Number(w.elements[i++].value ?? w.elements[i - 1]); for (let c = c1; c <= c2; c++)fontWidthsMap[key].glyphs[c] = wv; }
                                                }
                                            }
                                        }
                                    }
                                }

                                // Embedded font injection via FontFace API
                                const fdRef = fontDict.get('FontDescriptor');
                                if (fdRef) {
                                    const fd = await doc._resolve(fdRef);
                                    if (fd) {
                                        const mw = fd.get('MissingWidth');
                                        if (mw) fontWidthsMap[key].defaultWidth = Number(mw.value ?? mw);
                                        const ffRef = fd.get('FontFile2') || fd.get('FontFile3') || fd.get('FontFile');
                                        if (ffRef) {
                                            try {
                                                const ffObj = await doc._resolve(ffRef);
                                                const rawFB = await getStreamBytes(ffObj, ffRef);
                                                const fb = await decompressIfNeeded(rawFB, ffObj);
                                                if (fb && fb.length > 4) {
                                                    const h = (fb[0] << 24) | (fb[1] << 16) | (fb[2] << 8) | fb[3];
                                                    const isFont = h === 0x00010000 || h === 0x4F54544F || h === 0x74727565 || h === 0x74797031;
                                                    if (isFont) {
                                                        const alreadyLoaded = [...document.fonts].some(f => f.family === `"${key}"` && f.status === 'loaded');
                                                        if (!alreadyLoaded) {
                                                            const blob = new Blob([fb], { type: 'application/x-font-truetype' });
                                                            const url = URL.createObjectURL(blob);
                                                            const face = new FontFace(key, `url(${url})`);
                                                            await face.load();
                                                            document.fonts.add(face);
                                                            console.log(`[Engine] âœ… Font: ${key} (${fontName})`);
                                                        }
                                                    }
                                                }
                                            } catch (fErr) { console.warn(`[Engine] Font ${key}:`, fErr.message); }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // XObjects / Images
                    const xObjRef = res && res.get && res.get('XObject');
                    if (xObjRef) {
                        const xobjs = await doc._resolve(xObjRef);
                        if (xobjs && xobjs.map) {
                            for (let k of xobjs.map.keys()) {
                                const xObj = await doc._resolve(xobjs.get(k));
                                if (!xObj || !xObj.dict) continue;
                                const sub = xObj.dict.get('Subtype');
                                if ((sub?.name || sub) === 'Image') {
                                    const w = Number((xObj.dict.get('Width')?.value ?? xObj.dict.get('Width')) || 0);
                                    const h = Number((xObj.dict.get('Height')?.value ?? xObj.dict.get('Height')) || 0);
                                    const flt = xObj.dict.get('Filter');
                                    const rawBytes = await getStreamBytes(xObj, xobjs.get(k));
                                    if (rawBytes) {
                                        if ((flt?.name || flt) === 'DCTDecode') {
                                            imageMap[k] = { url: URL.createObjectURL(new Blob([rawBytes], { type: 'image/jpeg' })), width: w, height: h };
                                        } else {
                                            imageMap[k] = { bytes: await decompressIfNeeded(rawBytes, xObj), width: w, height: h, filter: 'Flate' };
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // ExtGState
                    const gsRef = res && res.get && res.get('ExtGState');
                    if (gsRef) {
                        const gsObj = await doc._resolve(gsRef);
                        if (gsObj && gsObj.map) {
                            for (let k of gsObj.map.keys()) {
                                const g = await doc._resolve(gsObj.get(k));
                                if (g && g.get) {
                                    const ca = g.get('ca'), CA = g.get('CA'), BM = g.get('BM');
                                    imageMap[k] = { ca: ca != null ? Number(ca?.value ?? ca) : undefined, CA: CA != null ? Number(CA?.value ?? CA) : undefined, BM: BM || undefined };
                                }
                            }
                        }
                    }
                }
            } catch (resErr) { console.warn('[Engine] Resources:', resErr.message); }

            console.log(`[Engine] âœ… Page ${pageIndex + 1}/${doc.pages.length} | ${streamBytes.length} bytes | ${Object.keys(fontWidthsMap).length} fonts | rotate=${rotate}Â°`);

            // Send to worker
            pdfWorker.postMessage({ type: 'parsePage', streamData: streamBytes, fontMap: fontWidthsMap, imageMap, rotate, mediaBox, pageIndex });
        };

        // â”€â”€ Worker Response Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        pdfWorker.onmessage = async (e) => {
            if (e.data.type === 'pageParsed') {
                const pageIndex = e.data.pageIndex;
                console.log(`[Main] Page ${pageIndex} parsed. TextItems: ${e.data.textItems?.length || 0}`);

                const pdfCanvas = document.getElementById(`pdf-canvas-${pageIndex}`) || document.getElementById('pdf-canvas');
                if (!pdfCanvas) {
                    console.error(`[Main] Target canvas for page ${pageIndex} not found!`);
                    return;
                }
                const mediaBox = e.data.mediaBox || [0, 0, 595, 842];
                const rotate = e.data.rotate || 0;
                const imgMap = e.data.imageMap || {};

                // Load images for this specific page
                const loadedImgs = {};
                const promises = [];
                for (let k in imgMap) {
                    const d = imgMap[k];
                    if (d.url) {
                        const i = new Image();
                        promises.push(new Promise(r => { i.onload = () => { loadedImgs[k] = { img: i }; r(); }; i.onerror = r; i.src = d.url; }));
                    } else if (d.bytes) {
                        try {
                            const c = document.createElement('canvas'); c.width = d.width; c.height = d.height;
                            const t = c.getContext('2d'); const id = t.createImageData(d.width, d.height);
                            for (let idx = 0, j = 0; idx < d.bytes.length; idx += 3, j += 4) { id.data[j] = d.bytes[idx]; id.data[j + 1] = d.bytes[idx + 1]; id.data[j + 2] = d.bytes[idx + 2]; id.data[j + 3] = 255; }
                            t.putImageData(id, 0, 0); loadedImgs[k] = { img: c };
                        } catch (err) { }
                    }
                }
                await Promise.all(promises);

                const { CanvasBackend } = await import('./engine/graphics/canvas_backend.js');
                const pageBackend = new CanvasBackend(pdfCanvas);
                pageBackend.imageMap = loadedImgs;
                await pageBackend.draw(e.data.operatorList, currentScale, mediaBox, rotate);
            } else if (e.data.type === 'pageError') {
                console.error("FATAL ERROR RETURNED FROM VM WORKER:", e.data.error);
            }
        };

        // â”€â”€ Trigger initial render via the unified renderAllPages() function â”€â”€â”€â”€â”€â”€â”€
        if (doc.pageCount > 0) {
            console.log("[Engine] Starting initial render...");
            await renderThumbnails(doc);
            await renderAllPages(doc);
            console.log("[Engine] Initial render complete.");
        } else {
            console.error('[Engine] â Œ No pages loaded from this PDF.');
        }

    } catch (error) {
        console.error('Error parsing PDF:', error);
    }
};



document.getElementById('file-input').addEventListener('change', (e) => {
    window.handleFileUpload(e.target.files[0]);
});

// Toolbar Event Listeners
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        if (toolManager) {
            toolManager.activate(tool);
        }
    });
});

const handleSave = async () => {
    console.log('Save button clicked. Type:', window.currentFileType);
    if (window.currentFileType === 'docx' && window.currentDocxEditor) {
        const { DocxWriter } = await import('./engine/writer/docx_writer.js');
        const dom = window.currentDocxEditor.getDOM();
        const writer = new DocxWriter(dom);
        const blob = await writer.save();
        downloadBlob(blob, 'edited_document.docx');
    } else if (window.currentFileType === 'xlsx' && window.currentXlsxEditor) {
        const { XlsxWriter } = await import('./engine/writer/xlsx_writer.js');
        // Update workbook from editor state (already updated on blur)
        const writer = new XlsxWriter(window.currentXlsxEditor.workbook);
        const blob = await writer.save();
        downloadBlob(blob, 'edited_spreadsheet.xlsx');
    } else if (currentDoc) {
        const { PDFWriter } = await import('./engine/writer/pdf_writer.js');
        const writer = new PDFWriter(currentDoc, editorState);
        const blob = await writer.save();
        downloadBlob(blob, 'edited_document.pdf');
    }
};

document.getElementById('save-btn').addEventListener('click', handleSave);
const bottomSaveBtn = document.getElementById('bottom-save-btn');
if (bottomSaveBtn) bottomSaveBtn.addEventListener('click', handleSave);

function downloadBlob(data, filename) {
    const blob = data instanceof Uint8Array ? new Blob([data]) : data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}

function updateToolUI(activeTool) {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        if (btn.getAttribute('data-tool') === activeTool) {
            btn.classList.add('active');
            btn.style.fontWeight = '';
            btn.style.background = '';
        } else {
            btn.classList.remove('active');
            btn.style.fontWeight = '';
            btn.style.background = '';
        }
    });

    const textControls = document.getElementById('text-controls');
    if (activeTool === 'text') {
        textControls.style.display = 'flex';
    } else {
        textControls.style.display = 'none';
    }
}


// Toolbar Listeners
document.getElementById('font-family').addEventListener('change', (e) => applyTextStyle('fontFamily', e.target.value));
document.getElementById('font-size').addEventListener('change', (e) => applyTextStyle('fontSize', parseInt(e.target.value)));
document.getElementById('text-color').addEventListener('change', (e) => applyTextStyle('color', e.target.value));

document.getElementById('bold-btn').addEventListener('click', (e) => {
    e.target.classList.toggle('active');
    const isActive = e.target.classList.contains('active');
    e.target.style.backgroundColor = isActive ? '#ddd' : '';
    applyTextStyle('bold', isActive);
});

document.getElementById('italic-btn').addEventListener('click', (e) => {
    e.target.classList.toggle('active');
    const isActive = e.target.classList.contains('active');
    e.target.style.backgroundColor = isActive ? '#ddd' : '';
    applyTextStyle('italic', isActive);
});

// Update Text Layer Editable to track selection
function updateTextLayerEditable(editable) {
    const textLayer = document.getElementById('text-layer');
    const spans = textLayer.getElementsByTagName('span');
    for (let span of spans) {
        span.contentEditable = editable;
        span.style.cursor = editable ? 'text' : 'text';
        span.style.pointerEvents = 'all';

        if (editable) {
            span.style.border = '1px dashed #ccc';

            span.onfocus = (e) => {
                selectedTextElement = e.target;
                e.target.style.outline = '2px solid #007bff';
                e.target.style.zIndex = '100';

                // Update Toolbar to match
                // (Optional: read computed style and set toolbar values)
            };

            span.onblur = (e) => {
                const newText = e.target.textContent;
                const opIndex = parseInt(e.target.getAttribute('data-op-index'));

                // Read styles from dataset or style
                const fontFamily = e.target.dataset.fontFamily; // Only if changed
                const fontSize = e.target.dataset.fontSize;
                const isBold = e.target.style.fontWeight === 'bold';
                const isItalic = e.target.style.fontStyle === 'italic';
                const color = e.target.style.color; // rgb(...)

                // Remove focus styles
                e.target.style.outline = 'none';
                e.target.style.zIndex = 'auto';
                // if (selectedTextElement === e.target) selectedTextElement = null; // Keep selection for toolbar interaction

                if (!isNaN(opIndex) && editorState) {
                    const mod = {
                        type: 'text',
                        opIndex: opIndex,
                        text: newText
                    };

                    if (fontFamily) mod.fontFamily = fontFamily;
                    if (fontSize) mod.fontSize = parseInt(fontSize);
                    if (isBold) mod.bold = true;
                    if (isItalic) mod.italic = true;
                    if (color) {
                        // Parse rgb
                        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                        if (match) {
                            mod.color = [parseInt(match[1]) / 255, parseInt(match[2]) / 255, parseInt(match[3]) / 255];
                        } else if (color.startsWith('#')) {
                            const r = parseInt(color.substr(1, 2), 16) / 255;
                            const g = parseInt(color.substr(3, 2), 16) / 255;
                            const b = parseInt(color.substr(5, 2), 16) / 255;
                            mod.color = [r, g, b];
                        }
                    }

                    console.log(`Saving text edit: Page ${currentPageIndex}, Op ${opIndex}`, mod);
                    editorState.addModification(currentPageIndex, mod);
                }
            };
        } else {
            span.style.border = 'none';
            span.onblur = null;
            span.onfocus = null;
        }
    }
}


async function renderThumbnails(doc) {
    if (window._isRenderingThumbnails) {
        console.log("[Engine] Thumbnail render already in progress, skipping...");
        return;
    }
    window._isRenderingThumbnails = true;
    try {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        sidebar.innerHTML = '';

        for (let i = 0; i < doc.pageCount; i++) {
            const page = await doc.getPage(i);
            await page.loadResources();

            const mediaBox = page.dict.get('MediaBox') || [0, 0, 612, 792];
            const pdfWidth = Math.abs(mediaBox[2] - mediaBox[0]);
            const pdfHeight = Math.abs(mediaBox[3] - mediaBox[1]);

            const scale = 0.2;
            const width = pdfWidth * scale;
            const height = pdfHeight * scale;

            const container = document.createElement('div');
            container.style.marginBottom = '10px';
            container.style.cursor = 'pointer';
            container.style.textAlign = 'center';
            container.onclick = () => {
                currentPageIndex = i;
                renderPage(i);
            };

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.style.border = '1px solid #ccc';
            canvas.style.background = 'white';

            const { CanvasBackend } = await import('./engine/graphics/canvas_backend.js');
            const { PageInterpreter } = await import('./engine/core/evaluator/page_interpreter.js');

            const backend = new CanvasBackend(canvas);
            backend.scale = scale;

            const interpreter = new PageInterpreter(page, backend);
            await interpreter.execute(await page.getContentStream());

            container.appendChild(canvas);

            const label = document.createElement('div');
            label.textContent = `Page ${i + 1}`;
            label.style.fontSize = '12px';
            container.appendChild(label);

            sidebar.appendChild(container);
        }
    } finally {
        window._isRenderingThumbnails = false;
    }
}

document.getElementById('prev-page').addEventListener('click', () => {
    if (currentDoc && currentPageIndex > 0) {
        let newIndex = currentPageIndex - 1;
        while (editorState && editorState.isPageDeleted(newIndex) && newIndex >= 0) {
            newIndex--;
        }
        if (newIndex >= 0) {
            currentPageIndex = newIndex;
            const target = document.querySelector(`.page-container[data-page-index="${newIndex}"]`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            updatePageIndicator(newIndex);
        }
    }
});

document.getElementById('next-page').addEventListener('click', () => {
    if (currentDoc && currentPageIndex < currentDoc.pageCount - 1) {
        let newIndex = currentPageIndex + 1;
        while (editorState && editorState.isPageDeleted(newIndex) && newIndex < currentDoc.pageCount) {
            newIndex++;
        }
        if (newIndex < currentDoc.pageCount) {
            currentPageIndex = newIndex;
            const target = document.querySelector(`.page-container[data-page-index="${newIndex}"]`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            updatePageIndicator(newIndex);
        }
    }
});

function updatePageIndicator(index) {
    let deletedBefore = 0;
    if (editorState) {
        for (let i = 0; i < index; i++) {
            if (editorState.isPageDeleted(i)) deletedBefore++;
        }
    }
    const visualIndex = index + 1 - deletedBefore;
    const total = currentDoc ? currentDoc.pageCount : 0;
    const pageNumElem = document.getElementById('page-num');
    if (pageNumElem) pageNumElem.textContent = `Page ${visualIndex} of ${total}`;
}

document.getElementById('zoom-in').addEventListener('click', () => {
    if (currentDoc) {
        currentScale += 0.25;
        updateZoomDisplay();
        renderAllPages(currentDoc);
    }
});

document.getElementById('zoom-out').addEventListener('click', () => {
    if (currentDoc && currentScale > 0.25) {
        currentScale -= 0.25;
        updateZoomDisplay();
        renderAllPages(currentDoc);
    }
});

document.getElementById('fit-width-btn').addEventListener('click', async () => {
    if (currentDoc) {
        const page = await currentDoc.getPage(currentPageIndex);
        const mediaBox = page.dict.get('MediaBox') || [0, 0, 612, 792];
        const pdfWidth = Math.abs(mediaBox[2] - mediaBox[0]);

        const containerWidth = document.getElementById('canvas-container').clientWidth - 40; // padding
        currentScale = containerWidth / pdfWidth;
        updateZoomDisplay();
        renderPage(currentPageIndex);
    }
});

document.getElementById('fit-page-btn').addEventListener('click', async () => {
    if (currentDoc) {
        const page = await currentDoc.getPage(currentPageIndex);
        const mediaBox = page.dict.get('MediaBox') || [0, 0, 612, 792];
        const pdfHeight = Math.abs(mediaBox[3] - mediaBox[1]);

        const containerHeight = document.getElementById('main-container').clientHeight - 40;
        currentScale = containerHeight / pdfHeight;
        updateZoomDisplay();
        renderPage(currentPageIndex);
    }
});

document.getElementById('bold-btn').addEventListener('click', (e) => {
    e.target.classList.toggle('active');
    if (e.target.classList.contains('active')) {
        e.target.style.backgroundColor = '#ddd';
    } else {
        e.target.style.backgroundColor = '';
    }
});

document.getElementById('italic-btn').addEventListener('click', (e) => {
    e.target.classList.toggle('active');
    if (e.target.classList.contains('active')) {
        e.target.style.backgroundColor = '#ddd';
    } else {
        e.target.style.backgroundColor = '';
    }
});

document.getElementById('search-btn').addEventListener('click', () => {
    const query = document.getElementById('search-input').value.toLowerCase();
    if (!query) return;

    const textLayer = document.getElementById('text-layer');
    const spans = textLayer.getElementsByTagName('span');
    let found = false;

    for (let span of spans) {
        span.style.backgroundColor = 'transparent';
        if (span.textContent.toLowerCase().includes(query)) {
            span.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
            if (!found) {
                span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                found = true;
            }
        }
    }

    if (!found) {
        alert('Text not found on this page.');
    }
});

function updateZoomDisplay() {
    document.getElementById('zoom-level').textContent = `${Math.round(currentScale * 100)}%`;
}

async function renderAllPages(doc) {
    if (!doc) return;
    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.innerHTML = ''; // Clear for full re-render

    const container = document.createElement('div');
    container.id = 'pages-container';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '20px';
    container.style.width = '100%';
    container.style.paddingBottom = '40px';
    wrapper.appendChild(container);

    for (let i = 0; i < doc.pageCount; i++) {
        const pageContainer = document.createElement('div');
        pageContainer.className = 'page-container';
        pageContainer.dataset.pageIndex = i;
        pageContainer.style.position = 'relative';
        pageContainer.style.background = 'white';
        pageContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';

        const canvas = document.createElement('canvas');
        canvas.id = `pdf-canvas-${i}`;
        canvas.style.display = 'block';
        canvas.style.maxWidth = '100%'; // Prevent horizontal overflow
        canvas.style.height = 'auto';
        pageContainer.appendChild(canvas);

        const textLayer = document.createElement('div');
        textLayer.id = `text-layer-${i}`;
        textLayer.className = 'pdf-text-layer';
        textLayer.style.position = 'absolute';
        textLayer.style.top = '0';
        textLayer.style.left = '0';
        textLayer.style.right = '0';
        textLayer.style.bottom = '0';
        textLayer.style.pointerEvents = 'none';
        pageContainer.appendChild(textLayer);

        container.appendChild(pageContainer);

        // Render page
        await renderSinglePage(doc, i, canvas, textLayer);
    }
}

async function renderSinglePage(doc, index, canvas, textLayer) {
    try {
        const page = await doc.getPage(index);
        await page.loadResources();

        const { CanvasBackend } = await import('./engine/graphics/canvas_backend.js');
        const { PageInterpreter } = await import('./engine/core/evaluator/page_interpreter.js');

        const mediaBox = page.dict.get('MediaBox') || [0, 0, 612, 792];
        const pdfWidth = Math.abs(mediaBox[2] - mediaBox[0]);
        const pdfHeight = Math.abs(mediaBox[3] - mediaBox[1]);

        // Base resolution scaling (CSS pixels vs Canvas pixels)
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = pdfWidth * currentScale;
        const displayHeight = pdfHeight * currentScale;

        // Set actual canvas internal dimensions
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;

        // Set CSS responsive dimensions to prevent clipping
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        // Match container and text layer to exact display dimensions
        canvas.parentElement.style.width = `${displayWidth}px`;
        canvas.parentElement.style.height = `${displayHeight}px`;

        const backend = new CanvasBackend(canvas);
        backend.scale = currentScale * dpr; // Apply DPR to backend
        backend.textLayer = textLayer;

        const interpreter = new PageInterpreter(page, backend);
        await interpreter.execute(await page.getContentStream());

    } catch (err) {
        console.error(`Render error on page ${index}:`, err);
    }
}

async function renderPage(index) {
    if (!currentDoc) return;

    let deletedCount = 0;
    if (editorState) {
        for (let i = 0; i < currentDoc.pageCount; i++) {
            if (editorState.isPageDeleted(i)) deletedCount++;
        }
    }
    const activePageCount = currentDoc.pageCount - deletedCount;

    // Calculate visual page number (excluding deleted pages before this one)
    let visualIndex = index + 1;
    if (editorState) {
        let deletedBefore = 0;
        for (let i = 0; i < index; i++) {
            if (editorState.isPageDeleted(i)) deletedBefore++;
        }
        visualIndex -= deletedBefore;
    }

    const isDeleted = editorState && editorState.isPageDeleted(index);
    document.getElementById('page-num').textContent = `Page ${visualIndex} of ${activePageCount}${isDeleted ? ' (DELETED)' : ''}`;
    document.getElementById('status').textContent = isDeleted ? 'Page Deleted' : `Rendering Page ${index + 1}...`;

    if (isDeleted) {
        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '30px Arial';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.fillText('PAGE DELETED', canvas.width / 2, canvas.height / 2);
        renderModifications(index); // Clear mods
        return;
    }

    try {
        let originalIndex = index;
        if (editorState) {
            originalIndex = editorState.getOriginalPageIndex(index);
        }
        const page = await currentDoc.getPage(originalIndex);
        await page.loadResources();

        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');

        const mediaBox = page.dict.get('MediaBox') || [0, 0, 612, 792];
        const pdfWidth = Math.abs(mediaBox[2] - mediaBox[0]);
        const pdfHeight = Math.abs(mediaBox[3] - mediaBox[1]);

        const width = pdfWidth * currentScale;
        const height = pdfHeight * currentScale;

        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);

        const textLayer = document.getElementById('text-layer');
        textLayer.innerHTML = '';
        textLayer.style.width = `${width}px`;
        textLayer.style.height = `${height}px`;

        const annotLayer = document.getElementById('annotation-layer');
        annotLayer.innerHTML = '';
        annotLayer.style.width = `${width}px`;
        annotLayer.style.height = `${height}px`;

        ctx.save();
        ctx.scale(currentScale, currentScale);

        const [m1, m2, m3, m4] = mediaBox;
        const offsetX = m1;
        const offsetY = m2;

        // Move origin to the bottom-left corner of the MediaBox
        ctx.translate(-offsetX, pdfHeight + offsetY);
        ctx.scale(1, -1);

        const { CanvasBackend } = await import('./engine/graphics/canvas_backend.js');
        const { PageInterpreter } = await import('./engine/core/evaluator/page_interpreter.js');

        const backend = new CanvasBackend(canvas);
        currentBackend = backend; // Store globally
        backend.scale = currentScale;
        backend.textLayer = textLayer;

        if (editorState) {
            editorState.setBackend(backend);
        }

        const interpreter = new PageInterpreter(page, backend, editorState, index);
        await interpreter.execute(await page.getContentStream());

        ctx.restore();

        // Render Existing Annotations (Legacy)
        const annotRenderer = new AnnotationRenderer(currentDoc);
        await annotRenderer.render(page, document.getElementById('annotation-layer'), currentScale, index, editorState);

        // CANVA-LEVEL: High-fidelity interactivity is now handled directly by the PageInterpreter's text layer logic.

        document.getElementById('status').textContent = 'Ready';

    } catch (error) {
        console.error('Render Error:', error);
        document.getElementById('status').textContent = 'Error rendering page';
    }

    // Render Modifications (Shapes, Text)
    renderModifications(index);
}

function renderModifications(pageIndex) {
    const layer = document.getElementById('annotation-layer');
    // Clear previous rendered mods
    const existing = layer.querySelectorAll('.rendered-mod');
    existing.forEach(el => el.remove());

    if (!editorState) return;

    const originalIndex = editorState.getOriginalPageIndex(pageIndex);
    const mods = editorState.getModifications(originalIndex);
    if (!mods) return;

    for (const mod of mods) {
        if (mod.type === 'addShape') {
            const div = document.createElement('div');
            div.className = 'rendered-mod';
            div.style.position = 'absolute';
            div.style.left = `${mod.x * currentScale}px`;
            div.style.top = `${mod.y * currentScale}px`;
            div.style.width = `${mod.width * currentScale}px`;
            div.style.height = `${mod.height * currentScale}px`;
            div.style.border = `${mod.strokeWidth || 2}px solid rgb(${(mod.strokeColor || [1, 0, 0]).map(c => c * 255).join(',')})`;
            div.style.pointerEvents = 'auto';
            if (mod.shapeType === 'circle') {
                div.style.borderRadius = '50%';
            }
            div.setAttribute('data-op-index', mod.opIndex);
            layer.appendChild(div);
        } else if (mod.type === 'addText') {
            const div = document.createElement('div');
            div.className = 'rendered-mod';
            div.style.position = 'absolute';
            div.style.left = `${mod.x * currentScale}px`;
            div.style.top = `${mod.y * currentScale}px`;
            div.style.fontSize = `${(mod.fontSize || 12) * currentScale}px`;
            div.style.fontFamily = mod.fontFamily || 'Helvetica';
            if (mod.bold) div.style.fontWeight = 'bold';
            if (mod.italic) div.style.fontStyle = 'italic';
            if (mod.underline && mod.strikethrough) div.style.textDecoration = 'underline line-through';
            else if (mod.underline) div.style.textDecoration = 'underline';
            else if (mod.strikethrough) div.style.textDecoration = 'line-through';
            if (mod.color) {
                div.style.color = `rgb(${mod.color.map(c => Math.round(c * 255)).join(',')})`;
            }
            div.textContent = mod.text;
            div.style.whiteSpace = 'pre';
            div.style.pointerEvents = 'auto';
            div.setAttribute('data-op-index', mod.opIndex);

            // Make Editable
            div.contentEditable = true;
            div.style.cursor = 'text';

            div.onfocus = (e) => {
                e.target.style.outline = '2px solid #007bff';
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                e.target.style.zIndex = '1000';
            };

            div.onblur = (e) => {
                e.target.style.outline = 'none';
                e.target.style.backgroundColor = 'transparent';
                e.target.style.zIndex = 'auto';

                const newText = e.target.textContent;
                if (newText !== mod.text) {
                    // Update modification in state
                    // We need a way to update. remove + add?
                    // EditorState doesn't have update.
                    // But we can just add a NEW modification that overrides? 
                    // No, duplicate addText at same pos?
                    // Better: Remove old mod, add new mod.
                    // But we need to find it.
                    // We have opIndex.

                    // Actually, EditorState.modifications is a Map<pageIndex, Array>.
                    // We can access it directly if we are careful, or add a method.
                    // Let's add updateModification to EditorState?
                    // Or just hack it here since we have editorState reference.

                    const mods = editorState.modifications.get(pageIndex);
                    const modIndex = mods.findIndex(m => m.opIndex === mod.opIndex);
                    if (modIndex !== -1) {
                        mods[modIndex].text = newText;
                        console.log('Updated text modification:', newText);
                    }
                }
            };

            layer.appendChild(div);
        } else if (mod.type === 'addInk') {
            // Check if SVG container exists
            let svgContainer = layer.querySelector('svg.drawing-layer');
            if (!svgContainer) {
                svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svgContainer.classList.add('drawing-layer');
                svgContainer.style.position = 'absolute';
                svgContainer.style.top = '0';
                svgContainer.style.left = '0';
                svgContainer.style.width = '100%';
                svgContainer.style.height = '100%';
                svgContainer.style.pointerEvents = 'none';
                layer.appendChild(svgContainer);
            }

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const d = mod.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * currentScale} ${p.y * currentScale}`).join(' ');
            path.setAttribute('d', d);
            path.setAttribute('stroke', `rgb(${(mod.color || [0, 0, 0]).map(c => c * 255).join(',')})`);
            path.setAttribute('stroke-width', (mod.width || 2));
            path.setAttribute('fill', 'none');
            if (mod.opacity) path.setAttribute('stroke-opacity', mod.opacity);
            if (mod.width > 5) path.setAttribute('stroke-linecap', 'square');
            else path.setAttribute('stroke-linecap', 'round');

            path.setAttribute('class', 'rendered-mod');
            path.setAttribute('data-op-index', mod.opIndex);
            path.style.pointerEvents = 'auto';
            svgContainer.appendChild(path);
        } else if (mod.type === 'addImage') {
            const img = document.createElement('img');
            // Check if data is Uint8Array or String
            if (mod.data instanceof Uint8Array) {
                const blob = new Blob([mod.data], { type: mod.mimeType || 'image/jpeg' });
                img.src = URL.createObjectURL(blob);
            } else {
                img.src = mod.data;
            }

            img.className = 'rendered-mod';
            img.style.position = 'absolute';
            img.style.left = `${mod.x * currentScale}px`;
            img.style.top = `${mod.y * currentScale}px`;
            img.style.width = `${mod.width * currentScale}px`;
            img.style.height = `${mod.height * currentScale}px`;
            img.style.pointerEvents = 'auto';
            img.setAttribute('data-op-index', mod.opIndex);

            img.addEventListener('mousedown', (e) => {
                if (!editorState) return;
                const tool = editorState.currentTool;
                if (tool === 'select' || tool === 'image') { // 'image' tool might be 'add image', but maybe 'select' is better
                    e.stopPropagation();
                    selectedImage = {
                        opIndex: mod.opIndex,
                        chunkIndex: undefined,
                        x: mod.x * currentScale,
                        y: mod.y * currentScale,
                        width: mod.width * currentScale,
                        height: mod.height * currentScale
                    };
                    console.log('Selected New Image:', selectedImage);
                    renderSelectionBox(selectedImage);
                }
            });

            layer.appendChild(img);
        }
    }
}

// Image Selection Logic
document.getElementById('canvas-container').addEventListener('mousedown', (e) => {
    if (!editorState) return;
    const currentTool = editorState.currentTool;

    if (currentTool !== 'select' && currentTool !== 'image') return;
    if (!currentBackend) return;

    const rect = document.getElementById('pdf-canvas').getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Hit Test Images
    // Iterate in reverse order (top-most first)
    const images = currentBackend.imageObjects;
    let found = null;
    for (let i = images.length - 1; i >= 0; i--) {
        const img = images[i];
        if (x >= img.x && x <= img.x + img.width &&
            y >= img.y && y <= img.y + img.height) {
            found = img;
            break;
        }
    }

    if (found) {
        console.log('Selected Image:', found);
        selectedImage = found;
        renderSelectionBox(found);
    } else {
        // Only clear if clicking on empty space?
        // Or if we want to deselect.
        // For now, deselect.
        selectedImage = null;
        document.getElementById('annotation-layer').innerHTML = '';
    }
});

function renderSelectionBox(img) {
    const annotLayer = document.getElementById('annotation-layer');
    annotLayer.innerHTML = '';

    const box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.left = `${img.x}px`;
    box.style.top = `${img.y}px`;
    box.style.width = `${img.width}px`;
    box.style.height = `${img.height}px`;
    box.style.border = '2px solid #007bff';
    box.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
    box.style.pointerEvents = 'all';
    box.style.cursor = 'move';

    // State
    let isDragging = false;
    let isResizing = false;
    let resizeHandle = '';
    let startX, startY;
    let initialLeft, initialTop, initialWidth, initialHeight;

    // Handles
    const handles = ['nw', 'ne', 'sw', 'se'];
    handles.forEach(pos => {
        const h = document.createElement('div');
        h.style.position = 'absolute';
        h.style.width = '10px';
        h.style.height = '10px';
        h.style.background = '#007bff';
        h.style.border = '1px solid white';
        h.style.pointerEvents = 'all';
        h.style.cursor = `${pos}-resize`;
        h.dataset.handle = pos;

        if (pos.includes('n')) h.style.top = '-5px'; else h.style.bottom = '-5px';
        if (pos.includes('w')) h.style.left = '-5px'; else h.style.right = '-5px';

        h.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizeHandle = pos;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = parseFloat(box.style.left);
            initialTop = parseFloat(box.style.top);
            initialWidth = parseFloat(box.style.width);
            initialHeight = parseFloat(box.style.height);
            e.stopPropagation();
        });

        box.appendChild(h);
    });

    annotLayer.appendChild(box);

    box.addEventListener('mousedown', (e) => {
        if (e.target !== box) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseFloat(box.style.left);
        initialTop = parseFloat(box.style.top);
        initialWidth = parseFloat(box.style.width);
        initialHeight = parseFloat(box.style.height);
        e.stopPropagation();
    });

    const onMouseMove = (e) => {
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            box.style.left = `${initialLeft + dx}px`;
            box.style.top = `${initialTop + dy}px`;
        } else if (isResizing) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = initialLeft;
            let newTop = initialTop;
            let newWidth = initialWidth;
            let newHeight = initialHeight;

            if (resizeHandle.includes('e')) newWidth = initialWidth + dx;
            if (resizeHandle.includes('w')) {
                newWidth = initialWidth - dx;
                newLeft = initialLeft + dx;
            }
            if (resizeHandle.includes('s')) newHeight = initialHeight + dy;
            if (resizeHandle.includes('n')) {
                newHeight = initialHeight - dy;
                newTop = initialTop + dy;
            }

            if (newWidth > 10) {
                box.style.width = `${newWidth}px`;
                box.style.left = `${newLeft}px`;
            }
            if (newHeight > 10) {
                box.style.height = `${newHeight}px`;
                box.style.top = `${newTop}px`;
            }
        }
    };

    const onMouseUp = (e) => {
        if (!isDragging && !isResizing) return;

        isDragging = false;
        isResizing = false;

        const newX = parseFloat(box.style.left);
        const newY = parseFloat(box.style.top);
        const newW = parseFloat(box.style.width);
        const newH = parseFloat(box.style.height);

        // Update Visuals locally
        img.x = newX;
        img.y = newY;
        img.width = newW;
        img.height = newH;

        if (editorState) {
            // Delta Calculation (Movement)
            // Note: initialLeft/Top are set on mousedown.
            // If dragging, initialLeft is correct.
            // If resizing, initialLeft is correct.
            const dx = newX - initialLeft;
            const dy = newY - initialTop;

            const pdfDx = dx / currentScale;
            const pdfDy = dy / currentScale;

            let existingMod = editorState.getModification(currentPageIndex, img.opIndex, img.chunkIndex);

            let totalDx = pdfDx;
            let totalDy = pdfDy;

            if (existingMod) {
                if (!isNaN(existingMod.deltaX) && !isNaN(existingMod.deltaY)) {
                    totalDx += existingMod.deltaX;
                    totalDy += existingMod.deltaY;
                }
            }

            // Scale Calculation
            // We need ratio relative to the size BEFORE this interaction.
            // initialWidth is size before interaction.
            const scaleRatioX = newW / initialWidth;
            const scaleRatioY = newH / initialHeight;

            let totalScaleX = scaleRatioX;
            let totalScaleY = scaleRatioY;

            if (existingMod && existingMod.scaleX !== undefined) {
                if (!isNaN(existingMod.scaleX) && !isNaN(existingMod.scaleY)) {
                    totalScaleX *= existingMod.scaleX;
                    totalScaleY *= existingMod.scaleY;
                }
            }

            // Correction for Bottom-Left scaling origin (PDF standard)
            const heightPDF = img.height / currentScale;
            totalDy += heightPDF * (scaleRatioY - 1);

            if (isNaN(totalDx) || isNaN(totalDy) || isNaN(totalScaleX) || isNaN(totalScaleY)) {
                console.error('NaN detected in modification:', { totalDx, totalDy, totalScaleX, totalScaleY });
                return;
            }

            editorState.addModification(currentPageIndex, {
                type: 'image',
                opIndex: img.opIndex,
                chunkIndex: img.chunkIndex,
                deltaX: totalDx,
                deltaY: totalDy,
                scaleX: totalScaleX,
                scaleY: totalScaleY
            });
        }

        // Re-render to show changes
        renderPage(currentPageIndex).then(() => {
            // Restore Selection
            if (selectedImage && currentBackend) {
                const newImg = currentBackend.imageObjects.find(obj => obj.opIndex === selectedImage.opIndex);
                if (newImg) {
                    selectedImage = newImg;
                    renderSelectionBox(newImg);
                }
            }
        });

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Global Key Listener for Deletion
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedImage && editorState) {
            editorState.addModification(currentPageIndex, {
                type: 'delete',
                opIndex: selectedImage.opIndex,
                chunkIndex: selectedImage.chunkIndex
            });
            console.log('Deleted Image:', selectedImage);
            selectedImage = null;
            document.getElementById('annotation-layer').innerHTML = '';
            renderPage(currentPageIndex);
        } else if (toolManager) {
            toolManager.deleteSelection(currentPageIndex);
        }
    }
});

// Undo/Redo Listeners
document.getElementById('undo-btn').addEventListener('click', () => {
    if (editorState) {
        const pageIndex = editorState.undo();
        if (pageIndex !== undefined) {
            renderPage(pageIndex);
        }
    }
});

document.getElementById('redo-btn').addEventListener('click', () => {
    if (editorState) {
        const pageIndex = editorState.redo();
        if (pageIndex !== undefined) {
            renderPage(pageIndex);
        }
    }
});


document.getElementById('delete-page-btn').addEventListener('click', () => {
    if (editorState) {
        const input = prompt('Enter page numbers to delete (e.g., 1, 3-5):', currentPageIndex + 1);
        if (!input) return;

        const pagesToDelete = parsePageRange(input, currentDoc.pageCount);
        if (pagesToDelete.length === 0) {
            alert('Invalid page selection.');
            return;
        }

        if (confirm(`Are you sure you want to delete ${pagesToDelete.length} pages?`)) {
            pagesToDelete.forEach(pageNum => {
                editorState.deletePage(pageNum - 1); // 0-indexed
            });

            // Update UI immediately
            // We need to find a valid page to show.
            // If current page is deleted, move to next valid, or prev valid.

            let newIndex = currentPageIndex;
            while (editorState.isPageDeleted(newIndex) && newIndex < currentDoc.pageCount) {
                newIndex++;
            }
            if (newIndex >= currentDoc.pageCount) {
                newIndex = currentPageIndex - 1;
                while (editorState.isPageDeleted(newIndex) && newIndex >= 0) {
                    newIndex--;
                }
            }

            if (newIndex >= 0 && newIndex < currentDoc.pageCount) {
                currentPageIndex = newIndex;
                renderPage(currentPageIndex);
            } else {
                // All pages deleted?
                alert('All pages deleted!');
                document.getElementById('annotation-layer').innerHTML = '';
                // Clear canvas...
            }
        }
    }
});

function parsePageRange(input, maxPage) {
    const pages = new Set();
    const parts = input.split(',');
    for (const part of parts) {
        const range = part.trim().split('-');
        if (range.length === 1) {
            const num = parseInt(range[0]);
            if (!isNaN(num) && num >= 1 && num <= maxPage) {
                pages.add(num);
            }
        } else if (range.length === 2) {
            const start = parseInt(range[0]);
            const end = parseInt(range[1]);
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                    if (i >= 1 && i <= maxPage) pages.add(i);
                }
            }
        }
    }
    return Array.from(pages);
}

// Delete Button Listener
const deleteElementBtn = document.getElementById('delete-element-btn');
if (deleteElementBtn) {
    deleteElementBtn.addEventListener('click', () => {
        if (editorState) {
            if (selectedImage) {
                editorState.addModification(currentPageIndex, {
                    type: 'delete',
                    opIndex: selectedImage.opIndex,
                    chunkIndex: selectedImage.chunkIndex
                });
                selectedImage = null;
                document.getElementById('annotation-layer').innerHTML = ''; // Clear selection box
                renderPage(currentPageIndex);
            } else if (selectedTextElement) {
                const opIndex = parseInt(selectedTextElement.getAttribute('data-op-index'));
                if (!isNaN(opIndex)) {
                    editorState.addModification(currentPageIndex, {
                        type: 'delete',
                        opIndex: opIndex
                    });
                    selectedTextElement = null;
                    renderPage(currentPageIndex);
                }
            } else if (toolManager) {
                toolManager.deleteSelection(currentPageIndex);
            }
        }
    });
}

// Move Page Logic
document.getElementById('move-up-btn').addEventListener('click', () => {
    if (!editorState || !currentDoc) return;
    if (currentPageIndex > 0) {
        editorState.movePage(currentPageIndex, currentPageIndex - 1);
        currentPageIndex--;
        renderPage(currentPageIndex);
    }
});

document.getElementById('move-down-btn').addEventListener('click', () => {
    if (!editorState || !currentDoc) return;
    if (currentPageIndex < editorState.pageOrder.length - 1) {
        editorState.movePage(currentPageIndex, currentPageIndex + 1);
        currentPageIndex++;
        renderPage(currentPageIndex);
    }
});

// Image Upload Logic
document.getElementById('add-image-btn').addEventListener('click', () => {
    document.getElementById('image-upload-input').click();
});

document.getElementById('image-upload-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    // Create Image Object (Metadata)
    const blob = new Blob([data], { type: file.type });
    const imgBitmap = await createImageBitmap(blob);

    const width = imgBitmap.width;
    const height = imgBitmap.height;

    if (editorState) {
        // Scale down if too large
        const canvas = document.getElementById('pdf-canvas');
        // canvas.width is in pixels (scaled). pdfWidth is canvas.width / currentScale.
        // We want to limit image to e.g. 50% of page size.
        const pdfWidth = canvas.width / currentScale;
        const pdfHeight = canvas.height / currentScale;

        let targetW = width;
        let targetH = height;
        const maxW = pdfWidth * 0.8; // 80% of page
        const maxH = pdfHeight * 0.8;

        if (targetW > maxW || targetH > maxH) {
            const ratio = Math.min(maxW / targetW, maxH / targetH);
            targetW *= ratio;
            targetH *= ratio;
        }

        // Convert to JPEG for PDF compatibility
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(imgBitmap, 0, 0);

        const jpegDataUrl = tempCanvas.toDataURL('image/jpeg', 0.8);
        const res = await fetch(jpegDataUrl);
        const jpegBlob = await res.blob();
        const jpegBuffer = await jpegBlob.arrayBuffer();
        const jpegData = new Uint8Array(jpegBuffer);

        editorState.addModification(currentPageIndex, {
            type: 'addImage',
            data: jpegData,
            mimeType: 'image/jpeg',
            width: targetW,
            height: targetH,
            originalWidth: width,
            originalHeight: height,
            x: 100,
            y: 100,
            // Generate a pseudo-opIndex for new images (negative to avoid collision)
            opIndex: -Date.now()
        });


        renderPage(currentPageIndex);
    }

    // Reset input
    e.target.value = '';
});

// Click Listener for Tools (Text, Select, etc.)
document.getElementById('annotation-layer').addEventListener('click', (e) => {
    if (!toolManager) return;

    // Ignore if clicking on existing input
    if (e.target.tagName === 'INPUT') return;

    if (toolManager.state.currentTool === 'text') {

        // Check if we clicked on existing text (below annotation layer)
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const textSpan = elements.find(el => el.tagName === 'SPAN' && el.parentElement.id === 'text-layer');

        if (textSpan) {
            // User clicked on existing text, let them edit it
            textSpan.focus();
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        toolManager.handleEvent('onClick', {
            x, y,
            clientX: e.clientX,
            clientY: e.clientY,
            scale: currentScale,
            pageIndex: currentPageIndex
        });
    }
});

// Listen for modification added event
document.addEventListener('pdf-modification-added', (e) => {
    if (e.detail && e.detail.pageIndex === currentPageIndex) {
        renderPage(currentPageIndex);
    }
});

// Mouse Event Delegation for Drawing Tools
// Mouse Event Delegation for Drawing Tools
const canvasContainer = document.getElementById('canvas-container');
const annotationLayer = document.getElementById('annotation-layer');

canvasContainer.addEventListener('mousedown', (e) => {
    if (toolManager && (toolManager.state.currentTool === 'shape' || toolManager.state.currentTool === 'draw' || toolManager.state.currentTool === 'highlight')) {
        const rect = annotationLayer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const shapeType = document.getElementById('shape-select').value;

        toolManager.handleEvent('onMouseDown', {
            x, y,
            scale: currentScale,
            pageIndex: currentPageIndex,
            shapeType: shapeType
        });
    }
});

document.addEventListener('mousemove', (e) => {
    if (toolManager && (toolManager.state.currentTool === 'shape' || toolManager.state.currentTool === 'draw' || toolManager.state.currentTool === 'highlight')) {
        const rect = annotationLayer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        toolManager.handleEvent('onMouseMove', {
            x, y,
            scale: currentScale,
            pageIndex: currentPageIndex
        });
    }
});

document.addEventListener('mouseup', (e) => {
    if (toolManager && (toolManager.state.currentTool === 'shape' || toolManager.state.currentTool === 'draw' || toolManager.state.currentTool === 'highlight')) {
        const rect = annotationLayer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const shapeType = document.getElementById('shape-select').value;

        toolManager.handleEvent('onMouseUp', {
            x, y,
            scale: currentScale,
            pageIndex: currentPageIndex,
            shapeType: shapeType
        });
    }
});

// Context Menu Logic
const contextMenu = document.getElementById('context-menu');

function showContextMenu(e, element) {
    e.preventDefault();
    selectedTextElement = element; // Set selection

    // Populate values
    const fontFamily = element.style.fontFamily || element.dataset.fontFamily || 'Helvetica';
    const fontSize = parseInt(element.style.fontSize) / currentScale || element.dataset.fontSize || 12;
    const isBold = element.style.fontWeight === 'bold';
    const isItalic = element.style.fontStyle === 'italic';
    const isUnderline = element.style.textDecoration.includes('underline');
    const isStrike = element.style.textDecoration.includes('line-through');
    const color = element.style.color || '#000000';

    document.getElementById('ctx-font-family').value = fontFamily.split(',')[0].replace(/['"]/g, ''); // Simple cleanup
    document.getElementById('ctx-font-size').value = Math.round(fontSize);
    document.getElementById('ctx-text-color').value = rgbToHex(color);

    // Update buttons
    const boldBtn = document.getElementById('ctx-bold-btn');
    boldBtn.style.backgroundColor = isBold ? '#ddd' : '';

    const italicBtn = document.getElementById('ctx-italic-btn');
    italicBtn.style.backgroundColor = isItalic ? '#ddd' : '';

    const underlineBtn = document.getElementById('ctx-underline-btn');
    underlineBtn.style.backgroundColor = isUnderline ? '#ddd' : '';

    const strikeBtn = document.getElementById('ctx-strike-btn');
    strikeBtn.style.backgroundColor = isStrike ? '#ddd' : '';

    // Position menu
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
}

function hideContextMenu() {
    contextMenu.style.display = 'none';
}

document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
        hideContextMenu();
    }
});

// Helper: RGB to Hex
function rgbToHex(rgb) {
    if (!rgb) return '#000000';
    if (rgb.startsWith('#')) return rgb;
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return '#000000';
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

// Attach Context Menu to Layers
document.getElementById('annotation-layer').addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'DIV' && e.target.classList.contains('rendered-mod')) {
        showContextMenu(e, e.target);
    }
});

document.getElementById('text-layer').addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'SPAN') {
        showContextMenu(e, e.target);
    }
});

// Context Menu Actions
document.getElementById('ctx-font-family').addEventListener('change', (e) => applyTextStyle('fontFamily', e.target.value));
document.getElementById('ctx-font-size').addEventListener('change', (e) => applyTextStyle('fontSize', parseInt(e.target.value)));
document.getElementById('ctx-text-color').addEventListener('change', (e) => applyTextStyle('color', e.target.value));

document.getElementById('ctx-bold-btn').addEventListener('click', (e) => {
    const isBold = e.target.style.backgroundColor !== 'rgb(221, 221, 221)'; // Toggle check
    e.target.style.backgroundColor = isBold ? '#ddd' : '';
    applyTextStyle('bold', isBold);
});

document.getElementById('ctx-italic-btn').addEventListener('click', (e) => {
    const isItalic = e.target.style.backgroundColor !== 'rgb(221, 221, 221)';
    e.target.style.backgroundColor = isItalic ? '#ddd' : '';
    applyTextStyle('italic', isItalic);
});

document.getElementById('ctx-underline-btn').addEventListener('click', (e) => {
    const isUnderline = e.target.style.backgroundColor !== 'rgb(221, 221, 221)';
    e.target.style.backgroundColor = isUnderline ? '#ddd' : '';
    applyTextStyle('underline', isUnderline);
});

document.getElementById('ctx-strike-btn').addEventListener('click', (e) => {
    const isStrike = e.target.style.backgroundColor !== 'rgb(221, 221, 221)';
    e.target.style.backgroundColor = isStrike ? '#ddd' : '';
    applyTextStyle('strikethrough', isStrike);
});

document.getElementById('ctx-delete-btn').addEventListener('click', () => {
    if (selectedTextElement) {
        selectedTextElement.textContent = '';
        selectedTextElement.blur(); // Trigger save
        hideContextMenu();
    }
});

// Helper to apply styles
function applyTextStyle(style, value) {
    if (!selectedTextElement) return;

    if (style === 'fontFamily') {
        selectedTextElement.style.fontFamily = value;
    } else if (style === 'fontSize') {
        selectedTextElement.style.fontSize = `${value * currentScale}px`;
        selectedTextElement.dataset.fontSize = value; // Store unscaled
    } else if (style === 'bold') {
        selectedTextElement.style.fontWeight = value ? 'bold' : 'normal';
    } else if (style === 'italic') {
        selectedTextElement.style.fontStyle = value ? 'italic' : 'normal';
    } else if (style === 'underline') {
        if (value) {
            selectedTextElement.style.textDecoration = selectedTextElement.style.textDecoration.includes('line-through') ? 'underline line-through' : 'underline';
        } else {
            selectedTextElement.style.textDecoration = selectedTextElement.style.textDecoration.replace('underline', '').trim();
        }
    } else if (style === 'strikethrough') {
        if (value) {
            selectedTextElement.style.textDecoration = selectedTextElement.style.textDecoration.includes('underline') ? 'underline line-through' : 'line-through';
        } else {
            selectedTextElement.style.textDecoration = selectedTextElement.style.textDecoration.replace('line-through', '').trim();
        }
    } else if (style === 'color') {
        selectedTextElement.style.color = value;
    }

    // Trigger save if it's added text (rendered-mod)
    if (selectedTextElement.classList.contains('rendered-mod')) {
        const opIndex = parseInt(selectedTextElement.getAttribute('data-op-index'));
        if (editorState) {
            const mods = editorState.getModifications(currentPageIndex);
            const mod = mods.find(m => m.opIndex === opIndex);
            if (mod) {
                if (style === 'fontFamily') mod.fontFamily = value;
                if (style === 'fontSize') mod.fontSize = value;
                if (style === 'bold') mod.bold = value;
                if (style === 'italic') mod.italic = value;
                if (style === 'underline') mod.underline = value;
                if (style === 'strikethrough') mod.strikethrough = value;
                if (style === 'color') {
                    if (value.startsWith('#')) {
                        const r = parseInt(value.substr(1, 2), 16) / 255;
                        const g = parseInt(value.substr(3, 2), 16) / 255;
                        const b = parseInt(value.substr(5, 2), 16) / 255;
                        mod.color = [r, g, b];
                    }
                }
            }
        }
        selectedTextElement.blur(); // Trigger save
        selectedTextElement.focus(); // Refocus
    } else {
        // For original text, we save on blur. 
        selectedTextElement.dataset[style] = value;
    }
}

// Search Logic
const extractedTextCache = new Map();
let searchResults = [];
let currentSearchIndex = -1;

async function extractTextFromPage(pageIndex) {
    if (extractedTextCache.has(pageIndex)) return extractedTextCache.get(pageIndex);

    const page = await currentDoc.getPage(pageIndex);
    await page.loadResources();

    const { PageInterpreter } = await import('./engine/core/evaluator/page_interpreter.js');
    const interpreter = new PageInterpreter(page, backend, null, pageIndex);
    await interpreter.execute(await page.getContentStream());

    extractedTextCache.set(pageIndex, backend.textItems);
    return backend.textItems;
}

document.getElementById('search-btn').addEventListener('click', async () => {
    const query = document.getElementById('search-input').value;
    if (!query) return;

    searchResults = [];
    currentSearchIndex = -1;

    // Clear highlights
    document.querySelectorAll('.search-highlight').forEach(el => el.remove());

    const lowerQuery = query.toLowerCase();

    // Search all pages
    for (let i = 0; i < currentDoc.pageCount; i++) {
        if (editorState && editorState.isPageDeleted(i)) continue;

        const items = await extractTextFromPage(i);
        for (const item of items) {
            if (item.text.toLowerCase().includes(lowerQuery)) {
                searchResults.push({
                    pageIndex: i,
                    item: item
                });
            }
        }
    }

    if (searchResults.length > 0) {
        alert(`Found ${searchResults.length} matches.`);
        showSearchResult(0);
    } else {
        alert('No matches found.');
    }
});

function showSearchResult(index) {
    if (index < 0 || index >= searchResults.length) return;
    currentSearchIndex = index;

    const result = searchResults[index];

    // Navigate to page
    if (currentPageIndex !== result.pageIndex) {
        currentPageIndex = result.pageIndex;
        renderPage(currentPageIndex).then(() => {
            highlightResult(result);
        });
    } else {
        highlightResult(result);
    }
}

function highlightResult(result) {
    const layer = document.getElementById('annotation-layer');
    // Clear previous highlights
    document.querySelectorAll('.search-highlight').forEach(el => el.remove());

    const item = result.item;
    const div = document.createElement('div');
    div.className = 'search-highlight';
    div.style.position = 'absolute';
    div.style.backgroundColor = 'rgba(255, 255, 0, 0.4)';
    div.style.border = '1px solid yellow';

    // Calculate coords
    const pdfHeight = currentBackend.pdfHeight;
    const y = (pdfHeight - item.y - item.fontSize) * currentScale;
    const x = item.x * currentScale;

    const width = item.text.length * item.fontSize * 0.6 * currentScale;
    const height = item.fontSize * currentScale;

    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.style.width = `${width}px`;
    div.style.height = `${height}px`;

    layer.appendChild(div);
}

// XLSX Toolbar Listeners
document.getElementById('xlsx-bold').addEventListener('click', () => {
    if (window.currentXlsxEditor) window.currentXlsxEditor.toggleBold();
});
document.getElementById('xlsx-italic').addEventListener('click', () => {
    if (window.currentXlsxEditor) window.currentXlsxEditor.toggleItalic();
});
document.getElementById('xlsx-add-row').addEventListener('click', () => {
    if (window.currentXlsxEditor) window.currentXlsxEditor.addRow();
});
document.getElementById('xlsx-add-col').addEventListener('click', () => {
    if (window.currentXlsxEditor) window.currentXlsxEditor.addCol();
});

// Convert PDF to DOCX
let currentDocxBlob = null;

document.getElementById('convert-docx-btn').addEventListener('click', async () => {
    if (!currentDoc || window.currentFileType !== 'pdf') {
        alert('Please open a PDF first.');
        return;
    }

    const downloadBtn = document.getElementById('download-docx-btn');
    downloadBtn.style.display = 'none'; // Reset

    showLoading('Converting to Word Document...');
    try {
        // 1. Pro Conversion Logic
        const converter = new PDFToDOCX();
        // Access raw buffer from the PDFDocument reader -> FileBuffer -> data
        // Allow UI to render
        await new Promise(r => setTimeout(r, 50));

        const uint8Array = await converter.convert(currentDoc.reader.buffer.data);
        // Note: PDFToDOCX handles DOM reconstruction and Writing internally.
        currentDocxBlob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

        // 3. Enable Download Button
        document.getElementById('status').textContent = `Conversion Ready. Size: ${currentDocxBlob.size} bytes. Click Download.`;
        downloadBtn.style.display = 'inline-block';

    } catch (e) {
        console.error(e);
        document.getElementById('status').textContent = 'Error converting';
        alert('Error converting: ' + e.message);
    } finally {
        hideLoading();
    }
});

// Manual Download Handler
document.getElementById('download-docx-btn').addEventListener('click', () => {
    if (currentDocxBlob) {
        const url = URL.createObjectURL(currentDocxBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted.docx';
        a.click();
        URL.revokeObjectURL(url);
        document.getElementById('status').textContent = 'Download Started';
    }
});

// Convert PDF to XLSX
document.getElementById('convert-xlsx-btn').addEventListener('click', async () => {
    if (!currentDoc || window.currentFileType !== 'pdf') {
        alert('Please open a PDF first.');
        return;
    }

    const downloadDocxBtn = document.getElementById('download-docx-btn');
    const downloadXlsxBtn = document.getElementById('download-xlsx-btn');

    downloadDocxBtn.style.display = 'none';
    downloadXlsxBtn.style.display = 'none';

    showLoading('Analyzing Tables & Converting to Excel...');
    try {
        const { PdfToXlsx } = await import('./engine/convert/pdf_to_xlsx.js');
        await new Promise(r => setTimeout(r, 50));

        const converter = new PdfToXlsx(currentDoc.reader.buffer.data);
        const uint8Array = await converter.convert();

        currentDocxBlob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        document.getElementById('status').textContent = `Excel Ready. Size: ${currentDocxBlob.size} bytes. Click Download.`;

        // Setup dedicated XLSX download button
        downloadXlsxBtn.onclick = () => {
            const url = URL.createObjectURL(currentDocxBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'converted.xlsx';
            a.click();
        };
        downloadXlsxBtn.style.display = 'inline-block';

    } catch (e) {
        console.error(e);
        document.getElementById('status').textContent = 'Error converting';
        alert('Error converting: ' + e.message);
    } finally {
        hideLoading();
    }
});

window.showLoading = function (msg) {
    const overlay = document.getElementById('status-overlay');
    const msgEl = document.getElementById('status-message');
    if (overlay && msgEl) {
        msgEl.textContent = msg;
        overlay.style.display = 'flex';
    }
}

window.hideLoading = function () {
    const overlay = document.getElementById('status-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ==========================================
// MERGE TOOL LOGIC
// ==========================================

const mergeContainer = document.getElementById('merge-tool-container');
const mergeFileList = document.getElementById('merge-file-list');
const mergeStatus = document.getElementById('merge-status');


// 2. Hide Merge Tool (Back)
document.getElementById('cancel-merge-btn').addEventListener('click', () => {
    mergeContainer.style.display = 'none';

    // Restore Top Nav
    document.getElementById('main-nav').style.display = 'flex'; // Was 'block' in CSS? Check. 'flex' based on .controls class?
    // Actually controls class doesn't set display. 
    // Let's assume block or flex. It looked like flex row.

    if (window.currentFileType === 'pdf') {
        document.getElementById('main-container').style.display = 'flex';
        document.getElementById('controls').style.display = 'block';
        document.getElementById('toolbar').style.display = 'block';
    } else if (window.currentFileType === 'docx') {
        document.getElementById('docx-editor-container').style.display = 'block';
    } else if (window.currentFileType === 'xlsx') {
        document.getElementById('xlsx-editor-container').style.display = 'flex';
    }
});

// 3. Handle File Input
document.getElementById('merge-file-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    mergeStatus.textContent = `Processing ${files.length} files...`;

    for (const file of files) {
        try {
            const { PDFDocument } = await import('./engine/ast/pdf_document.js');
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const doc = await PDFDocument.load(uint8Array);

            mergeDocs.push({
                name: file.name,
                doc: doc,
                pageCount: doc.pages.length
            });
        } catch (err) {
            console.error('Error parsing file for merge:', file.name, err);
            alert(`Failed to load ${file.name}: ${err.message}`);
        }
    }

    renderMergeList();
    mergeStatus.textContent = '';
    e.target.value = ''; // Reset input to allow re-uploading same file
});

function renderMergeList() {
    mergeFileList.innerHTML = '';

    if (mergeDocs.length === 0) {
        mergeFileList.innerHTML = '<div id="merge-placeholder" style="text-align: center; color: #999; margin-top: 30px;">No files selected</div>';
        return;
    }

    mergeDocs.forEach((item, index) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.background = '#f8f9fa';
        div.style.padding = '10px';
        div.style.borderRadius = '4px';
        div.style.border = '1px solid #ddd';

        div.innerHTML = `
    <div>
        <strong>${index + 1}. ${item.name}</strong>
        <span style="color: #666; font-size: 0.9em;">(${item.pageCount} pages)</span>
    </div>
    <button class="remove-merge-item" data-index="${index}" style="color: red; background: none; border: none; cursor: pointer;">Remove</button>
`;
        mergeFileList.appendChild(div);
    });

    // Add listeners to Remove buttons
    document.querySelectorAll('.remove-merge-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            mergeDocs.splice(idx, 1);
            renderMergeList();
        });
    });
}

// 4. Execute Merge
let lastMergedPdfUrl = null;

document.getElementById('execute-merge-btn').addEventListener('click', async () => {
    if (mergeDocs.length === 0) {
        alert('Please add at least one PDF file.');
        return;
    }

    // Hide download button if visible from previous run
    document.getElementById('download-merged-btn').style.display = 'none';

    showLoading('Merging PDFs...');

    try {
        const { UniversalMutator } = await import('./engine/tools/universal_mutator.js');

        let mergedDoc = mergeDocs[0].doc;
        for (let i = 1; i < mergeDocs.length; i++) {
            mergedDoc = await UniversalMutator.mergePdfs(mergedDoc, mergeDocs[i].doc);
        }

        const outBytes = await mergedDoc.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });

        // Prepare Download
        if (lastMergedPdfUrl) URL.revokeObjectURL(lastMergedPdfUrl);
        lastMergedPdfUrl = URL.createObjectURL(blob);

        // Show Download Button
        const dlBtn = document.getElementById('download-merged-btn');
        dlBtn.style.display = 'inline-block';
        dlBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = lastMergedPdfUrl;
            a.download = `GodEngine_Merged.pdf`;
            a.click();
        };
        mergeStatus.textContent = 'Merge Complete! Click Download to save.';

    } catch (err) {
        console.error('Merge Error:', err);
        alert('Failed to merge: ' + err.message);
        mergeStatus.textContent = 'Merge Failed.';
    } finally {
        hideLoading();
    }
});

// 5. Execute Encrypt
document.getElementById('execute-encrypt-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('encrypt-file-input');
    const userPass = document.getElementById('encrypt-user-pass').value;
    const confirmPass = document.getElementById('encrypt-user-pass-confirm').value;
    // Owner pass is optional. If not set, usually usage of userPass or same is implied, or explicitly separate. 
    // Spec: If only user pass provided, owner pass is same (or computable).
    const ownerPass = document.getElementById('encrypt-owner-pass').value || userPass;

    if (!fileInput.files[0]) {
        alert('Please select a PDF file.');
        return;
    }
    if (!userPass) {
        alert('User password is required.');
        return;
    }
    if (userPass !== confirmPass) {
        alert('Passwords do not match.');
        return;
    }

    showLoading('Encrypting PDF natively...');
    try {
        const file = fileInput.files[0];
        const { PDFDocument } = await import('./engine/ast/pdf_document.js');
        const { UniversalMutator } = await import('./engine/tools/universal_mutator.js');

        const arrayBuffer = await file.arrayBuffer();
        const doc = await PDFDocument.load(new Uint8Array(arrayBuffer));

        const protectedDoc = await UniversalMutator.protectPdf(doc, userPass);
        const outBytes = await protectedDoc.save();

        // Handle Download
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const downloadBtn = document.getElementById('download-encrypted-btn');
        downloadBtn.style.display = 'inline-block';

        // Reset old listener to avoid multi-download triggers if reused
        const newBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);

        newBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name.replace('.pdf', '_protected.pdf');
            a.click();
        };

        const status = document.getElementById('encrypt-status');
        status.style.display = 'block';
        status.textContent = 'Encryption Complete. Click Download.';

    } catch (e) {
        console.error(e);
        alert('Encryption failed: ' + e.message);
    } finally {
        hideLoading();
    }
});

// 6. Decrypt / Unlock PDF
document.getElementById('check-password-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('decrypt-file-upload');
    const password = document.getElementById('decrypt-password').value;
    const ownerPassword = document.getElementById('decrypt-owner-password').value;
    const status = document.getElementById('decrypt-status');

    if (!fileInput.files[0]) {
        alert('Please select a PDF file.');
        return;
    }

    showLoading('Checking Password & Decrypting...');
    status.textContent = '';
    status.style.color = '#333';

    try {
        const file = fileInput.files[0];
        const { PDFDocument } = await import('./engine/ast/pdf_document.js');
        const { UniversalMutator } = await import('./engine/tools/universal_mutator.js');

        const arrayBuffer = await file.arrayBuffer();
        const doc = await PDFDocument.load(new Uint8Array(arrayBuffer));

        // Try Owner Password if provided, else User Password
        let usedPassword = password;
        if (ownerPassword) usedPassword = ownerPassword;

        // returns native AST modified document
        const unlockedDoc = await UniversalMutator.unlockPdf(doc, usedPassword);
        const outBytes = await unlockedDoc.save();

        status.textContent = 'Success! Document completely unlocked natively.';
        status.style.color = '#28a745';

        // Setup Download
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        // Remove old success buttons if any
        const oldBtn = document.getElementById('download-unlocked-btn');
        if (oldBtn) oldBtn.remove();

        const downBtn = document.createElement('button');
        downBtn.id = 'download-unlocked-btn';
        downBtn.textContent = 'Download Unlocked PDF';
        downBtn.style.cssText = 'margin-top:10px; background:#28a745; color:white; padding:10px 20px; border:none; border-radius:4px; cursor:pointer; display:block;';
        downBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name.replace('.pdf', '_unlocked.pdf');
            a.click();
        };

        status.parentNode.appendChild(downBtn);

    } catch (e) {
        console.error(e);
        if (e && e.message && e.message.includes('Incorrect Password')) {
            status.textContent = 'Incorrect Password.';
            status.style.color = '#dc3545';
        } else if (e && e.message && e.message.includes('No file')) {
            status.textContent = 'Error: No file loaded.';
        } else {
            status.textContent = 'Decryption Failed: ' + (e.message || e);
            status.style.color = '#dc3545';
        }
    } finally {
        hideLoading();
    }
});

// 7. Markdown to PDF
document.getElementById('md-input-type').addEventListener('change', (e) => {
    const isFile = e.target.value === 'file';
    document.getElementById('md-text-input-area').style.display = isFile ? 'none' : 'block';
    document.getElementById('md-file-input-area').style.display = isFile ? 'block' : 'none';
});

document.getElementById('md-file-upload').addEventListener('change', (e) => {
    if (e.target.files[0]) {
        document.getElementById('md-file-name').textContent = e.target.files[0].name;
    }
});

let lastMdPdfUrl = null;
document.getElementById('convert-md-btn').addEventListener('click', async () => {
    const inputType = document.getElementById('md-input-type').value;
    const status = document.getElementById('md-status');
    const downloadBtn = document.getElementById('download-md-pdf-btn');

    // Reset
    status.textContent = '';
    downloadBtn.style.display = 'none';
    if (lastMdPdfUrl) URL.revokeObjectURL(lastMdPdfUrl);

    let fileToProcess = null;

    if (inputType === 'text') {
        const text = document.getElementById('md-text-content').value;
        if (!text.trim()) {
            alert('Please enter markdown text.');
            return;
        }
        fileToProcess = new Blob([text], { type: 'text/markdown' });
    } else {
        const fileInput = document.getElementById('md-file-upload');
        if (!fileInput.files[0]) {
            alert('Please select a markdown file.');
            return;
        }
        fileToProcess = fileInput.files[0];
    }

    showLoading('Converting Markdown to PDF...');
    try {
        const { MarkdownToPdfTool } = await import('./engine/tools/convert/markdown_to_pdf_tool.js');
        const pdfBlob = await MarkdownToPdfTool.execute(fileToProcess);

        lastMdPdfUrl = URL.createObjectURL(pdfBlob);

        // Setup Download
        downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = lastMdPdfUrl;
            a.download = 'converted.pdf';
            a.click();
        };
        downloadBtn.style.display = 'inline-block';
        status.textContent = 'Conversion Successful!';
        status.style.color = '#28a745';

    } catch (e) {
        console.error(e);
        status.textContent = 'Conversion Failed: ' + e.message;
        status.style.color = '#dc3545';
    } finally {
        hideLoading();
    }
});

// ==========================================
// TOOLS DASHBOARD LOGIC
// ==========================================

const toolsDashboard = document.getElementById('tools-dashboard');


// Wire "Back to Tools" buttons
document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('back-to-tools-btn')) {
        // Hide all tool containers
        const toolIDs = ['merge-tool-container', 'split-tool-container', 'encrypt-tool-container', 'decrypt-tool-container', 'image-tool-container', 'text-tool-container'];
        toolIDs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Hide Main
        document.getElementById('main-container').style.display = 'none';
        document.getElementById('docx-editor-container').style.display = 'none';

        // Show Dashboard
        toolsDashboard.style.display = 'block';
        document.getElementById('main-nav').style.display = 'flex'; // Nav bar visible
    }
});

document.getElementById('close-dashboard-btn').addEventListener('click', () => {
    toolsDashboard.style.display = 'none';
    // Restore Main
    if (currentDoc) {
        document.getElementById('main-container').style.display = 'flex';
        document.getElementById('controls').style.display = 'block';
        document.getElementById('toolbar').style.display = 'block';
        const mainNav = document.getElementById('main-nav');
        if (mainNav) mainNav.style.display = 'flex';

        const td = document.getElementById('tools-dashboard');
        if (td) td.style.display = 'block';
    }
});

// Global Tool Activator
// Global Tool Activator
let currentActiveToolId = null;

window.activateTool = async (tool) => {
    // URL Routing
    if (!window._noPushState) {
        // Use relative path to avoid /public/ duplicate issues
        const toolUrl = tool ? tool : './';
        history.pushState({ tool }, "", toolUrl);
    }
    window._noPushState = false;

    // STRICT MUTUAL EXCLUSIVITY: Hide EVERYTHING first
    document.querySelectorAll('.tool-panel').forEach(el => el.style.display = 'none');

    // Hide dashboard and its nav buttons
    const td = document.getElementById('tools-dashboard');
    if (td) td.style.display = 'none';
    const mainNav = document.getElementById('main-nav');
    if (mainNav) mainNav.style.display = 'none'; // Hide the dashboard nav buttons (Merge, Split, etc.)

    const toolbar = document.getElementById('toolbar');
    if (toolbar) toolbar.style.display = 'none';
    const controls = document.getElementById('controls');
    if (controls) controls.style.display = 'none';
    const mainContainer = document.getElementById('main-container');
    if (mainContainer) mainContainer.style.display = 'none';


    // Check specific legacy cases
    switch (tool) {

        // Legacy encrypt/decrypt tools removed to use universal tools.
        case 'image-to-pdf':
            document.getElementById('image-tool-container').style.display = 'block';
            return;
        case 'md-to-pdf':
            document.getElementById('markdown-tool-container').style.display = 'block';
            return;
        case 'txt-to-pdf': // New Txt tool
            document.getElementById('text-tool-container').style.display = 'block';
            return;
        case 'ktxt-to-pdf': // Alias same tool
            document.getElementById('text-tool-container').style.display = 'block';
            return;
    }

    const nativeTools = ['delete-pages', 'extract-pages', 'split', 'watermark', 'rotate-pdf', 'flatten-pdf', 'encrypt', 'decrypt', 'merge', 'reorder-pdf'];
    const isNative = nativeTools.includes(tool);

    // Dynamic Registry Check (For Future Batches)
    try {
        let isValidTool = isNative;
        if (!isNative) {
            const { TOOL_REGISTRY } = await import('./engine/tools/tool_registry.js');
            isValidTool = TOOL_REGISTRY[tool];
        }

        if (isValidTool) {
            currentActiveToolId = tool;
            const uniContainer = document.getElementById('universal-tool-container');
            const title = document.getElementById('uni-tool-title');
            const desc = document.getElementById('uni-tool-desc');

            // Reset UI
            document.getElementById('uni-tool-input').value = '';
            document.getElementById('uni-tool-file-info').textContent = 'No file selected';
            document.getElementById('uni-tool-execute-btn').disabled = true;

            // Clear any custom injected UI
            const wmUI = document.getElementById('wm-ui-container');
            if (wmUI) wmUI.remove();

            // Set Title based on ID (Formatter)
            title.textContent = tool.replace(/-/g, ' ').toUpperCase();
            desc.textContent = `Upload a PDF to process with ${tool}.`;

            // Show/Hide Params
            const paramsContainer = document.getElementById('uni-tool-params-container');
            const paramsLabel = document.getElementById('uni-tool-params-label');
            const paramsInput = document.getElementById('uni-tool-params');
            const paramsSelect = document.getElementById('uni-tool-params-select');

            // Reset input type and confirm box for all tools
            paramsInput.type = 'text';
            let confirmInput = document.getElementById('uni-tool-params-confirm');
            let confirmLabel = document.getElementById('uni-tool-params-confirm-label');
            if (!confirmInput) {
                confirmLabel = document.createElement('label');
                confirmLabel.id = 'uni-tool-params-confirm-label';
                confirmLabel.style.display = 'block';
                confirmLabel.style.fontSize = '12px';
                confirmLabel.style.marginTop = '15px';
                confirmLabel.style.marginBottom = '5px';
                confirmLabel.style.fontWeight = 'bold';
                confirmLabel.textContent = 'Confirm Password';

                confirmInput = document.createElement('input');
                confirmInput.type = 'password';
                confirmInput.id = 'uni-tool-params-confirm';
                confirmInput.style.width = '100%';
                confirmInput.style.padding = '8px';
                confirmInput.style.border = '1px solid #ccc';
                confirmInput.style.borderRadius = '4px';
                confirmInput.placeholder = 'Confirm Password';

                paramsInput.parentNode.insertBefore(confirmLabel, paramsInput.nextSibling);
                paramsInput.parentNode.insertBefore(confirmInput, confirmLabel.nextSibling);
            }
            confirmInput.style.display = 'none';
            confirmLabel.style.display = 'none';
            confirmInput.value = '';

            if (['delete-pages', 'extract-pages', 'split', 'watermark', 'reorder-pdf', 'rotate-pdf', 'crop-pdf', 'encrypt', 'decrypt'].includes(tool)) {
                paramsContainer.style.display = 'block';
                if (tool === 'watermark') {
                    import('./engine/tools/watermark_ui.js').then(m => {
                        if (currentActiveToolId === 'watermark') {
                            m.buildWatermarkUI(paramsContainer, paramsLabel, paramsInput, paramsSelect, window.currentDoc, window.uniToolFiles, null);
                        }
                    });
                } else if (tool === 'encrypt' || tool === 'decrypt') {
                    paramsLabel.textContent = 'Password';
                    paramsInput.placeholder = 'e.g., mysecretpassword';
                    paramsInput.type = 'password';
                    if (tool === 'encrypt') {
                        confirmInput.style.display = 'block';
                        confirmLabel.style.display = 'block';
                    }
                } else if (tool === 'reorder-pdf') {
                    paramsLabel.textContent = 'New Order (Drag pages to update)';
                    paramsInput.placeholder = 'e.g., 1,3,2';
                } else {
                    paramsLabel.textContent = 'Page Ranges (e.g., 1-5, 8)';
                    paramsInput.placeholder = 'e.g., 1-5, 8';
                }
                if (tool === 'crop-pdf') {
                    paramsInput.style.display = 'none';
                } else {
                    paramsInput.style.display = 'block';
                }
                if (paramsSelect) paramsSelect.style.display = 'none';
            } else {
                // Default hidden params for others
                paramsContainer.style.display = 'none';
            }

            // --- ORGANIZER PREVIEW INJECTION ---
            // Ensure the preview container exists at the right place
            const oldOrg = document.getElementById('organizer-preview-container');
            if (oldOrg) oldOrg.remove();

            const orgPreview = document.createElement('div');
            orgPreview.id = 'organizer-preview-container';
            orgPreview.style.marginTop = '15px';
            orgPreview.style.marginBottom = '15px';
            orgPreview.style.display = 'none'; // Visible when populated

            // Insert before paramsContainer
            if (paramsContainer && paramsContainer.parentNode) {
                paramsContainer.parentNode.insertBefore(orgPreview, paramsContainer);
            } else {
                // Fallback
                uniToolInput.parentNode.appendChild(orgPreview);
            }

            // Restore Default Input Visibility (in case hidden by compare-pdf)
            const defaultWrapper = uniContainer.querySelector('div[style*="dashed"]');
            if (defaultWrapper) defaultWrapper.style.display = 'block';
            document.getElementById('uni-tool-input').style.display = 'none'; // Input itself stays hidden (triggered by btn)

            // update renderOrganizerPreview to target this ID
            // Note: The helper function 'renderOrganizerPreview' uses 'uni-tool-result' by mistake in previous step?
            // No, I need to update the helper function too. But here I Just set up the slot.
            // ------------------------------------

            // Multi-file support

            // Multi-file support
            const fileInput = document.getElementById('uni-tool-input');
            const btn = uniContainer.querySelector('button.secondary');
            // desc already defined above
            if (tool === 'merge') {
                fileInput.multiple = true;
                desc.textContent = `Upload multiple PDFs to merge.`;
            } else if (tool === 'excel-to-pdf') {
                fileInput.multiple = false;
                fileInput.accept = '.xlsx';
                desc.textContent = `Upload an Excel file to convert to PDF.`;
                // Find the button and update text

                if (btn) btn.textContent = 'Select Excel File';
            } else if (tool === 'word-to-pdf') {
                fileInput.multiple = false;
                fileInput.accept = '.docx';
                desc.textContent = `Upload a Word file to convert to PDF.`;

                if (btn) btn.textContent = 'Select Word File';
            } else if (tool === 'word-to-excel') {
                fileInput.multiple = false;
                fileInput.accept = '.docx';
                desc.textContent = `Upload a Word file to convert to Excel.`;

                if (btn) btn.textContent = 'Select Word File';
            } else if (tool === 'excel-to-word') {
                fileInput.multiple = false;
                fileInput.accept = '.xlsx';
                desc.textContent = `Upload an Excel file to convert to Word.`;

                if (btn) btn.textContent = 'Select Excel File';

            } else if (tool === 'pdf-to-ppt') {
                fileInput.multiple = false;
                fileInput.accept = '.pdf';
                desc.textContent = `Upload a PDF file to convert to PowerPoint.`;

                if (btn) btn.textContent = 'Select PDF File';
            } else if (tool === 'ppt-to-pdf') {
                fileInput.multiple = false;
                fileInput.accept = '.pptx';
                desc.textContent = `Upload a PowerPoint file to convert to PDF.`;
                if (btn) btn.textContent = 'Select PPT File';
            } else if (tool === 'grayscale-pdf') {
                desc.textContent = `Upload a PDF to process with grayscale pdf.\nConvert your PDF to black and white (grayscale).`;
                if (btn) btn.textContent = 'Select PDF File';
            } else if (tool === 'compress-pdf') {
                desc.textContent = `Upload a PDF to compress.\nOptimize the PDF file size by removing redundant data.`;
                if (btn) btn.textContent = 'Select PDF File';

                // Inject Custom UI for Compression
                paramsContainer.style.display = 'block';
                paramsInput.style.display = 'none';
                if (paramsSelect) paramsSelect.style.display = 'none';

                const existing = document.getElementById('compress-ui-container');
                if (existing) existing.remove();

                const cUI = document.createElement('div');
                cUI.id = 'compress-ui-container';
                cUI.style.marginTop = '15px';
                cUI.innerHTML = `
        <div style="padding: 10px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px;">
        <div style="margin-bottom: 8px;">
            <strong>Original File Size: </strong> <span id="compress-original-size">0 KB</span>
        </div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Compression Level (Target Size):</label>
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="range" id="compress-range" min="1" max="100" value="100" style="flex:1;">
                    <span id="compress-display-val" style="font-weight:bold; min-width:60px; text-align:right;">- KB</span>
            </div>
            <input type="hidden" id="compress-target-size">
                <small style="color:#666; display:block; margin-top:5px;">Drag to adjust final size estimation.</small>
        </div>
    </div>
    `;
                paramsContainer.appendChild(cUI);

                // Add Slider Listener
                setTimeout(() => {
                    const range = document.getElementById('compress-range');
                    const display = document.getElementById('compress-display-val');
                    const targetInput = document.getElementById('compress-target-size');

                    if (range) {
                        range.addEventListener('input', (e) => {
                            // Value is actually absolute KB in my logic below?
                            // Or percentage?
                            // Let's assume percentage for smoothness?
                            // But user wants "drag meter from 0 to original size".
                            // So slider value = KB.
                            const val = Number(e.target.value);
                            if (display) display.textContent = `${val} KB`;
                            if (targetInput) targetInput.value = val;
                        });
                    }
                }, 100);
            } else if (tool === 'repair-pdf') {
                desc.textContent = `Upload a corrupted or damaged PDF to repair.\nAttempts to recover valid objects and rebuild the file structure.`;
                if (btn) btn.textContent = 'Select Corrupt PDF';
            } else if (tool === 'flatten-pdf') {
                desc.textContent = `Upload a PDF to process with flatten pdf.\nMerge annotations and forms into the page content to make them non - editable.`;
                if (btn) btn.textContent = 'Select PDF File';
            } else if (tool === 'page-numbers') {
                desc.textContent = `Add page numbers to your PDF.`;
                if (btn) btn.textContent = 'Select PDF File';

                // Inject Custom UI
                paramsContainer.style.display = 'block';
                paramsInput.style.display = 'none'; // Hide default input
                if (paramsSelect) paramsSelect.style.display = 'none';

                // Clear previous custom UI
                const existing = document.getElementById('pn-ui-container');
                if (existing) existing.remove();

                const pnUI = document.createElement('div');
                pnUI.id = 'pn-ui-container';
                pnUI.style.marginTop = '10px';
                pnUI.innerHTML = `
        < div style = "margin-bottom:8px" >
            <label style="display:block;font-size:12px;margin-bottom:4px">Start Number:</label>
            <input type="number" id="pn-start" value="1" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
        </div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Format:</label>
            <select id="pn-format" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
                <option value="number">1, 2, 3 ...</option>
                <option value="page-number">Page 1, Page 2 ...</option>
                <option value="page-total">Page 1 of 10 ...</option>
                <option value="roman">i, ii, iii ...</option>
                <option value="roman-upper">I, II, III ...</option>
            </select>
        </div>
        <div>
            <label style="display:block;font-size:12px;margin-bottom:4px">Position:</label>
            <select id="pn-pos" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
                <option value="center">Bottom Center</option>
                <option value="left">Bottom Left</option>
                <option value="right">Bottom Right</option>
            </select>
        </div>
    `;
                paramsContainer.appendChild(pnUI);
                paramsLabel.textContent = 'Page Number Options';

            } else if (tool === 'sign-pdf') {
                desc.textContent = `Add a digital signature (text stamp) to your PDF.`;
                if (btn) btn.textContent = 'Sign PDF';

                paramsContainer.style.display = 'block';
                paramsInput.style.display = 'none';
                if (paramsSelect) paramsSelect.style.display = 'none';

                const existing = document.getElementById('sign-ui-container');
                if (existing) existing.remove();

                const signUI = document.createElement('div');
                signUI.id = 'sign-ui-container';
                signUI.style.marginTop = '10px';
                signUI.innerHTML = `
        <div style="margin-bottom:10px; display:flex; gap:10px">
            <button id="sign-mode-type" style="flex:1;padding:6px;cursor:pointer;background:#e2e8f0;border:1px solid #cbd5e0;border-radius:4px;font-weight:bold" onclick="document.getElementById('sign-draw-panel').style.display='none';document.getElementById('sign-type-panel').style.display='block';this.style.background='#cbd5e0';document.getElementById('sign-mode-draw').style.background='#fff'">Type</button>
            <button id="sign-mode-draw" style="flex:1;padding:6px;cursor:pointer;background:#fff;border:1px solid #cbd5e0;border-radius:4px" onclick="document.getElementById('sign-type-panel').style.display='none';document.getElementById('sign-draw-panel').style.display='block';this.style.background='#cbd5e0';document.getElementById('sign-mode-type').style.background='#fff'">Draw</button>
        </div>

        <div id="sign-type-panel">
            <div style="margin-bottom:10px">
                <label style="display:block;font-size:12px;margin-bottom:4px">Signature Text:</label>
                <input type="text" id="sign-text" placeholder="e.g. John Doe" value="Digitally Signed" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
            </div>
             <div style="margin-bottom:10px">
                <label style="display:block;font-size:12px;margin-bottom:4px">Ink Color:</label>
                <select id="sign-color" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
                    <option value="blue">Blue Ink (#0000CC)</option>
                    <option value="black">Black Ink (#000000)</option>
                    <option value="red">Red Ink (#CC0000)</option>
                </select>
            </div>
        </div>

        <div id="sign-draw-panel" style="display:none;margin-bottom:10px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Draw Signature:</label>
            <canvas id="sign-canvas" width="300" height="150" style="border:1px solid #cbd5e0; background:#fff; cursor:crosshair; width:100%"></canvas>
            <button id="sign-clear-btn" style="margin-top:4px;padding:4px 8px;font-size:11px">Clear</button>
        </div>

        <div style="margin-bottom:10px;border-top:1px solid #eee;padding-top:10px">
             <label style="display:block;font-size:12px;margin-bottom:4px">Pages:</label>
             <input type="text" id="sign-pages" placeholder="e.g. 1-3, 5 (Empty = All Pages)" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
        </div>

        <div style="margin-bottom:10px">
             <label style="display:block;font-size:12px;margin-bottom:4px">Position:</label>
             <div style="display:flex; gap:10px; align-items:center; margin-bottom:5px">
                 <span style="font-size:10px;width:30px">X%</span>
                 <input type="range" id="sign-x-range" min="0" max="100" value="80" style="flex:1" oninput="document.getElementById('sign-x-val').textContent=this.value+'%'">
                 <span id="sign-x-val" style="font-size:10px;width:30px">80%</span>
             </div>
             <div style="display:flex; gap:10px; align-items:center">
                 <span style="font-size:10px;width:30px">Y%</span>
                 <input type="range" id="sign-y-range" min="0" max="100" value="10" style="flex:1" oninput="document.getElementById('sign-y-val').textContent=this.value+'%'">
                 <span id="sign-y-val" style="font-size:10px;width:30px">10%</span>
             </div>
             <p style="font-size:10px;color:#777;margin-top:4px">X: Left to Right. Y: Bottom to Top.</p>
        </div>
    `;

                // Re-attach if needed, but we need to run script to attach Canvas listeners
                setTimeout(() => {
                    const cvs = document.getElementById('sign-canvas');
                    if (cvs) {
                        const ctx = cvs.getContext('2d');
                        ctx.strokeStyle = "#0000cc";
                        ctx.lineWidth = 2;
                        let drawing = false;

                        const getPos = (e) => {
                            const rect = cvs.getBoundingClientRect();
                            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
                        };

                        cvs.addEventListener('mousedown', (e) => { drawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); });
                        cvs.addEventListener('mousemove', (e) => {
                            if (!drawing) return;
                            const p = getPos(e);
                            ctx.lineTo(p.x, p.y);
                            ctx.stroke();
                        });
                        cvs.addEventListener('mouseup', () => drawing = false);
                        cvs.addEventListener('mouseleave', () => drawing = false);

                        document.getElementById('sign-clear-btn').addEventListener('click', () => {
                            ctx.clearRect(0, 0, cvs.width, cvs.height);
                        });

                        // Update Color logic for Canvas
                        document.getElementById('sign-color').addEventListener('change', (e) => {
                            const map = { 'blue': '#0000cc', 'black': '#000000', 'red': '#cc0000' };
                            ctx.strokeStyle = map[e.target.value] || '#0000cc';
                        });
                    }
                }, 100);

                paramsContainer.appendChild(signUI);
                paramsContainer.appendChild(signUI);
                paramsLabel.textContent = 'Signature Options';

            } else if (tool === 'redact-pdf') {
                desc.textContent = `Permanently mask sensitive information. Draw rectangles interactively on any page to fill the area with solid black, making the content unreadable.`;
                if (btn) btn.textContent = 'Redact PDF';

                paramsContainer.style.display = 'block';
                paramsInput.style.display = 'none';
                if (paramsSelect) paramsSelect.style.display = 'none';

                const existing = document.getElementById('redact-ui-container');
                if (existing) existing.remove();

                const ui = document.createElement('div');
                ui.id = 'redact-ui-container';
                ui.style.marginTop = '10px';
                ui.innerHTML = `
        <div style="background:#f8f9fa; padding:10px; border-radius:5px; border:1px solid #e9ecef;">
            <strong style="display:block;margin-bottom:5px;color:#d9534f">Redaction Mode</strong>
            <p style="font-size:12px;margin-bottom:10px">
                Drag your mouse over the page preview below to draw redaction boxes.
            </p>
            <button id="redact-clear-all" class="btn btn-sm btn-outline-danger" style="width:100%">Clear All Redactions</button>
            <div id="redact-list" style="margin-top:10px;max-height:100px;overflow-y:auto;font-size:11px;color:#666">
                No redactions added.
            </div>
        </div>
    `;
                paramsContainer.appendChild(ui);
                paramsLabel.textContent = 'Redaction Tools';

                // Clear Handler
                setTimeout(() => {
                    const clearBtn = document.getElementById('redact-clear-all');
                    if (clearBtn) {
                        clearBtn.onclick = () => {
                            if (confirm('Clear all redactions?')) {
                                window.activeRedactions = [];
                                // Trigger update to preview (how? we need a global update function or similar)
                                if (window.renderRedactions) window.renderRedactions();
                                document.getElementById('redact-list').innerHTML = 'No redactions added.';
                            }
                        };
                    }
                }, 100);

            } else if (tool === 'compare-pdf') {
                desc.textContent = `Compare two PDF files and generate a text difference report.`;
                if (btn) btn.textContent = 'Compare PDFs';

                // Hide default input
                document.getElementById('uni-tool-input').style.display = 'none'; // Hide default label/input area? 
                // Actually uni-tool-input is inside a wrapper div with dashed border.  
                // Let's just hide the "Select PDF File" button and File Info in that wrapper?
                // Or easier: Hide the whole wrapper and inject my own.
                const defaultWrapper = uniContainer.querySelector('div[style*="dashed"]');
                if (defaultWrapper) defaultWrapper.style.display = 'none';

                paramsContainer.style.display = 'block';
                paramsInput.style.display = 'none';
                if (paramsSelect) paramsSelect.style.display = 'none';

                const existing = document.getElementById('compare-ui-container');
                if (existing) existing.remove();

                const cUI = document.createElement('div');
                cUI.id = 'compare-ui-container';
                cUI.style.marginTop = '10px';
                cUI.innerHTML = `
        <div style="display:flex; gap:20px; flex-wrap:wrap">
            <div style="flex:1; padding:20px; background:#f8f9fa; border:1px solid #ddd; border-radius:4px; text-align:center">
                <strong style="display:block;margin-bottom:10px">Original PDF</strong>
                <input type="file" id="compare-file-1" accept=".pdf" style="display:block; margin:0 auto">
            </div>
            <div style="flex:1; padding:20px; background:#f8f9fa; border:1px solid #ddd; border-radius:4px; text-align:center">
                <strong style="display:block;margin-bottom:10px">Modified PDF</strong>
                <input type="file" id="compare-file-2" accept=".pdf" style="display:block; margin:0 auto">
            </div>
        </div>
    `;
                paramsContainer.appendChild(cUI);
                paramsLabel.textContent = 'Comparison Inputs';

                // Logic to update uniToolFiles
                const f1 = document.getElementById('compare-file-1');
                const f2 = document.getElementById('compare-file-2');

                const updateFiles = () => {
                    const files = [];
                    if (f1.files[0]) files.push(f1.files[0]);
                    if (f2.files[0]) files.push(f2.files[0]);
                    uniToolFiles = files;

                    const execBtn = document.getElementById('uni-tool-execute-btn');
                    if (execBtn) execBtn.disabled = files.length !== 2;

                    // Clear previous results
                    if (uniToolResult) uniToolResult.style.display = 'none';
                };

                f1.addEventListener('change', updateFiles);
                f2.addEventListener('change', updateFiles);

            } else if (tool === 'ocr-pdf') {
                desc.textContent = `Extract text from scanned PDF files using OCR (Optical Character Recognition).`;
                if (btn) btn.textContent = 'Perform OCR';

                paramsContainer.style.display = 'block';
                paramsInput.style.display = 'none';
                if (paramsSelect) paramsSelect.style.display = 'none';

                const existing = document.getElementById('ocr-ui-container');
                if (existing) existing.remove();

                const ocrUI = document.createElement('div');
                ocrUI.id = 'ocr-ui-container';
                ocrUI.style.marginTop = '10px';
                ocrUI.innerHTML = `
        <div style="margin-bottom:10px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Language:</label>
            <select id="ocr-lang" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
                <option value="eng">English</option>
                <option value="spa">Spanish</option>
                <option value="fra">French</option>
                <option value="deu">German</option>
                <option value="jpn">Japanese</option>
                <option value="chi_sim">Chinese (Simplified)</option>
            </select>
        </div>
        <div style="margin-bottom:10px">
             <label style="display:block;font-size:12px;margin-bottom:4px">Output Format:</label>
             <select id="ocr-format" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
                 <option value="txt">Plain Text (.txt)</option>
                 <option value="pdf">Searchable PDF (.pdf)</option>
             </select>
        </div>
        <div style="font-size:11px; color:#666; background:#fff3cd; padding:8px; border:1px solid #ffeeba; border-radius:4px">
            <strong>Note:</strong> OCR processing is done in your browser and may take some time for large documents. Internet connection required to load OCR engine.
        </div>
    `;
                paramsContainer.appendChild(ocrUI);
                paramsLabel.textContent = 'OCR Settings';

            } else if (tool === 'resize-pdf') {
                desc.textContent = `Resize PDF pages to standard or custom dimensions.`;
                if (btn) btn.textContent = 'Select PDF File';

                // Inject Custom UI
                paramsContainer.style.display = 'block';
                paramsInput.style.display = 'none';
                if (paramsSelect) paramsSelect.style.display = 'none';

                // Clean up
                const existing = document.getElementById('resize-ui-container');
                if (existing) existing.remove();

                const ui = document.createElement('div');
                ui.id = 'resize-ui-container';
                ui.style.marginTop = '10px';
                ui.innerHTML = `
        < div style = "margin-bottom:8px" >
            <label style="display:block;font-size:12px;margin-bottom:4px">Page Size:</label>
            <select id="resize-format" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
                <option value="a4">A4 (595 x 842 pt)</option>
                <option value="letter">Letter (612 x 792 pt)</option>
                <option value="legal">Legal (612 x 1008 pt)</option>
                <option value="a3">A3 (842 x 1191 pt)</option>
                <option value="custom">Custom Dimensions</option>
            </select>
        </div >
        <div id="resize-custom-dims" style="display:none; gap:10px; margin-bottom:8px">
            <input type="number" id="resize-w" placeholder="Width (pt)" style="width:48%;padding:8px;border:1px solid #ddd;border-radius:4px">
                <input type="number" id="resize-h" placeholder="Height (pt)" style="width:48%;padding:8px;border:1px solid #ddd;border-radius:4px">
                </div>
                <div style="font-size:11px;color:#666">
                    Content will be scaled to fit the new page size.
                </div>
                `;
                paramsContainer.appendChild(ui);
                paramsLabel.textContent = 'Resize Options';

                // Resize Logic
                const sel = document.getElementById('resize-format');
                const dims = document.getElementById('resize-custom-dims');
                const w = document.getElementById('resize-w');
                const h = document.getElementById('resize-h');
                const paramInput = document.getElementById('uni-tool-params');

                const updateResizeParams = () => {
                    const targetLabel = document.getElementById('resize-target-info');
                    let displayStr = '';

                    if (sel.value === 'custom') {
                        dims.style.display = 'flex';
                        const wv = w.value || 0;
                        const hv = h.value || 0;
                        paramInput.value = `${wv},${hv}`;
                        displayStr = `${wv} x ${hv} pt`;
                    } else {
                        dims.style.display = 'none';
                        paramInput.value = sel.value;
                        const map = {
                            'a4': 'A4 (595 x 842 pt)',
                            'letter': 'Letter (612 x 792 pt)',
                            'legal': 'Legal (612 x 1008 pt)',
                            'a3': 'A3 (842 x 1191 pt)'
                        };
                        displayStr = map[sel.value] || sel.value;
                    }
                    if (targetLabel) targetLabel.textContent = displayStr;
                };

                sel.addEventListener('change', updateResizeParams);
                w.addEventListener('input', updateResizeParams);
                h.addEventListener('input', updateResizeParams);
                updateResizeParams();

            } else if (tool === 'metadata') {
                desc.textContent = `Upload a PDF to process with metadata tools.\nView and edit document properties like Title, Author, Subject, and Keywords.`;
                if (btn) btn.textContent = 'Save Metadata';

                paramsContainer.style.display = 'block';
                paramsInput.style.display = 'none';
                if (paramsSelect) paramsSelect.style.display = 'none';

                const existing = document.getElementById('metadata-ui-container');
                if (existing) existing.remove();

                const mUI = document.createElement('div');
                mUI.id = 'metadata-ui-container';
                mUI.style.marginTop = '10px';
                mUI.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px">
            <div>
                <label style="display:block;font-size:11px;margin-bottom:2px">Title</label>
                <input type="text" id="meta-title" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px">
            </div>
            <div>
                <label style="display:block;font-size:11px;margin-bottom:2px">Author</label>
                <input type="text" id="meta-author" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px">
            </div>
            <div style="grid-column: span 2">
                <label style="display:block;font-size:11px;margin-bottom:2px">Subject</label>
                <input type="text" id="meta-subject" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px">
            </div>
            <div style="grid-column: span 2">
                <label style="display:block;font-size:11px;margin-bottom:2px">Keywords</label>
                <input type="text" id="meta-keywords" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px">
            </div>
            <div>
                <label style="display:block;font-size:11px;margin-bottom:2px">Creator</label>
                <input type="text" id="meta-creator" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px">
            </div>
            <div>
                <label style="display:block;font-size:11px;margin-bottom:2px">Producer</label>
                <input type="text" id="meta-producer" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px">
            </div>
        </div>
        <div style="margin-top:10px; display:flex; gap:10px">
            <button id="meta-read-btn" style="flex:1; padding:6px; cursor:pointer; background:#007bff; border:1px solid #0069d9; border-radius:4px; color:white; font-weight:500">Read Metadata</button>
            <button id="meta-clear-btn" style="flex:1; padding:6px; cursor:pointer; background:#fff3cd; border:1px solid #ffeeba; border-radius:4px; color:#856404; font-weight:500">Remove All (Clear)</button>
        </div>
        <div style="margin-top:5px; font-size:11px; color:#666">
            <i>Note: "Remove All" clears fields. Click "Save Metadata" to apply removal.</i>
        </div>
    `;
                paramsContainer.appendChild(mUI);
                paramsLabel.textContent = 'Metadata Fields';

                // Button Logic
                setTimeout(() => {
                    const mRead = document.getElementById('meta-read-btn');
                    const mClear = document.getElementById('meta-clear-btn');

                    if (mRead) {
                        mRead.onclick = async (e) => {
                            e.preventDefault();
                            if (uniToolFiles.length > 0) {
                                const btn = e.target;
                                const oldText = btn.textContent;
                                btn.textContent = 'Reading...';
                                try {
                                    await renderOrganizerPreview(uniToolFiles, 'metadata');
                                } finally {
                                    btn.textContent = oldText;
                                }
                            } else {
                                alert('Please select a file first.');
                            }
                        };
                    }
                    if (mClear) {
                        mClear.onclick = (e) => {
                            e.preventDefault();
                            ['meta-title', 'meta-author', 'meta-subject', 'meta-keywords', 'meta-creator', 'meta-producer']
                                .forEach(id => {
                                    const el = document.getElementById(id);
                                    if (el) el.value = '';
                                });
                        };
                    }
                }, 50);

            } else if (tool === 'font-analysis') {
                desc.textContent = `Upload a PDF to process with font analysis.\nGenerate a detailed report of all fonts used, including types and page locations.`;
                if (btn) btn.textContent = 'Analyze Fonts';

                paramsContainer.style.display = 'none';
                // We just need the button, no settings.

                paramsLabel.textContent = 'Analysis';

                // Clean up others
                const existing = document.getElementById('metadata-ui-container');
                if (existing) existing.remove();



            } else if (tool === 'word-watermark') {
                desc.textContent = `Add a text watermark to a Word document.`;
                paramsContainer.style.display = 'block';
                paramsLabel.textContent = 'Watermark Text';
                paramsInput.placeholder = 'e.g. DRAFT';
                fileInput.accept = '.docx';
                if (btn) btn.textContent = 'Select Word File';

            } else if (tool === 'word-merge') {
                desc.textContent = `Merge multiple Word documents into one.`;
                fileInput.multiple = true;
                fileInput.accept = '.docx';
                if (btn) btn.textContent = 'Select Word Files';

            } else if (tool === 'word-split') {
                desc.textContent = `Split a Word document into separate pages.`;
                fileInput.accept = '.docx';
                if (btn) btn.textContent = 'Select Word File';

            } else if (tool === 'excel-csv') {
                desc.textContent = `Convert Excel to CSV or CSV to Excel.`;
                fileInput.accept = '.xlsx, .csv';
                // Determine direction based on file extension later?
                // "Convert Format"
                if (btn) btn.textContent = 'Select File';

            } else if (tool === 'excel-merge') {
                desc.textContent = `Merge multiple Excel workbooks.`;
                fileInput.multiple = true;
                fileInput.accept = '.xlsx';
                if (btn) btn.textContent = 'Select Excel Files';

            } else if (tool === 'excel-split') {
                desc.textContent = `Split Excel sheets into separate files.`;
                fileInput.accept = '.xlsx';
                if (btn) btn.textContent = 'Select Excel File';

            } else if (['excel-pivot', 'excel-clean', 'excel-formula'].includes(tool)) {
                desc.textContent = `Upload an Excel file to open the Advanced Editor.`;
                fileInput.accept = '.xlsx';
                if (btn) btn.textContent = 'Open Excel Editor';
                // Using Universal Tool flow to get file, then we hijack execution.

            } else if (tool === 'header-footer') {
                desc.textContent = `Add headers or footers to your PDF.`;
                paramsContainer.style.display = 'block';
                paramsInput.style.display = 'none';
                if (paramsSelect) paramsSelect.style.display = 'none';

                const existing = document.getElementById('hf-ui-container');
                if (existing) existing.remove();

                const ui = document.createElement('div');
                ui.id = 'hf-ui-container';
                ui.style.marginTop = '10px';
                ui.innerHTML = `
                <div style="margin-bottom:8px">
                    <label style="display:block;font-size:12px;margin-bottom:4px">Text:</label>
                    <input type="text" id="hf-text" value="Confidential" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
                </div>
                <div style="display:flex; gap:10px; margin-bottom:8px">
                    <div style="flex:1">
                        <label style="display:block;font-size:12px;margin-bottom:4px">Position:</label>
                        <select id="hf-pos" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
                            <option value="top-left">Top Left</option>
                            <option value="top-center" selected>Top Center</option>
                            <option value="top-right">Top Right</option>
                            <option value="bottom-left">Bottom Left</option>
                            <option value="bottom-center">Bottom Center</option>
                            <option value="bottom-right">Bottom Right</option>
                        </select>
                    </div>
                    <div style="flex:1">
                        <label style="display:block;font-size:12px;margin-bottom:4px">Margin (pt):</label>
                        <input type="number" id="hf-margin" value="20" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
                    </div>
                </div>
                <div id="organizer-preview" style="display:flex; flex-wrap:wrap; gap:10px; padding:10px; background:#f5f5f5; border:1px solid #ddd; max-height:400px; overflow-y:auto; margin-top:10px;">
                    <div style="width:100%; text-align:center; color:#999; padding:20px;">No file selected</div>
                </div>
                `;
                paramsContainer.appendChild(ui);
                paramsLabel.textContent = 'Header/Footer Options';

                // Manual Preview Logic for Header Footer
                const previewContainer = document.getElementById('organizer-preview');
                const fileIn = document.getElementById('uni-tool-input'); // Universal Input

                // We need to attach listener. But fileIn might already have listener for `renderOrganizerPreview`.
                // Since we removed 'header-footer' from the list, `renderOrganizerPreview` will skip it.
                // So we can assume `previewContainer` won't be wiped.
                // We attach our own logic.

                const renderHFPreview = async () => {
                    if (fileIn.files.length === 0) return;
                    const file = fileIn.files[0];
                    previewContainer.innerHTML = '<div class="spinner"></div>';

                    try {
                        const { PDFDocument } = await import('./engine/ast/pdf_document.js');
                        const { CanvasBackend } = await import('./engine/graphics/canvas_backend.js');
                        const { PageInterpreter } = await import('./engine/core/evaluator/page_interpreter.js');

                        const ab = await file.arrayBuffer();
                        const doc = await PDFDocument.load(new Uint8Array(ab));

                        previewContainer.innerHTML = '';

                        for (let i = 0; i < doc.pageCount; i++) {
                            const page = await doc.getPage(i);
                            const mb = page.dict.get('MediaBox') || [0, 0, 612, 792];
                            const mbW = mb[2] - mb[0];
                            const mbH = mb[3] - mb[1];

                            const targetW = 150;
                            const scale = targetW / mbW;

                            const card = document.createElement('div');
                            card.className = 'organizer-card';
                            card.style.position = 'relative';
                            card.style.margin = '5px';
                            card.dataset.scale = scale;

                            const cvs = document.createElement('canvas');
                            cvs.width = targetW;
                            cvs.height = mbH * scale;
                            card.appendChild(cvs);

                            const ctx = cvs.getContext('2d');
                            ctx.save();
                            ctx.translate(0, cvs.height);
                            ctx.scale(scale, -scale);
                            const backend = new CanvasBackend(cvs, mbH, null, scale);
                            const interpreter = new PageInterpreter(page, backend);
                            await interpreter.execute(await page.getContentStream());
                            ctx.restore();

                            previewContainer.appendChild(card);
                        }

                        if (window.updateHFPreview) window.updateHFPreview();

                    } catch (e) {
                        console.error("Preview Render Error", e);
                        previewContainer.innerHTML = 'Error rendering preview';
                    }
                };

                fileIn.addEventListener('change', renderHFPreview);
                // If file already selected (e.g. going back)
                if (fileIn.files.length > 0) renderHFPreview();


                const txt = document.getElementById('hf-text');
                const pos = document.getElementById('hf-pos');
                const mar = document.getElementById('hf-margin');
                const pIn = document.getElementById('uni-tool-params');

                const updateHF = () => {
                    const config = {
                        text: txt.value,
                        pos: pos.value,
                        margin: mar.value
                    };
                    pIn.value = JSON.stringify(config);

                    // Update Preview logic
                    const container = document.getElementById('organizer-preview');
                    if (container) {
                        const cards = container.querySelectorAll('.organizer-card');
                        cards.forEach(card => {
                            // Ensure relative positioning
                            if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

                            let overlay = card.querySelector('.hf-overlay');
                            if (!overlay) {
                                overlay = document.createElement('div');
                                overlay.className = 'hf-overlay';
                                overlay.style.position = 'absolute';
                                overlay.style.pointerEvents = 'none';
                                overlay.style.color = 'rgba(255,0,0,0.6)'; // Reddish for visibility
                                overlay.style.fontFamily = 'Helvetica, sans-serif';
                                overlay.style.whiteSpace = 'nowrap';
                                overlay.style.zIndex = '10';
                                card.appendChild(overlay);
                            }

                            const scale = parseFloat(card.dataset.scale || 1);
                            overlay.textContent = config.text;
                            overlay.style.fontSize = Math.max(8, (10 * scale)) + 'px';

                            const mPx = (parseFloat(config.margin) || 0) * scale;
                            const canvas = card.querySelector('canvas');
                            const h = canvas ? canvas.height : card.clientHeight; // canvas.height is attribute (pixels)

                            // Reset
                            overlay.style.top = 'auto';
                            overlay.style.bottom = 'auto';
                            overlay.style.left = 'auto';
                            overlay.style.right = 'auto';
                            overlay.style.transform = 'none';
                            overlay.style.textAlign = 'left';

                            // Y Pos
                            if (config.pos.includes('top')) {
                                overlay.style.top = mPx + 'px';
                            } else {
                                // Bottom
                                overlay.style.top = (h - mPx - (10 * scale)) + 'px';
                            }

                            // X Pos
                            if (config.pos.includes('left')) {
                                overlay.style.left = mPx + 'px';
                            } else if (config.pos.includes('right')) {
                                overlay.style.right = mPx + 'px';
                                overlay.style.textAlign = 'right';
                            } else {
                                overlay.style.left = '50%';
                                overlay.style.transform = 'translateX(-50%)';
                                overlay.style.textAlign = 'center';
                            }
                        });
                    }
                };
                window.updateHFPreview = updateHF;

                txt.addEventListener('input', updateHF);
                pos.addEventListener('change', updateHF);
                mar.addEventListener('input', updateHF);
                updateHF();

            } else if (tool === 'watermark') {
                desc.textContent = `Add a text watermark to your PDF.`;
                if (btn) btn.textContent = 'Select PDF File';
            } else if (tool === 'decrypt') {
                desc.textContent = `Remove password security from PDF.`;
                if (btn) btn.textContent = 'Select PDF File';
            } else if (tool === 'pdf-to-json') {
                desc.textContent = `Extract PDF content to JSON format.`;
                if (btn) btn.textContent = 'Select PDF File';
            } else {
                fileInput.multiple = false;
                fileInput.removeAttribute('multiple');
                fileInput.accept = '.pdf'; // Default reset

                if (btn) btn.textContent = 'Select PDF File';
            }

            uniContainer.style.display = 'block';
            uniContainer.style.maxHeight = '90vh';
            uniContainer.style.overflowY = 'auto';
        } else {
            alert('Tool coming soon: ' + tool);
        }
    } catch (err) {
        console.warn(`Dynamic tool registry not found or tool ${tool} not loaded:`, err.message);
        // It is fully expected that Batch A tools won't find the registry.
        // Legacy features rely on this.
    }
};



// --- ORGANIZER UI HELPERS ---
const renderOrganizerPreview = async (files, toolId) => {
    // Target the specific container injected in activateTool
    const container = document.getElementById('organizer-preview-container');
    if (!container) return; // Should exist

    container.style.display = 'block';

    // Add Toolbar for specific tools
    let toolbarHtml = '';
    if (toolId === 'rotate-pdf') {
        toolbarHtml = `
    <div style="margin-bottom: 10px; display: flex; gap: 10px; justify-content: flex-end;">
        <button id="rotate-all-left" class="btn btn-sm btn-outline-primary">Rotate All Left</button>
        <button id="rotate-all-right" class="btn btn-sm btn-outline-primary">Rotate All Right</button>
    </div>
`;
    } else if (toolId === 'crop-pdf') {
        toolbarHtml = `
    <div style="margin-bottom: 10px; text-align: center; background: #fff; padding: 10px; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <span style="font-weight:bold; color:#d9534f;">Interactive Crop Mode</span>
        <span style="color:#666; font-size:0.9em; margin-left:10px;">Drag the red box corners on each page to crop content.</span>
    </div>
`;
    } else if (toolId === 'resize-pdf') {
        toolbarHtml = `
    <div style="margin-bottom: 10px; text-align: center; background: #fff; padding: 10px; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <span style="font-weight:bold; color:#28a745;">Resize Preview</span>
        <span id="resize-preview-info" style="color:#666; font-size:0.9em; margin-left:10px;">Loading...</span>
        <span style="color:#aaa; margin:0 5px;">âž”</span>
        <span id="resize-target-info" style="color:#007bff; font-weight:bold; font-size:0.9em;">A4</span>
    </div>
`;
    }

    container.innerHTML = toolbarHtml + '<div id="organizer-preview" style="display:flex; flex-wrap:wrap; gap:10px; padding:10px; background:#f5f5f5; border:1px solid #ddd; max-height:500px; overflow-y:auto;"></div>';

    const preview = document.getElementById('organizer-preview');

    if (toolId === 'rotate-pdf') {
        const btnAllLeft = document.getElementById('rotate-all-left');
        const btnAllRight = document.getElementById('rotate-all-right');

        // We can't bind click handlers yet because we need access to the canvas elements (or we can query them dynamically).
        // Best to define the handler relative to the page count or known state.
        // We will bind them after we know pageCount or inside the logic scope.
    }

    // Tools that support Page Grid or Single File Analysis
    if (['split', 'delete-pages', 'extract-pages', 'reorder-pdf', 'rotate-pdf', 'crop-pdf', 'resize-pdf', 'grayscale-pdf', 'flatten-pdf', 'redact-pdf', 'ocr-pdf', 'metadata', 'font-analysis'].includes(toolId)) {
        if (files.length !== 1) {
            preview.innerHTML = '<p>Please select exactly one PDF file for this tool.</p>';
            return;
        }
        const file = files[0];

        // Metadata Logic
        if (toolId === 'metadata') {
            // Load Metadata
            preview.innerHTML = '<p>Reading Metadata...</p>';
            try {
                const { MetadataTool } = await import('./engine/tools/advanced/metadata_tool.js');
                const meta = await MetadataTool.readMetadata(file);

                // Populate Inputs
                const safelySet = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val || '';
                }
                const getKey = (obj, key) => {
                    if (!obj) return '';
                    const found = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
                    return found ? obj[found] : '';
                };

                safelySet('meta-title', getKey(meta, 'Title'));
                safelySet('meta-author', getKey(meta, 'Author'));
                safelySet('meta-subject', getKey(meta, 'Subject'));
                safelySet('meta-keywords', getKey(meta, 'Keywords'));
                safelySet('meta-creator', getKey(meta, 'Creator'));
                safelySet('meta-producer', getKey(meta, 'Producer'));

                // Construct Preview
                const pad = (str, len) => str.padEnd(len, ' ');
                let displayHtml = `<div style="font-family: monospace; background: #fafafa; padding: 15px; border: 1px solid #eee; border-radius: 4px; white-space: pre; overflow-x: auto; font-size: 13px; line-height: 1.5;">`;

                displayHtml += `<span style="color:#2ecc71; font-weight:bold; display:block; margin-bottom:10px">Metadata Read Successfully</span>`;

                displayHtml += `${pad('Title:', 17)} ${getKey(meta, 'Title') || '(none)'}\n`;
                displayHtml += `${pad('Subject:', 17)} ${getKey(meta, 'Subject') || '(none)'}\n`;
                displayHtml += `${pad('Keywords:', 17)} ${getKey(meta, 'Keywords') || '(none)'}\n`;
                displayHtml += `${pad('Author:', 17)} ${getKey(meta, 'Author') || '(none)'}\n`;

                if (meta._extended) {
                    const ext = meta._extended;
                    displayHtml += `${pad('Custom Metadata:', 17)} ${ext['Custom Metadata']}\n`;
                    displayHtml += `${pad('Metadata Stream:', 17)} ${ext['Metadata Stream']}\n`;
                    displayHtml += `${pad('Tagged:', 17)} ${ext['Tagged']}\n`;
                    displayHtml += `${pad('UserProperties:', 17)} ${ext['UserProperties']}\n`;
                    displayHtml += `${pad('Suspects:', 17)} ${ext['Suspects']}\n`;
                    displayHtml += `${pad('Form:', 17)} ${ext['Form']}\n`;
                    displayHtml += `${pad('JavaScript:', 17)} ${ext['JavaScript']}\n`;
                    displayHtml += `${pad('Pages:', 17)} ${ext['Pages']}\n`;
                    displayHtml += `${pad('Encrypted:', 17)} ${ext['Encrypted']}\n`;
                    displayHtml += `${pad('Page size:', 17)} ${ext['Page size']}\n`;
                    displayHtml += `${pad('Page rot:', 17)} ${ext['Page rot']}\n`;
                    displayHtml += `${pad('File size:', 17)} ${ext['File size']}\n`;
                    displayHtml += `${pad('Optimized:', 17)} ${ext['Optimized']}\n`;
                    displayHtml += `${pad('PDF version:', 17)} ${ext['PDF version']}\n`;
                }
                displayHtml += `</div>`;

                preview.innerHTML = displayHtml;

                if (meta._debug) {
                    preview.innerHTML += `<p style="color:#d35400; font-size:11px; margin-top:5px">Debug: ${meta._debug}</p>`;
                }
            } catch (e) {
                preview.innerHTML = '<p style="color:red">Error reading metadata: ' + e.message + '</p>';
            }
            return; // Stop standard grid render
        }

        // Font Analysis Logic
        if (toolId === 'font-analysis') {
            preview.innerHTML = '<p>Click "Analyze Fonts" to begin analysis.</p>';
            return;
        }

        // Dynamic Import to ensure classes are available
        const { PDFDocument } = await import('./engine/ast/pdf_document.js');
        const { CanvasBackend } = await import('./engine/graphics/canvas_backend.js');
        const { PageInterpreter } = await import('./engine/core/evaluator/page_interpreter.js');

        const doc = await PDFDocument.load(file);
        const pageCount = doc.pageCount;

        // Reset Kinda State
        if (toolId === 'rotate-pdf') {
            window.globalRotation = 0;
        } else if (toolId === 'crop-pdf') {
            window.pageCrops = {}; // Stores {"0": [L, B, R, T], ... }
        } else if (toolId === 'resize-pdf') {
            const p1 = await doc.getPage(0);
            const mb = p1.dict.get('MediaBox') || [0, 0, 612, 792];
            const w = (mb[2] - mb[0]).toFixed(2);
            const h = (mb[3] - mb[1]).toFixed(2);
            const el = document.getElementById('resize-preview-info');
            if (el) el.textContent = `Original Size: ${w} x ${h} pt`;
        }

        // State for Selection
        const pageStates = new Array(pageCount).fill(false); // For select/delete
        // Reorder State
        let pageOrder = Array.from({ length: pageCount }, (_, i) => i);
        // Update Input Function
        const updateParams = () => {
            const input = document.getElementById('uni-tool-params');
            if (toolId === 'delete-pages') {
                const selected = pageOrder.filter(i => pageStates[i]).map(i => i + 1);
                input.value = selected.join(',');
            } else if (toolId === 'extract-pages') {
                const selected = pageOrder.filter(i => pageStates[i]).map(i => i + 1);
                input.value = selected.join(',');
            } else if (toolId === 'split') {
                const selected = pageOrder.filter(i => pageStates[i]).map(i => i + 1);
                input.value = selected.join(',');
            } else if (toolId === 'reorder-pdf') {
                const cards = Array.from(preview.children);
                const newOrderIndices = cards.map(c => parseInt(c.dataset.pageIndex));
                input.value = newOrderIndices.map(i => i + 1).join(',');
            } else if (toolId === 'rotate-pdf') {
                // Send single global rotation integer string
                input.value = (window.globalRotation || 0).toString();
            } else if (toolId === 'crop-pdf') {
                const payload = {
                    default: [0, 0, 0, 0],
                    pages: window.pageCrops || {}
                };
                input.value = JSON.stringify(payload);
            }
        };

        if (toolId === 'rotate-pdf') {
            const btnAllLeft = document.getElementById('rotate-all-left');
            const btnAllRight = document.getElementById('rotate-all-right');

            const rotateAll = (angle) => {
                window.globalRotation = (window.globalRotation || 0) + angle;
                const r = window.globalRotation;

                // Update ALL Visuals
                const cards = preview.querySelectorAll('.organizer-card');
                cards.forEach(card => {
                    const canvas = card.querySelector('canvas');
                    if (canvas) {
                        const base = parseInt(card.dataset.baseRotation || 0);
                        const total = base + r;
                        canvas.style.transform = `rotate(${total}deg)`;
                        canvas.style.transition = 'transform 0.3s ease';
                    }
                });
                updateParams();
            };

            if (btnAllLeft) btnAllLeft.onclick = () => rotateAll(-90);
            if (btnAllRight) btnAllRight.onclick = () => rotateAll(90);
        }



        if (toolId === 'sign-pdf') {
            // --- SIGNATURE INTERACTIVE PREVIEW ---

            window.currentSignPageIndex = 0;

            // Container Checks
            const previewContainer = preview; // 'uni-tool-preview'
            previewContainer.innerHTML = '';

            // Layout
            const layout = document.createElement('div');
            layout.style.display = 'flex';
            layout.style.flexDirection = 'column';
            layout.style.alignItems = 'center';
            layout.style.gap = '10px';
            previewContainer.appendChild(layout);

            // Controls (Page Nav)
            const controls = document.createElement('div');
            controls.innerHTML = `
        <button id="sign-prev-btn" class="btn btn-secondary" style="padding:4px 8px">Prev</button>
        <span id="sign-page-indicator" style="font-weight:bold;margin:0 10px">Page 1 / ${pageCount}</span>
        <button id="sign-next-btn" class="btn btn-secondary" style="padding:4px 8px">Next</button>
    `;
            layout.appendChild(controls);

            // Canvas Wrapper
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.border = '1px solid #ccc';
            wrapper.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
            wrapper.style.display = 'inline-block'; // Shrink to fit canvas
            layout.appendChild(wrapper);

            // The Canvas
            const canvas = document.createElement('canvas');
            wrapper.appendChild(canvas);

            // The Draggable Signature Overlay
            const signBox = document.createElement('div');
            signBox.id = 'sign-box-overlay';
            signBox.style.position = 'absolute';
            signBox.style.cursor = 'move';
            signBox.style.userSelect = 'none';
            signBox.style.border = '1px dashed #00f';
            signBox.style.display = 'flex';
            signBox.style.alignItems = 'center';
            signBox.style.justifyContent = 'center';
            signBox.style.whiteSpace = 'nowrap';
            // Start default
            signBox.style.left = '80%';
            signBox.style.bottom = '10%';
            signBox.style.transform = 'translate(-0%, 0%)'; // Anchor? Standard is Bottom-Left usually in PDF.
            // Let's stick to Top-Left based standard div positoning but map to Bottom-Left PDF coords.
            // Actually, PDF coords: (0,0) is Bottom-Left.
            // HTML absolute coords: (0,0) is Top-Left.
            // My slider inputs: X% (Left->Right), Y% (Bottom->Top).
            // So HTML Top = 100% - Y% - Height%.
            // HTML Left = X%.
            // Simplest: store visual state in %, map to inputs.
            wrapper.appendChild(signBox);

            // Function to Render Current Page
            const renderPage = async () => {
                const idx = window.currentSignPageIndex;
                document.getElementById('sign-page-indicator').textContent = `Page ${idx + 1} / ${pageCount}`;

                const page = await doc.getPage(idx);
                const mediaBox = page.dict.get('MediaBox') || [0, 0, 612, 792];
                const w = (mediaBox[2] - mediaBox[0]);
                const h = (mediaBox[3] - mediaBox[1]);

                // Fit to reasonable size
                const maxH = 600;
                const scale = maxH / h;

                canvas.width = w * scale;
                canvas.height = h * scale;

                // Draw
                const ctx = canvas.getContext('2d');
                ctx.save();
                ctx.scale(scale, scale);
                // No flip needed for standard text-rendering backend?
                // Standard backend expects bottom-up?
                // CanvasBackend expects standard cartesian?
                // Let's use standard page render logic.
                // PageInterpreter expects backend.
                ctx.translate(0, h);
                ctx.scale(1, -1);

                const backend = new CanvasBackend(ctx, h, null, 1);
                const interpreter = new PageInterpreter(page, backend);
                await interpreter.execute(await page.getContentStream());
                ctx.restore();

                updateSignatureVisuals();
            };

            // Function to Update Signature Appearance (Text/Image/Color)
            const updateSignatureVisuals = () => {
                const typePanel = document.getElementById('sign-type-panel');
                const isDraw = typePanel.style.display === 'none';

                signBox.innerHTML = ''; // Clear

                if (isDraw) {
                    // Get Image from Canvas
                    const srcCanvas = document.getElementById('sign-canvas');
                    if (srcCanvas) {
                        const img = new Image();
                        img.src = srcCanvas.toDataURL('image/png'); // Preview uses PNG for transparency
                        img.style.maxHeight = '50px'; // Fit preview
                        img.style.pointerEvents = 'none';
                        signBox.appendChild(img);
                        signBox.style.padding = '0';
                        signBox.style.border = '1px dashed #00f';
                    }
                } else {
                    const textVal = document.getElementById('sign-text').value;
                    const colorVal = document.getElementById('sign-color').value;
                    const colorMap = { 'blue': '#0000cc', 'black': '#000000', 'red': '#cc0000' };

                    signBox.textContent = textVal;
                    signBox.style.fontFamily = 'Helvetica, sans-serif';
                    signBox.style.fontSize = '24px'; // Relative? 
                    signBox.style.fontWeight = 'bold';
                    signBox.style.color = colorMap[colorVal];
                    signBox.style.padding = '5px';
                }
            };

            // --- Bi-Directional Sync ---

            // 1. Inputs Changed -> Update Visual Position
            const syncVisualsFromInputs = () => {
                const xPct = document.getElementById('sign-x-range').value;
                const yPct = document.getElementById('sign-y-range').value;

                // HTML Left = X%
                signBox.style.left = xPct + '%';
                // HTML Bottom = Y%
                signBox.style.top = '';
                signBox.style.bottom = yPct + '%';
            };

            // 2. Dragged -> Update Inputs
            const setupDrag = () => {
                let isDragging = false;
                let startX, startY;

                signBox.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    // Calculate offset?
                    // Let's just snap center or keep offset. 
                    // Simple: use mouse position relative to container.
                    e.preventDefault();
                });

                document.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;

                    const rect = wrapper.getBoundingClientRect();
                    let cx = e.clientX - rect.left;
                    let cy = e.clientY - rect.top;

                    // Clamp
                    if (cx < 0) cx = 0;
                    if (cx > rect.width) cx = rect.width;
                    if (cy < 0) cy = 0;
                    if (cy > rect.height) cy = rect.height;

                    // Convert to PDF Coords (Bottom-Left origin) %
                    const valX = (cx / rect.width) * 100;

                    // HTML Y (Top-down) -> PDF Y (Bottom-up)
                    // At bottom (cy = height), Y% should be 0.
                    // At top (cy = 0), Y% should be 100.
                    const valY = ((rect.height - cy) / rect.height) * 100;

                    // Update State
                    document.getElementById('sign-x-range').value = Math.round(valX);
                    document.getElementById('sign-y-range').value = Math.round(valY);
                    document.getElementById('sign-x-val').textContent = Math.round(valX) + '%';
                    document.getElementById('sign-y-val').textContent = Math.round(valY) + '%';

                    syncVisualsFromInputs();
                });

                document.addEventListener('mouseup', () => isDragging = false);
            };

            // Bind Events
            document.getElementById('sign-prev-btn').onclick = () => {
                if (window.currentSignPageIndex > 0) { window.currentSignPageIndex--; renderPage(); }
            };
            document.getElementById('sign-next-btn').onclick = () => {
                if (window.currentSignPageIndex < pageCount - 1) { window.currentSignPageIndex++; renderPage(); }
            };

            // Monitor sidebar inputs for changes
            const observeInputs = () => {
                ['sign-text', 'sign-color'].forEach(id => {
                    document.getElementById(id)?.addEventListener('input', updateSignatureVisuals);
                });
                ['sign-x-range', 'sign-y-range'].forEach(id => {
                    document.getElementById(id)?.addEventListener('input', syncVisualsFromInputs);
                });

                // Mode Buttons
                document.getElementById('sign-mode-type').addEventListener('click', () => setTimeout(updateSignatureVisuals, 50));
                document.getElementById('sign-mode-draw').addEventListener('click', () => setTimeout(updateSignatureVisuals, 50));

                // Canvas Drawing (needs to trigger update)
                const cvs = document.getElementById('sign-canvas');
                if (cvs) {
                    cvs.addEventListener('mouseup', () => setTimeout(updateSignatureVisuals, 100));
                    cvs.addEventListener('mouseleave', () => setTimeout(updateSignatureVisuals, 100)); // Update preview when done drawing
                }
            };

            // Initial calls
            renderPage();
            setupDrag();
            observeInputs();
            syncVisualsFromInputs();
        }



        if (toolId === 'redact-pdf') {
            // Initialize State
            if (!window.activeRedactions) window.activeRedactions = []; // Array of { page, x, y, width, height }
            window.currentRedactPageIndex = 0;

            // Create Slider UI
            const sliderControls = document.createElement('div');
            sliderControls.style.width = '100%';
            sliderControls.style.marginBottom = '10px';
            sliderControls.style.display = 'flex';
            sliderControls.style.justifyContent = 'center';
            sliderControls.style.alignItems = 'center';
            sliderControls.style.gap = '20px';
            sliderControls.innerHTML = `
         <button id="redact-prev-btn" class="btn btn-secondary">Previous</button>
         <span id="redact-page-indicator" style="font-weight:bold;">Page 1 / ${pageCount}</span>
         <button id="redact-next-btn" class="btn btn-secondary">Next</button>
     `;
            preview.appendChild(sliderControls);

            const largePreview = document.createElement('div');
            largePreview.id = 'redact-large-preview';
            largePreview.style.width = '100%';
            largePreview.style.textAlign = 'center';
            largePreview.style.position = 'relative';
            largePreview.style.minHeight = '400px';
            largePreview.style.overflow = 'auto'; // allow scroll if large
            preview.appendChild(largePreview);

            const renderCurrentPage = async () => {
                const idx = window.currentRedactPageIndex;
                document.getElementById('redact-page-indicator').textContent = `Page ${idx + 1} / ${pageCount}`;
                largePreview.innerHTML = '<p>Rendering...</p>';

                const page = await doc.getPage(idx);
                const mediaBox = page.dict.get('MediaBox') || [0, 0, 612, 792];
                const mbH = (mediaBox[3] || 792) - (mediaBox[1] || 0);

                const targetHeight = 800; // Large preview
                const scale = targetHeight / mbH;

                const canvas = document.createElement('canvas');
                const viewportWidth = (mediaBox[2] - mediaBox[0]) * scale;
                canvas.width = viewportWidth;
                canvas.height = targetHeight;
                canvas.style.border = '1px solid #ccc';

                try {
                    const ctx = canvas.getContext('2d');
                    ctx.save();
                    ctx.translate(0, canvas.height);
                    ctx.scale(scale, -scale);
                    const backend = new CanvasBackend(ctx, mbH, null, scale);
                    const interpreter = new PageInterpreter(page, backend);
                    await interpreter.execute(await page.getContentStream());
                    ctx.restore();
                } catch (e) { console.error(e); }

                largePreview.innerHTML = '';

                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';
                wrapper.style.display = 'inline-block';
                wrapper.appendChild(canvas);
                largePreview.appendChild(wrapper);

                // Draw Handler
                let isDrawing = false;
                let startX, startY;
                let currentBox = null;

                wrapper.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    isDrawing = true;
                    const rect = wrapper.getBoundingClientRect();
                    startX = e.clientX - rect.left;
                    startY = e.clientY - rect.top;

                    currentBox = document.createElement('div');
                    currentBox.style.position = 'absolute';
                    currentBox.style.background = 'rgba(0,0,0,0.5)'; // Semi-transparent black preview
                    currentBox.style.border = '1px solid red';
                    currentBox.style.left = startX + 'px';
                    currentBox.style.top = startY + 'px';
                    currentBox.style.width = '0px';
                    currentBox.style.height = '0px';
                    wrapper.appendChild(currentBox);
                });

                wrapper.addEventListener('mousemove', (e) => {
                    if (!isDrawing) return;
                    const rect = wrapper.getBoundingClientRect();
                    const currX = e.clientX - rect.left;
                    const currY = e.clientY - rect.top;

                    const w = currX - startX;
                    const h = currY - startY;

                    currentBox.style.width = Math.abs(w) + 'px';
                    currentBox.style.height = Math.abs(h) + 'px';
                    currentBox.style.left = (w < 0 ? currX : startX) + 'px';
                    currentBox.style.top = (h < 0 ? currY : startY) + 'px';
                });

                wrapper.addEventListener('mouseup', () => {
                    if (!isDrawing) return;
                    isDrawing = false;
                    if (!currentBox) return;

                    // Calculate PDF Coords
                    // UI: Top-Left based. 
                    // RedactTool expects: x, y (Top-Left from ui, converted later or simple rect)
                    // Let's store raw UI (PDF scaled) coordinates relative to Top-Left.

                    const uiLeft = parseFloat(currentBox.style.left);
                    const uiTop = parseFloat(currentBox.style.top);
                    const uiW = parseFloat(currentBox.style.width);
                    const uiH = parseFloat(currentBox.style.height);

                    if (uiW < 5 || uiH < 5) {
                        currentBox.remove();
                        return; // Too small
                    }

                    // Convert to PDF Units
                    // Scale = pixels / pts
                    // pts = pixels / scale
                    const pdfX = uiLeft / scale;
                    const pdfW = uiW / scale;
                    const pdfH = uiH / scale;
                    // uiTop is distance from top of canvas.
                    // mbH is the full PDF page height in PDF units.
                    // (uiTop / scale) is the distance from top in PDF units.
                    // mbH - (uiTop / scale) gives the Y coordinate of the top edge of the box from PDF bottom.
                    // To get the bottom-left Y coordinate, subtract the height of the box.
                    const pdfY = mbH - (uiTop / scale) - pdfH;

                    // Store
                    window.activeRedactions.push({
                        page: idx,
                        x: pdfX,
                        y: pdfY,
                        width: pdfW,
                        height: pdfH
                    });

                    currentBox.style.background = 'black'; // Solid black now
                    currentBox.style.border = 'none';

                    updateRedactionList();
                });

                // Render Existing
                window.activeRedactions.forEach(r => {
                    if (r.page === idx) {
                        const div = document.createElement('div');
                        div.style.position = 'absolute';
                        div.style.background = 'black';
                        div.style.left = (r.x * scale) + 'px';
                        // Convert PDF bottom-left Y to UI top-left Y
                        // PDF Y (bottom-left) -> UI Top (from top)
                        // UI Top = (Page Height - PDF Y - Redaction Height) * scale
                        div.style.top = (mbH - r.y - r.height) * scale + 'px';
                        div.style.width = (r.width * scale) + 'px';
                        div.style.height = (r.height * scale) + 'px';
                        div.title = "Redaction";
                        // Maybe add delete on click?
                        div.onclick = (e) => {
                            e.stopPropagation();
                            if (confirm('Remove this redaction?')) {
                                window.activeRedactions = window.activeRedactions.filter(item => item !== r);
                                div.remove();
                                updateRedactionList();
                            }
                        };
                        wrapper.appendChild(div);
                    }
                });
            };

            // Global Helper to re-render
            window.renderRedactions = renderCurrentPage;

            // Buttons
            document.getElementById('redact-prev-btn').onclick = () => {
                if (window.currentRedactPageIndex > 0) {
                    window.currentRedactPageIndex--;
                    renderCurrentPage();
                }
            };
            document.getElementById('redact-next-btn').onclick = () => {
                if (window.currentRedactPageIndex < pageCount - 1) {
                    window.currentRedactPageIndex++;
                    renderCurrentPage();
                }
            };

            // List Helper
            const updateRedactionList = () => {
                const list = document.getElementById('redact-list');
                if (!list) return;
                if (window.activeRedactions.length === 0) {
                    list.innerHTML = 'No redactions added.';
                    return;
                }
                list.innerHTML = window.activeRedactions.map((r, i) => `
             <div style="border-bottom:1px solid #eee;padding:2px">
                 #${i + 1} Page ${r.page + 1} 
                 (${Math.round(r.width)}x${Math.round(r.height)})
             </div>
         `).join('');
            };

            renderCurrentPage();
        }

        if (toolId === 'crop-pdf') {
            // --- CROP PDF SLIDER MODE ---

            // Initialize State
            window.currentCropPageIndex = 0;
            // pageCrops already initialized above

            // Create Slider UI
            const sliderControls = document.createElement('div');
            sliderControls.style.width = '100%';
            sliderControls.style.marginBottom = '10px';
            sliderControls.style.display = 'flex';
            sliderControls.style.justifyContent = 'center';
            sliderControls.style.alignItems = 'center';
            sliderControls.style.gap = '20px';
            sliderControls.innerHTML = `
                                <button id="crop-prev-btn" class="btn btn-secondary">Previous</button>
                                <span id="crop-page-indicator" style="font-weight:bold;">Page 1 / ${pageCount}</span>
                                <button id="crop-next-btn" class="btn btn-secondary">Next</button>
                                `;
            preview.appendChild(sliderControls);

            const largePreview = document.createElement('div');
            largePreview.id = 'crop-large-preview';
            largePreview.style.width = '100%';
            largePreview.style.display = 'flex';
            largePreview.style.justifyContent = 'center';
            largePreview.style.position = 'relative';
            largePreview.style.minHeight = '400px';
            preview.appendChild(largePreview);

            const renderCurrentPage = async () => {
                largePreview.innerHTML = '<p>Rendering...</p>';
                const idx = window.currentCropPageIndex;
                document.getElementById('crop-page-indicator').textContent = `Page ${idx + 1} / ${pageCount}`;

                const page = await doc.getPage(idx);

                // Get Metrics
                const mediaBox = page.dict.get('MediaBox') || [0, 0, 612, 792];
                const mbX = mediaBox[0] || 0;
                const mbY = mediaBox[1] || 0;
                const mbW = (mediaBox[2] || 612) - mbX;
                const mbH = (mediaBox[3] || 792) - mbY;

                // Scale for Large Preview (Fit Height or Width)
                // Let's aim for a reasonable height, e.g. 600px
                const targetHeight = 600;
                const scale = targetHeight / mbH;

                const canvas = document.createElement('canvas');
                canvas.width = mbW * scale;
                canvas.height = mbH * scale;

                // Render Page
                try {
                    const ctx = canvas.getContext('2d');
                    // PDF Coordinate System Setup
                    ctx.save();
                    ctx.translate(0, canvas.height); // Move to bottom
                    ctx.scale(1, -1); // Flip Y (now unit coords are bottom-up)
                    // Scale is handled by scaling the canvas size? No, we need to scale the context too if we want PDF units (72 DPI) to map to Canvas Pixels.
                    // But if we pass `scale` to backend, let's see.
                    // Actually, if we scaled canvas width/height by `scale`, we need to scale the context too? 
                    // Yes, ctx.scale(scale, scale) would be needed if drawing commands use PDF units.
                    // Combining Scale and Flip:
                    // ctx.transform(scale, 0, 0, -scale, 0, canvas.height);

                    // But let's look at how thumbnails do it? 
                    // Thumbnails seemed to work (or maybe I just assumed they did). 
                    // But I'll trust the Standard approach.
                    ctx.restore(); // Reset

                    ctx.save();
                    ctx.translate(0, canvas.height);
                    ctx.scale(scale, -scale);

                    // Correct Constructor: (ctx, height, textLayer)
                    const backend = new CanvasBackend(ctx, mbH, null, scale);

                    const interpreter = new PageInterpreter(page, backend);
                    const contentStream = await page.getContentStream();
                    await interpreter.execute(contentStream);

                    ctx.restore();
                } catch (e) { console.error(e); }

                largePreview.innerHTML = ''; // Clear loading

                // Wrapper
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';
                wrapper.style.display = 'inline-block';
                wrapper.style.userSelect = 'none';
                wrapper.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';

                wrapper.appendChild(canvas);

                // --- INTERACTIVE BOX ---
                const cropBox = document.createElement('div');
                cropBox.className = 'crop-box';
                cropBox.style.position = 'absolute';
                cropBox.style.border = '2px dashed red';
                cropBox.style.backgroundColor = 'rgba(255, 0, 0, 0.05)';
                cropBox.style.cursor = 'move';
                cropBox.style.zIndex = '10';

                // Initial State
                if (!window.pageCrops[idx]) {
                    window.pageCrops[idx] = [20, 20, 20, 20];
                }

                // Render Box Pos
                const renderBox = () => {
                    const [cL, cB, cR, cT] = window.pageCrops[idx];
                    cropBox.style.left = (cL * scale) + 'px';
                    cropBox.style.right = (cR * scale) + 'px';
                    cropBox.style.top = (cT * scale) + 'px';
                    cropBox.style.bottom = (cB * scale) + 'px';
                };
                renderBox();

                // Handles (Reusable Helper?)
                const createHandle = (cursor, posStyles) => {
                    const h = document.createElement('div');
                    h.style.position = 'absolute';
                    h.style.width = '12px';
                    h.style.height = '12px';
                    h.style.background = 'red';
                    h.style.cursor = cursor;
                    Object.assign(h.style, posStyles);
                    cropBox.appendChild(h);
                    return h;
                };

                const nw = createHandle('nw-resize', { left: '-6px', top: '-6px' });
                const ne = createHandle('ne-resize', { right: '-6px', top: '-6px' });
                const sw = createHandle('sw-resize', { left: '-6px', bottom: '-6px' });
                const se = createHandle('se-resize', { right: '-6px', bottom: '-6px' });

                // Interaction 
                const setupInteraction = (el, type) => {
                    el.addEventListener('mousedown', (e) => {
                        e.stopPropagation(); e.preventDefault();
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const wrapRect = wrapper.getBoundingClientRect();

                        const startL = cropBox.offsetLeft;
                        const startT = cropBox.offsetTop;
                        const startR = wrapRect.width - (startL + cropBox.offsetWidth);
                        const startB = wrapRect.height - (startT + cropBox.offsetHeight);

                        const onMove = (me) => {
                            const dx = me.clientX - startX;
                            const dy = me.clientY - startY;
                            let newL = startL, newT = startT, newR = startR, newB = startB;

                            if (type === 'move') { newL += dx; newR -= dx; newT += dy; newB -= dy; }
                            else if (type === 'nw') { newL += dx; newT += dy; }
                            else if (type === 'ne') { newR -= dx; newT += dy; }
                            else if (type === 'sw') { newL += dx; newB -= dy; }
                            else if (type === 'se') { newR -= dx; newB -= dy; }

                            const currentW = wrapRect.width - newL - newR;
                            const currentH = wrapRect.height - newT - newB;

                            if (currentW < 20 || currentH < 20) return;
                            if (newL < 0 || newR < 0 || newT < 0 || newB < 0) return;

                            cropBox.style.left = newL + 'px';
                            cropBox.style.right = newR + 'px';
                            cropBox.style.top = newT + 'px';
                            cropBox.style.bottom = newB + 'px';

                            const pL = Math.round(newL / scale);
                            const pR = Math.round(newR / scale);
                            const pT = Math.round(newT / scale);
                            const pB = Math.round(newB / scale);
                            window.pageCrops[idx] = [pL, pB, pR, pT];
                        };

                        const onUp = () => {
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                            updateParams();
                        };
                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                    });
                };

                setupInteraction(cropBox, 'move');
                setupInteraction(nw, 'nw');
                setupInteraction(ne, 'ne');
                setupInteraction(sw, 'sw');
                setupInteraction(se, 'se');

                wrapper.appendChild(cropBox);
                largePreview.appendChild(wrapper);
            };

            // Bind Buttons
            document.getElementById('crop-prev-btn').onclick = () => {
                if (window.currentCropPageIndex > 0) {
                    window.currentCropPageIndex--;
                    renderCurrentPage();
                }
            };
            document.getElementById('crop-next-btn').onclick = () => {
                if (window.currentCropPageIndex < pageCount - 1) {
                    window.currentCropPageIndex++;
                    renderCurrentPage();
                }
            };

            // Initial Render
            renderCurrentPage();

        } else {
            // --- GRID MODE (Original Logic) ---
            // Render Thumbnails Loop
            for (let i = 0; i < pageCount; i++) {
                const pageIndex = i;
                const page = await doc.getPage(pageIndex);

                // Create Card
                const card = document.createElement('div');
                card.className = 'organizer-card';
                card.style.width = '120px';
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.alignItems = 'center';
                card.style.cursor = 'pointer';
                card.style.border = '2px solid transparent';
                card.style.position = 'relative';
                card.dataset.pageIndex = pageIndex;

                if (toolId === 'reorder-pdf') {
                    card.draggable = true;
                    // Drag Events
                    card.addEventListener('dragstart', (e) => {
                        e.dataTransfer.setData('text/plain', pageIndex);
                        e.dataTransfer.effectAllowed = 'move';
                        window.draggedCard = card;
                    });
                    card.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        card.style.borderTop = '2px solid blue';
                    });
                    card.addEventListener('dragleave', () => {
                        card.style.borderTop = '2px solid transparent';
                    });
                    card.addEventListener('drop', (e) => {
                        e.preventDefault();
                        card.style.borderTop = '2px solid transparent';
                        if (window.draggedCard && window.draggedCard !== card) {
                            preview.insertBefore(window.draggedCard, card);
                            updateParams();
                        }
                    });
                }

                // Thumbnail Canvas
                const canvas = document.createElement('canvas');

                // Manual Viewport Calculation (Custom Engine Compatibility)
                let mediaBox = page.dict.get('MediaBox');
                if (!mediaBox) mediaBox = [0, 0, 612, 792]; // Default Letter

                // Handle if MediaBox is Array or likely Array (it is a Map get result, usually array)
                // But page.dict.get might return unresolved ref? page.loadResources resolves things?
                // Page dict usually has direct array for MediaBox. 
                // In PDFPage (custom), we don't have a helper.
                // Assuming it is resolved (PDFParser resolve loop?). 
                // PDFParser.parseObject returns arrays. So it should be an array.

                const mbX = mediaBox[0] || 0;
                const mbY = mediaBox[1] || 0;
                const mbW = (mediaBox[2] || 612) - mbX;
                const mbH = (mediaBox[3] || 792) - mbY;

                const targetWidth = 120;
                const scale = targetWidth / mbW;
                card.dataset.scale = scale;



                canvas.width = targetWidth;
                canvas.height = mbH * scale;

                if (toolId === 'grayscale-pdf') {
                    canvas.style.filter = 'grayscale(100%)';
                }

                // Render
                try {
                    const ctx = canvas.getContext('2d');
                    ctx.save();
                    ctx.translate(0, canvas.height);
                    ctx.scale(scale, -scale);

                    // Correct Constructor
                    const backend = new CanvasBackend(ctx, mbH, null, scale);

                    const interpreter = new PageInterpreter(page, backend);
                    const contentStream = await page.getContentStream();
                    await interpreter.execute(contentStream);
                    ctx.restore();
                } catch (e) {
                    console.warn('Thumb render error', e);
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ddd';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#000';
                    ctx.fillText(`Page ${pageIndex + 1}`, 10, 20);
                }

                card.appendChild(canvas);

                // Page Number Label
                const label = document.createElement('div');
                label.textContent = `Page ${pageIndex + 1}`;
                card.appendChild(label);

                if (toolId === 'rotate-pdf') {
                    // Store Base Rotation
                    const baseRot = page.dict.get('Rotate') || 0;
                    card.dataset.baseRotation = baseRot;

                    // Initialize visual state with global rotation (0 at start)
                    const currentGlobal = window.globalRotation || 0;
                    const total = baseRot + currentGlobal;
                    canvas.style.transform = `rotate(${total}deg)`;
                    canvas.style.transition = 'transform 0.3s ease';
                }




                // Click Handler
                card.addEventListener('click', () => {
                    if (toolId === 'reorder-pdf') return; // Drag only

                    pageStates[pageIndex] = !pageStates[pageIndex];

                    if (pageStates[pageIndex]) {
                        card.style.border = '2px solid blue';
                        card.style.opacity = toolId === 'delete-pages' ? '0.5' : '1';
                        if (toolId === 'delete-pages') {
                            // Add X overlay
                            const x = document.createElement('div');
                            x.className = 'delete-overlay';
                            x.textContent = 'X';
                            x.style.position = 'absolute';
                            x.style.top = '50%';
                            x.style.left = '50%';
                            x.style.transform = 'translate(-50%, -50%)';
                            x.style.color = 'red';
                            x.style.fontSize = '40px';
                            x.style.fontWeight = 'bold';
                            card.appendChild(x);
                        }
                    } else {
                        card.style.border = '2px solid transparent';
                        card.style.opacity = '1';
                        const x = card.querySelector('.delete-overlay');
                        if (x) x.remove();
                    }
                    updateParams();
                });

                preview.appendChild(card);
            }

            if (toolId === 'header-footer' && window.updateHFPreview) {
                window.updateHFPreview();
            }

        }
    } else if (toolId === 'merge') {
        preview.innerHTML = '';
        const list = document.createElement('ul');
        list.style.listStyle = 'none';
        list.style.padding = '0';

        files.forEach((f, i) => {
            const li = document.createElement('li');
            li.style.padding = '5px';
            li.style.margin = '5px 0';
            li.style.background = '#fff';
            li.style.border = '1px solid #ccc';
            li.display = 'flex';
            li.justifyContent = 'space-between';
            li.textContent = `${i + 1}. ${f.name} (${(f.size / 1024).toFixed(1)} KB)`;
            list.appendChild(li);
        });
        preview.appendChild(list);
    }
};

// Universal Tool Logic
const uniToolInput = document.getElementById('uni-tool-input');
const uniToolExecuteBtn = document.getElementById('uni-tool-execute-btn');
const uniToolResult = document.getElementById('uni-tool-result');
const uniToolDownloadBtn = document.getElementById('uni-tool-download-btn');
const uniToolPreviewContainer = document.getElementById('uni-tool-preview-container');

let uniToolFiles = [];
let currentResultBlob = null;
let currentResultName = '';

if (uniToolInput) {
    uniToolInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            uniToolFiles = Array.from(e.target.files);
            const info = document.getElementById('uni-tool-file-info');
            if (uniToolFiles.length === 1) {
                info.textContent = uniToolFiles[0].name;

                // Update Compress UI if active
                if (currentActiveToolId === 'compress-pdf') {
                    const sizeKB = (uniToolFiles[0].size / 1024).toFixed(2);
                    const sizeSpan = document.getElementById('compress-original-size');
                    const targetInput = document.getElementById('compress-target-size');
                    const compressRange = document.getElementById('compress-range');
                    const compressDisplay = document.getElementById('compress-display-val');

                    if (sizeSpan) sizeSpan.textContent = `${sizeKB} KB`;

                    const maxVal = Math.ceil(Number(sizeKB));

                    if (compressRange) {
                        compressRange.max = maxVal;
                        compressRange.value = maxVal; // Default to 100% (no compression) or maybe 75%?
                        // User said "finalize the size", so start at full? Or maybe 50% suggestion?
                        // User prompt: "drag meter from 0 to orginial size"
                        // I'll start at Original Size.
                    }
                    if (compressDisplay) {
                        compressDisplay.textContent = `${maxVal} KB`;
                    }
                    if (targetInput) {
                        targetInput.value = maxVal;
                    }
                }
            } else {
                info.textContent = `${uniToolFiles.length} files selected`;
            }
            uniToolExecuteBtn.disabled = false;
            // Hide previous result
            if (uniToolResult) uniToolResult.style.display = 'none';

            // TRIGGER PREVIEW
            if (currentActiveToolId && ['split', 'delete-pages', 'extract-pages', 'reorder-pdf', 'merge', 'rotate-pdf', 'crop-pdf', 'grayscale-pdf', 'flatten-pdf', 'resize-pdf', 'redact-pdf', 'ocr-pdf', 'metadata', 'font-analysis'].includes(currentActiveToolId)) {
                await renderOrganizerPreview(uniToolFiles, currentActiveToolId);
            }

            // Sync with global currentDoc if applicable
            if (uniToolFiles.length > 0 && ['delete-pages', 'rotate-pdf', 'split'].includes(currentActiveToolId)) {
                const { PDFDocument } = await import('./engine/ast/pdf_document.js');
                window.currentDoc = await PDFDocument.load(uniToolFiles[0]);
            }
        }
    });
}

if (uniToolExecuteBtn) {
    uniToolExecuteBtn.addEventListener('click', async () => {
        if (uniToolFiles.length === 0 || !currentActiveToolId) return;

        showLoading('Processing...');

        // INTERCEPT EXCEL EDITOR TOOLS
        if (['excel-pivot', 'excel-clean', 'excel-formula'].includes(currentActiveToolId)) {
            try {
                const { XlsxReader } = await import('./engine/xlsx/xlsx_reader.js');
                const { XlsxEditor } = await import('./engine/xlsx/xlsx_editor.js');

                const file = Array.isArray(uniToolFiles) ? uniToolFiles[0] : uniToolFiles;
                const buffer = await file.arrayBuffer();
                const reader = new XlsxReader(new Uint8Array(buffer));
                const workbook = await reader.load();

                // Show Editor UI
                document.getElementById('tools-dashboard').style.display = 'none';
                document.getElementById('universal-tool-container').style.display = 'none'; // Hide uni tool input
                const editorContainer = document.getElementById('xlsx-editor-container');
                editorContainer.style.display = 'block';

                // Setup Editor Instance
                const editorEl = document.getElementById('xlsx-grid-container');
                const editor = new XlsxEditor(editorEl);
                window.currentXlsxEditor = editor;
                editor.render(workbook);

                // Mode Feedback
                if (currentActiveToolId === 'excel-pivot') {
                    alert("Pivot Table: Please select data range (Feature in beta).");
                } else if (currentActiveToolId === 'excel-clean') {
                    if (confirm("Perform Auto-Clean? (Removes empty rows)")) {
                        // Basic Clean: Remove empty rows
                        let cleaned = 0;
                        for (const sheet of workbook.sheets) {
                            const rowsToDelete = [];
                            for (const r of sheet.rows.keys()) {
                                const row = sheet.rows.get(r);
                                if (!row || row.cells.size === 0) rowsToDelete.push(r);
                            }
                            rowsToDelete.forEach(r => sheet.rows.delete(r));
                            cleaned += rowsToDelete.length;
                        }
                        alert(`Cleaned ${cleaned} empty rows.`);
                        editor.render(workbook);
                    }
                } else if (currentActiveToolId === 'excel-formula') {
                    alert("Formula Debugger: Click on cells to trace precedents (Visual only).");
                }

                // Show Back Button inside editor?
                // Assuming XlsxEditor container has a "Back" or Close button.
                // Index.html structures usually have one. 
                // Line 2065 in app.js says it hides it.
                // We trust the UI has a close button we wired up elsewhere or user reloads/clicks Back.

            } catch (e) {
                console.error(e);
                alert("Failed to open Editor: " + e.message);
            } finally {
                hideLoading();
            }
            return;
        }

        try {
            // Batch A tools are already handled natively outside this execute block. 
            // If they reach here by mistake, redirect.
            const nativeTools = ['delete-pages', 'extract-pages', 'split', 'watermark', 'rotate-pdf', 'flatten-pdf', 'encrypt', 'decrypt', 'merge', 'reorder-pdf'];
            if (nativeTools.includes(currentActiveToolId)) {
                hideLoading();
                const file = Array.isArray(uniToolFiles) ? uniToolFiles[0] : uniToolFiles;
                const params = document.getElementById('uni-tool-params').value;

                if (currentActiveToolId === 'encrypt') {
                    const confirmInp = document.getElementById('uni-tool-params-confirm');
                    if (confirmInp && confirmInp.style.display !== 'none' && confirmInp.value !== params) {
                        alert("Passwords do not match! Please confirm your password correctly.");
                        return;
                    }
                }

                window.executeNativeTool(currentActiveToolId, file, params);
                return;
            }

            const { loadTool } = await import('./engine/tools/tool_registry.js');
            const module = await loadTool(currentActiveToolId);

            if (!module) throw new Error('Tool module not found.');

            const ClassName = Object.keys(module)[0];
            const ToolClass = module[ClassName];

            if (ToolClass && ToolClass.execute) {
                // Determine params value
                let paramsVal = 'jpeg'; // Default to simple jpeg
                const paramsInput = document.getElementById('uni-tool-params');

                // If specific tools need params input
                if (['delete-pages', 'extract-pages', 'split', 'reorder-pdf', 'rotate-pdf', 'crop-pdf', 'header-footer', 'resize-pdf'].includes(currentActiveToolId)) {
                    paramsVal = paramsInput.value;
                } else if (currentActiveToolId === 'page-numbers') {
                    // Gather custom params
                    const start = document.getElementById('pn-start')?.value || 1;
                    const format = document.getElementById('pn-format')?.value || 'number';
                    const position = document.getElementById('pn-pos')?.value || 'center';
                    paramsVal = JSON.stringify({ start, format, position });
                } else if (currentActiveToolId === 'watermark') {
                    const includeText = document.getElementById('wm-check-text')?.checked || false;
                    const includeImage = document.getElementById('wm-check-image')?.checked || false;

                    // Text Params
                    const text = document.getElementById('wm-text')?.value || 'CONFIDENTIAL';
                    const textSize = document.getElementById('wm-size')?.value || 10; // Default 10%
                    const textRot = document.getElementById('wm-rot')?.value || 45;
                    const textColor = document.getElementById('wm-color')?.value || '#cccccc';
                    const textOpacity = document.getElementById('wm-opacity')?.value || 0.5;
                    const textX = document.getElementById('wm-x-pct')?.value || 50;
                    const textY = document.getElementById('wm-y-pct')?.value || 50;

                    // Image Params
                    const imgSize = document.getElementById('wm-img-size')?.value || 30; // Default 30%
                    const imgRot = document.getElementById('wm-img-rot')?.value || 0;
                    const imgOpacity = document.getElementById('wm-img-opacity')?.value || 0.8;
                    const imgX = document.getElementById('wm-img-x-pct')?.value || 50;
                    const imgY = document.getElementById('wm-img-y-pct')?.value || 50;

                    const pages = document.getElementById('wm-pages')?.value || 'all';
                    const imagePages = document.getElementById('wm-img-pages')?.value || 'all';

                    const uiContainer = document.getElementById('wm-ui-container');
                    const imgData = uiContainer ? uiContainer.dataset.imgData : null;

                    paramsVal = JSON.stringify({
                        includeText, includeImage,
                        pages,
                        imagePages,
                        textConfig: {
                            text,
                            scalePct: Number(textSize) / 100, // Pass Normalized
                            rotation: Number(textRot),
                            color: textColor,
                            opacity: Number(textOpacity),
                            xPct: Number(textX),
                            yPct: Number(textY)
                        },
                        imageConfig: {
                            scalePct: Number(imgSize) / 100, // Pass Normalized
                            rotation: Number(imgRot),
                            opacity: Number(imgOpacity),
                            xPct: Number(imgX),
                            yPct: Number(imgY),
                            data: imgData
                        }
                    });
                } else if (currentActiveToolId === 'metadata') {
                    paramsVal = JSON.stringify({
                        Title: document.getElementById('meta-title')?.value || '',
                        Author: document.getElementById('meta-author')?.value || '',
                        Subject: document.getElementById('meta-subject')?.value || '',
                        Keywords: document.getElementById('meta-keywords')?.value || '',
                        Creator: document.getElementById('meta-creator')?.value || '',
                        Producer: document.getElementById('meta-producer')?.value || ''
                    });
                } else if (currentActiveToolId === 'font-analysis') {
                    paramsVal = '{}';
                } else if (currentActiveToolId === 'sign-pdf') {
                    const mode = document.getElementById('sign-draw-panel').style.display !== 'none' ? 'draw' : 'type';
                    let imageData = null;
                    if (mode === 'draw') {
                        const cvs = document.getElementById('sign-canvas');
                        // Use JPEG to match PDFWriter's DCTDecode expectation
                        // Check if canvas has white background (JPEGs don't support transparency)
                        // If transparent, it turns black. We set white bg in CSS but need to fill it?
                        const ctx = cvs.getContext('2d');
                        ctx.globalCompositeOperation = 'destination-over';
                        ctx.fillStyle = "white";
                        ctx.fillRect(0, 0, cvs.width, cvs.height);

                        imageData = cvs.toDataURL('image/jpeg', 0.8);
                    }
                    paramsVal = JSON.stringify({
                        mode,
                        text: document.getElementById('sign-text')?.value || 'Digitally Signed',
                        color: document.getElementById('sign-color')?.value || 'blue',
                        pages: document.getElementById('sign-pages')?.value || '',
                        x: document.getElementById('sign-x-range')?.value || 80,
                        y: document.getElementById('sign-y-range')?.value || 10,
                        imageData
                    });

                } else if (currentActiveToolId === 'redact-pdf') {
                    if (!window.activeRedactions || window.activeRedactions.length === 0) {
                        alert('Please add at least one redaction box.');
                        hideLoading();
                        return;
                    }
                    paramsVal = JSON.stringify(window.activeRedactions);

                } else if (currentActiveToolId === 'compress-pdf') {
                    const target = document.getElementById('compress-target-size')?.value || 0;
                    paramsVal = JSON.stringify({ targetSizeKB: Number(target) });

                } else if (currentActiveToolId === 'ocr-pdf') {
                    const lang = document.getElementById('ocr-lang')?.value || 'eng';
                    const format = document.getElementById('ocr-format')?.value || 'txt';
                    paramsVal = JSON.stringify({ lang, format });
                }

                let input = uniToolFiles.length === 1 ? uniToolFiles[0] : uniToolFiles;
                if (currentActiveToolId === 'merge' && !Array.isArray(input)) input = [input];

                let result = await ToolClass.execute(input, paramsVal);

                if (result instanceof Uint8Array) {
                    // Convert to Blob for consistency
                    result = new Blob([result], { type: 'application/pdf' });
                }
                const resultBlob = result;
                currentResultBlob = resultBlob;

                let ext = 'pdf';
                if (currentActiveToolId === 'split') ext = 'zip';
                else if (currentActiveToolId === 'pdf-to-image') {
                    // Always image now
                    if (resultBlob.type === 'image/png') ext = 'png';
                    else ext = 'jpeg';
                }
                else if (currentActiveToolId === 'pdf-to-text') ext = 'txt';
                else if (currentActiveToolId === 'ocr-pdf') {
                    const format = document.getElementById('ocr-format')?.value || 'txt';
                    ext = format;
                }
                else if (currentActiveToolId === 'pdf-to-html') ext = 'html';
                else if (currentActiveToolId === 'pdf-to-excel') ext = 'xlsx';
                else if (currentActiveToolId === 'word-to-excel') ext = 'xlsx';
                else if (currentActiveToolId === 'excel-to-word') ext = 'docx';
                else if (currentActiveToolId === 'excel-to-word') ext = 'docx';
                else if (currentActiveToolId === 'pdf-to-word') ext = 'docx';
                else if (currentActiveToolId === 'pdf-to-ppt') ext = 'pptx';
                else if (currentActiveToolId === 'pdf-to-json') ext = 'json';

                else if (currentActiveToolId === 'compare-pdf') ext = 'json';
                else if (currentActiveToolId === 'font-analysis') ext = 'json';

                currentResultName = `${currentActiveToolId}_result.${ext}`;

                // Show Result UI
                if (uniToolResult) uniToolResult.style.display = 'block';
                if (uniToolPreviewContainer) uniToolPreviewContainer.innerHTML = '';

                // Preview Logic
                if (resultBlob.preview) {
                    if (uniToolPreviewContainer) uniToolPreviewContainer.innerHTML = resultBlob.preview;
                } else if (currentActiveToolId === 'font-analysis') {
                    const text = await resultBlob.text();
                    const json = JSON.parse(text);
                    let html = `<div style="padding:10px; background:white; border:1px solid #ddd; border-radius:4px;">`;
                    html += `<h3 style="margin-top:0">Font Analysis Report</h3><p>Unique Fonts Found: <strong>${json.count}</strong></p>`;
                    html += '<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:12px;">';
                    html += '<thead style="background:#f5f5f5;"><tr style="text-align:left;"><th style="padding:8px; border:1px solid #ddd;">Font Name</th><th style="padding:8px; border:1px solid #ddd;">Type</th><th style="padding:8px; border:1px solid #ddd;">Match / Accuracy</th><th style="padding:8px; border:1px solid #ddd;">Pages</th></tr></thead><tbody>';

                    json.fonts.forEach(f => {
                        const match = f.accuracy || '-';
                        const matchColor = match.includes('Exact') ? '#28a745' : (match.includes('Gener') ? '#fd7e14' : '#666');
                        html += `<tr>
                    <td style="padding:8px; border:1px solid #ddd; font-family:monospace">${f.name}</td>
                    <td style="padding:8px; border:1px solid #ddd;">${f.type}</td>
                    <td style="padding:8px; border:1px solid #ddd; color:${matchColor}; font-weight:500">${match}</td>
                    <td style="padding:8px; border:1px solid #ddd;">${f.pages}</td>
                </tr>`;
                    });
                    html += '</tbody></table></div>';

                    if (uniToolPreviewContainer) uniToolPreviewContainer.innerHTML = html;

                } else if (ext === 'html' || currentActiveToolId === 'compare-pdf') {
                    // Render HTML in Iframe
                    const url = URL.createObjectURL(resultBlob);
                    const iframe = document.createElement('iframe');
                    iframe.src = url;
                    iframe.style.width = '100%';
                    iframe.style.height = '600px';
                    iframe.style.border = '1px solid #ccc';
                    if (uniToolPreviewContainer) {
                        uniToolPreviewContainer.innerHTML = '';
                        uniToolPreviewContainer.appendChild(iframe);
                    }
                } else if ((ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp') && resultBlob instanceof Blob) {
                    const img = document.createElement('img');
                    try {
                        img.src = URL.createObjectURL(resultBlob);
                        img.style.maxWidth = '100%';
                        img.style.maxHeight = '300px';
                        img.style.border = '1px solid #ddd';
                        img.style.borderRadius = '4px';
                        if (uniToolPreviewContainer) uniToolPreviewContainer.appendChild(img);
                    } catch (e) {
                        console.error("Preview failed:", e);
                        if (uniToolPreviewContainer) uniToolPreviewContainer.innerHTML = '<p>Preview unavailable</p>';
                    }
                } else if (ext === 'pdf') {
                    // Start of PDF Preview Logic
                    // Skip Result Preview for Watermark tool (User Request: "one preview")
                    if (currentActiveToolId === 'watermark') {
                        uniToolPreviewContainer.innerHTML = ''; // Ensure empty
                    } else if (uniToolPreviewContainer) {
                        uniToolPreviewContainer.innerHTML = '<div style="margin-bottom:10px; font-weight:bold; color:#666;">Result Preview (Page 1):</div>';
                        const canvas = document.createElement('canvas');
                        canvas.style.border = '1px solid #ccc';
                        canvas.style.maxWidth = '100%';
                        canvas.style.maxHeight = '500px';
                        canvas.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                        uniToolPreviewContainer.appendChild(canvas);

                        // Render Result
                        try {
                            const { PDFDocument } = await import('./engine/ast/pdf_document.js');
                            const { CanvasBackend } = await import('./engine/graphics/canvas_backend.js');
                            const { PageInterpreter } = await import('./engine/core/evaluator/page_interpreter.js');

                            let blobToLoad = resultBlob;
                            if (resultBlob instanceof Uint8Array) {
                                blobToLoad = new Blob([resultBlob], { type: 'application/pdf' });
                            }

                            const doc = await PDFDocument.load(blobToLoad);
                            const page = await doc.getPage(0);
                            await page.loadResources();

                            const mediaBox = page.dict.get('MediaBox') || [0, 0, 612, 792];
                            const pdfWidth = Math.abs(mediaBox[2] - mediaBox[0]);
                            const pdfHeight = Math.abs(mediaBox[3] - mediaBox[1]);
                            const scale = 0.6; // Preview scale

                            canvas.width = pdfWidth * scale;
                            canvas.height = pdfHeight * scale;

                            // Text Layer for Preview
                            const textLayer = document.createElement('div');
                            textLayer.style.position = 'absolute';
                            textLayer.style.left = '0';
                            textLayer.style.top = '0';
                            textLayer.style.width = `${canvas.width}px`;
                            textLayer.style.height = `${canvas.height}px`;
                            textLayer.style.pointerEvents = 'none'; // Let clicks pass through

                            // Wrapper to hold canvas + text layer
                            const wrapper = document.createElement('div');
                            wrapper.style.position = 'relative';
                            wrapper.style.border = '1px solid #ccc';
                            wrapper.style.display = 'inline-block';
                            wrapper.appendChild(canvas);
                            wrapper.appendChild(textLayer);

                            // IMPORTANT: Remove direct canvas append, use wrapper
                            // But uniToolPreviewContainer.appendChild(canvas) was called earlier.
                            // We need to clear and append wrapper.
                            uniToolPreviewContainer.innerHTML = '<div style="margin-bottom:10px; font-weight:bold; color:#666;">Result Preview (Page 1):</div>';
                            uniToolPreviewContainer.appendChild(wrapper);

                            const ctx = canvas.getContext('2d');
                            ctx.scale(scale, scale);
                            ctx.translate(0, pdfHeight);
                            ctx.scale(1, -1);

                            const backend = new CanvasBackend(ctx, pdfHeight, textLayer, scale);
                            const interpreter = new PageInterpreter(page, backend);
                            await interpreter.execute(await page.getContentStream());

                        } catch (e) {
                            console.error("PDF Preview Error:", e);
                            uniToolPreviewContainer.insertAdjacentHTML('beforeend', `<p style="color:red">Preview failed: ${e.message}</p>`);
                        }
                    }
                } else if (ext === 'zip') {
                    if (uniToolPreviewContainer) uniToolPreviewContainer.innerHTML = '<div style="font-size: 3rem;">ðŸ“¦</div><p>ZIP Archive Ready</p>';
                } else {
                    if (uniToolPreviewContainer) uniToolPreviewContainer.innerHTML = '<div style="font-size: 3rem;">ðŸ“„</div><p>File Ready</p>';
                }

                // REMOVED ALERT
            } else {
                throw new Error('Invalid Tool Implementation.');
            }

        } catch (err) {
            if (err.message === "PDF is damaged") {
                // Show error in the result preview area (guaranteed visible)
                if (uniToolPreviewContainer) {
                    uniToolPreviewContainer.innerHTML = `
                <div style="
                    color: #d32f2f;
                    background-color: #fdecea;
                    padding: 15px;
                    border-radius: 8px;
                    border: 1px solid #f5c6cb;
                    margin-top: 20px;
                    text-align: center;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                ">
                    <span style="font-size: 24px;">â Œ</span>
                    <span>PDF is damaged and cannot be repaired.</span>
                </div>
             `;
                }
            } else if (err.message === "Invalid password." || err.message === "This PDF is not encrypted." || err.message.includes("Unsupported encryption")) {
                if (uniToolResult) uniToolResult.style.display = 'block';
                if (uniToolPreviewContainer) {
                    uniToolPreviewContainer.innerHTML = `
                        <div style="color: #d32f2f; background: #fdecea; padding: 15px; border-radius: 8px; border: 1px solid #f5c6cb; text-align: center; font-weight: bold;">
                            <span style="font-size: 20px;">âš ï¸ </span> ${err.message}
                        </div>
                    `;
                }
            } else {
                console.error(err);
                alert('Error executing tool: ' + err.message);
            }
        } finally {
            hideLoading();
        }
    });
}

if (uniToolDownloadBtn) {
    uniToolDownloadBtn.addEventListener('click', () => {
        if (currentResultBlob) {
            downloadBlob(currentResultBlob, currentResultName);
        }
    });
}

// Global Back Button Handler
document.querySelectorAll('.back-to-tools-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Clear Hash to return to Home route
        if (window.location.hash !== '' && window.location.hash !== '#') {
            history.pushState({ tool: null }, "", "#");
        }

        // Hide all tool panels
        document.querySelectorAll('.tool-panel').forEach(el => el.style.display = 'none');

        // Show Dashboard
        const dashboard = document.getElementById('tools-dashboard');
        dashboard.style.display = 'block';

        // Ensure Nav is visible
        document.getElementById('main-nav').style.display = 'flex';

        // Clear State
        const info = document.getElementById('uni-tool-file-info');
        if (info) info.textContent = 'No file selected';
        const input = document.getElementById('uni-tool-input');
        if (input) input.value = '';
        const execBtn = document.getElementById('uni-tool-execute-btn');
        if (execBtn) execBtn.disabled = true;

        // Clear Result
        if (uniToolResult) uniToolResult.style.display = 'none';
        currentResultBlob = null;
    });
});



// =======================
// IMAGE TOOL LOGIC
// =======================
const imageToolInput = document.getElementById('image-tool-input');
const imageToolPreview = document.getElementById('image-tool-preview');
const executeImagePdfBtn = document.getElementById('execute-image-pdf-btn');
let selectedImageFiles = [];

if (imageToolInput) {
    imageToolInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            selectedImageFiles = Array.from(e.target.files);
            if (executeImagePdfBtn) executeImagePdfBtn.disabled = false;

            // Preview (First 5 images)
            imageToolPreview.innerHTML = '';
            selectedImageFiles.slice(0, 5).forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = document.createElement('img');
                    img.src = ev.target.result;
                    img.style.maxWidth = '100px';
                    img.style.maxHeight = '100px';
                    img.style.margin = '5px';
                    img.style.borderRadius = '4px';
                    img.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    imageToolPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
            if (selectedImageFiles.length > 5) {
                const more = document.createElement('div');
                more.textContent = `+${selectedImageFiles.length - 5} more`;
                imageToolPreview.appendChild(more);
            }
        }
    });
}

const downloadImagePdfBtn = document.getElementById('download-image-pdf-btn');
const previewImagePdfBtn = document.getElementById('preview-image-pdf-btn');
let currentImagePdfBlob = null;

if (executeImagePdfBtn) {
    executeImagePdfBtn.addEventListener('click', async () => {
        if (!selectedImageFiles || selectedImageFiles.length === 0) return;
        showLoading('Converting Images to PDF...');
        try {
            const { ImageToPdf } = await import('./engine/convert/image_to_pdf.js');
            const converter = new ImageToPdf(selectedImageFiles);
            const pdfBytes = await converter.convert();

            currentImagePdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

            // Show options
            executeImagePdfBtn.style.display = 'none';
            if (downloadImagePdfBtn) downloadImagePdfBtn.style.display = 'inline-block';
            if (previewImagePdfBtn) previewImagePdfBtn.style.display = 'inline-block';

        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            hideLoading();
        }
    });
}

if (downloadImagePdfBtn) {
    downloadImagePdfBtn.addEventListener('click', () => {
        if (currentImagePdfBlob) {
            downloadBlob(currentImagePdfBlob, 'image_converted.pdf');
        }
    });
}

if (previewImagePdfBtn) {
    previewImagePdfBtn.addEventListener('click', () => {
        if (currentImagePdfBlob) {
            const file = new File([currentImagePdfBlob], 'image_converted.pdf', { type: 'application/pdf' });

            // Hide tool, show editor
            document.querySelectorAll('.tool-panel').forEach(el => el.style.display = 'none');
            document.getElementById('main-container').style.display = 'flex';
            document.getElementById('controls').style.display = 'flex';
            document.getElementById('main-nav').style.display = 'flex';

            // Reset buttons for next time
            executeImagePdfBtn.style.display = 'inline-block';
            downloadImagePdfBtn.style.display = 'none';
            previewImagePdfBtn.style.display = 'none';

            if (window.handleFileUpload) {
                window.handleFileUpload(file);
            }
        }
    });
}

// =======================
// TEXT TOOL LOGIC
// =======================
const textToolInput = document.getElementById('text-tool-input');
const textToolEditor = document.getElementById('text-tool-editor');
const executeTxtPdfBtn = document.getElementById('execute-txt-pdf-btn');

if (textToolInput) {
    textToolInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const text = await e.target.files[0].text();
            if (textToolEditor) textToolEditor.value = text;
        }
    });
}

const downloadTxtPdfBtn = document.getElementById('download-txt-pdf-btn');
const previewTxtPdfBtn = document.getElementById('preview-txt-pdf-btn');
let currentTxtPdfBlob = null;

if (executeTxtPdfBtn) {
    executeTxtPdfBtn.addEventListener('click', async () => {
        const text = textToolEditor ? textToolEditor.value : '';
        if (!text) { alert('Please enter some text.'); return; }

        showLoading('Converting Text to PDF...');
        try {
            const { TxtToPdf } = await import('./engine/convert/txt_to_pdf.js');
            const converter = new TxtToPdf(text);
            const pdfBytes = await converter.convert();

            currentTxtPdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

            // Show options
            executeTxtPdfBtn.style.display = 'none';
            if (downloadTxtPdfBtn) downloadTxtPdfBtn.style.display = 'inline-block';
            if (previewTxtPdfBtn) previewTxtPdfBtn.style.display = 'inline-block';

        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            hideLoading();
        }
    });
}

if (downloadTxtPdfBtn) {
    downloadTxtPdfBtn.addEventListener('click', () => {
        if (currentTxtPdfBlob) {
            downloadBlob(currentTxtPdfBlob, 'text_converted.pdf');
        }
    });
}

if (previewTxtPdfBtn) {
    previewTxtPdfBtn.addEventListener('click', () => {
        if (currentTxtPdfBlob) {
            const file = new File([currentTxtPdfBlob], 'text_converted.pdf', { type: 'application/pdf' });

            document.querySelectorAll('.tool-panel').forEach(el => el.style.display = 'none');
            document.getElementById('main-container').style.display = 'flex';
            document.getElementById('controls').style.display = 'flex';
            document.getElementById('main-nav').style.display = 'flex';

            // Reset
            executeTxtPdfBtn.style.display = 'inline-block';
            downloadTxtPdfBtn.style.display = 'none';
            previewTxtPdfBtn.style.display = 'none';

            if (window.handleFileUpload) {
                window.handleFileUpload(file);
            }
        }
    });
}


// 5. Download Handlers
document.getElementById('download-merged-btn').addEventListener('click', () => {
    if (!lastMergedPdfUrl) return;
    const a = document.createElement('a');
    a.href = lastMergedPdfUrl;
    a.download = `merged_document_${Date.now()}.pdf`;
    a.click();
});

// Module removed to clean up unused features.

// Toolbar Buttons
const encryptBtn = document.getElementById('encrypt-btn');
if (encryptBtn) {
    encryptBtn.addEventListener('click', () => {
        document.querySelectorAll('.tool-panel').forEach(el => el.style.display = 'none');
        document.getElementById('encrypt-tool-container').style.display = 'block';
    });
}

const decryptBtn = document.getElementById('decrypt-btn');
if (decryptBtn) {
    decryptBtn.addEventListener('click', () => {
        document.querySelectorAll('.tool-panel').forEach(el => el.style.display = 'none');
        document.getElementById('decrypt-tool-container').style.display = 'block';
        // Hide editor
        const mc = document.getElementById('main-container'); if (mc) mc.style.display = 'none';
        const ctrls = document.getElementById('controls'); if (ctrls) ctrls.style.display = 'none';
    });
}

const mainDecryptBtn = document.getElementById('show-decrypt-tool-btn');
if (mainDecryptBtn) {
    mainDecryptBtn.addEventListener('click', () => {
        document.querySelectorAll('.tool-panel').forEach(el => el.style.display = 'none');
        document.getElementById('decrypt-tool-container').style.display = 'block';
        // Hide editor
        const mc = document.getElementById('main-container'); if (mc) mc.style.display = 'none';
        const ctrls = document.getElementById('controls'); if (ctrls) ctrls.style.display = 'none';

        // Also hide main-nav if we want full screen tool?
        // Encrypt tool hides main-nav.
        // Let's hide main-nav to avoid clutter, as the tool has a "Home" button now.
        const nav = document.getElementById('main-nav'); if (nav) nav.style.display = 'none';
    });
}

// ==========================================
// PHASE 5 & 6 COMPLETER: Office Export Engine
// ==========================================
const saveBtn = document.getElementById('save-btn');
const convertDocxBtn = document.getElementById('convert-docx-btn');
const convertXlsxBtn = document.getElementById('convert-xlsx-btn');

async function triggerPhase6Export(type) {
    if (!pdfCanvas) {
        alert("Wait until a PDF is mapped before converting.");
        return;
    }

    // Attempt dynamic binding to semantic text layers mapped during Phase 3
    const semanticLayer = pdfCanvas.parentElement.querySelector('.pdf-text-layer');
    const nodes = [];
    if (semanticLayer) {
        const spans = Array.from(semanticLayer.querySelectorAll('span'));
        spans.forEach(span => {
            nodes.push({
                text: span.textContent,
                x: parseFloat(span.style.left) || 0,
                y: parseFloat(span.style.top) || 0,
                fontSize: parseFloat(span.style.fontSize) || 12
            });
        });
    }

    const { ExportEngine } = await import('./engine/export_engine.js');
    const engine = new ExportEngine(pdfCanvas, nodes);

    if (type === 'docx') {
        const url = engine.generateTargetWordDocument();
        ExportEngine.triggerDownload(url, 'document_target.doc');
    } else if (type === 'xlsx') {
        const url = engine.generateTargetExcelDocument();
        ExportEngine.triggerDownload(url, 'spreadsheet_target.xls');
    } else if (type === 'pdf') {
        const blob = await engine.generatePDFBlob();
        const url = URL.createObjectURL(blob);
        ExportEngine.triggerDownload(url, 'saved_output.pdf');
    }
}

if (convertDocxBtn) convertDocxBtn.addEventListener('click', () => triggerPhase6Export('docx'));
if (convertXlsxBtn) convertXlsxBtn.addEventListener('click', () => triggerPhase6Export('xlsx'));
if (saveBtn) saveBtn.addEventListener('click', () => triggerPhase6Export('pdf'));

// --- URL ROUTING HANDLERS ---
window.toggleDashboard = (show) => {
    const td = document.getElementById('tools-dashboard');
    if (td) {
        td.style.display = show ? 'block' : 'none';
        // Prevent body scroll when dashboard is open
        document.body.style.overflow = show ? 'hidden' : 'auto';
    }
};

function resetUIToHome() {
    // Note: In "Editor-First" mode, Home is the Editor Workspace itself.
    // We hide specific tool panels (like universal-tool-container) but keep the editor visible.
    document.querySelectorAll('.tool-panel').forEach(el => {
        if (el.id !== 'tools-dashboard') el.style.display = 'none';
    });

    // Dashboard is now a modal, keep it hidden by default
    window.toggleDashboard(false);

    // Show Editor Workspace
    const mainContainer = document.getElementById('main-container');
    if (mainContainer) mainContainer.style.display = 'flex';

    const controls = document.getElementById('controls');
    if (controls) controls.style.display = 'flex';

    const toolbar = document.getElementById('toolbar');
    if (toolbar) toolbar.style.display = 'block';

    const mainNav = document.getElementById('main-nav');
    if (mainNav) mainNav.style.display = 'flex';
}

// --- Navigation & Routing ---

// Alias for dashboard clicks
window.loadDashboardTool = (...args) => window.activateTool(...args);

// Reset home properly
window.resetUIToHome = () => {
    document.querySelectorAll('.tool-panel').forEach(el => {
        if (el.id !== 'tools-dashboard') el.style.display = 'none';
    });
    document.getElementById('universal-tool-container').style.display = 'none';

    // Dashboard Modal hidden
    window.toggleDashboard(false);

    const mainNav = document.getElementById('main-nav');
    if (mainNav) mainNav.style.display = 'flex';

    // Always show Editor Workspace
    document.getElementById('main-container').style.display = 'flex';
    document.getElementById('controls').style.display = 'flex';
    document.getElementById('toolbar').style.display = 'block';

    if (!window._noPushState) {
        // Go back to the base directory of the app
        history.pushState({ tool: null }, "", "./");
    }
    window._noPushState = false;
    currentActiveToolId = null;
};

// Single Popstate Listener
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.tool) {
        console.log(`[Router] Popstate: loading ${event.state.tool}`);
        window._noPushState = true;
        window.activateTool(event.state.tool);
    } else {
        console.log(`[Router] Popstate: resetting to home`);
        window._noPushState = true;
        window.resetUIToHome();
    }
});

// Single Hashchange Listener (Legacy/Fallback)
window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#/')) {
        const tool = hash.substring(2);
        console.log(`[Router] Hashchange: loading ${tool}`);
        window._noPushState = true;
        window.activateTool(tool);
    } else if (!hash || hash === '#' || hash === '#/') {
        console.log(`[Router] Hashchange: resetting to home`);
        window.resetUIToHome();
    }
});

// Global Back Button Listener
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('back-to-tools-btn')) {
        window.resetUIToHome();
    }
});

// Initial Load Handler
window.addEventListener('load', () => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#/')) {
        const tool = hash.substring(2);
        console.log(`[Router] Loading tool from hash: ${tool}`);
        window._noPushState = true;
        window.activateTool(tool);
    } else {
        const path = window.location.pathname;
        const parts = path.split('/');
        const tool = parts[parts.length - 1];

        if (tool && tool !== 'index.html' && tool !== '' && !path.endsWith('.html') && !path.endsWith('/')) {
            console.log(`[Router] Loading tool from path: ${tool}`);
            window._noPushState = true;
            window.activateTool(tool);
        } else {
            // Check if we are at /public/ or root and need to show home
            if (path.endsWith('/public/') || path.endsWith('/public') || path === '/' || path.endsWith('index.html')) {
                window._noPushState = true;
                window.resetUIToHome();
            }
        }
    }
});
