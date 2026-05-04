/**
 * IncrementalWriter — Module 4 (Tools)
 * Implements the PDF 1.4 Incremental Update specification.
 * This allows adding objects to a PDF without rewriting the whole file.
 */
export class IncrementalWriter {
    /**
     * @param {Uint8Array} originalBytes 
     * @param {number} lastXRefPos - Byte offset of the last XRef table
     */
    constructor(originalBytes, lastXRefPos) {
        this.originalBytes = originalBytes;
        this.lastXRefPos = lastXRefPos;
        this.newObjects = []; // Array of { id, gen, bytes }
    }

    /**
     * Adds a new or modified object to the update list.
     * @param {number} id 
     * @param {number} gen 
     * @param {string|Uint8Array} content 
     */
    addObject(id, gen, content) {
        const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        this.newObjects.push({ id, gen, bytes });
    }

    /**
     * Generates the final updated PDF buffer.
     */
    generate() {
        const chunks = [this.originalBytes];
        let currentOffset = this.originalBytes.length;
        const xrefEntries = {}; // id -> offset

        // 1. Write new objects
        for (const obj of this.newObjects) {
            const header = new TextEncoder().encode(`\n${obj.id} ${obj.gen} obj\n`);
            const footer = new TextEncoder().encode(`\nendobj\n`);

            xrefEntries[obj.id] = currentOffset + 1; // +1 to skip leading \n

            chunks.push(header);
            chunks.push(obj.bytes);
            chunks.push(footer);

            currentOffset += header.length + obj.bytes.length + footer.length;
        }

        const startXRef = currentOffset;

        // 2. Write new XRef table (Simplified for one section)
        // Note: Production-grade requires multiple subsections if IDs are sparse.
        const sortedIds = Object.keys(xrefEntries).sort((a, b) => a - b);
        if (sortedIds.length > 0) {
            const firstId = sortedIds[0];
            const count = parseInt(sortedIds[sortedIds.length - 1]) - parseInt(firstId) + 1;

            let xrefStr = `xref\n${firstId} ${count}\n`;
            for (let i = parseInt(firstId); i < parseInt(firstId) + count; i++) {
                if (xrefEntries[i]) {
                    xrefStr += `${String(xrefEntries[i]).padStart(10, '0')} ${String(this.newObjects.find(o => o.id == i).gen).padStart(5, '0')} n \n`;
                } else {
                    xrefStr += `0000000000 65535 f \n`; // Free entry placeholder
                }
            }
            chunks.push(new TextEncoder().encode(xrefStr));
            currentOffset += xrefStr.length;
        }

        // 3. Write Trailer
        const trailer = `trailer\n<< /Size ${this.lastXRefPos + this.newObjects.length + 1} /Prev ${this.lastXRefPos} >>\nstartxref\n${startXRef}\n%%EOF\n`;
        chunks.push(new TextEncoder().encode(trailer));

        // Flatten to single Uint8Array
        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const finalBuffer = new Uint8Array(totalLen);
        let ptr = 0;
        for (const chunk of chunks) {
            finalBuffer.set(chunk, ptr);
            ptr += chunk.length;
        }

        return finalBuffer;
    }
}
