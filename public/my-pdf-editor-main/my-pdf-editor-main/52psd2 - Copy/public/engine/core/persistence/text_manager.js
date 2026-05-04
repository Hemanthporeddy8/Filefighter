/**
 * TextManager — Module 4 (Persistence)
 * Tracks user edits to Semantic Paragraphs.
 * When a user modifies a contenteditable block, this manager stores
 * the delta (new text, original bounding box, page index).
 */
export class TextManager {
    constructor() {
        // Map of pageIndex -> Array of { originalText, newText, x, y, fontSize, fontFamily, w, h }
        this.edits = {};
    }

    /**
     * Records a text modification.
     */
    recordEdit(pageIndex, paragraphData, newText) {
        if (!this.edits[pageIndex]) {
            this.edits[pageIndex] = [];
        }

        // Check if we are updating an existing edit block
        const existing = this.edits[pageIndex].find(e =>
            e.x === paragraphData.x && e.y === paragraphData.y
        );

        if (existing) {
            existing.newText = newText;
        } else {
            this.edits[pageIndex].push({
                ...paragraphData,
                newText
            });
        }
        console.log(`[TextManager] Recorded edit on page ${pageIndex}:`, newText);
    }

    getEditsForPage(pageIndex) {
        return this.edits[pageIndex] || [];
    }

    getAllEdits() {
        return this.edits;
    }

    hasEdits() {
        return Object.keys(this.edits).length > 0;
    }

    clear() {
        this.edits = {};
    }
}

export const textManager = new TextManager();
