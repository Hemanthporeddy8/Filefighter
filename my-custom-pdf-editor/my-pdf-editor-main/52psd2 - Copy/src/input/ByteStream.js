/**
 * @module ByteStream
 * @description Core module for handling raw binary data reading, seeking, and slicing.
 * Acts as the foundational layer for the PDF engine's file input.
 */

export class ByteStream {
    /**
     * @param {Uint8Array|ArrayBuffer} data - The raw PDF data.
     */
    constructor(data) {
        if (data instanceof ArrayBuffer) {
            this.buffer = new Uint8Array(data);
        } else if (data instanceof Uint8Array) {
            this.buffer = data;
        } else {
            throw new Error("ByteStream requires Uint8Array or ArrayBuffer");
        }

        this.pos = 0;
        this.length = this.buffer.length;
    }

    /**
     * Read a single byte and advance cursor.
     * @returns {number} The byte value (0-255).
     */
    readByte() {
        if (this.pos >= this.length) {
            throw new Error("End of stream reached");
        }
        return this.buffer[this.pos++];
    }

    /**
     * Read n bytes and advance cursor.
     * @param {number} n - Number of bytes to read.
     * @returns {Uint8Array} The read bytes.
     */
    readBytes(n) {
        if (this.pos + n > this.length) {
            throw new Error("End of stream reached");
        }
        const bytes = this.buffer.subarray(this.pos, this.pos + n);
        this.pos += n;
        return bytes;
    }

    /**
     * Peek at the next byte without advancing cursor.
     * @returns {number} The byte value.
     */
    peekByte() {
        if (this.pos >= this.length) {
            throw new Error("End of stream reached");
        }
        return this.buffer[this.pos];
    }

    /**
     * Peek at the next n bytes without advancing cursor.
     * @param {number} n 
     * @returns {Uint8Array}
     */
    peekBytes(n) {
        if (this.pos + n > this.length) {
            throw new Error("End of stream reached");
        }
        return this.buffer.subarray(this.pos, this.pos + n);
    }

    /**
     * Skip n bytes.
     * @param {number} n 
     */
    skip(n) {
        if (this.pos + n > this.length) {
            throw new Error("End of stream reached");
        }
        this.pos += n;
    }

    /**
     * Seek to absolute position.
     * @param {number} p 
     */
    seek(p) {
        if (p < 0 || p > this.length) {
            throw new Error("Invalid seek position");
        }
        this.pos = p;
    }

    /**
     * Get current position.
     * @returns {number}
     */
    getPosition() {
        return this.pos;
    }

    /**
     * Check if end of stream.
     * @returns {boolean}
     */
    isEOF() {
        return this.pos >= this.length;
    }

    /**
     * Create a new ByteStream from a slice of this stream.
     * Does not copy memory, uses subarray.
     * @param {number} start 
     * @param {number} end 
     * @returns {ByteStream}
     */
    slice(start, end) {
        return new ByteStream(this.buffer.subarray(start, end));
    }

    /**
     * Read a string of length n (assumes 8-bit encoding like ASCII/Latin1).
     * @param {number} n 
     * @returns {string}
     */
    readString(n) {
        const bytes = this.readBytes(n);
        let str = "";
        for (let i = 0; i < n; i++) {
            str += String.fromCharCode(bytes[i]);
        }
        return str;
    }
}
