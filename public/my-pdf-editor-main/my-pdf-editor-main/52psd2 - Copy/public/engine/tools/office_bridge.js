/**
 * OfficeBridge — Phase 5 / Canva-Level Milestone
 * Translates Office OpenXML (DOCX/XLSX) structures into the God Engine AST.
 */
export class OfficeBridge {
    /**
     * Entry point for converting a Word/Excel blob into a renderable God Engine state.
     * @param {Blob} blob 
     * @returns {Promise<Object>} The mapped AST or Document object.
     */
    static async import(blob) {
        console.log(`[OfficeBridge] Importing ${blob.type} (${blob.size} bytes)...`);

        // 1. Unzip the OOXML container
        // Note: For a zero-dependency approach, we'd implement a ZIP parser.
        // For now, we utilize the browser's response-stream-unzip heuristics or a minimal ZIP iterator.
        try {
            const entries = await this._unzip(blob);
            if (blob.name?.endsWith('.docx') || blob.type.includes('word')) {
                return await this._parseDocx(entries);
            } else if (blob.name?.endsWith('.xlsx') || blob.type.includes('sheet')) {
                return await this._parseXlsx(entries);
            }
        } catch (e) {
            console.error('[OfficeBridge] Failed to parse Office container:', e);
            throw e;
        }
    }

    /**
     * Minimalist ZIP Extractor (Proprietary/Zero-Dep)
     * Leverages the ZIP File Header format: [PK\x03\x04]
     */
    static async _unzip(blob) {
        const buffer = await blob.arrayBuffer();
        const view = new DataView(buffer);
        const entries = {};

        let offset = 0;
        while (offset < buffer.byteLength - 30) {
            const signature = view.getUint32(offset, true);
            if (signature !== 0x04034b50) break; // End of Local File Headers

            const fileNameLen = view.getUint16(offset + 26, true);
            const extraLen = view.getUint16(offset + 28, true);
            const compressedSize = view.getUint32(offset + 18, true);
            const compressionMethod = view.getUint16(offset + 8, true);

            const fileName = new TextDecoder().decode(buffer.slice(offset + 30, offset + 30 + fileNameLen));
            const dataStart = offset + 30 + fileNameLen + extraLen;
            let data = buffer.slice(dataStart, dataStart + compressedSize);

            if (compressionMethod === 8) { // DEFLATE
                // Utilize the browser's native DecompressionStream (Modern Chrome/Edge/Firefox)
                const ds = new DecompressionStream('deflate-raw');
                const writer = ds.writable.getWriter();
                writer.write(data);
                writer.close();
                const output = await new Response(ds.readable).arrayBuffer();
                data = output;
            }

            entries[fileName] = data;
            offset = dataStart + compressedSize;

            // Skip Data Descriptor if present
            const flags = view.getUint16(offset + 6, true);
            if ((flags & 0x08) !== 0) offset += 12;
        }
        return entries;
    }

    static async _parseDocx(entries) {
        const documentXml = entries['word/document.xml'];
        if (!documentXml) throw new Error('Invalid DOCX: missing word/document.xml');

        const xmlText = new TextDecoder().decode(documentXml);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        // Heuristic: Map <w:p> (Paragraphs) and <w:r> (Runs) to TextItems
        const textItems = [];
        let cursorY = 50; // Simple layout flow
        const paragraphs = xmlDoc.getElementsByTagName('w:p');

        for (const p of paragraphs) {
            let paragraphText = '';
            const runs = p.getElementsByTagName('w:r');
            for (const r of runs) {
                const textNodes = r.getElementsByTagName('w:t');
                for (const t of textNodes) {
                    paragraphText += t.textContent;
                }
            }

            if (paragraphText.trim()) {
                textItems.push({
                    text: paragraphText,
                    x: 50,
                    y: cursorY,
                    fontSize: 12,
                    fontFamily: 'Helvetica',
                    width: paragraphText.length * 7 // Crude estimation
                });
                cursorY += 20;
            }
        }

        return { type: 'docx', textItems };
    }

    static async _parseXlsx(entries) {
        // 1. Parse Shared Strings
        const sharedStringsXml = entries['xl/sharedStrings.xml'];
        const sharedStrings = [];
        if (sharedStringsXml) {
            const xmlText = new TextDecoder().decode(sharedStringsXml);
            const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
            const tNodes = xmlDoc.getElementsByTagName('t');
            for (let t of tNodes) sharedStrings.push(t.textContent);
        }

        // 2. Parse Sheet1
        const sheetXml = entries['xl/worksheets/sheet1.xml'];
        if (!sheetXml) throw new Error('Invalid XLSX: missing xl/worksheets/sheet1.xml');
        const xmlText = new TextDecoder().decode(sheetXml);
        const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
        const rows = xmlDoc.getElementsByTagName('row');

        const textItems = [];
        let cursorY = 50;

        for (let row of rows) {
            const cells = row.getElementsByTagName('c');
            let cursorX = 50;
            for (let cell of cells) {
                const type = cell.getAttribute('t');
                const vNode = cell.getElementsByTagName('v')[0];
                let value = vNode ? vNode.textContent : "";

                if (type === 's' && sharedStrings[parseInt(value)] !== undefined) {
                    value = sharedStrings[parseInt(value)];
                }

                if (value) {
                    textItems.push({
                        text: value,
                        x: cursorX,
                        y: cursorY,
                        fontSize: 11,
                        fontFamily: 'Calibri, Arial',
                        width: value.length * 8
                    });
                }
                cursorX += 100; // Column spacing
            }
            cursorY += 25; // Row spacing
        }

        return { type: 'xlsx', textItems };
    }
}
