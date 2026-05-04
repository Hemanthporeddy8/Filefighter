import { RandomAccessReader } from './random_access_reader.js';
import { ASTParser } from './ast_parser.js';
import { PDFDict, PDFArray, PDFRef, PDFNumber, PDFStream, PDFPage } from './pdf_objects.js';
import { FlateDecoder } from '../decoders/flate_decoder.js';

/**
 * @module PDFDocument
 * @description Production-grade PDF document loader.
 * Supports: PDF 1.0–2.0, standard XREF tables, PDF 1.5+ XRef streams, Object Streams.
 */
export class PDFDocument {
    constructor() {
        this.pages = [];
        this.reader = null;
        this.parser = null;
        this.catalog = null;
        this.objectCache = new Map();
        this._objStreamCache = new Map();
        this._objectCache = new Map();
        this.originalBuffer = null;
        this.startXrefPos = 0;
    }

    get pageCount() {
        return this.pages.length;
    }

    getPage(index) {
        return this.pages[index];
    }

    getMaxObjectId() {
        let max = 0;
        for (const key of this.parser.xref.keys()) {
            const num = parseInt(key.split(',')[0], 10);
            if (num > max) max = num;
        }
        return max;
    }

    static async load(file) {
        const doc = new PDFDocument();
        doc.reader = new RandomAccessReader(file);
        doc.originalBuffer = file; // Store reference
        doc.parser = new ASTParser(doc.reader);

        await doc.parseXrefTable();
        await doc.loadDocumentCatalog();

        return doc;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // XREF PARSING
    // ─────────────────────────────────────────────────────────────────────────

    async parseXrefTable() {
        // Step 1: Find startxref from the end of the file
        const endBuf = await this.reader.readEnd(2048);
        const endStr = new TextDecoder('latin1').decode(endBuf);
        const sxIdx = endStr.lastIndexOf('startxref');
        if (sxIdx === -1) throw new Error('PDF Fatal: No startxref found.');

        const afterSx = endStr.substring(sxIdx + 9).trim();
        const startOffset = parseInt(afterSx.split(/\s+/)[0], 10);
        if (isNaN(startOffset) || startOffset < 0) throw new Error('PDF Fatal: Invalid startxref offset.');

        this.startXrefPos = startOffset;
        await this._loadXref(startOffset);
    }

    async _loadXref(offset) {
        // Read the first 64 bytes at offset to figure out if it's table or stream
        const peek = await this.reader.read(offset, 64);
        const peekStr = new TextDecoder('latin1').decode(peek);
        const trimmed = peekStr.trimStart();

        if (trimmed.startsWith('xref')) {
            await this._parseClassicXref(offset);
        } else {
            await this._parseXrefStream(offset);
        }
    }

    async _parseClassicXref(offset) {
        // Read up to 256KB from the xref start
        const buf = await this.reader.read(offset, 262144);
        const xrefStr = new TextDecoder('latin1').decode(buf);
        const lines = xrefStr.split(/\r\n|\r|\n/);

        let objNum = 0;
        let sectionCount = 0;
        let inTable = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line === 'xref') { inTable = true; continue; }

            if (line === 'trailer') {
                // Parse the entire trailer dictionary properly
                const restStr = lines.slice(i + 1).join('\n');
                const trailerBuf = new TextEncoder().encode(restStr);
                const trailer = this.parser.parseIndirectObject(trailerBuf, true);

                if (trailer instanceof PDFDict) {
                    this.parser.trailer = trailer;
                    const root = trailer.get('Root');
                    console.log('[Engine] Trailer parsed. /Root:', root?.toString() || 'missing');

                    const prev = trailer.get('Prev');
                    if (prev instanceof PDFNumber) {
                        console.log('[Engine] Following /Prev xref chain at:', prev.value);
                        await this._loadXref(prev.value);
                    }
                }
                return;
            }

            if (!inTable) continue;

            // Section header: "objNum count"
            const headM = line.match(/^(\d+)\s+(\d+)$/);
            if (headM) {
                objNum = +headM[1];
                sectionCount = +headM[2];
                continue;
            }

            // Entry: "offset gen [n|f]"
            const entM = line.match(/^(\d{10})\s+(\d{5})\s+([nf])/);
            if (entM && sectionCount > 0) {
                if (entM[3] === 'n') {
                    const key = `${objNum},${+entM[2]}`;
                    if (!this.parser.xref.has(key)) { // don't overwrite (newer incremental wins)
                        this.parser.xref.set(key, +entM[1]);
                    }
                }
                objNum++;
                sectionCount--;
            }
        }
    }

    async _parseXrefStream(offset) {
        console.log('[Engine] PDF 1.5+ XRef stream at offset:', offset);
        // Read a large chunk to get the whole object header + stream
        const buf = await this.reader.read(offset, 131072);

        // Parse the object using ASTParser
        const xrefObj = this.parser.parseIndirectObject(buf);
        if (!(xrefObj instanceof PDFStream)) {
            console.error('[Engine] XRef stream is not a stream object!');
            return;
        }

        const dict = xrefObj.dict;

        this.parser.trailer = dict;
        const rootRef = dict.get('Root');
        if (rootRef) {
            console.log('[Engine] XRef stream /Root:', rootRef.toString());
        }

        // Extract /W (field widths) and /Index (object number ranges)
        const wArr = dict.get('W');
        if (!wArr || !wArr.elements || wArr.elements.length < 3) {
            console.warn('[Engine] XRef stream has no /W array — using scan fallback');
            await this._scanAllObjects();
            return;
        }
        const w = wArr.elements.map(e => (e instanceof PDFNumber ? e.value : (e.value || 0)));

        // /Index defaults to [0, /Size]
        let indexRanges = [0, 0];
        const sizeEntry = dict.get('Size');
        if (sizeEntry instanceof PDFNumber) indexRanges = [0, sizeEntry.value];
        const indexArr = dict.get('Index');
        if (indexArr && indexArr.elements) {
            indexRanges = indexArr.elements.map(e => (e instanceof PDFNumber ? e.value : e.value) || 0);
        }

        // Decompress the stream data
        // IMPORTANT: We cannot use xrefObj.streamData because /Length may be an indirect ref
        // (extremely common in PDF), causing streamLength=0 and streamData to be empty.
        // Instead: locate stream/endstream boundaries manually in the raw buffer.
        let data;
        try {
            // Find 'stream' keyword in raw bytes
            const streamKeyword = new TextEncoder().encode('stream');
            const endStreamKeyword = new TextEncoder().encode('endstream');

            let streamStart = -1;
            for (let i = 3; i < buf.length - streamKeyword.length; i++) {
                // Quick reject: first byte must be 's' (0x73)
                if (buf[i] !== 0x73) continue;
                let match = true;
                for (let j = 0; j < streamKeyword.length; j++) {
                    if (buf[i + j] !== streamKeyword[j]) { match = false; break; }
                }
                if (!match) continue;

                // Ensure this 'stream' is NOT preceded by 'end' (i.e., not 'endstream')
                if (i >= 3 && buf[i - 3] === 0x65 && buf[i - 2] === 0x6E && buf[i - 1] === 0x64) continue;

                // Must be followed by \\r\\n or \\n (PDF spec requirement)
                const after = buf[i + streamKeyword.length];
                if (after !== 0x0A && after !== 0x0D) continue;

                // Skip past the newline(s) after 'stream'
                let s = i + streamKeyword.length;
                if (buf[s] === 0x0D && buf[s + 1] === 0x0A) s += 2; // CRLF
                else if (buf[s] === 0x0D || buf[s] === 0x0A) s += 1; // LF or CR
                streamStart = s;
                break;
            }

            if (streamStart < 0) throw new Error('No stream keyword found');

            // Find 'endstream' — search from the end for reliability
            let streamEnd = buf.length;
            for (let i = buf.length - endStreamKeyword.length; i >= streamStart; i--) {
                let match = true;
                for (let j = 0; j < endStreamKeyword.length; j++) {
                    if (buf[i + j] !== endStreamKeyword[j]) { match = false; break; }
                }
                if (match) {
                    streamEnd = i;
                    // PDF spec: stream data is followed by \r\n or \n before 'endstream'
                    // These bytes are NOT part of the stream — trim them
                    while (streamEnd > streamStart && (buf[streamEnd - 1] === 0x0A || buf[streamEnd - 1] === 0x0D)) {
                        streamEnd--;
                    }
                    break;
                }
            }

            const rawStream = buf.subarray(streamStart, streamEnd);
            console.log(`[Engine] XRef raw stream: ${rawStream.length} bytes, first 4: ${rawStream[0]} ${rawStream[1]} ${rawStream[2]} ${rawStream[3]}`);
            data = await FlateDecoder.decode(rawStream);
        } catch (e) {
            console.warn('[Engine] XRef stream decode failed, using scan fallback:', e.message);
            await this._scanAllObjects();
            return;
        }

        // Parse binary entries
        const entrySize = w[0] + w[1] + w[2];
        if (entrySize === 0) return;

        let dataPos = 0;
        for (let ri = 0; ri < indexRanges.length; ri += 2) {
            let objNum = indexRanges[ri];
            const count = indexRanges[ri + 1];

            for (let n = 0; n < count; n++, objNum++) {
                if (dataPos + entrySize > data.length) break;

                // Field 1: type (default 1 if w[0] === 0)
                let type = 1;
                if (w[0] > 0) {
                    type = 0;
                    for (let b = 0; b < w[0]; b++) type = (type << 8) | data[dataPos + b];
                }

                // Field 2: offset or stream obj number
                let field2 = 0;
                for (let b = 0; b < w[1]; b++) field2 = (field2 << 8) | data[dataPos + w[0] + b];

                // Field 3: generation (or object index in ObjStm)
                let field3 = 0;
                for (let b = 0; b < w[2]; b++) field3 = (field3 << 8) | data[dataPos + w[0] + w[1] + b];

                dataPos += entrySize;

                const key = `${objNum},${type === 2 ? 0 : field3}`;
                if (this.parser.xref.has(key)) continue; // don't overwrite

                if (type === 0) {
                    // Free object — skip
                } else if (type === 1) {
                    // Normal object at byte offset
                    this.parser.xref.set(key, field2);
                } else if (type === 2) {
                    // Object in a compressed Object Stream
                    // Store as negative to distinguish from direct offsets
                    // Format: { stmObjNum: field2, index: field3 }
                    this.parser.xref.set(key, { stmObjNum: field2, indexInStm: field3 });
                }
            }
        }

        console.log(`[Engine] XRef stream parsed: ${this.parser.xref.size} entries`);

        // Follow /Prev chain
        const prevEntry = dict.get('Prev');
        if (prevEntry instanceof PDFNumber && prevEntry.value > 0) {
            await this._loadXref(prevEntry.value);
        }
    }

    async _scanAllObjects() {
        console.warn('[Engine] Fallback: scanning entire file for N G obj patterns...');
        const fileSize = this.reader.size;
        const chunkSize = 65536;
        const overlap = 32;
        let prevTail = '';

        for (let pos = 0; pos < fileSize; pos += chunkSize - overlap) {
            const len = Math.min(chunkSize, fileSize - pos);
            const buf = await this.reader.read(pos, len);
            const str = prevTail + new TextDecoder('latin1').decode(buf);
            const re = /(\d+)\s+(\d+)\s+obj/g;
            let m;
            while ((m = re.exec(str)) !== null) {
                const num = +m[1];
                const gen = +m[2];
                const byteOffset = pos - prevTail.length + m.index;
                const key = `${num},${gen}`;
                if (!this.parser.xref.has(key)) {
                    this.parser.xref.set(key, byteOffset);
                }
            }
            prevTail = str.slice(-overlap);
        }
        console.log(`[Engine] File scan built ${this.parser.xref.size} xref entries`);
    }

    /**
     * Extract raw compressed bytes from a raw buffer that starts at a PDF object offset.
     * @param {Uint8Array} buf - The buffer containing the object
     * @param {PDFDict} dict - The parsed dictionary for this stream
     */
    async _extractStreamBytes(buf, dict, offset = -1) {
        if (!buf || buf.length === 0) return new Uint8Array(0);

        // Find the "stream" keyword efficiently
        const bufStr = new TextDecoder('latin1').decode(buf.subarray(0, 4096));
        const sKeywordIdx = bufStr.indexOf('stream');
        if (sKeywordIdx === -1) throw new Error('No stream keyword found');

        let s = sKeywordIdx + 6;
        if (buf[s] === 0x0D && buf[s + 1] === 0x0A) s += 2;
        else if (buf[s] === 0x0A || buf[s] === 0x0D) s += 1;
        const streamStartAcrossBuffer = s;

        // Determine exact length
        let streamLength = -1;
        if (dict) {
            const lenObj = dict.get('Length');
            const resolvedLen = await this._resolve(lenObj);
            if (typeof resolvedLen === 'number') streamLength = resolvedLen;
            else if (resolvedLen instanceof PDFNumber) streamLength = resolvedLen.value;
        }

        // Case A: Successful length resolution + we have the data in this buffer
        if (streamLength >= 0 && streamStartAcrossBuffer + streamLength <= buf.length) {
            return buf.subarray(streamStartAcrossBuffer, streamStartAcrossBuffer + streamLength);
        }

        // Case B: We need to read more from the reader because the buffer was truncated
        if (offset !== -1 && streamLength >= 0) {
            const absoluteStart = offset + streamStartAcrossBuffer;
            return await this.reader.read(absoluteStart, streamLength);
        }

        // Case C: Fallback search for endstream
        const es = new Uint8Array([0x65, 0x6E, 0x64, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6D]);
        for (let i = streamStartAcrossBuffer; i <= buf.length - es.length; i++) {
            let match = true;
            for (let j = 0; j < es.length; j++) if (buf[i + j] !== es[j]) { match = false; break; }
            if (match) {
                let streamEnd = i;
                if (buf[streamEnd - 1] === 0x0A) { streamEnd--; if (buf[streamEnd - 1] === 0x0D) streamEnd--; }
                else if (buf[streamEnd - 1] === 0x0D) streamEnd--;
                return buf.subarray(streamStartAcrossBuffer, streamEnd);
            }
        }
        throw new Error('Incomplete stream: length unknown and endstream not found');
    }


    // ─────────────────────────────────────────────────────────────────────────
    // OBJECT STREAM SUPPORT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Load a compressed Object Stream and cache all its objects.
     */
    async _loadObjectStream(stmObjNum) {
        if (this._objStreamCache.has(stmObjNum)) {
            return this._objStreamCache.get(stmObjNum);
        }

        const stmRef = new PDFRef(stmObjNum, 0);
        // Temporarily remove the ObjStm entry so we don't recurse
        const stmOffset = this.parser.xref.get(`${stmObjNum},0`);
        if (typeof stmOffset !== 'number') {
            console.error(`[Engine] Object Stream ${stmObjNum} not directly reachable`);
            return null;
        }

        const buf = await this.reader.read(stmOffset, 131072);
        const stmObj = this.parser.parseIndirectObject(buf);
        if (!(stmObj instanceof PDFStream)) {
            console.error(`[Engine] Object ${stmObjNum} is not a stream`);
            return null;
        }

        // Decompress — do NOT use stmObj.streamData (empty when /Length is indirect ref)
        // Instead locate stream/endstream boundaries by binary search
        let data;
        try {
            data = await FlateDecoder.decode(await this._extractStreamBytes(buf, stmObj.dict));
        } catch (e) {
            console.error(`[Engine] Object Stream ${stmObjNum} decompression failed:`, e.message);
            return null;
        }

        const str = new TextDecoder('latin1').decode(data);
        const nEntry = stmObj.dict.get('N');
        const firstEntry = stmObj.dict.get('First');
        const n = nEntry instanceof PDFNumber ? nEntry.value : 0;
        const first = firstEntry instanceof PDFNumber ? firstEntry.value : 0;

        // Parse header: pairs of "objNum offset" before the actual objects
        const headerStr = str.substring(0, first);
        const headerPairs = headerStr.trim().split(/\s+/);
        const offsets = new Map(); // objNum -> offset within data (after 'first')

        for (let i = 0; i < headerPairs.length - 1; i += 2) {
            const num = parseInt(headerPairs[i], 10);
            const relOffset = parseInt(headerPairs[i + 1], 10);
            offsets.set(num, first + relOffset);
        }

        // Parse each object from its offset
        const objects = new Map();
        for (const [num, objOffset] of offsets.entries()) {
            const objBuf = new TextEncoder().encode(str.substring(objOffset));
            // Wrap in a fake "N 0 obj" wrapper for parseIndirectObject
            const fakeObj = `${num} 0 obj\n${str.substring(objOffset)}\nendobj`;
            const fakeBuf = new TextEncoder().encode(fakeObj);
            try {
                const parsed = this.parser.parseIndirectObject(new Uint8Array(fakeBuf));
                objects.set(num, parsed);
            } catch (e) {
                console.warn(`[Engine] ObjStm obj ${num} parse failed:`, e.message);
            }
        }

        this._objStreamCache.set(stmObjNum, objects);
        console.log(`[Engine] Object Stream ${stmObjNum}: ${objects.size} objects loaded`);
        return objects;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CATALOG + PAGE TREE
    // ─────────────────────────────────────────────────────────────────────────

    async loadDocumentCatalog() {
        if (!this.parser.trailer) {
            console.warn('[Engine] No trailer — attempting full file scan...');
            await this._scanAllObjects();
            if (!this.parser.trailer) {
                console.error('[Engine] Cannot find /Root. PDF is invalid or unsupported.');
                return;
            }
        }

        // Attach the object stream resolver to the parser
        this.parser._resolveObjStmRef = async (stmObjNum, indexInStm) => {
            const stmObjects = await this._loadObjectStream(stmObjNum);
            if (!stmObjects) return null;
            // Return the Nth object (by insertion order)
            let i = 0;
            for (const [, v] of stmObjects.entries()) {
                if (i === indexInStm) return v;
                i++;
            }
            return null;
        };

        const rootRef = (this.parser.trailer instanceof PDFDict) ? this.parser.trailer.get('Root') : this.parser.trailer;
        console.log('[Engine] Resolving /Root:', rootRef?.toString() || 'null');
        this.catalog = await this._resolve(rootRef);

        if (!(this.catalog instanceof PDFDict)) {
            console.error('[Engine] /Root is not a PDFDict:', this.catalog);
            return;
        }

        const pagesRef = this.catalog.get('Pages');
        await this._flattenPageTree(pagesRef);
        console.log(`[Engine] ✅ ${this.pages.length} page(s) loaded.`);
    }

    // FIX 2: Recursive page tree traversal WITH property inheritance.
    // Per PDF spec §7.7.3.4: /MediaBox, /Resources, /Rotate, /CropBox
    // defined on a /Pages node are inherited by all children that don\'t
    // override them. Without this, child pages miss their /Resources and
    // /MediaBox, causing blank pages and mismatched page sizes.
    async _flattenPageTree(nodeRef, depth = 0, inherited = {}) {
        if (depth > 32) return; // safety guard against circular references
        const node = await this._resolve(nodeRef);
        if (!node || !(node instanceof PDFDict)) return;

        const typeVal = node.get('Type');
        const typeName = typeVal ? (typeVal.name || String(typeVal)) : '';

        // Collect inheritable properties from this node
        // These flow DOWN from /Pages to /Page children
        const inheritableKeys = ['Resources', 'MediaBox', 'CropBox', 'Rotate'];
        const nodeInherited = { ...inherited };
        for (const k of inheritableKeys) {
            const val = node.get(k);
            if (val !== undefined && val !== null) {
                nodeInherited[k] = val; // this node overrides parent
            }
        }

        if (typeName === 'Pages') {
            const kids = node.get('Kids');
            const kidsArr = await this._resolve(kids);
            if (kidsArr instanceof PDFArray) {
                for (const kidRef of kidsArr.elements) {
                    await this._flattenPageTree(kidRef, depth + 1, nodeInherited);
                }
            }
        } else if (typeName === 'Page' || node.get('MediaBox') || Object.keys(nodeInherited).length > 0) {
            // Merge inherited properties INTO page dict for any missing keys
            // This makes them available when app.js does page.get('Resources') etc.
            for (const k of inheritableKeys) {
                if (!node.get(k) && nodeInherited[k] !== undefined) {
                    node.set(k, nodeInherited[k]);
                }
            }
            this.pages.push(new PDFPage(node, this, nodeRef));
        }
    }

    async _resolve(ref) {
        if (!(ref instanceof PDFRef)) {
            // Non-ref: resolve primitives directly (no caching needed)
            return this.parser.resolve(ref);
        }

        const num = ref.num ?? ref.value ?? 0;
        const gen = ref.gen ?? ref.generation ?? 0;
        const key = `${num},${gen}`;

        // FIX 1: Check object cache first — avoid re-reading from disk
        if (this._objectCache.has(key)) {
            return this._objectCache.get(key);
        }

        const entry = this.parser.xref.get(key);

        let result;
        if (entry && typeof entry === 'object' && 'stmObjNum' in entry) {
            const stmObjects = await this._loadObjectStream(entry.stmObjNum);
            result = stmObjects ? (stmObjects.get(num) ?? null) : null;
        } else if (typeof entry === 'number') {
            // Type 1: direct byte offset
            // We read a conservative chunk for the dictionary/object header
            const buf = await this.reader.read(entry, 16384);
            result = this.parser.parseIndirectObject(buf);

            // Handle truncated or indirect length streams
            if (result instanceof PDFStream && result._isTruncated) {
                try {
                    result.buffer = await this._extractStreamBytes(buf, result.dict, entry);
                } catch (e) {
                    console.error(`[Engine] Stream extraction failed for obj ${num}:`, e.message);
                }
            }
        }

        // Store in cache (including null — avoids re-hitting disk for missing refs)
        if (result !== undefined) {
            this._objectCache.set(key, result);
        }
        return result ?? null;
    }

    removePage(index) {
        if (index >= 0 && index < this.pages.length) {
            this.pages.splice(index, 1);
            console.log(`[Engine] Page removal registered. Remaining: ${this.pages.length}`);
            return true;
        }
        return false;
    }

    async save() {
        const out = []; let offset = 0; const newXref = new Map(); const enc = new TextEncoder();
        const hr = enc.encode("%PDF-1.7\n%\u00e2\u00e3\u00cf\u00d3\n");
        out.push(hr); offset += hr.length;
        const keys = Array.from(this.parser.xref.keys()).sort((a, b) => parseInt(a) - parseInt(b));
        let maxObj = 0;
        for (const key of keys) {
            const [num, gen] = key.split(',').map(Number);
            maxObj = Math.max(maxObj, num);
            const obj = await this._resolve(new PDFRef(num, gen));
            if (!obj) continue;
            newXref.set(num, offset);
            const p = enc.encode(`${num} ${gen} obj\n`);
            const b = (obj instanceof PDFStream) ? obj.serialize() : enc.encode(obj.toString());
            const s = enc.encode("\nendobj\n");
            out.push(p, b, s); offset += p.length + b.length + s.length;
        }
        const sx = offset;
        let xrStr = `xref\n0 ${maxObj + 1}\n0000000000 65535 f\r\n`;
        for (let i = 1; i <= maxObj; i++) {
            const off = newXref.get(i);
            xrStr += (off !== undefined) ? String(off).padStart(10, "0") + " 00000 n\r\n" : "0000000000 00000 f\r\n";
        }
        const xrB = enc.encode(xrStr); out.push(xrB); offset += xrB.length;

        // Build standard Trailer Dictionary
        let rootRef = this.parser.trailer;
        let trailerContent = "";

        if (this.parser.trailer instanceof PDFDict) {
            rootRef = this.parser.trailer.get('Root');
            for (const key of this.parser.trailer.getKeys()) {
                if (['Size', 'Root', 'Encrypt', 'ID', 'Prev', 'XRefStm', 'Index', 'W'].includes(key)) continue;
                const val = this.parser.trailer.get(key);
                if (val) trailerContent += ` /${key} ${val.toString()}`;
            }
        }

        let encryptStr = "";
        let idStr = "";
        if (this.encryptRef) encryptStr = ` /Encrypt ${this.encryptRef.toString()}`;
        if (this.idArray) idStr = ` /ID ${this.idArray.toString()}`;

        const tr = `trailer\n<< /Size ${maxObj + 1} /Root ${rootRef.toString()}${trailerContent}${encryptStr}${idStr} >>\nstartxref\n${sx}\n%%EOF`;
        out.push(enc.encode(tr));
        const total = out.reduce((a, b) => a + b.length, 0); const res = new Uint8Array(total);
        let cur = 0; for (const b of out) { res.set(b, cur); cur += b.length; }
        return res;
    }
}
