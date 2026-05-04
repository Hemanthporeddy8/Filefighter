/**
 * XlsxWriter — Milestone 3 (Persistence)
 * Serializes God Engine AST/State back into a valid .xlsx (ZIP/OOXML) file.
 */
export class XlsxWriter {
    /**
     * @param {Object} workbook - The current workbook state
     */
    constructor(workbook) {
        this.workbook = workbook;
    }

    /**
     * Packages the editor state into a .xlsx blob.
     * @returns {Promise<Blob>}
     */
    async save() {
        console.log('[XlsxWriter] Generating binary...');
        const entries = {};

        // 1. Generate core sheet1.xml
        const sheetXml = this._generateSheetXml();
        entries['xl/worksheets/sheet1.xml'] = new TextEncoder().encode(sheetXml);

        // 2. Generate workbook.xml
        entries['xl/workbook.xml'] = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>`);

        // 3. Add required boilerplate
        entries['[Content_Types].xml'] = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
        entries['_rels/.rels'] = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
        entries['xl/_rels/workbook.xml.rels'] = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);

        // 4. Package into ZIP (Reusing same ZIP logic for simplicity, in production would be a shared util)
        const zipBuffer = await this._zip(entries);
        return new Blob([zipBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    _generateSheetXml() {
        let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
            <sheetData>`;

        // Add dummy data for now or map from workbook
        xml += `
                <row r="1">
                    <c r="A1" t="inlineStr">
                        <is><t>Edited via God Engine</t></is>
                    </c>
                </row>`;

        xml += `
            </sheetData>
        </worksheet>`;
        return xml;
    }

    // --- ZIP and CRC32 Logic (Duplicate of DocxWriter for self-containment in this phase) ---
    async _zip(entries) {
        const BUF_SIZE = 1024 * 1024;
        const buffer = new Uint8Array(BUF_SIZE);
        let offset = 0;
        const localHeaders = [];
        for (const [name, data] of Object.entries(entries)) {
            const nameBytes = new TextEncoder().encode(name);
            localHeaders.push({ nameBytes, data, offset });
            const view = new DataView(buffer.buffer);
            view.setUint32(offset, 0x04034b50, true);
            view.setUint16(offset + 4, 10, true);
            view.setUint16(offset + 6, 0, true);
            view.setUint16(offset + 8, 0, true);
            view.setUint16(offset + 10, 0, true);
            view.setUint16(offset + 12, 0, true);
            view.setUint32(offset + 14, this._crc32(data), true);
            view.setUint32(offset + 18, data.length, true);
            view.setUint32(offset + 22, data.length, true);
            view.setUint16(offset + 26, nameBytes.length, true);
            view.setUint16(offset + 28, 0, true);
            buffer.set(nameBytes, offset + 30);
            buffer.set(data, offset + 30 + nameBytes.length);
            offset += 30 + nameBytes.length + data.length;
        }
        const centralDirectoryStart = offset;
        for (const h of localHeaders) {
            const view = new DataView(buffer.buffer);
            view.setUint32(offset, 0x02014b50, true);
            view.setUint16(offset + 4, 20, true);
            view.setUint16(offset + 6, 10, true);
            view.setUint16(offset + 10, 0, true);
            view.setUint16(offset + 12, 0, true);
            view.setUint16(offset + 14, 0, true);
            view.setUint32(offset + 16, this._crc32(h.data), true);
            view.setUint32(offset + 20, h.data.length, true);
            view.setUint32(offset + 24, h.data.length, true);
            view.setUint16(offset + 28, h.nameBytes.length, true);
            view.setUint32(offset + 42, h.offset, true);
            buffer.set(h.nameBytes, offset + 46);
            offset += 46 + h.nameBytes.length;
        }
        const centralDirectoryEnd = offset;
        const view = new DataView(buffer.buffer);
        view.setUint32(offset, 0x06054b50, true);
        view.setUint16(offset + 8, localHeaders.length, true);
        view.setUint16(offset + 10, localHeaders.length, true);
        view.setUint32(offset + 12, centralDirectoryEnd - centralDirectoryStart, true);
        view.setUint32(offset + 16, centralDirectoryStart, true);
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
