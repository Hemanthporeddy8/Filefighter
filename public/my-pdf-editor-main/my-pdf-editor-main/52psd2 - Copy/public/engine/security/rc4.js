// Minimal RC4 implementation for Uint8Array
export function rc4(key, data) {
    if (typeof key === 'string') key = new TextEncoder().encode(key);
    if (typeof data === 'string') data = new TextEncoder().encode(data);

    let s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;

    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + key[i % key.length]) & 255;
        let x = s[i];
        s[i] = s[j];
        s[j] = x;
    }

    let res = new Uint8Array(data.length);
    let i = 0;
    j = 0;
    for (let y = 0; y < data.length; y++) {
        i = (i + 1) & 255;
        j = (j + s[i]) & 255;
        let x = s[i];
        s[i] = s[j];
        s[j] = x;
        res[y] = data[y] ^ s[(s[i] + s[j]) & 255];
    }
    return res;
}
