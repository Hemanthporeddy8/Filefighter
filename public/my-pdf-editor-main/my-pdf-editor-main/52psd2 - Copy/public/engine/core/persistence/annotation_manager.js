/**
 * AnnotationManager — Module 4 (Persistence)
 * Tracks all user-added annotations (highlights, notes) in memory
 * for eventual binary injection into the PDF stream.
 */
export class AnnotationManager {
    constructor() {
        this.annotations = []; // Array of { pageIndex, type: 'Highlight', rects: [{x, y, w, h}] }
    }

    /**
     * Records a new highlight annotation.
     * @param {number} pageIndex 
     * @param {Array} rects - Array of bounding rects in Page Coordinates (0..1) or pixels
     */
    addHighlight(pageIndex, rects) {
        this.annotations.push({
            pageIndex,
            type: 'Highlight',
            rects,
            timestamp: Date.now()
        });
        console.log(`[AnnotationManager] Recorded highlight on page ${pageIndex}`, rects);
    }

    getAnnotationsForPage(pageIndex) {
        return this.annotations.filter(ann => ann.pageIndex === pageIndex);
    }

    getAllAnnotations() {
        return this.annotations;
    }

    clear() {
        this.annotations = [];
    }
}

export const annotationManager = new AnnotationManager();
