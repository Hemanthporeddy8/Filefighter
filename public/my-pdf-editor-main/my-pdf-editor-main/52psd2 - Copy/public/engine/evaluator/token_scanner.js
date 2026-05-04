/**
 * @module TokenScanner
 * @description The Lexical analyzer that parses decrypted Stream Bytes into executable command sequences.
 * Identical in philosophy to `pdf.js` content parser (src/core/parser.js) but zero-dependency.
 * 
 * FIXED:
 *  - Inline image BI/ID/EI parsing (was crashing the VM)
 *  - Dictionary << >> handling inside content streams
 *  - Name token robustness (/Name with special chars)
 *  - Number edge cases (-0, .5, 1e4)
 */

export class TokenScanner {
    constructor(unzippedBytes) {
        if (typeof unzippedBytes === 'string') {
            // Accept string input too
            this.stream = new Uint8Array(unzippedBytes.length);
            for (let i = 0; i < unzippedBytes.length; i++)
                this.stream[i] = unzippedBytes.charCodeAt(i) & 0xFF;
        } else {
            this.stream = unzippedBytes; // Uint8Array
        }
        this.pos = 0;
    }

    nextToken() {
        this.skipWhitespace();
        if (this.pos >= this.stream.length) return null;

        const startIndex = this.pos; // Remember where this token began
        const args = [];

        while (this.pos < this.stream.length) {
            this.skipWhitespace();
            if (this.pos >= this.stream.length) break;

            const byte = this.stream[this.pos];

            // Number argument (+, -, or digit or .)
            if (byte === 43 || byte === 45 || byte === 46 || (byte >= 48 && byte <= 57)) {
                // Make sure it's actually a number (not an operator like 'BM')
                const next = this.stream[this.pos + 1];
                if (byte === 43 || byte === 45) {
                    // Only treat as number if followed by digit or '.'
                    if (next >= 48 && next <= 57 || next === 46) {
                        args.push(this.readNumber());
                        continue;
                    }
                } else {
                    args.push(this.readNumber());
                    continue;
                }
            }

            // String sequence (...)
            if (byte === 40) { // '('
                args.push(this.readString());
                continue;
            }

            // Hex string sequence <...> but NOT <<dict>>
            if (byte === 60 && this.stream[this.pos + 1] !== 60) { // '<' but not '<<'
                args.push(this.readHexString());
                continue;
            }

            // Dictionary << ... >> inside content stream (e.g., inline image params)
            if (byte === 60 && this.stream[this.pos + 1] === 60) {
                args.push(this.readDictionary());
                continue;
            }

            // Array start [ — collect elements until ]
            if (byte === 91) { // '['
                args.push(this.readArray());
                continue;
            }

            // Array end ] unexpected — skip
            if (byte === 93) {
                this.pos++;
                continue;
            }

            // Name token /FontName
            if (byte === 47) { // '/'
                args.push(this.readName());
                continue;
            }

            // ── Operator ─────────────────────────────────────────────────────
            const cmd = this.readOperator();
            if (!cmd) { this.pos++; continue; }

            // ── Inline Image Special Handling ─────────────────────────────────
            // PDF spec: BI <dict> ID <raw bytes> EI
            if (cmd === 'BI') {
                const imgResult = this._handleInlineImage(args);
                return { ...imgResult, startIndex, endIndex: this.pos };
            }

            return { cmd, args, startIndex, endIndex: this.pos };
        }
        return null;
    }

