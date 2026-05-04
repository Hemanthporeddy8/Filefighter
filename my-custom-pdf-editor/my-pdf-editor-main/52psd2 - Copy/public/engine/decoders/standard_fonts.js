/**
 * @module StandardFonts
 * @description Exact character advance widths for the 14 Standard PDF Fonts.
 * Without this, ANY text using Helvetica, Times, Courier etc. has wrong spacing.
 * Reference: pdf.js src/core/metrics.js + Adobe Font Metrics files (AFM)
 */

// ── Standard 14 Font Metrics (Character widths in 1/1000 em) ─────────────────
// Sourced from Adobe AFM files. Each entry is: charCode → width
// Missing codes fall back to defaultWidth

const Helvetica = {
    defaultWidth: 278,
    widths: {
        32:278,33:278,34:355,35:556,36:556,37:889,38:667,39:191,40:333,41:333,
        42:389,43:584,44:278,45:333,46:278,47:278,48:556,49:556,50:556,51:556,
        52:556,53:556,54:556,55:556,56:556,57:556,58:278,59:278,60:584,61:584,
        62:584,63:556,64:1015,65:667,66:667,67:722,68:722,69:667,70:611,71:778,
        72:722,73:278,74:500,75:667,76:556,77:833,78:722,79:778,80:667,81:778,
        82:722,83:667,84:611,85:722,86:667,87:944,88:667,89:667,90:611,91:278,
        92:278,93:278,94:469,95:556,96:333,97:556,98:556,99:500,100:556,101:556,
        102:278,103:556,104:556,105:222,106:222,107:500,108:222,109:833,110:556,
        111:556,112:556,113:556,114:333,115:500,116:278,117:556,118:500,119:722,
        120:500,121:500,122:500,123:334,124:260,125:334,126:584
    }
};

const HelveticaBold = {
    defaultWidth: 278,
    widths: {
        32:278,33:333,34:474,35:556,36:556,37:889,38:722,39:238,40:333,41:333,
        42:389,43:584,44:278,45:333,46:278,47:278,48:556,49:556,50:556,51:556,
        52:556,53:556,54:556,55:556,56:556,57:556,58:333,59:333,60:584,61:584,
        62:584,63:611,64:975,65:722,66:722,67:722,68:722,69:667,70:611,71:778,
        72:722,73:278,74:556,75:722,76:611,77:833,78:722,79:778,80:667,81:778,
        82:722,83:667,84:611,85:722,86:667,87:944,88:667,89:667,90:611,91:333,
        92:278,93:333,94:584,95:556,96:333,97:556,98:611,99:556,100:611,101:556,
        102:333,103:611,104:611,105:278,106:278,107:556,108:278,109:889,110:611,
        111:611,112:611,113:611,114:389,115:556,116:333,117:611,118:556,119:778,
        120:556,121:556,122:500,123:389,124:280,125:389,126:584
    }
};

const Times = {
    defaultWidth: 250,
    widths: {
        32:250,33:333,34:408,35:500,36:500,37:833,38:778,39:180,40:333,41:333,
        42:500,43:564,44:250,45:333,46:250,47:278,48:500,49:500,50:500,51:500,
        52:500,53:500,54:500,55:500,56:500,57:500,58:278,59:278,60:564,61:564,
        62:564,63:444,64:921,65:722,66:667,67:667,68:722,69:611,70:556,71:722,
        72:722,73:333,74:389,75:722,76:611,77:889,78:722,79:722,80:556,81:722,
        82:667,83:556,84:611,85:722,86:722,87:944,88:722,89:722,90:611,91:333,
        92:278,93:333,94:469,95:500,96:333,97:444,98:500,99:444,100:500,101:444,
        102:333,103:500,104:500,105:278,106:278,107:500,108:278,109:778,110:500,
        111:500,112:500,113:500,114:333,115:389,116:278,117:500,118:500,119:722,
        120:500,121:500,122:444,123:480,124:200,125:480,126:541
    }
};

