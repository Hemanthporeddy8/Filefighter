# Custom PDF Engine & Editor (From Scratch)

## 🚀 Project Overview
This project is a **pure JavaScript PDF engine built from scratch**, designed to parse, render, edit, and save PDF documents directly in the browser. Unlike wrappers around existing libraries (like pdf.js), this engine implements the **PDF ISO 32000-1 specification** manually, providing full control over the document structure and rendering pipeline.

---

## ✅ Completed Features (MVP)

### 1. Core PDF Parsing (The "Brain")
*   **Raw Byte Parsing:** Reads binary PDF files directly using a custom `ByteReader`.
*   **Tokenization:** A custom `TokenScanner` breaks down the raw stream into PDF tokens (Keywords, Names, Strings, Numbers, Arrays, Dictionaries).
*   **Structure Analysis:**
    *   Parses the **Cross-Reference (XRef) Table** to locate objects.
    *   Reconstructs the **Page Tree** hierarchy.
    *   Resolves **Indirect References** (`10 0 R`) to actual objects.

### 2. Rendering Engine (The "Eyes")
*   **Content Stream Interpreter:** Reads page content streams and executes PDF operators (e.g., `BT`, `Tm`, `Tj`, `Do`).
*   **Canvas Backend:** Maps PDF vector commands to HTML5 Canvas API.
    *   **Text:** Basic text positioning and rendering.
    *   **Graphics:** Paths, strokes, fills, and colors (RGB).
    *   **Images:** Renders JPEG and raw image XObjects.
*   **Coordinate System:** Handles PDF-to-Canvas coordinate transformation (PDF origin is bottom-left, Canvas is top-left).

### 3. Editing Capabilities (The "Hands")
*   **Non-Destructive Editing:** Modifications are stored as a "delta" layer on top of the original document.
*   **Features:**
    *   **Add Text:** Insert new text with custom fonts, sizes, and colors.
    *   **Add Images:** Insert JPEG/PNG images with scaling and positioning.
    *   **Drawing:** Add vector shapes (rectangles, circles) and freehand ink.
    *   **Page Management:** Reorder and delete pages.

### 4. PDF Writing & Saving
*   **Incremental Updates:** Instead of rewriting the whole file, we append changes to the end of the file (standard PDF versioning).
*   **Stream Patching:** Injects new content commands into existing page streams.
*   **Structure Rebuilding:** Automatically updates the `Pages` tree and `Catalog` to reflect page additions/deletions.

---

## 🛠️ Technical Implementation Details

### How It Works
1.  **Loading:**
    *   The `PDFParser` scans the file tail to find the `startxref`.
    *   It parses the XRef table to build a map of Object IDs to file offsets.
2.  **Rendering:**
    *   `PDFPage` retrieves the `Contents` stream.
    *   `PageInterpreter` iterates through operators.
    *   `CanvasBackend` executes the corresponding drawing commands.
3.  **Editing:**
    *   User actions (e.g., adding an image) create a **Modification Object** in `EditorState`.
    *   These mods are rendered instantly on an HTML overlay (`annotation-layer`) for feedback.
4.  **Saving:**
    *   `PDFWriter` collects all modified objects.
    *   It generates a new **XRef Section** pointing to the new/modified objects.
    *   It appends the new body, XRef, and Trailer to the original file buffer.

---

## 🗺️ Roadmap to Adobe-Level Engine

To reach enterprise-grade fidelity and capabilities, the following steps are required:

### Phase 1: Robustness & Compatibility (Immediate Next Steps)
- [ ] **Object Streams (ObjStm):** Support compressed objects (common in modern PDFs).
- [ ] **Encryption:** Implement RC4/AES decryption to open password-protected files.
- [ ] **Linearization:** Support "Fast Web View" for streaming large PDFs.
- [ ] **Error Recovery:** Gracefully handle malformed or corrupt PDF structures.

### Phase 2: Advanced Rendering
- [ ] **Complex Fonts:** Support CFF (Compact Font Format), Type 1, and CID-keyed fonts for non-Latin languages.
- [ ] **Color Spaces:** Implement CMYK, Lab, and ICCBased color profiles for print-accurate rendering.
- [ ] **Transparency:** Support PDF transparency groups, soft masks, and blending modes (Multiply, Screen, etc.).
- [ ] **Patterns & Shading:** Render complex gradients and tiling patterns.

### Phase 3: Professional Editing
- [ ] **Content Reflow:** Ability to edit *existing* text paragraphs and automatically reflow the layout.
- [ ] **Font Matching:** Heuristics to identify and match fonts when editing existing text.
- [ ] **Forms:** Full support for AcroForms (Text fields, Checkboxes, Radio buttons).
- [ ] **Annotations:** Standard PDF annotations (Comments, Highlights, Sticky Notes).

### Phase 4: Enterprise Features
- [ ] **Digital Signatures:** Cryptographic signing and verification.
- [ ] **PDF/A & PDF/UA:** Compliance with archival and accessibility standards.
- [ ] **Optimization:** Dead object removal and stream compression.
