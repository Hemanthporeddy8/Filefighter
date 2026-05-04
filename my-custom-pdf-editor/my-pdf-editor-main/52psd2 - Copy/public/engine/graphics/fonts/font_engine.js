export class FontEngine {
    constructor() {
        this.cmapCache = new Map();
    }

    /**
     * Parses a Font Dictionary (Type1, TrueType, or Type0/CIDFont)
     * and extracts all necessary metrics and Unicode mappings.
     * @param {PDFDict} fontDict 
     * @param {Function} resolveFn - async function to resolve indirect references
     */
    async parseFont(fontDict, resolveFn) {
        if (!fontDict || typeof fontDict.get !== 'function') return null;

        let subtype = fontDict.get('Subtype');
        if (subtype) subtype = subtype.name; // PDFName -> string

        let baseFontRaw = fontDict.get('BaseFont');
        let cleanFontName = (baseFontRaw && typeof baseFontRaw.name === 'string') ? baseFontRaw.name : 'sans-serif';

        // 1. Strip PDF subset prefixes (e.g., 'ABCDEF+Arial' -> 'Arial')
        if (cleanFontName.includes('+')) {
            cleanFontName = cleanFontName.split('+')[1];
        }

        // 2. Map standard PDF 14 fonts to browser safe equivalents
        const fontLower = cleanFontName.toLowerCase();
        let cssFont = 'sans-serif';
        if (fontLower.includes('times') || fontLower.includes('serif')) cssFont = 'serif';
        else if (fontLower.includes('courier') || fontLower.includes('mono')) cssFont = 'monospace';
        else if (fontLower.includes('helvetica') || fontLower.includes('arial')) cssFont = 'sans-serif';
        else cssFont = `"${cleanFontName}", sans-serif`;

        const fontData = {
            name: cssFont,
            originalName: cleanFontName,
            isType0: subtype === 'Type0',
            firstChar: 0,
            widths: [],
            defaultWidth: 1000,
            toUnicode: {}, // Map char-code -> Unicode string
            cidToGid: null,
            descendantFonts: [],
            // Phase 2: Internal Typographic Metrics (1000-unit scale)
            ascent: 800,
            descent: -200,
            capHeight: 700
        };

        // Extract precise internal FontDescriptor metrics
        const descriptorRaw = await resolveFn(fontDict.get('FontDescriptor'));
        if (descriptorRaw && typeof descriptorRaw.get === 'function') {
            const ascent = descriptorRaw.get('Ascent');
            if (ascent && typeof ascent === 'number') fontData.ascent = ascent;

            const descent = descriptorRaw.get('Descent');
            if (descent && typeof descent === 'number') fontData.descent = descent;

            const capHeight = descriptorRaw.get('CapHeight');
            if (capHeight && typeof capHeight === 'number') fontData.capHeight = capHeight;
        }

        // 3. Handle Type0 / CIDFonts (Asian & Complex characters)
        if (fontData.isType0) {
            let descendantsRaw = await resolveFn(fontDict.get('DescendantFonts'));
            if (descendantsRaw && descendantsRaw.elements) {
                for (let i = 0; i < descendantsRaw.elements.length; i++) {
                    const dDict = await resolveFn(descendantsRaw.elements[i]);
                    if (dDict) {
                        fontData.descendantFonts.push(dDict);
                        // Extract DW (Default Width) and W (Widths) from CIDFont
                        const dw = await resolveFn(dDict.get('DW'));
                        if (dw && typeof dw.value === 'number') fontData.defaultWidth = dw.value;

                        // Parse W array (complex [c [w1 w2 ...] c1 c2 w] format)
                        const wArray = await resolveFn(dDict.get('W'));
                        if (wArray && Array.isArray(wArray.elements)) {
                            fontData.glyphs = fontData.glyphs || {};
                            const wElements = wArray.elements;

                            for (let j = 0; j < wElements.length; j++) {
                                // Linear format: c [w1 w2 w3...]
                                if (typeof wElements[j].value === 'number' && wElements[j + 1] && Array.isArray(wElements[j + 1].elements)) {
                                    let startingCid = wElements[j].value;
                                    const widths = wElements[j + 1].elements;
                                    for (let k = 0; k < widths.length; k++) {
                                        fontData.glyphs[startingCid++] = widths[k].value;
                                    }
                                    j++; // Skip the array we just processed
                                }
                                // Range format: c1 c2 w -> maps all CIDs between c1 and c2 to width w
                                else if (typeof wElements[j].value === 'number' && typeof wElements[j + 1]?.value === 'number' && typeof wElements[j + 2]?.value === 'number') {
                                    const c1 = wElements[j].value;
                                    const c2 = wElements[j + 1].value;
                                    const w = wElements[j + 2].value;
                                    for (let cid = c1; cid <= c2; cid++) {
                                        fontData.glyphs[cid] = w;
                                    }
                                    j += 2; // Skip the next two numbers
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // Standard Type1/TrueType metrics
            const firstCharRaw = fontDict.get('FirstChar');
            fontData.firstChar = (firstCharRaw && typeof firstCharRaw.value === 'number') ? firstCharRaw.value : 0;

            const widthsRaw = await resolveFn(fontDict.get('Widths'));
            if (widthsRaw && Array.isArray(widthsRaw.elements)) {
                fontData.widths = widthsRaw.elements.map(e => e.value);
            }
        }

        // 4. Parse ToUnicode CMap
        const toUnicodeStream = await resolveFn(fontDict.get('ToUnicode'));
        if (toUnicodeStream && typeof toUnicodeStream.decode === 'function') {
            try {
                const cmapBytes = await toUnicodeStream.decode();
                const cmapStr = new TextDecoder('utf-8').decode(cmapBytes);
                fontData.toUnicode = this._parseCMap(cmapStr);
            } catch (err) {
                console.warn(`[FontEngine] Failed to parse ToUnicode CMap for ${cleanFontName}:`, err);
            }
        }

        // 5. Phase 8: @font-face Injection & Binary Metrics
        if (descriptorRaw && typeof descriptorRaw.get === 'function') {
            const fontFile2 = await resolveFn(descriptorRaw.get('FontFile2'));
            const fontFile3 = await resolveFn(descriptorRaw.get('FontFile3'));
            const fontStream = fontFile2 || fontFile3;

            if (fontStream && typeof fontStream.decode === 'function') {
                try {
                    const bytes = await fontStream.decode();
                    const ttData = this._parseTrueTypeBinary(bytes);
                    
                    // Pull in mappings if ToUnicode was empty
                    if (Object.keys(fontData.toUnicode).length === 0) {
                        fontData.toUnicode = ttData.mapping;
                    }
                    
                    // Pull in widths if /Widths array was empty
                    if (!fontData.widths || fontData.widths.length === 0) {
                        fontData.glyphs = Object.assign(fontData.glyphs || {}, ttData.widths);
                    }

                    // Inject @font-face for exact rendering match
                    const format = fontFile2 ? 'truetype' : 'opentype';
                    const uniqueFamily = `PDF_${cleanFontName.replace(/[^a-zA-Z0-9]/g, '_')}_${Math.random().toString(36).substr(2, 5)}`;
                    this._injectFontFace(uniqueFamily, bytes, format);
                    fontData.name = `"${uniqueFamily}"`; // Use the injected family name
                } catch (err) {
                    console.warn(`[FontEngine] Native font extraction/injection failed for ${cleanFontName}:`, err);
                }
            }
        }

        return fontData;
    }

    /**
     * Parses Adobe CMap syntax (bfchar and bfrange) to build a Unicode lookup table.
     * @param {string} cmapData 
     */
    _parseCMap(cmapData) {
        const mapping = {};
        const lines = cmapData.split(/\r?\n| /);

        let inBfChar = false;
        let inBfRange = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;

            if (line.includes('beginbfchar')) { inBfChar = true; continue; }
            if (line.includes('endbfchar')) { inBfChar = false; continue; }
            if (line.includes('beginbfrange')) { inBfRange = true; continue; }
            if (line.includes('endbfrange')) { inBfRange = false; continue; }

            // Common pattern: <0001> <0041>
            if (inBfChar) {
                const match = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/);
                if (match) {
                    const charCode = parseInt(match[1], 16);
                    const unicodeStr = String.fromCodePoint(parseInt(match[2], 16));
                    mapping[charCode] = unicodeStr;
                }
            }

            // Pattern: <start> <end> <unicode_start>
            if (inBfRange) {
                // 1. Array format: <0001> <0003> [<0041> <0042> <0043>]
                const arrayMatch = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+\[(.*?)\]/);
                if (arrayMatch) {
                    const startCode = parseInt(arrayMatch[1], 16);
                    const endCode = parseInt(arrayMatch[2], 16);
                    const hexValues = arrayMatch[3].match(/<([0-9A-Fa-f]+)>/g) || [];

                    let code = startCode;
                    for (const hexStr of hexValues) {
                        if (code > endCode) break;
                        const cleanHex = hexStr.replace(/[<>]/g, '');
                        mapping[code] = String.fromCodePoint(parseInt(cleanHex, 16));
                        code++;
                    }
                } else {
                    // 2. Linear format: <0001> <0005> <0041> -> Maps 1-5 to A-E
                    const linearMatch = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/);
                    if (linearMatch) {
                        const startCode = parseInt(linearMatch[1], 16);
                        const endCode = parseInt(linearMatch[2], 16);
                        let currentUnicode = parseInt(linearMatch[3], 16);

                        for (let code = startCode; code <= endCode; code++) {
                            mapping[code] = String.fromCodePoint(currentUnicode);
                            currentUnicode++;
                        }
                    }
                }
            }
        }
        return mapping;
    }

    /**
     * Phase 6: Deep TrueType Binary Parsing
     * Parses the binary TrueType / OpenType font buffer to extract the `cmap` (Unicode mapping)
     * and the `hmtx` (Horizontal Metrics / Widths) tables.
     * @param {Uint8Array} ttfBytes
     */
    _parseTrueTypeBinary(ttfBytes) {
        const result = { mapping: {}, widths: {} };
        const view = new DataView(ttfBytes.buffer, ttfBytes.byteOffset, ttfBytes.byteLength);
        
        // 1. Parse TTF Header
        const numTables = view.getUint16(4, false);
        const tables = {};

        // 2. Index all tables
        for (let i = 0; i < numTables; i++) {
            const tableOffset = 12 + (i * 16);
            const tag = String.fromCharCode(view.getUint8(tableOffset), view.getUint8(tableOffset + 1), view.getUint8(tableOffset + 2), view.getUint8(tableOffset + 3));
            tables[tag] = {
                offset: view.getUint32(tableOffset + 8, false),
                length: view.getUint32(tableOffset + 12, false)
            };
        }

        if (!tables['cmap']) return result;

        // 3. Parse cmap Subtable (Platform 3, Encoding 1)
        const cmapOffset = tables['cmap'].offset;
        const numSubtables = view.getUint16(cmapOffset + 2, false);
        let format4Offset = 0;

        for (let i = 0; i < numSubtables; i++) {
            const recordOffset = cmapOffset + 4 + (i * 8);
            const platformID = view.getUint16(recordOffset, false);
            const encodingID = view.getUint16(recordOffset + 2, false);
            if ((platformID === 3 && encodingID === 1) || (platformID === 0)) {
                format4Offset = cmapOffset + view.getUint32(recordOffset + 4, false);
                break;
            }
        }

        if (format4Offset > 0) {
            const format = view.getUint16(format4Offset, false);
            if (format === 4) {
                const segCountX2 = view.getUint16(format4Offset + 6, false);
                const segCount = segCountX2 / 2;
                const endCodeOffset = format4Offset + 14;
                const startCodeOffset = endCodeOffset + segCountX2 + 2;
                const idDeltaOffset = startCodeOffset + segCountX2;
                const idRangeOffsetOffset = idDeltaOffset + segCountX2;

                for (let i = 0; i < segCount; i++) {
                    const endCode = view.getUint16(endCodeOffset + (i * 2), false);
                    const startCode = view.getUint16(startCodeOffset + (i * 2), false);
                    const idDelta = view.getInt16(idDeltaOffset + (i * 2), false);
                    const idRangeOffset = view.getUint16(idRangeOffsetOffset + (i * 2), false);
                    const idRangeOffsetAddress = idRangeOffsetOffset + (i * 2);

                    if (startCode === 0xFFFF) break;

                    for (let c = startCode; c <= endCode; c++) {
                        let glyphIndex = 0;
                        if (idRangeOffset === 0) {
                            glyphIndex = (c + idDelta) & 0xFFFF;
                        } else {
                            const gOff = idRangeOffsetAddress + idRangeOffset + ((c - startCode) * 2);
                            glyphIndex = view.getUint16(gOff, false);
                            if (glyphIndex !== 0) glyphIndex = (glyphIndex + idDelta) & 0xFFFF;
                        }
                        if (glyphIndex !== 0) result.mapping[glyphIndex] = String.fromCodePoint(c);
                    }
                }
            }
        }

        // 4. Parse hmtx table (Widths)
        // Requires 'maxp' for glyph count and 'hhea' for metrics count
        if (tables['maxp'] && tables['hhea'] && tables['hmtx']) {
            const numGlyphs = view.getUint16(tables['maxp'].offset + 4, false);
            const numberOfHMetrics = view.getUint16(tables['hhea'].offset + 34, false);
            const hmtxOffset = tables['hmtx'].offset;

            // PDF fonts use a 1000-unit square. TTF uses 'unitsPerEm'.
            let unitsPerEm = 2048; // Default for most TTFs
            if (tables['head']) {
                unitsPerEm = view.getUint16(tables['head'].offset + 18, false);
            }
            const scale = 1000 / unitsPerEm;

            for (let gid = 0; gid < numGlyphs; gid++) {
                let advanceWidth = 0;
                if (gid < numberOfHMetrics) {
                    advanceWidth = view.getUint16(hmtxOffset + (gid * 4), false);
                } else {
                    // Use the last advanceWidth if gid exceeds metrics count
                    advanceWidth = view.getUint16(hmtxOffset + ((numberOfHMetrics - 1) * 4), false);
                }
                result.widths[gid] = advanceWidth * scale;
            }
        }

        return result;
    }

    /**
     * Injects a Base64 encoded @font-face rule into the document.
     * @param {string} family 
     * @param {Uint8Array} bytes 
     * @param {string} format 
     */
    _injectFontFace(family, bytes, format) {
        let styleTag = document.getElementById('pdf-engine-injected-fonts');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'pdf-engine-injected-fonts';
            document.head.appendChild(styleTag);
        }

        // Convert bytes to base64
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = typeof window !== 'undefined' ? window.btoa(binary) : null;
        if (!base64) return;

        const rule = `
            @font-face {
                font-family: "${family}";
                src: url("data:font/${format};base64,${base64}");
                font-display: swap;
            }
        `;
        styleTag.appendChild(document.createTextNode(rule));
    }
}
