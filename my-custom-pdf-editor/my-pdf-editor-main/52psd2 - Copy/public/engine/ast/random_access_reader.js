/**
 * @module RandomAccessReader
 * @description Reads a File object in asynchronous chunks directly off the disk.
 * Bypasses reading the entire file into RAM, solving the 200MB crash issue.
 */

export class RandomAccessReader {
    constructor(file) {
        this.file = file;
        this.size = file.size || file.byteLength || file.length || 0;
        this.pos = 0;
    }

    /**
     * Instantly reads a chunk directly from the hard drive.
     * @param {number} position 
     * @param {number} length 
     * @returns {Promise<Uint8Array>}
     */
    async read(position, length) {
        if (!this.file || position >= this.size) return new Uint8Array(0);

        const end = Math.min(position + length, this.size);

        // If file is already a Uint8Array/Buffer (Node.js or pre-loaded)
        if (this.file instanceof Uint8Array || ArrayBuffer.isView(this.file)) {
            return this.file.subarray(position, end);
        }

        // Browser File/Blob: use modern arrayBuffer() API (much cleaner than FileReader)
        const slice = this.file.slice(position, end);
        if (typeof slice.arrayBuffer === 'function') {
            const ab = await slice.arrayBuffer();
            return new Uint8Array(ab);
        }

        // Fallback for older browsers: use FileReader
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(new Uint8Array(fr.result));
            fr.onerror = (e) => reject(new Error('FileReader failed: ' + e));
            fr.readAsArrayBuffer(slice);
        });
    }

    /**
     * Helper to read backward from the end of the file.
     * Vital for finding the XREF %%EOF table instantly.
     */
    async readEnd(length) {
        const start = Math.max(0, this.size - length);
        return this.read(start, length);
    }
}