    // ── Inline Image Parser ───────────────────────────────────────────────────
    // Reference: pdf.js src/core/parser.js readInlineImageData()
    _handleInlineImage(existingArgs) {
        // We're right after 'BI'. Read key/value pairs until 'ID'.
        const params = {};
        while (this.pos < this.stream.length) {
            this.skipWhitespace();
            if (this.pos >= this.stream.length) break;

            const byte = this.stream[this.pos];
            // Check for 'ID' operator
            if (byte === 73 && this.stream[this.pos + 1] === 68) { // 'ID'
                const prevIsWS = this.pos === 0 || this.stream[this.pos - 1] <= 32;
                if (prevIsWS) {
                    this.pos += 2;
                    // skip single whitespace after ID
                    if (this.pos < this.stream.length && this.stream[this.pos] <= 32) this.pos++;
                    break;
                }
            }

            if (byte === 47) { // '/' — key
                const key = this.readName().replace('/', '');
                this.skipWhitespace();
                // Read value: could be name, number, or array
                const vbyte = this.stream[this.pos];
                let val;
                if (vbyte === 47) val = this.readName();
                else if (vbyte === 91) val = this.readArray();
                else if ((vbyte >= 48 && vbyte <= 57) || vbyte === 45) val = this.readNumber();
                else val = this.readOperator(); // e.g. 'true' / 'false'
                params[key] = val;
            } else {
                this.pos++;
            }
        }

        // Now consume raw image bytes until 'EI'
        const imgStart = this.pos;
        let imgEnd = this.pos;
        while (this.pos < this.stream.length - 2) {
            // Look for whitespace + EI (pdf spec: EI must follow whitespace)
            if (this.stream[this.pos] <= 32 &&
                this.stream[this.pos + 1] === 69 &&  // 'E'
                this.stream[this.pos + 2] === 73) {  // 'I'
                imgEnd = this.pos;
                this.pos += 3;
                break;
            }
            this.pos++;
        }

        const imgBytes = this.stream.slice(imgStart, imgEnd);

        return {
            cmd: 'BI',
            args: [params, imgBytes]
        };
    }

    // ── Skip whitespace and comments ─────────────────────────────────────────
    skipWhitespace() {
        while (this.pos < this.stream.length) {
            const byte = this.stream[this.pos];
            if (byte === 0 || byte === 9 || byte === 10 || byte === 12 || byte === 13 || byte === 32) {
                this.pos++;
            } else if (byte === 37) { // '%' PDF comment — skip to end of line
                while (this.pos < this.stream.length &&
                       this.stream[this.pos] !== 10 && this.stream[this.pos] !== 13) {
                    this.pos++;
                }
            } else break;
        }
    }

    readNumber() {
        let str = '';
        const start = this.pos;
        // Leading sign
        if (this.stream[this.pos] === 43 || this.stream[this.pos] === 45) {
            str += String.fromCharCode(this.stream[this.pos++]);
        }
        let hasDot = false;
        while (this.pos < this.stream.length) {
            const byte = this.stream[this.pos];
            if (byte >= 48 && byte <= 57) { str += String.fromCharCode(byte); this.pos++; }
            else if (byte === 46 && !hasDot) { str += '.'; hasDot = true; this.pos++; }
            else if ((byte === 101 || byte === 69) && str.length > 0) { // scientific notation
                str += 'e'; this.pos++;
                if (this.stream[this.pos] === 43 || this.stream[this.pos] === 45)
                    str += String.fromCharCode(this.stream[this.pos++]);
            } else break;
        }
        return parseFloat(str) || 0;
    }

    readString() {
        this.pos++; // Skip '('
        const bytes = [];
        let depth = 1;

        while (this.pos < this.stream.length && depth > 0) {
            const byte = this.stream[this.pos];

            if (byte === 92) { // '\' (escape)
                this.pos++;
                const nextByte = this.stream[this.pos];
                if (nextByte === 110) bytes.push(10);      // \n
                else if (nextByte === 114) bytes.push(13); // \r
                else if (nextByte === 116) bytes.push(9);  // \t
                else if (nextByte === 98) bytes.push(8);   // \b
                else if (nextByte === 102) bytes.push(12); // \f
                else if (nextByte === 40 || nextByte === 41 || nextByte === 92) bytes.push(nextByte);
                else if (nextByte >= 48 && nextByte <= 55) {
                    // Octal escape \ddd
                    let octalStr = String.fromCharCode(nextByte);
                    this.pos++;
                    for (let n = 0; n < 2; n++) {
                        const b = this.stream[this.pos];
                        if (b >= 48 && b <= 55) { octalStr += String.fromCharCode(b); this.pos++; }
                        else break;
                    }
                    bytes.push(parseInt(octalStr, 8));
                    continue;
                } else if (nextByte === 13) {
                    // \CR or \CR\LF — line continuation
                    this.pos++;
                    if (this.stream[this.pos] === 10) this.pos++;
                    continue;
                } else if (nextByte === 10) {
                    this.pos++; continue; // \LF line continuation
                } else {
                    bytes.push(nextByte);
                }
            } else if (byte === 40) { // '(' nested paren
                depth++;
                bytes.push(40);
            } else if (byte === 41) { // ')'
                depth--;
                if (depth > 0) bytes.push(41);
            } else {
                bytes.push(byte);
            }
            this.pos++;
        }
        return bytes.map(b => String.fromCharCode(b)).join('');
    }

