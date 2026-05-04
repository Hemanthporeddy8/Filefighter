/**
 * @module PDFWorker
 * @description The dedicated background thread for the God Engine.
 * Follows the pdf.js multi-threaded architecture. Parses 200MB streams without
 * freezing the main HTML layout UI.
 */
import { OperatorEvaluator } from '../evaluator/evaluator.js';

self.onmessage = async function (e) {
    const data = e.data;
    // FIX: renamed contentsData → streamData in renderPage(); support both for compat
    const { type, streamData, contentsData, pageIndex, fontMap, imageMap, rotate, mediaBox } = data;
    const streamBytes = streamData || contentsData;

    if (type === 'parsePage') {
        try {
            const evaluator = new OperatorEvaluator(fontMap, imageMap);
            const { operatorList, textItems } = await evaluator.getOperatorList(streamBytes);
            console.log(`[Worker] Page ${pageIndex} parsed. Ops: ${operatorList.length}, TextItems: ${textItems.length}`);

            // Echo mediaBox and rotate back — canvas backend needs them to size/rotate canvas
            self.postMessage({
                type: 'pageParsed',
                pageIndex,
                operatorList,
                textItems,
                imageMap,
                mediaBox: mediaBox || [0, 0, 595, 842],
                rotate: rotate || 0
            });
        } catch (err) {
            console.error("FATAL INTERNAL WORKER VM CRASH:", err);
            self.postMessage({
                type: 'pageError',
                pageIndex,
                error: err.toString(),
                stack: err.stack
            });
        }
    }
};
