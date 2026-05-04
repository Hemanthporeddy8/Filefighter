# Comprehensive QA Testing Guide

This guide details the procedure to verify every feature of the PDF Engine using the `latest` build.

## Prerequisites
1. Open the application in a modern browser.
2. Open `generator.html` in a separate tab to generate test assets.
3. Generate all test files: `multipage_test.pdf`, `large_test.pdf`, `encrypted_1234.pdf`, `high_res_test.jpg`, `transparent.png`, `advanced_test.md`, `advanced_layout.html`.

---

## 1. Core PDF Editor (Viewer & Annotation)
- [ ] **Open PDF**: Load `multipage_test.pdf`.
- [ ] **Navigation**: Use Next/Prev buttons to view all 5 pages.
- [ ] **Zoom**: Zoom In/Out and verify clarity.
- [ ] **Canvas Rendering**: Ensure text "Page 1 of 5" is visible and Helvetica font is correct.

## 2. Organization Tools
### Merge PDF
- [ ] Open **Merge PDF** tool.
- [ ] Upload `multipage_test.pdf` TWICE.
- [ ] Click **Merge**.
- [ ] **Verify**: Result should have 10 pages.

### Split PDF
- [ ] Open **Split PDF** tool.
- [ ] Upload `multipage_test.pdf`.
- [ ] Select Page Range: `2-4`.
- [ ] Click **Split**.
- [ ] **Verify**: Result should contain Page 2, 3, and 4 (3 pages total).

### Rotate PDF
- [ ] Open **Rotate PDF**.
- [ ] Upload `multipage_test.pdf`.
- [ ] Rotate Page 1 by 90 degrees.
- [ ] **Verify**: Preview shows rotation. Save and check result.

## 3. Security Tools
### Encrypt PDF
- [ ] Open **Encrypt PDF**.
- [ ] Upload `multipage_test.pdf`.
- [ ] Set User Password: `test`.
- [ ] Click **Encrypt & Download**.
- [ ] **Verify**: Try to open the result; it should ask for password `test`.

### Unlock PDF (Decryption)
- [ ] Open **Unlock PDF**.
- [ ] Upload `encrypted_1234.pdf` (from Generator).
- [ ] Enter Password: `1234`.
- [ ] Click **Check Password**.
- [ ] **Verify**: Success message appears. Download and open result without password.

## 4. Conversion Tools (To PDF)
### Image to PDF
- [ ] Open **Image to PDF**.
- [ ] Upload `high_res_test.jpg`.
- [ ] **Verify**: Result is a PDF containing the image, scaled to fit page.
- [ ] (Bonus) Test `transparent.png`.

### Markdown to PDF
- [ ] Open **Markdown to PDF**.
- [ ] Upload `advanced_test.md`.
- [ ] **Verify**:
    - Headers are larger/bold.
    - Code block is formatted (monospaced).
    - Table is rendered.

### HTML to PDF
- [ ] Open **HTML to PDF**.
- [ ] Upload `advanced_layout.html`.
- [ ] **Verify**: Tables and Cards are rendered. CSS colors (green/red) are visible.

## 5. Advanced / Analysis
### Compress PDF
- [ ] Open **Compress PDF**.
- [ ] Upload `large_test.pdf`.
- [ ] Set Compression Level to 50%.
- [ ] **Verify**: Output file size is smaller than input.

### Metadata Editor
- [ ] Open **Metadata**.
- [ ] Upload `multipage_test.pdf`.
- [ ] Set Author to "QA Team".
- [ ] Click Update.
- [ ] **Verify**: Open result in a PDF Reader (e.g. Chrome/Edge) and check Properties.

### OCR (Optical Character Recognition)
- [ ] Open **OCR PDF**.
- [ ] Upload `high_res_test.jpg` (or a screenshot with text).
- [ ] **Verify**: Output text file contains extracted text.

---

## 6. Stability Checks
- [ ] **Error Handling**: Upload a `.txt` file to "Merge PDF" and ensure graceful error message.
- [ ] **Performance**: Load `large_test.pdf` in the Viewer. Ensure scrolling is smooth.
