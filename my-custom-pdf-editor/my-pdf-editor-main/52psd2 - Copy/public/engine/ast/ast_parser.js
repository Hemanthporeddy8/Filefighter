import { PDFObject, PDFBool, PDFNumber, PDFString, PDFName, PDFArray, PDFDict, PDFRef, PDFStream } from './pdf_objects.js';

/**
 * @module ASTParser
 * @description Translates raw binary bytes streaming from the RandomAccessReader into strict PDFObject instances.
 */
export class ASTParser {
    constructor(reader) {
        this.reader = reader;
        this.xref = new Map();
        this.trailer = null;
    }

    /**
     * Resolves an indirect reference via the XREF table.
     * Handles both normal byte-offset refs and PDF 1.5+ Object Stream type-2 refs.
     */
    async resolve(obj) {
        if (!(obj instanceof PDFRef)) return obj;

        const num = obj.num ?? obj.value ?? 0;
        const gen = obj.gen ?? obj.generation ?? 0;
        const key = `${num},${gen}`;
        let entry = this.xref.get(key);

        if (entry === undefined) {
            // Brute-force byte search for missing refs
            entry = await this._bruteForceSearch(num, gen);
            if (entry !== undefined) this.xref.set(key, entry);
        }

        if (entry === undefined) {
            console.error(`[Engine] Ref ${num} ${gen} R not found.`);
            return null;
        }

        // Type 2: object embedded inside a compressed Object Stream
        if (typeof entry === 'object' && 'stmObjNum' in entry) {
            if (this._resolveObjStmRef) {
                return this._resolveObjStmRef(entry.stmObjNum, entry.indexInStm);
            }
            console.error(`[Engine] No ObjStm resolver for ref ${num} ${gen}`);
            return null;
        }

        // Type 1: direct byte offset
        const chunk = await this.reader.read(entry, 65536);
        return this.parseIndirectObject(chunk);
    }

    async _bruteForceSearch(num, gen) {
        const searchStr = `${num} ${gen} obj`;
        const encoded = new TextEncoder().encode(searchStr);
        const chunkSize = 524288; // 512KB

        for (let pos = this.reader.size; pos > 0; pos -= (chunkSize - encoded.length)) {
            const readPos = Math.max(0, pos - chunkSize);
            const buf = await this.reader.read(readPos, chunkSize);

            // Search backward through the chunk
            for (let i = buf.length - encoded.length; i >= 0; i--) {
                let match = true;
                for (let j = 0; j < encoded.length; j++) {
                    if (buf[i + j] !== encoded[j]) { match = false; break; }
                }
                if (match) {
                    // Make sure it's preceded by whitespace or start-of-file
                    const pre = i > 0 ? buf[i - 1] : 0x0A;
                    if (pre <= 0x20) return readPos + i;
                }
            }
            if (readPos === 0) break;
        }
        return undefined;
    }


