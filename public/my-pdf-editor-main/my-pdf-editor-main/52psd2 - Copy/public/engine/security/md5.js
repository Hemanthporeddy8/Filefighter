// Minimal MD5 implementation for PDF Encryption, supporting Uint8Array
export function md5(message) {
    if (typeof message === 'string') {
        const enc = new TextEncoder();
        message = enc.encode(message);
    }
    const k = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
        0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
        0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
        0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
        0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
        0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
        0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
        0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
    ];
    const r = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];

    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476;

    let len = message.length;
    let bitLen = len * 8;
    let padLen = (len % 64 < 56) ? 56 - (len % 64) : 120 - (len % 64);
    let padded = new Uint8Array(len + padLen + 8);
    padded.set(message);
    padded[len] = 0x80;

    let v = bitLen;
    for (let i = 0; i < 8; i++) {
        padded[len + padLen + i] = v & 0xFF;
        v = Math.floor(v / 256);
    }

    const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
    const leftRotate = (x, c) => (x << c) | (x >>> (32 - c));

    for (let offset = 0; offset < padded.length; offset += 64) {
        let a = h0, b = h1, c = h2, d = h3;
        const w = new Int32Array(16);
        for (let i = 0; i < 16; i++) w[i] = view.getInt32(offset + i * 4, true);

        for (let i = 0; i < 64; i++) {
            let f, g;
            if (i < 16) {
                f = (b & c) | ((~b) & d);
                g = i;
            } else if (i < 32) {
                f = (d & b) | ((~d) & c);
                g = (5 * i + 1) % 16;
            } else if (i < 48) {
                f = b ^ c ^ d;
                g = (3 * i + 5) % 16;
            } else {
                f = c ^ (b | (~d));
                g = (7 * i) % 16;
            }
            let temp = d;
            d = c;
            c = b;
            b = (b + leftRotate((a + f + k[i] + w[g]) | 0, r[i])) | 0;
            a = temp;
        }

        h0 = (h0 + a) | 0;
        h1 = (h1 + b) | 0;
        h2 = (h2 + c) | 0;
        h3 = (h3 + d) | 0;
    }

    const out = new Uint8Array(16);
    const outView = new DataView(out.buffer);
    outView.setInt32(0, h0, true);
    outView.setInt32(4, h1, true);
    outView.setInt32(8, h2, true);
    outView.setInt32(12, h3, true);
    return out;
}
