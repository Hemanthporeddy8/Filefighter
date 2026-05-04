import { FlateDecoder } from '../decoders/flate_decoder.js';
import { AdvancedDecoders } from '../decoders/advanced_decoders.js';

export class PDFObject {
    serialize() { return this.toString(); }
}

export class PDFBool extends PDFObject {
    constructor(value) { super(); this.value = value; }
    toString() { return this.value ? 'true' : 'false'; }
}

export class PDFNumber extends PDFObject {
    constructor(value) { super(); this.value = value; }
    toString() { return String(this.value); }
    // Allow arithmetic: PDFNumber - PDFNumber, mediaBox[2] - mediaBox[0] etc.
    valueOf() { return this.value; }
}

export class PDFString extends PDFObject {
    constructor(value) { super(); this.value = value; }
    toString() {
        if (this.value instanceof Uint8Array) {
            let hex = '';
            for (let i = 0; i < this.value.length; i++) {
                hex += this.value[i].toString(16).padStart(2, '0');
            }
            return `<${hex.toUpperCase()}>`;
        }
        return `(${this.value.replace(/[()\\]/g, '\\$&')})`;
    }
}

export class PDFName extends PDFObject {
    constructor(name) { super(); this.name = name; }
    toString() {
        return `/${this.name.replace(/[^!-~]/g, c => `#${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
    }
}

export class PDFArray extends PDFObject {
    constructor(elements = []) {
        super();
        this.elements = elements;
        // Make numeric indexing work: arr[0], arr[2] etc.
        // This is needed because app.js does mediaBox[0], mediaBox[2] throughout.
        return new Proxy(this, {
            get(target, prop) {
                if (typeof prop === 'string' && /^\d+$/.test(prop)) {
                    const el = target.elements[Number(prop)];
                    // Unwrap PDFNumber to raw JS number for arithmetic
                    return (el && typeof el.valueOf === 'function') ? el.valueOf() : el;
                }
                return target[prop];
            }
        });
    }
    push(element) { this.elements.push(element); }
    get(index) {
        const el = this.elements[index];
        return (el && typeof el.valueOf === 'function') ? el.valueOf() : el;
    }
    get length() { return this.elements.length; }
    // Make for...of and destructuring work: const [x1,y1,x2,y2] = mediaBox
    [Symbol.iterator]() {
        let i = 0;
        const els = this.elements;
        return {
            next() {
                if (i < els.length) {
                    const el = els[i++];
                    const val = (el && typeof el.valueOf === 'function') ? el.valueOf() : el;
                    return { value: val, done: false };
                }
                return { value: undefined, done: true };
            }
        };
    }
    toString() { return `[ ${this.elements.map(e => e ? e.toString() : 'null').join(' ')} ]`; }
}

export class PDFDict extends PDFObject {
    constructor(map = new Map()) { super(); this.map = map; }
    set(key, value) { this.map.set(key.name || key, value); }
    get(key) { return this.map.get(key.name || key); }
    has(key) { return this.map.has(key.name || key); }
    getKeys() { return Array.from(this.map.keys()); }
    toString() {
        let str = '<<\n';
        for (const [k, v] of this.map.entries()) {
            if (v !== null && v !== undefined) {
                if (typeof v.toString === 'function') {
                    str += `  /${k} ${v.toString()}\n`;
                } else if (v instanceof Uint8Array) {
                    str += `  /${k} <${Array.from(v).map(b => b.toString(16).padStart(2, '0')).join('')}>\n`;
                } else {
                    str += `  /${k} ${v}\n`; // Fallback for raw numbers/strings
                }
            } else {
                str += `  /${k} null\n`;
            }
        }
        str += '>>';
        return str;
    }
}

export class PDFRef extends PDFObject {
    constructor(num, gen = 0) { super(); this.num = num; this.gen = gen; }
    toString() { return `${this.num} ${this.gen} R`; }
}

export class PDFStream extends PDFObject {
    constructor(dict, buffer) { super(); this.dict = dict; this.buffer = buffer; }

