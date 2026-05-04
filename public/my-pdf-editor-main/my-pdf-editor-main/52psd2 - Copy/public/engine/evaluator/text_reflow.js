/**
 * TextReflow — Phase 5 / Canva-Level Milestone
 * Recalculates the geometry and PDF text matrices (Tm) for edited paragraphs.
 * Essential for making text "wrap" and "overflow" correctly during live editing.
 */
export class TextReflow {
    /**
     * Recalculates coordinates for a block of text within a specific width.
     * @param {string} text 
     * @param {number} width 
     * @param {number} fontSize 
     * @param {string} fontFamily 
     * @returns {Array} List of lines with their individual item offsets.
     */
    static reflow(text, width, fontSize, fontFamily) {
        // Simple heuristic reflow (Monospace or estimated widths)
        const charWidth = fontSize * 0.6; // average proportion
        const charsPerLine = Math.floor(width / charWidth) || 1;

        const lines = [];
        const words = text.split(/\s+/);
        let currentLine = [];
        let currentLen = 0;

        for (const word of words) {
            if (currentLen + word.length + 1 > charsPerLine && currentLine.length > 0) {
                lines.push(currentLine.join(' '));
                currentLine = [word];
                currentLen = word.length;
            } else {
                currentLine.push(word);
                currentLen += word.length + 1;
            }
        }
        if (currentLine.length > 0) lines.push(currentLine.join(' '));

        return lines.map((line, idx) => ({
            text: line,
            yOffset: idx * (fontSize * 1.2), // Standard 1.2 leading
        }));
    }
}
