/**
 * Advanced Layout Engine
 * Phase 1 Implementation for Professional PDF Parsing
 * 
 * Replaces the heuristic 'TextBundler' with deterministic typography math.
 * 
 * Key Pillars:
 * 1. Glyph Run Detection (Never merge distinct fonts/styles)
 * 2. Baseline Clustering (Exact geometric Y-axis matching)
 * 3. Exact Word Boundary metrics (Derived from ToUnicode + Widths array)
 */

export class LayoutEngine {
    constructor() {
        this.glyphRuns = []; // Segmented by identical font + size + styling
    }

    /**
     * Ingest a raw stream of absolutely-positioned character items from evaluator.js
     * @param {Array<{text, x, y, fontSize, fontFamily, scaleX, scaleY, width}>} items 
     */
    processTextItems(items) {
        if (!items || items.length === 0) return [];

        // 1. Group into isolated Glyph Runs
        this.glyphRuns = this._segmentIntoGlyphRuns(items);

        // 2. Cluster each Run into Baselines (Lines)
        const lines = [];
        for (const run of this.glyphRuns) {
            lines.push(...this._clusterBaselines(run));
        }

        // 3. Detect Words within each Line using exact font width metrics
        const words = [];
        for (const line of lines) {
            words.push(...this._detectWordBoundaries(line));
        }

        // 4. Construct Bounding Boxes
        return this._computeBoundingBoxes(words);
    }

    /**
     * Segment characters strictly where rendering rules change.
     * Prevents editing corruption when a user tries to edit mixed fonts.
     */
    _segmentIntoGlyphRuns(items) {
        const runs = [];
        let currentRun = [];
        let currentKey = null;

        for (const item of items) {
            // A Run key is identical font family + font size (rounded to 1 decimal config)
            const key = `${item.fontFamily}_${Math.round(item.fontSize * 10)}`;

            if (key !== currentKey) {
                if (currentRun.length > 0) {
                    runs.push(currentRun);
                }
                currentRun = [item];
                currentKey = key;
            } else {
                currentRun.push(item);
            }
        }
        if (currentRun.length > 0) runs.push(currentRun);
        return runs;
    }

    /**
     * Group items that share the EXACT same geometric baseline (Y coordinate).
     * We allow a tiny floating point epsilon (0.01) rather than a heuristic gap.
     */
    _clusterBaselines(runItems) {
        // Sort geometrically top-to-bottom, left-to-right
        // PDF Y-axis is bottom-to-top, so TOP of the page has the HIGHEST Y.
        runItems.sort((a, b) => {
            if (Math.abs(a.y - b.y) > 0.1) return b.y - a.y; // Higher Y (Top) first
            return a.x - b.x; // Left to right
        });

        const lines = [];
        let currentLine = [];
        let currentY = null;

        for (const item of runItems) {
            if (currentY === null || Math.abs(item.y - currentY) > 0.1) {
                if (currentLine.length > 0) lines.push(currentLine);
                currentLine = [item];
                currentY = item.y;
            } else {
                currentLine.push(item);
            }
        }
        if (currentLine.length > 0) lines.push(currentLine);
        return lines;
    }

