export async function buildWatermarkUI(paramsContainer, paramsLabel, paramsInput, paramsSelect, currentDoc, uniToolFiles, pagesContainerParent) {
    const desc = document.getElementById('uni-tool-desc');
    const btn = document.getElementById('uni-tool-choose-file-btn');
    if (desc) desc.textContent = `Add a text watermark to your PDF.`;
    if (btn) btn.textContent = 'Select PDF File';

    // Inject Custom UI
    paramsContainer.style.display = 'block';
    paramsInput.style.display = 'none'; // Hide default input
    if (paramsSelect) paramsSelect.style.display = 'none';

    // Clear previous custom UI
    const existing = document.getElementById('wm-ui-container');
    if (existing) existing.remove();
    const pn = document.getElementById('pn-ui-container');
    if (pn) pn.remove();

    const wmUI = document.createElement('div');
    wmUI.id = 'wm-ui-container';
    wmUI.style.marginTop = '10px';
    wmUI.style.maxHeight = '600px';
    wmUI.style.overflowY = 'auto'; // Scrollable settings
    wmUI.innerHTML = `
    <div style="margin-bottom:8px">
        <label style="display:block;font-size:12px;margin-bottom:4px">Content:</label>
        <div style="display:flex;gap:10px">
            <label><input type="checkbox" id="wm-check-text" checked> Text</label>
            <label><input type="checkbox" id="wm-check-image"> Image</label>
        </div>
    </div>

    <!-- Preview Controls -->
    <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; background:#eee; padding:5px; border-radius:4px;">
        <button id="wm-prev-page" style="cursor:pointer; padding:2px 8px;">&lt;</button>
        <span style="font-size:12px;">Page <span id="wm-curr-page-disp">1</span> / <span id="wm-total-pages">?</span></span>
        <button id="wm-next-page" style="cursor:pointer; padding:2px 8px;">&gt;</button>
    </div>

    <!--TEXT OPTIONS-->
    <div id="wm-text-opts" style="border:1px solid #ddd;padding:8px;border-radius:4px;margin-bottom:8px;background:#f9f9f9">
        <div style="font-weight:bold;font-size:12px;margin-bottom:5px;border-bottom:1px solid #eee">Text Settings</div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Text:</label>
            <input type="text" id="wm-text" value="CONFIDENTIAL" style="width:100%;padding:4px;border:1px solid #ddd;border-radius:4px">
        </div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Color:</label>
            <input type="color" id="wm-color" value="#cccccc" style="width:100%;height:30px;padding:2px;border:1px solid #ddd;border-radius:4px">
        </div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Size (% of Page):</label>
            <input type="range" id="wm-size" min="1" max="100" value="10" style="width:100%">
        </div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Rotation (0-360):</label>
            <input type="range" id="wm-rot" min="0" max="360" value="45" style="width:100%">
        </div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Opacity (0-1):</label>
            <input type="range" id="wm-opacity" min="0" max="1" step="0.1" value="0.5" style="width:100%">
        </div>
    </div>

    <!--IMAGE OPTIONS-->
    <div id="wm-image-opts" style="display:none;border:1px solid #ddd;padding:8px;border-radius:4px;margin-bottom:8px;background:#f9f9f9">
        <div style="font-weight:bold;font-size:12px;margin-bottom:5px;border-bottom:1px solid #eee">Image Settings</div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Select Image:</label>
            <input type="file" id="wm-file" accept="image/*" style="width:100%">
        </div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Size (% of Page):</label>
            <input type="range" id="wm-img-size" min="1" max="100" value="30" style="width:100%">
        </div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Rotation (0-360):</label>
            <input type="range" id="wm-img-rot" min="0" max="360" value="0" style="width:100%">
        </div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Opacity (0-1):</label>
            <input type="range" id="wm-img-opacity" min="0" max="1" step="0.1" value="0.8" style="width:100%">
        </div>
        <div style="margin-bottom:8px">
            <label style="display:block;font-size:12px;margin-bottom:4px">Image Pages (e.g. "1-5" or "all"):</label>
            <input type="text" id="wm-img-pages" value="all" style="width:100%;padding:4px;border:1px solid #ddd;border-radius:4px">
        </div>
    </div>

    <div style="margin-top:8px">
        <label style="display:block;font-size:12px;margin-bottom:4px">Target Pages (e.g. "1-5, 8" or "all"):</label>
        <input type="text" id="wm-pages" value="all" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
    </div>

    <div style="margin-top:15px;border:1px solid #eee;background:#eef;padding:10px;">
        <label style="display:block;font-size:12px;margin-bottom:4px;font-weight:bold">Interactive Preview (All Pages):</label>
        <div id="wm-pages-container" style="width:100%;max-height:500px;overflow-y:auto;border:1px solid #ccc;background:#555;text-align:center;padding:10px;">
            <button id="wm-load-preview-btn" style="padding:10px;cursor:pointer;">Load PDF Preview</button>
        </div>
    </div>

    <div id="wm-loading-overlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.8); z-index:2000; justify-content:center; align-items:center;">
        <span style="font-weight:bold; color:#333;">Updating...</span>
    </div>

    <!--Hidden Position Inputs-->
    <input type="hidden" id="wm-x-pct" value="50">
    <input type="hidden" id="wm-y-pct" value="50">
    <input type="hidden" id="wm-img-x-pct" value="50">
    <input type="hidden" id="wm-img-y-pct" value="50">
    `;
    paramsContainer.appendChild(wmUI);
    paramsLabel.textContent = 'Watermark Options';

    // Select Elements
    const checkText = document.getElementById('wm-check-text');
    const checkImage = document.getElementById('wm-check-image');
    const textOpts = document.getElementById('wm-text-opts');
    const imgOpts = document.getElementById('wm-image-opts');

    // Text Inputs
    const textInput = document.getElementById('wm-text');
    const textSizeInput = document.getElementById('wm-size');
    const textRotInput = document.getElementById('wm-rot');
    const textColorInput = document.getElementById('wm-color');
    const textOpInput = document.getElementById('wm-opacity');
    const textXInput = document.getElementById('wm-x-pct');
    const textYInput = document.getElementById('wm-y-pct');

    // Image Inputs
    const fileInput = document.getElementById('wm-file');
    const imgSizeInput = document.getElementById('wm-img-size');
    const imgRotInput = document.getElementById('wm-img-rot');
    const imgOpInput = document.getElementById('wm-img-opacity');
    const imgXInput = document.getElementById('wm-img-x-pct');
    const imgYInput = document.getElementById('wm-img-y-pct');

    let textOverlays = [];
    let imgOverlays = [];
    let currentImgData = null;
    let currentImgAspect = 0;

    const toggleSections = () => {
        textOpts.style.display = checkText.checked ? 'block' : 'none';
        imgOpts.style.display = checkImage.checked ? 'block' : 'none';
        updateOverlays();
    };
    checkText.addEventListener('change', toggleSections);
    checkImage.addEventListener('change', toggleSections);

    fileInput.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (f) {
            const reader = new FileReader();
            reader.onload = (re) => {
                const i = new Image();
                i.onload = () => {
                    currentImgData = re.target.result;
                    currentImgAspect = i.height / i.width;
                    wmUI.dataset.imgData = currentImgData;
                    updateOverlays();
                };
                i.src = re.target.result;
            };
            reader.readAsDataURL(f);
        }
    });

    const updateOverlays = () => {
        const loadingOverlay = document.getElementById('wm-loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        setTimeout(() => {
            updateOverlaysInternal();
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }, 10);
    };

    const updateOverlaysInternal = () => {
        const pagesContainerLoc = document.getElementById('wm-pages-container');
        const firstWrapper = pagesContainerLoc.querySelector('div[style*="position: relative"]');
        if (!firstWrapper) return;

        const previewWidth = firstWrapper.offsetWidth;

        // Text Updates
        const showText = checkText.checked;
        textOverlays.forEach(ov => {
            ov.style.display = showText ? 'flex' : 'none';
            if (showText) {
                const scalePct = textSizeInput.value / 100;
                const fontSize = previewWidth * scalePct;

                ov.textContent = textInput.value;
                ov.style.color = textColorInput.value;
                ov.style.fontSize = fontSize + 'px';
                ov.style.opacity = textOpInput.value;
                ov.style.transform = `translate(-50%, -50%) rotate(${textRotInput.value}deg)`;
                ov.style.left = textXInput.value + '%';
                ov.style.top = textYInput.value + '%';
                ov.style.border = '1px dashed blue';
                ov.style.zIndex = '1000';
                ov.dataset.scalePct = scalePct;
            }
        });

        // Image Updates
        const showImg = checkImage.checked && currentImgData;
        imgOverlays.forEach(ov => {
            ov.style.display = showImg ? 'block' : 'none';
            if (showImg) {
                const scalePct = imgSizeInput.value / 100;
                const w = previewWidth * scalePct;
                const h = currentImgAspect ? w * currentImgAspect : w;

                ov.style.backgroundImage = `url(${currentImgData})`;
                ov.style.backgroundSize = 'contain';
                ov.style.backgroundRepeat = 'no-repeat';
                ov.style.backgroundPosition = 'center';

                ov.style.width = w + 'px';
                ov.style.height = h + 'px';

                ov.style.opacity = imgOpInput.value;
                ov.style.transform = `translate(-50%, -50%) rotate(${imgRotInput.value}deg)`;
                ov.style.left = imgXInput.value + '%';
                ov.style.top = imgYInput.value + '%';
                ov.style.border = '1px dashed blue';
                ov.style.zIndex = '1000';
                ov.dataset.scalePct = scalePct;
            }
        });
    };

    [textInput, textSizeInput, textRotInput, textColorInput, textOpInput].forEach(el => el.addEventListener('input', updateOverlays));
    [imgSizeInput, imgRotInput, imgOpInput].forEach(el => el.addEventListener('input', updateOverlays));

    const loadBtn = document.getElementById('wm-load-preview-btn');
    const pagesContainerLoc = document.getElementById('wm-pages-container');

    let currentPreviewPage = 0;
    let totalPages = 0;
    let isGridView = true;

    const setupResize = (handle, el, inputSize) => {
        let startX, initialSize;
        const onMove = (e) => {
            const dx = e.clientX - startX;
            const firstWrapper = pagesContainerLoc.querySelector('div[style*="position: relative"]');
            const previewWidth = firstWrapper ? firstWrapper.offsetWidth : 1000;
            const oldPx = previewWidth * (initialSize / 100);
            let newPct = ((oldPx + dx) / previewWidth) * 100;
            if (newPct < 1) newPct = 1;
            if (newPct > 100) newPct = 100;
            inputSize.value = newPct;
            updateOverlays();
        };
        const onUp = () => {
            document.body.style.cursor = 'default';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        handle.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            initialSize = parseFloat(inputSize.value);
            e.stopPropagation();
            e.preventDefault();
            document.body.style.cursor = 'se-resize';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    };

    const setupDrag = (el, container, inputX, inputY) => {
        let startX, startY, initialX, initialY;
        const onMove = (e) => {
            const rect = container.getBoundingClientRect();
            inputX.value = Math.max(0, Math.min(((initialX + (e.clientX - startX)) / rect.width) * 100, 100));
            inputY.value = Math.max(0, Math.min(((initialY + (e.clientY - startY)) / rect.height) * 100, 100));
            updateOverlays();
        };
        const onUp = () => {
            el.style.cursor = 'move';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        el.addEventListener('mousedown', (e) => {
            startX = e.clientX; startY = e.clientY;
            initialX = (parseFloat(el.style.left || '50') / 100) * container.offsetWidth;
            initialY = (parseFloat(el.style.top || '50') / 100) * container.offsetHeight;
            e.preventDefault(); el.style.cursor = 'grabbing';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    };

    const renderPageContent = async (idx, container) => {
        try {
            const page = await currentDoc.getPage(idx);
            let cBox = page.dict.get('CropBox') || page.dict.get('MediaBox') || [0, 0, 612, 792];
            let pdfWidth = Math.abs(cBox[2] - cBox[0]);
            let pdfHeight = Math.abs(cBox[3] - cBox[1]);
            if ((page.dict.get('Rotate') || 0) % 180 !== 0) [pdfWidth, pdfHeight] = [pdfHeight, pdfWidth];

            const scale = 0.4;
            const viewWidth = pdfWidth * scale;
            const viewHeight = pdfHeight * scale;

            const canvasWrapper = document.createElement('div');
            canvasWrapper.style.position = 'relative';
            canvasWrapper.style.display = 'inline-block';
            canvasWrapper.style.margin = '5px';
            canvasWrapper.style.border = '1px solid #999';
            canvasWrapper.style.backgroundColor = 'white';

            const canvas = document.createElement('canvas');
            canvas.width = viewWidth; canvas.height = viewHeight;
            const ctx = canvas.getContext('2d');
            canvasWrapper.appendChild(canvas);
            container.appendChild(canvasWrapper);

            // Import dynamically since this UI lives loosely.
            const { CanvasBackend } = await import('../graphics/canvas_backend.js');
            const { PageInterpreter } = await import('../core/evaluator/page_interpreter.js');
            const backend = new CanvasBackend(ctx, pdfHeight, null, scale);
            const interpreter = new PageInterpreter(page, backend);
            await interpreter.execute(await page.getContentStream());
            ctx.restore(); ctx.restore();

            const createOverlay = (isImg) => {
                const ov = document.createElement('div');
                ov.style.position = 'absolute';
                ov.style.cursor = 'move';
                ov.style.border = '1px dashed rgba(0,0,0,0.2)';
                ov.style.pointerEvents = 'auto';
                if (!isImg) {
                    ov.style.display = 'flex'; ov.style.alignItems = 'center'; ov.style.justifyContent = 'center'; ov.style.whiteSpace = 'nowrap';
                } else {
                    ov.style.backgroundSize = 'contain'; ov.style.backgroundRepeat = 'no-repeat'; ov.style.backgroundPosition = 'center';
                }
                const handle = document.createElement('div');
                handle.style.width = '10px'; handle.style.height = '10px'; handle.style.background = 'blue';
                handle.style.position = 'absolute'; handle.style.bottom = '-5px'; handle.style.right = '-5px'; handle.style.cursor = 'se-resize';
                ov.appendChild(handle);
                return { ov, handle };
            };

            const txtObj = createOverlay(false);
            setupDrag(txtObj.ov, canvasWrapper, textXInput, textYInput);
            setupResize(txtObj.handle, txtObj.ov, textSizeInput);
            canvasWrapper.appendChild(txtObj.ov);
            textOverlays.push(txtObj.ov);

            const imgObj = createOverlay(true);
            setupDrag(imgObj.ov, canvasWrapper, imgXInput, imgYInput);
            setupResize(imgObj.handle, imgObj.ov, imgSizeInput);
            canvasWrapper.appendChild(imgObj.ov);
            imgOverlays.push(imgObj.ov);
        } catch (e) {
            container.innerHTML += `<div style="color:red;padding:10px">Preview error: ${e.message}</div>`;
        }
    };

    const prevBtn = document.getElementById('wm-prev-page');
    const nextBtn = document.getElementById('wm-next-page');
    const pageDisp = document.getElementById('wm-curr-page-disp');
    const totalDisp = document.getElementById('wm-total-pages');

    prevBtn.onclick = () => { if (currentPreviewPage > 0) { currentPreviewPage--; refreshPreview(); } };
    nextBtn.onclick = () => { if (currentPreviewPage < totalPages - 1) { currentPreviewPage++; refreshPreview(); } };

    const refreshPreview = async () => {
        pagesContainerLoc.innerHTML = '';
        textOverlays = []; imgOverlays = [];
        totalPages = currentDoc.pageCount;
        if (totalDisp) totalDisp.textContent = totalPages;
        if (pageDisp) pageDisp.textContent = currentPreviewPage + 1;
        await renderPageContent(currentPreviewPage, pagesContainerLoc);
        updateOverlays();
    };

    if (loadBtn) {
        loadBtn.onclick = async () => {
            if (!currentDoc) {
                if (uniToolFiles && uniToolFiles.length > 0) {
                    loadBtn.textContent = "Parsing...";
                    try {
                        const { PDFParser } = await import('../parser/pdf_parser.js');
                        const { Stream } = await import('../io/stream.js');
                        const arrayBuffer = await uniToolFiles[0].arrayBuffer();
                        const stream = new Stream(new Uint8Array(arrayBuffer));
                        const parser = new PDFParser(stream);
                        // Hack: we need to mutate currentDoc globally. 
                        // It's cleaner to read it from window or return it.
                        // We will just do a standard parse and bind it to window.currentDoc for compatibility.
                        window.currentDoc = await parser.parse();
                        currentDoc = window.currentDoc; // Local reference
                    } catch (e) {
                        alert("Preview parse failed: " + e.message);
                        loadBtn.textContent = "Load PDF Preview";
                        return;
                    }
                } else { alert("Select file first."); return; }
            }
            loadBtn.style.display = 'none';
            refreshPreview();
        };
    }
}
