# PDF Engine Implementation Roadmap

To transform the current file structure into a fully functional "Final Product", we need to implement the actual logic within the modules. We will follow this phased approach:

## Phase 1: The Core Reader (Critical Path)
**Goal:** Open a PDF file, parse its structure, and retrieve the Page objects.
- [ ] **ByteReader**: Ensure robust binary reading (already mostly done).
- [ ] **XRef Parser**: Implement full logic to parse Cross-Reference tables and streams.
- [ ] **Object Resolver**: Logic to fetch objects by ID from the file.
- [ ] **Page Tree**: Logic to traverse the `/Pages` tree and collect all `Page` objects.
- [ ] **Stream Decoders**: Implement `FlateDecode` (Zlib) and `ASCII85` logic.

## Phase 2: The Content Interpreter
**Goal:** Read the drawing commands from a Page.
- [ ] **Content Tokenizer**: Parse the stream of operators (`BT`, `ET`, `m`, `l`, `re`).
- [ ] **Operator Dispatch**: Map operators to function calls.
- [ ] **Graphics State**: Track current color, line width, transform matrix.

## Phase 3: The Basic Renderer
**Goal:** Draw simple shapes and text to an HTML Canvas.
- [ ] **CanvasBackend**: Map internal drawing commands to `ctx.moveTo`, `ctx.lineTo`, etc.
- [ ] **Text State**: Handle text positioning matrices (`Tm`).
- [ ] **Basic Fonts**: Support standard 14 PDF fonts (Helvetica, Times, etc.).

## Phase 4: Advanced Resources
**Goal:** Support custom fonts and images.
- [ ] **TrueType Parser**: Parse `.ttf` font files embedded in the PDF.
- [ ] **Image Decoders**: Implement JPEG and PNG handling from binary streams.
- [ ] **Color Spaces**: Convert CMYK/Gray to RGB for the screen.

## Phase 5: Interactive & Polish
**Goal:** Links, Forms, and UI.
- [ ] **Annotations**: Render links and highlights.
- [ ] **Forms**: Render input fields.
- [ ] **UI**: Build the thumbnail view and page controls.

---

## Current Status
We have the **Skeleton** (Files & Classes) for all phases.
We need to write the **Muscles** (Logic & Algorithms) for Phase 1.