const TimesBold = {
    defaultWidth: 250,
    widths: {
        32:250,33:333,34:555,35:500,36:500,37:1000,38:833,39:333,40:333,41:333,
        42:500,43:570,44:250,45:333,46:250,47:278,48:500,49:500,50:500,51:500,
        52:500,53:500,54:500,55:500,56:500,57:500,58:333,59:333,60:570,61:570,
        62:570,63:500,64:930,65:722,66:667,67:722,68:722,69:667,70:611,71:778,
        72:778,73:389,74:500,75:778,76:667,77:944,78:722,79:778,80:611,81:778,
        82:722,83:556,84:667,85:722,86:722,87:1000,88:722,89:722,90:667,91:333,
        92:278,93:333,94:581,95:500,96:333,97:500,98:556,99:444,100:556,101:444,
        102:333,103:500,104:556,105:278,106:333,107:556,108:278,109:833,110:556,
        111:500,112:556,113:556,114:444,115:389,116:333,117:556,118:500,119:722,
        120:500,121:500,122:444,123:394,124:220,125:394,126:520
    }
};

const Courier = {
    defaultWidth: 600,
    widths: {} // Courier is monospaced — all chars are 600
};

const Symbol = {
    defaultWidth: 250,
    widths: {
        32:250,33:333,34:713,35:500,36:549,37:833,38:778,39:439,40:333,41:333,
        42:500,43:549,44:250,45:549,46:250,47:278,48:500,49:500,50:500,51:500,
        52:500,53:500,54:500,55:500,56:500,57:500,58:278,59:278,60:549,61:549,
        62:549,63:444,64:549,65:722,66:667,67:722,68:612,69:611,70:763,71:603,
        72:722,73:333,74:631,75:722,76:686,77:889,78:722,79:722,80:768,81:741,
        82:556,83:592,84:611,85:690,86:439,87:768,88:645,89:795,90:611
    }
};

// ── Standard Font Name Normalization ─────────────────────────────────────────
// PDF uses many aliases for the same font — normalize to our key
const STANDARD_FONT_MAP = {
    // Helvetica family
    'Helvetica': Helvetica,
    'Helvetica-Bold': HelveticaBold,
    'Helvetica-Oblique': Helvetica,
    'Helvetica-BoldOblique': HelveticaBold,
    'Arial': Helvetica,
    'ArialMT': Helvetica,
    'Arial-Bold': HelveticaBold,
    'Arial-BoldMT': HelveticaBold,
    // Times family
    'Times-Roman': Times,
    'Times-Bold': TimesBold,
    'Times-Italic': Times,
    'Times-BoldItalic': TimesBold,
    'TimesNewRoman': Times,
    'TimesNewRomanPSMT': Times,
    'TimesNewRoman-Bold': TimesBold,
    'TimesNewRomanPS-BoldMT': TimesBold,
    // Courier family (monospaced — all 600)
    'Courier': Courier,
    'Courier-Bold': Courier,
    'Courier-Oblique': Courier,
    'Courier-BoldOblique': Courier,
    'CourierNew': Courier,
    'CourierNewPSMT': Courier,
    // Symbol/ZapfDingbats
    'Symbol': Symbol,
    'ZapfDingbats': Symbol,
};

export function getStandardFontMetrics(fontName) {
    if (!fontName) return null;
    // Strip subset prefix (e.g. "ABCDEF+Helvetica" → "Helvetica")
    const base = fontName.replace(/^[A-Z]{6}\+/, '');
    return STANDARD_FONT_MAP[base] || STANDARD_FONT_MAP[fontName] || null;
}

export function getCharWidth(fontObj, cid, glyph) {
    // 1. Try explicit glyph widths from the PDF font dict
    if (fontObj?.glyphs?.[cid] !== undefined) return fontObj.glyphs[cid];
    // 2. Try standard font AFM metrics
    const metrics = getStandardFontMetrics(fontObj?.name);
    if (metrics) {
        return metrics.widths[cid] !== undefined ? metrics.widths[cid] : metrics.defaultWidth;
    }
    // 3. Fallback
    return fontObj?.defaultWidth || 1000;
}

