/**
 * TOOL_REGISTRY
 * Map of tool IDs to their implementation modules.
 * This allows the app to dynamically load tools as needed.
 */
export const TOOL_REGISTRY = {
    'decrypt': true, // Native
    'encrypt': true, // Native
    'merge': true,   // Native
    'split': true,   // Native
    'rotate-pdf': true,
    'watermark': true,
    'delete-pages': true,
    'extract-pages': true,
    'reorder-pdf': true,
    'flatten-pdf': true,
    'image-to-pdf': true,
    'md-to-pdf': true,
    'txt-to-pdf': true
};

/**
 * loadTool
 * Dynamically imports the requested tool module.
 */
export async function loadTool(toolId) {
    // For native tools, we don't need to load a separate module as they are in UniversalMutator
    const nativeTools = ['delete-pages', 'extract-pages', 'split', 'watermark', 'rotate-pdf', 'flatten-pdf', 'encrypt', 'decrypt', 'merge', 'reorder-pdf'];
    if (nativeTools.includes(toolId)) {
        return { isNative: true };
    }

    switch (toolId) {
        case 'image-to-pdf':
            return import('./image_to_pdf.js');
        case 'md-to-pdf':
            return import('./md_to_pdf.js');
        case 'txt-to-pdf':
            return import('./txt_to_pdf.js');
        default:
            return null;
    }
}
