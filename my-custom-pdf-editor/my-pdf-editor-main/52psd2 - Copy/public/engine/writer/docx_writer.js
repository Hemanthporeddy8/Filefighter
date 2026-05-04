/**
 * DocxWriter — Milestone 3 (Persistence)
 * Serializes God Engine AST/State back into a valid .docx (ZIP/OOXML) file.
 * Includes a minimalist ZIP generator for zero-dependency operation.
 */
export class DocxWriter {
    /**
     * @param {HTMLElement} dom - The current editor DOM
     */
    constructor(dom) {
        this.dom = dom;
    }

    /**
     * Packages the editor state into a .docx blob.
     * @returns {Promise<Blob>}
     */
    async save() {
        console.log('[DocxWriter] Generating binary...');
        const entries = {};

        // 1. Generate core document.xml
        const xml = this._generateDocumentXml();
        entries['word/document.xml'] = new TextEncoder().encode(xml);

        // 2. Add required boilerplate (Relations, Content_Types, etc.)
        // These are static for basic document functionality.
        entries['[Content_Types].xml'] = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
        entries['_rels/.rels'] = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);

        // 3. Package into ZIP
        const zipBuffer = await this._zip(entries);
        return new Blob([zipBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }

    _generateDocumentXml() {
        let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:body>`;

        // Iterate through editor blocks
        const blocks = this.dom.querySelectorAll('.engine-edit-block');
        blocks.forEach(block => {
            const text = block.innerText;
            xml += `
                <w:p>
                    <w:r>
                        <w:t>${this._escapeXml(text)}</w:t>
                    </w:r>
                </w:p>`;
        });

        xml += `
                <w:sectPr>
                    <w:pgSz w:w="12240" w:h="15840"/>
                    <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
                </w:sectPr>
            </w:body>
        </w:document>`;
        return xml;
    }

    _escapeXml(unsafe) {
        return unsafe.replace(/[<>&'"]/g, c => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }

    /**
     * Minimalist non-compressed ZIP generator (Store mode)
     */
    async _zip(entries) {
        const BUF_SIZE = 1024 * 1024; // 1MB start
        const buffer = new Uint8Array(BUF_SIZE);
        let offset = 0;
        const localHeaders = [];

        for (const [name, data] of Object.entries(entries)) {
            const nameBytes = new TextEncoder().encode(name);
            localHeaders.push({ nameBytes, data, offset });

            // Local File Header
            const view = new DataView(buffer.buffer);
            view.setUint32(offset, 0x04034b50, true); // Signature
            view.setUint16(offset + 4, 10, true);    // Version
            view.setUint16(offset + 6, 0, true);     // Flags
            view.setUint16(offset + 8, 0, true);     // Compression (Store)
            view.setUint16(offset + 10, 0, true);    // Time
            view.setUint16(offset + 12, 0, true);    // Date
            view.setUint32(offset + 14, this._crc32(data), true);
            view.setUint32(offset + 18, data.length, true); // Compressed size
            view.setUint32(offset + 22, data.length, true); // Uncompressed size
            view.setUint16(offset + 26, nameBytes.length, true);
            view.setUint16(offset + 28, 0, true);    // Extra field len

            buffer.set(nameBytes, offset + 30);
            buffer.set(data, offset + 30 + nameBytes.length);

            offset += 30 + nameBytes.length + data.length;
        }

        const centralDirectoryStart = offset;
        for (const h of localHeaders) {
            // Central Directory Header
            const view = new DataView(buffer.buffer);
            view.setUint32(offset, 0x02014b50, true);
            view.setUint16(offset + 4, 20, true);
            view.setUint16(offset + 6, 10, true);
            view.setUint16(offset + 10, 0, true); // Compression
            view.setUint16(offset + 12, 0, true); // Time
            view.setUint16(offset + 14, 0, true); // Date
            view.setUint32(offset + 16, this._crc32(h.data), true);
            view.setUint32(offset + 20, h.data.length, true);
            view.setUint32(offset + 24, h.data.length, true);
            view.setUint16(offset + 28, h.nameBytes.length, true);
            view.setUint16(offset + 30, 0, true); // Extra
            view.setUint16(offset + 32, 0, true); // Comment
            view.setUint16(offset + 34, 0, true); // Disk
            view.setUint16(offset + 36, 0, true); // Internal attr
            view.setUint32(offset + 38, 0, true); // External attr
            view.setUint32(offset + 42, h.offset, true); // Relative offset

            buffer.set(h.nameBytes, offset + 46);
            offset += 46 + h.nameBytes.length;
        }

        const centralDirectoryEnd = offset;
        // End of Central Directory
        const view = new DataView(buffer.buffer);
        view.setUint32(offset, 0x06054b50, true);
        view.setUint16(offset + 4, 0, true);
        view.setUint16(offset + 6, 0, true);
        view.setUint16(offset + 8, localHeaders.length, true);
        view.setUint16(offset + 10, localHeaders.length, true);
        view.setUint32(offset + 12, centralDirectoryEnd - centralDirectoryStart, true);
        view.setUint32(offset + 16, centralDirectoryStart, true);
        view.setUint16(offset + 20, 0, true);

        offset += 22;

        return buffer.slice(0, offset);
    }

    _crc32(data) {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[i] = c;
        }
        let crc = 0 ^ (-1);
        for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
        return (crc ^ (-1)) >>> 0;
    }
}