    readHexString() {
        this.pos++; // Skip '<'
        let hexStr = '';
        while (this.pos < this.stream.length) {
            const byte = this.stream[this.pos];
            if (byte === 62) { this.pos++; break; } // '>'
            const ch = String.fromCharCode(byte).toLowerCase();
            if ((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f')) hexStr += ch;
            this.pos++;
        }
        if (hexStr.length % 2 !== 0) hexStr += '0';
        let res = '';
        for (let i = 0; i < hexStr.length; i += 2)
            res += String.fromCharCode(parseInt(hexStr.substr(i, 2), 16));
        return res;
    }

    readName() {
        this.pos++; // Skip '/'
        let name = '/';
        while (this.pos < this.stream.length) {
            const byte = this.stream[this.pos];
            // Stop at whitespace, delimiters
            if (byte <= 32 || byte === 47 || byte === 60 || byte === 62 ||
                byte === 91 || byte === 93 || byte === 40 || byte === 41) break;
            // Handle #xx hex escape in names
            if (byte === 35) { // '#'
                this.pos++;
                const h1 = String.fromCharCode(this.stream[this.pos++] || 48);
                const h2 = String.fromCharCode(this.stream[this.pos] || 48);
                name += String.fromCharCode(parseInt(h1 + h2, 16));
            } else {
                name += String.fromCharCode(byte);
            }
            this.pos++;
        }
        return name;
    }

    readArray() {
        this.pos++; // Skip '['
        const elements = [];
        while (this.pos < this.stream.length) {
            this.skipWhitespace();
            const byte = this.stream[this.pos];
            if (byte === 93) { this.pos++; break; } // ']'
            if (byte === 40) elements.push(this.readString());
            else if (byte === 60 && this.stream[this.pos + 1] !== 60) elements.push(this.readHexString());
            else if (byte === 47) elements.push(this.readName());
            else if (byte === 91) elements.push(this.readArray());
            else if (byte === 43 || byte === 45 || byte === 46 || (byte >= 48 && byte <= 57))
                elements.push(this.readNumber());
            else { this.pos++; } // skip unknown
        }
        return elements;
    }

    readDictionary() {
        // Skip '<<'
        this.pos += 2;
        const dict = {};
        while (this.pos < this.stream.length) {
            this.skipWhitespace();
            const byte = this.stream[this.pos];
            if (byte === 62 && this.stream[this.pos + 1] === 62) { this.pos += 2; break; } // '>>'
            if (byte === 47) {
                const key = this.readName().slice(1);
                this.skipWhitespace();
                const vb = this.stream[this.pos];
                let val;
                if (vb === 47) val = this.readName();
                else if (vb === 40) val = this.readString();
                else if (vb === 60 && this.stream[this.pos+1] !== 60) val = this.readHexString();
                else if (vb === 91) val = this.readArray();
                else if (vb === 60 && this.stream[this.pos+1] === 60) val = this.readDictionary();
                else if (vb === 43 || vb === 45 || vb === 46 || (vb >= 48 && vb <= 57)) val = this.readNumber();
                else { val = this.readOperator(); }
                dict[key] = val;
            } else { this.pos++; }
        }
        return dict;
    }

    readOperator() {
        let cmd = '';
        while (this.pos < this.stream.length) {
            const byte = this.stream[this.pos];
            // Valid operator chars: letters, *, ', "
            if ((byte >= 97 && byte <= 122) || (byte >= 65 && byte <= 90) ||
                byte === 42 || byte === 39 || byte === 34) {
                cmd += String.fromCharCode(byte);
                this.pos++;
            } else break;
        }
        return cmd || null;
    }
}
