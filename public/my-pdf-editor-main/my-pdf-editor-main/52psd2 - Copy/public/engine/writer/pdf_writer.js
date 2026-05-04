import { IncrementalWriter } from '../core/writer/incremental_writer.js';
import { textManager } from '../core/persistence/text_manager.js';
import { PDFStream, PDFDict, PDFNumber, PDFRef, PDFArray } from '../ast/pdf_objects.js';

/**
 * PDFWriter — Milestone 3 (Persistence)
 * Serializes InteractiveEditor changes back to the PDF binary.
 * Uses IncrementalWriter to safely append updates.
 */
export class PDFWriter {
    /**
     * @param {PDFDocument} doc - The active PDF AST
     * @param {Object} editorState - (Optional) Current editor state
     */
    constructor(doc, editorState = null) {
        this.doc = doc;
        this.editorState = editorState;
    }

    /**
     * Generates a final PDF Blob containing all edits.
     * @returns {Promise<Blob>}
     */
    async save() {
        console.log('[PDFWriter] Starting binary serialization...');

        // 1. Initialize IncrementalWriter
        const writer = new IncrementalWriter(this.doc.parser.bytes, this.doc.parser.xrefPos);

        // 2. Process Text Edits from textManager
        const allEdits = textManager.getAllEdits();
        let nextObjId = this.doc.getMaxObjectId() + 1;

        for (const pageIndex in allEdits) {
            const idx = parseInt(pageIndex);
            const page = this.doc.pages[idx];
            if (!page) continue;

            const pageEdits = allEdits[pageIndex];

            // Generate new Content Stream data
            // BT = Begin Text, ET = End Text, Tf = Font, Td = Displacement, Tj = Show Text
            let streamData = 'q\n'; // Save graphics state

            pageEdits.forEach(edit => {
                // PDF coordinates are bottom-up, DOM is top-down
                // We need to map edit.y (DOM) back to PDF space
                const mBox = page.dict.get('MediaBox');
                const pageHeight = mBox ? Math.abs(mBox[3] - mBox[1]) : 792;

                // Simple mapping (assumes direct scale for now, scaling logic in PageInterpreter/InteractiveEditor should be consistent)
                // In a perfect system, we'd use the inverse of the viewport transform.
                // For now, we assume the edit.x/y are in PDF points or matched by the editor.
                const pdfX = edit.x;
                const pdfY = pageHeight - edit.y - edit.height;

                streamData += `BT\n`;
                streamData += `/F1 ${edit.fontSize} Tf\n`; // Default fallback font
                streamData += `1 0 0 1 ${pdfX} ${pdfY} Tm\n`; // Identity matrix with translation
                streamData += `(${this._sanitizeText(edit.text)}) Tj\n`;
                streamData += `ET\n`;
            });

            streamData += 'Q\n'; // Restore graphics state

            // 3. Create the PDFStream Object
            const streamId = nextObjId++;
            const streamDict = new PDFDict();
            streamDict.set('Length', new PDFNumber(streamData.length));
            const newStream = new PDFStream(streamDict, new TextEncoder().encode(streamData));

            // Add to writer
            writer.addObject(streamId, 0, newStream.toBytes());

            // 4. Update the Page Object to include this new stream
            // We append the new stream to the existing contents so it renders on top.
            let contents = page.dict.get('Contents');
            const newRef = new PDFRef(streamId, 0);

            if (contents instanceof PDFArray) {
                contents.elements.push(newRef);
            } else if (contents instanceof PDFRef) {
                const newArray = new PDFArray([contents, newRef]);
                page.dict.set('Contents', newArray);
            } else {
                page.dict.set('Contents', newRef);
            }

            // Re-serialize the modified Page object
            const pageId = page.ref.num;
            const pageGen = page.ref.gen;
            writer.addObject(pageId, pageGen, page.dict.toBytes());
        }

        // 5. Generate final binary
        const finalBuffer = writer.generate();
        return new Blob([finalBuffer], { type: 'application/pdf' });
    }

    /**
     * Escapes special characters for PDF strings.
     */
    _sanitizeText(text) {
        return text.replace(/\\/g, '\\\\')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)');
    }
}