// ── WinAnsiEncoding Table ─────────────────────────────────────────────────────
// Reference: pdf.js src/core/encodings.js
// Maps PDF byte values 0x20-0xFF → Unicode codepoints
export const WinAnsiEncoding = {
    0x20: 0x0020, 0x21: 0x0021, 0x22: 0x0022, 0x23: 0x0023, 0x24: 0x0024,
    0x25: 0x0025, 0x26: 0x0026, 0x27: 0x0027, 0x28: 0x0028, 0x29: 0x0029,
    0x2A: 0x002A, 0x2B: 0x002B, 0x2C: 0x002C, 0x2D: 0x002D, 0x2E: 0x002E,
    0x2F: 0x002F, 0x30: 0x0030, 0x31: 0x0031, 0x32: 0x0032, 0x33: 0x0033,
    0x34: 0x0034, 0x35: 0x0035, 0x36: 0x0036, 0x37: 0x0037, 0x38: 0x0038,
    0x39: 0x0039, 0x3A: 0x003A, 0x3B: 0x003B, 0x3C: 0x003C, 0x3D: 0x003D,
    0x3E: 0x003E, 0x3F: 0x003F, 0x40: 0x0040, 0x41: 0x0041, 0x42: 0x0042,
    0x43: 0x0043, 0x44: 0x0044, 0x45: 0x0045, 0x46: 0x0046, 0x47: 0x0047,
    0x48: 0x0048, 0x49: 0x0049, 0x4A: 0x004A, 0x4B: 0x004B, 0x4C: 0x004C,
    0x4D: 0x004D, 0x4E: 0x004E, 0x4F: 0x004F, 0x50: 0x0050, 0x51: 0x0051,
    0x52: 0x0052, 0x53: 0x0053, 0x54: 0x0054, 0x55: 0x0055, 0x56: 0x0056,
    0x57: 0x0057, 0x58: 0x0058, 0x59: 0x0059, 0x5A: 0x005A, 0x5B: 0x005B,
    0x5C: 0x005C, 0x5D: 0x005D, 0x5E: 0x005E, 0x5F: 0x005F, 0x60: 0x0060,
    0x61: 0x0061, 0x62: 0x0062, 0x63: 0x0063, 0x64: 0x0064, 0x65: 0x0065,
    0x66: 0x0066, 0x67: 0x0067, 0x68: 0x0068, 0x69: 0x0069, 0x6A: 0x006A,
    0x6B: 0x006B, 0x6C: 0x006C, 0x6D: 0x006D, 0x6E: 0x006E, 0x6F: 0x006F,
    0x70: 0x0070, 0x71: 0x0071, 0x72: 0x0072, 0x73: 0x0073, 0x74: 0x0074,
    0x75: 0x0075, 0x76: 0x0076, 0x77: 0x0077, 0x78: 0x0078, 0x79: 0x0079,
    0x7A: 0x007A, 0x7B: 0x007B, 0x7C: 0x007C, 0x7D: 0x007D, 0x7E: 0x007E,
    // 0x80-0x9F: special Windows chars
    0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
    0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
    0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
    0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
    0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
    0x9E: 0x017E, 0x9F: 0x0178,
    // 0xA0-0xFF: Latin-1 supplement
    0xA0: 0x00A0, 0xA1: 0x00A1, 0xA2: 0x00A2, 0xA3: 0x00A3, 0xA4: 0x00A4,
    0xA5: 0x00A5, 0xA6: 0x00A6, 0xA7: 0x00A7, 0xA8: 0x00A8, 0xA9: 0x00A9,
    0xAA: 0x00AA, 0xAB: 0x00AB, 0xAC: 0x00AC, 0xAD: 0x00AD, 0xAE: 0x00AE,
    0xAF: 0x00AF, 0xB0: 0x00B0, 0xB1: 0x00B1, 0xB2: 0x00B2, 0xB3: 0x00B3,
    0xB4: 0x00B4, 0xB5: 0x00B5, 0xB6: 0x00B6, 0xB7: 0x00B7, 0xB8: 0x00B8,
    0xB9: 0x00B9, 0xBA: 0x00BA, 0xBB: 0x00BB, 0xBC: 0x00BC, 0xBD: 0x00BD,
    0xBE: 0x00BE, 0xBF: 0x00BF, 0xC0: 0x00C0, 0xC1: 0x00C1, 0xC2: 0x00C2,
    0xC3: 0x00C3, 0xC4: 0x00C4, 0xC5: 0x00C5, 0xC6: 0x00C6, 0xC7: 0x00C7,
    0xC8: 0x00C8, 0xC9: 0x00C9, 0xCA: 0x00CA, 0xCB: 0x00CB, 0xCC: 0x00CC,
    0xCD: 0x00CD, 0xCE: 0x00CE, 0xCF: 0x00CF, 0xD0: 0x00D0, 0xD1: 0x00D1,
    0xD2: 0x00D2, 0xD3: 0x00D3, 0xD4: 0x00D4, 0xD5: 0x00D5, 0xD6: 0x00D6,
    0xD7: 0x00D7, 0xD8: 0x00D8, 0xD9: 0x00D9, 0xDA: 0x00DA, 0xDB: 0x00DB,
    0xDC: 0x00DC, 0xDD: 0x00DD, 0xDE: 0x00DE, 0xDF: 0x00DF, 0xE0: 0x00E0,
    0xE1: 0x00E1, 0xE2: 0x00E2, 0xE3: 0x00E3, 0xE4: 0x00E4, 0xE5: 0x00E5,
    0xE6: 0x00E6, 0xE7: 0x00E7, 0xE8: 0x00E8, 0xE9: 0x00E9, 0xEA: 0x00EA,
    0xEB: 0x00EB, 0xEC: 0x00EC, 0xED: 0x00ED, 0xEE: 0x00EE, 0xEF: 0x00EF,
    0xF0: 0x00F0, 0xF1: 0x00F1, 0xF2: 0x00F2, 0xF3: 0x00F3, 0xF4: 0x00F4,
    0xF5: 0x00F5, 0xF6: 0x00F6, 0xF7: 0x00F7, 0xF8: 0x00F8, 0xF9: 0x00F9,
    0xFA: 0x00FA, 0xFB: 0x00FB, 0xFC: 0x00FC, 0xFD: 0x00FD, 0xFE: 0x00FE,
    0xFF: 0x00FF
};