    /**
     * Decodes this stream's buffer by applying the /Filter chain.
     * Returns decoded Uint8Array bytes (plain content stream text).
     */
    async decode() {
        let data = this.buffer;
        if (!data || data.length === 0) return new Uint8Array(0);

        const filterVal = this.dict.get('Filter');
        if (!filterVal) return data; // No filter — plaintext stream

        // Normalize to array of filter name strings
        let filters = [];
        if (filterVal && filterVal.name) {
            filters = [filterVal.name]; // single PDFName
        } else if (filterVal && filterVal.elements) {
            filters = filterVal.elements.map(f => f.name || f); // PDFArray of PDFNames
        } else if (typeof filterVal === 'string') {
            filters = [filterVal];
        }

        // Apply filters sequentially (left to right as per PDF spec)
        for (const filterName of filters) {
            try {
                if (filterName === 'FlateDecode') {
                    data = await FlateDecoder.decode(data);
                } else if (filterName === 'ASCII85Decode') {
                    data = AdvancedDecoders.decodeASCII85(data);
                } else if (filterName === 'LZWDecode') {
                    data = await AdvancedDecoders.decodeLZW(data);
                } else if (filterName === 'ASCIIHexDecode') {
                    data = this._decodeASCIIHex(data);
                } else if (filterName === 'DCTDecode' || filterName === 'JPXDecode') {
                    // Do not decompress JPEGs or JPEG2000s in JS.
                    // We pass the raw binary stream through to the native browser <img> decoder.
                    continue;
                } else {
                    console.warn(`[Engine] Filter '${filterName}' not yet implemented.`);
                }
            } catch (e) {
                console.error(`[Engine] Filter '${filterName}' failed:`, e.message);
            }
        }
        return data;
    }

    _decodeASCIIHex(data) {
        let hex = new TextDecoder('latin1').decode(data).replace(/[^0-9a-fA-F]/g, '');
        if (hex.length % 2) hex += '0';
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
        return out;
    }

    serialize() {
        // Ensure /Length is synchronized with the buffer size
        this.dict.set('Length', new PDFNumber(this.buffer.length));

        const header = this.dict.toString();
        const start = `\nstream\n`, end = `\nendstream\n`;
        const enc = new TextEncoder();
        const hB = enc.encode(header), sB = enc.encode(start), eB = enc.encode(end);
        const res = new Uint8Array(hB.length + sB.length + this.buffer.length + eB.length);
        res.set(hB); res.set(sB, hB.length); res.set(this.buffer, hB.length + sB.length); res.set(eB, hB.length + sB.length + this.buffer.length);
        return res;
    }
}

export class PDFPage extends PDFObject {
    constructor(dict, doc, ref = null) {
        super();
        this.dict = dict;
        this.doc = doc;
        this.ref = ref; // Store the PDFRef (num, gen)
    }

    get(key) {
        return this.dict.get(key);
    }

    async loadResources() {
        const res = this.dict.get('Resources');
        if (!res) return new PDFDict();
        const resolved = this.doc ? await this.doc._resolve(res) : res;
        return resolved || new PDFDict();
    }

    /**
     * Returns the decoded content stream bytes for this page.
     * Handles: single PDFStream, PDFArray of stream refs (concatenated), filter chains.
     */
    async getContentStream() {
        if (!this.doc) return null;
        const contentsRaw = this.dict.get('Contents');
        if (!contentsRaw) return null;

        const contents = await this.doc._resolve(contentsRaw);
        if (!contents) return null;

        // Case 1: Array of content streams (concatenate them)
        if (contents instanceof PDFArray || (contents && Array.isArray(contents.elements))) {
            const chunks = [];
            const elements = contents.elements;
            for (const ref of elements) {
                const stream = await this.doc._resolve(ref);
                if (stream instanceof PDFStream) {
                    const decoded = await stream.decode();
                    chunks.push(decoded);
                }
            }
            // Merge with whitespace separator
            const totalLen = chunks.reduce((sum, c) => sum + c.length + 1, 0);
            const merged = new Uint8Array(totalLen);
            let offset = 0;
            for (const chunk of chunks) {
                merged.set(chunk, offset);
                offset += chunk.length;
                merged[offset++] = 32; // space separator
            }
            return merged;
        }

        // Case 2: Single content stream
        if (contents instanceof PDFStream) {
            return contents.decode();
        }

        console.warn('[Engine] getContentStream: unrecognized Contents type', typeof contents);
        return null;
    }
}
