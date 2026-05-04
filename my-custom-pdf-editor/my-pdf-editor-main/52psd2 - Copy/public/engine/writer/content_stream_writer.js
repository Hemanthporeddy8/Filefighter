/**
 * @module ContentStreamWriter
 * @description Phase 4: Rebuilds PDF content streams (BT/ET) from the DOM Editor's Document Object Model.
 * This takes individual `tokens` with precise metrics and compiles them into a pure vector PDF stream byte array.
 */
export class ContentStreamWriter {
    constructor() {
        this.encoder = new TextEncoder();
    }

    /**
     * Reconstructs the entire text content stream for a page.
     * @param {Array} blocks - Array of text blocks from `interactive_editor.js` containing `tokens`.
     * @param {Object} fontMap - Mapping of CSS font families to PDF internal Font IDs (e.g. 'sans-serif' -> '/F1').
     */
    generateStream(blocks, fontMap = {}) {
        let stream = '';

        // Ensure standard graphics state and origin are preserved if needed, though typically text blocks
        // operate in isolation inside their own BT/ET blocks.

        for (const block of blocks) {
            if (!block.tokens || block.tokens.length === 0) continue;

            stream += 'BT\n';

            let currentFont = null;
            let currentSize = null;
            let currentTc = 0;
            let currentTz = 100;

            for (let i = 0; i < block.tokens.length; i++) {
                const token = block.tokens[i];

                // Map font
                const pdfFont = fontMap[token.fontFamily] || '/F1';
                if (pdfFont !== currentFont || token.fontSize !== currentSize) {
                    stream += `${pdfFont} ${token.fontSize.toFixed(2)} Tf\n`;
                    currentFont = pdfFont;
                    currentSize = token.fontSize;
                }

                // Handle Character Spacing (Tc)
                const tc = token.charSpacing || 0;
                if (tc !== currentTc) {
                    stream += `${tc.toFixed(2)} Tc\n`;
                    currentTc = tc;
                }

                // Handle Horizontal Scaling (Tz)
                const tz = (token.scaleX || 1) * 100;
                if (Math.abs(tz - currentTz) > 0.01) {
                    stream += `${tz.toFixed(2)} Tz\n`;
                    currentTz = tz;
                }

                // Position and Draw
                stream += `1 0 0 1 ${token.x.toFixed(2)} ${token.y.toFixed(2)} Tm\n`;
                const escapedText = token.text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
                stream += `(${escapedText}) Tj\n`;
            }

            stream += 'ET\n';
        }

        return this.encoder.encode(stream);
    }
}