    /**
     * Phase 5.2: True Word Boundary Detection
     * Split continuous character arrays into separate word blocks based strictly on
     * the PDF `kerningArray` (TJ operator array) rather than arbitrary proximity gaps.
     */
    _detectWordBoundaries(lineItems) {
        const words = [];
        let currentWord = [];

        // Determine the width of a typical space character for this run
        const spaceAdvance = lineItems[0].fontSize * 0.25;

        for (let i = 0; i < lineItems.length; i++) {
            const item = lineItems[i];

            if (currentWord.length === 0) {
                if (item.text !== ' ') currentWord.push(item);
                continue;
            }

            const prevItem = currentWord[currentWord.length - 1];
            let isWordBoundary = false;

            // Phase 5.2: Literal Kerning Array tracking
            // If the PDF explicitly defines a massive horizontal shift (e.g. -250 units) between 
            // these two characters in the TJ array, that defines an intentional word space.
            if (item.kerningArray && item.kerningArray.length > 0) {
                // We find where this item's text appears in the array and look at the preceding number
                const charIdx = item.kerningArray.indexOf(item.text);
                if (charIdx > 0 && typeof item.kerningArray[charIdx - 1] === 'number') {
                    const kernValue = Math.abs(item.kerningArray[charIdx - 1]);
                    // PDFs use negative kerning for positive space advances typically
                    if (kernValue > 200) { 
                        isWordBoundary = true;
                    }
                }
            }

            // Fallback to geometric gap tracking if no kerning explicitly defined (e.g. 'Tj' string operator)
            const expectedEnd = prevItem.x + prevItem.width;
            const gap = item.x - expectedEnd;

            if (isWordBoundary || gap > spaceAdvance * 0.8 || item.text === ' ') {
                words.push(currentWord);
                if (item.text !== ' ') {
                    currentWord = [item];
                } else {
                    currentWord = []; // Explicit space char is collapsed into block margins
                }
            } else {
                currentWord.push(item);
            }
        }
        
        if (currentWord.length > 0) words.push(currentWord);
        return words;
    }

    /**
     * Calculate structural bounding boxes around the exact word objects
     * Merge words on the same line into a single cohesive editable block.
     */
    _computeBoundingBoxes(words) {
        if (words.length === 0) return [];

        const lines = []; // Re-cluster words back into sentence lines
        let currentLine = [];
        let currentY = words[0][0].y;

        // Group words by their explicit baseline
        for (const wordTokens of words) {
            if (wordTokens.length === 0) continue;

            const firstY = wordTokens[0].y;
            if (Math.abs(firstY - currentY) > 0.1) {
                if (currentLine.length > 0) lines.push(currentLine);
                currentLine = [wordTokens];
                currentY = firstY;
            } else {
                currentLine.push(wordTokens);
            }
        }
        if (currentLine.length > 0) lines.push(currentLine);

        const blocks = [];

        // Build one block per line
        for (const lineWords of lines) {
            const allTokens = [];
            let fullText = '';

            const firstToken = lineWords[0][0];
            const x = firstToken.x;

            // PDF space: Baseline + Ascent = Top edge.
            // So Top Edge Y coordinate is HIGHER than baseline.
            const ascentRatio = (firstToken.ascent || 800) / 1000;
            const descentRatio = Math.abs(firstToken.descent || -200) / 1000;

            const boxHeight = firstToken.fontSize * (ascentRatio + descentRatio);
            const boxTopY = firstToken.y + (firstToken.fontSize * ascentRatio);

            for (let i = 0; i < lineWords.length; i++) {
                const wordTokens = lineWords[i];
                allTokens.push(...wordTokens);

                for (const t of wordTokens) fullText += t.text;

                // Add a structural space if there's another word coming
                if (i < lineWords.length - 1) {
                    fullText += ' ';
                    // We generate a synthetic space token for the cursor index
                    allTokens.push({
                        text: ' ',
                        x: wordTokens[wordTokens.length - 1].x + wordTokens[wordTokens.length - 1].width,
                        y: firstToken.y,
                        fontSize: firstToken.fontSize,
                        fontFamily: firstToken.fontFamily,
                        scaleX: firstToken.scaleX,
                        scaleY: firstToken.scaleY,
                        width: firstToken.fontSize * 0.25, // Standard space advance
                        ascent: firstToken.ascent,
                        descent: firstToken.descent,
                        capHeight: firstToken.capHeight
                    });
                }
            }

            const lastToken = allTokens[allTokens.length - 1];
            const totalWidth = (lastToken.x + lastToken.width) - x;

            blocks.push({
                text: fullText,
                x: x,
                y: firstToken.y - (firstToken.fontSize * descentRatio), // Bottom-Left Corner
                width: totalWidth,
                height: boxHeight,
                fontSize: firstToken.fontSize,
                fontFamily: firstToken.fontFamily,
                scaleX: firstToken.scaleX,
                scaleY: firstToken.scaleY,
                tokens: allTokens
            });
        }
        return blocks;
    }
}