    // Extremely lightweight manual byte-scanner, completely memory-safe for massive files
    /**
     * Specialized one-shot parser for a chunk containing a PDF indirect object.
     * @param {Uint8Array} buffer 
     * @param {boolean} dictOnly - If true, returns the dictionary/object even if it's a stream.
     */
    parseIndirectObject(buffer, dictOnly = false) {
        let pos = 0;

        const skipWhitespace = () => {
            while (pos < buffer.length) {
                const b = buffer[pos];
                if (b === 0x00 || b === 0x09 || b === 0x0A || b === 0x0C || b === 0x0D || b === 0x20) {
                    pos++;
                } else if (b === 0x25) { // Comment %
                    while (pos < buffer.length && buffer[pos] !== 0x0A && buffer[pos] !== 0x0D) pos++;
                } else {
                    break;
                }
            }
        };

        const readToken = () => {
            skipWhitespace();
            if (pos >= buffer.length) return null;

            const start = pos;
            const b = buffer[pos];

            if (b === 0x2F) { // Name /
                pos++;
                while (pos < buffer.length) {
                    const next = buffer[pos];
                    if (next <= 0x20 || next === 0x28 || next === 0x29 || next === 0x3C || next === 0x3E || next === 0x5B || next === 0x5D || next === 0x7B || next === 0x7D || next === 0x2F || next === 0x25) break;
                    pos++;
                }
                return new PDFName(new TextDecoder().decode(buffer.subarray(start + 1, pos)));
            }

            if (b === 0x3C && buffer[pos + 1] === 0x3C) { pos += 2; return '<<'; }
            if (b === 0x3E && buffer[pos + 1] === 0x3E) { pos += 2; return '>>'; }
            if (b === 0x5B) { pos++; return '['; }
            if (b === 0x5D) { pos++; return ']'; }

            if (b === 0x28) { // String (
                pos++; let depth = 1;
                while (pos < buffer.length && depth > 0) {
                    if (buffer[pos] === 0x5C) pos += 2;
                    else if (buffer[pos] === 0x28) { depth++; pos++; }
                    else if (buffer[pos] === 0x29) { depth--; pos++; }
                    else pos++;
                }
                return new PDFString(new TextDecoder().decode(buffer.subarray(start + 1, pos - 1)));
            }

            if (b === 0x3C) { // Hex <
                pos++;
                const startHex = pos;
                while (pos < buffer.length && buffer[pos] !== 0x3E) pos++;
                const hexStr = new TextDecoder().decode(buffer.subarray(startHex, pos)).replace(/[^0-9A-Fa-f]/g, '');
                pos++;
                const bytes = new Uint8Array(Math.ceil(hexStr.length / 2));
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = parseInt(hexStr.substring(i * 2, i * 2 + 2).padEnd(2, '0'), 16);
                }
                return new PDFString(bytes);
            }

            while (pos < buffer.length) {
                const next = buffer[pos];
                if (next <= 0x20 || next === 0x28 || next === 0x29 || next === 0x3C || next === 0x3E || next === 0x5B || next === 0x5D || next === 0x7B || next === 0x7D || next === 0x2F || next === 0x25) break;
                pos++;
            }
            if (pos === start) pos++;
            const str = new TextDecoder().decode(buffer.subarray(start, pos));

            if (str === 'true') return new PDFBool(true);
            if (str === 'false') return new PDFBool(false);
            if (str === 'null') return null;
            if (!isNaN(parseFloat(str))) {
                const savedPos = pos; skipWhitespace();
                let nextStr = ""; let tempPos = pos;
                while (tempPos < buffer.length && buffer[tempPos] > 0x20 && buffer[tempPos] !== 0x2F && buffer[tempPos] !== 0x5B && buffer[tempPos] !== 0x3C) {
                    nextStr += String.fromCharCode(buffer[tempPos++]);
                }
                if (!isNaN(parseFloat(nextStr))) {
                    tempPos++; while (tempPos < buffer.length && buffer[tempPos] <= 0x20) tempPos++;
                    if (String.fromCharCode(buffer[tempPos]) === 'R') {
                        pos = tempPos + 1;
                        return new PDFRef(parseInt(str), parseInt(nextStr));
                    }
                }
                pos = savedPos;
                return new PDFNumber(parseFloat(str));
            }
            return str;
        };

        const parseValue = () => {
            const token = readToken();
            if (token === '<<') {
                const dict = new PDFDict(); let guard = 0;
                while (guard++ < 2000) {
                    const key = parseValue();
                    if (key === '>>' || key === null) break;
                    if (!(key instanceof PDFName)) continue;
                    dict.set(key, parseValue());
                }
                return dict;
            }
            if (token === '[') {
                const arr = new PDFArray(); let guard = 0;
                while (guard++ < 5000) {
                    const val = parseValue();
                    if (val === ']' || val === null) break;
                    arr.push(val);
                }
                return arr;
            }
            return token;
        };

        // Skip 'N G obj' if present
        const t1 = readToken();
        if (!isNaN(parseInt(t1))) {
            const t2 = readToken();
            if (!isNaN(parseInt(t2))) {
                const t3 = readToken();
                if (t3 !== 'obj') pos = 0;
            } else pos = 0;
        } else pos = 0;

        const astObj = parseValue();

        if (!dictOnly) {
            skipWhitespace();
            if (pos < buffer.length) {
                const peek = new TextDecoder().decode(buffer.subarray(pos, pos + 20));
                const sIdx = peek.indexOf('stream');
                if (sIdx !== -1) {
                    pos += sIdx + 6;
                    if (buffer[pos] === 0x0D && buffer[pos + 1] === 0x0A) pos += 2;
                    else if (buffer[pos] === 0x0A || buffer[pos] === 0x0D) pos += 1;

                    let streamLength = 0;
                    if (astObj instanceof PDFDict) {
                        const len = astObj.get('Length');
                        if (len instanceof PDFNumber) streamLength = len.value;
                    }
                    const streamData = buffer.subarray(pos, Math.min(buffer.length, pos + streamLength));
                    const stream = new PDFStream(astObj, streamData);
                    stream._streamStartPos = pos;
                    stream._isTruncated = (streamLength > buffer.length - pos) || (astObj.get('Length') instanceof PDFRef);
                    return stream;
                }
            }
        }
        return astObj;
    }
}