// MacRomanEncoding — used by older PDFs and Mac-generated documents
export const MacRomanEncoding = {
    ...WinAnsiEncoding, // shares most of Latin-1
    0x80: 0x00C4, 0x81: 0x00C5, 0x82: 0x00C7, 0x83: 0x00C9, 0x84: 0x00D1,
    0x85: 0x00D6, 0x86: 0x00DC, 0x87: 0x00E1, 0x88: 0x00E0, 0x89: 0x00E2,
    0x8A: 0x00E4, 0x8B: 0x00E5, 0x8C: 0x00E7, 0x8D: 0x00E9, 0x8E: 0x00E8,
    0x8F: 0x00EA, 0x90: 0x00EB, 0x91: 0x00ED, 0x92: 0x00EC, 0x93: 0x00EE,
    0x94: 0x00EF, 0x95: 0x00F1, 0x96: 0x00F3, 0x97: 0x00F2, 0x98: 0x00F4,
    0x99: 0x00F6, 0x9A: 0x00FA, 0x9B: 0x00F9, 0x9C: 0x00FB, 0x9D: 0x00FC,
};

// Apply encoding table to resolve a glyph from raw byte value
export function applyEncoding(byteVal, encoding, toUnicode) {
    // 1. toUnicode always wins
    if (toUnicode && toUnicode[byteVal]) return toUnicode[byteVal];
    // 2. Apply encoding table
    if (encoding && encoding[byteVal]) return String.fromCodePoint(encoding[byteVal]);
    // 3. Direct ASCII passthrough
    if (byteVal >= 0x20 && byteVal <= 0x7E) return String.fromCharCode(byteVal);
    return '';
}

export function getEncodingForName(name) {
    switch (name) {
        case 'WinAnsiEncoding': return WinAnsiEncoding;
        case 'MacRomanEncoding': return MacRomanEncoding;
        default: return null;
    }
}
