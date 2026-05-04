import { md5 } from './md5.js';
import { rc4 } from './rc4.js';

export async function encryptPdfAst(doc, userPassword, ownerPassword = null) {
    if (!ownerPassword) ownerPassword = userPassword;

    // Load necessary constructors
    const { PDFDict, PDFName, PDFNumber, PDFString, PDFArray, PDFRef, PDFStream } = await import('../ast/pdf_objects.js');

    const PADDING_STRING = new Uint8Array([
        0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
        0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
    ]);

    function padPassword(pwd) {
        const bytes = typeof pwd === 'string' ? new TextEncoder().encode(pwd) : (pwd || new Uint8Array(0));
        const res = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            res[i] = i < bytes.length ? bytes[i] : PADDING_STRING[i - bytes.length];
        }
        return res;
    }

    const paddedUser = padPassword(userPassword);
    const paddedOwner = padPassword(ownerPassword);

    // 1. Generate O (Owner Password String)
    const ownerKey = md5(paddedOwner).slice(0, 5);
    const O = rc4(ownerKey, paddedUser);

    // 2. Generate Encryption Key (DEK)
    const pValue = -4; // Permissions: print/copy restricted
    const pBytes = new Uint8Array([pValue & 0xFF, (pValue >> 8) & 0xFF, (pValue >> 16) & 0xFF, (pValue >> 24) & 0xFF]);

    // ID array (required for spec).
    const idHash = new Uint8Array(16);
    for (let i = 0; i < 16; i++) idHash[i] = i ^ 0x42;

    const hashInput = new Uint8Array(32 + 32 + 4 + 16);
    hashInput.set(paddedUser, 0);
    hashInput.set(O, 32);
    hashInput.set(pBytes, 64);
    hashInput.set(idHash, 68);

    const DEK = md5(hashInput).slice(0, 5);

    // 3. Generate U (User Password String)
    const U = rc4(DEK, PADDING_STRING);

    // 4. Build Encrypt Dictionary
    const encryptDict = new PDFDict();
    encryptDict.set('Filter', new PDFName('Standard'));
    encryptDict.set('V', new PDFNumber(1)); // 40-bit RC4
    encryptDict.set('R', new PDFNumber(2)); // Revision 2
    encryptDict.set('O', new PDFString(O));
    encryptDict.set('U', new PDFString(U));
    encryptDict.set('P', new PDFNumber(pValue));

    const nextId = doc.getMaxObjectId() + 10;
    doc.parser.xref.set(`${nextId},0`, encryptDict);
    doc._objectCache.set(`${nextId},0`, encryptDict);

    doc.encryptRef = new PDFRef(nextId, 0);
    doc.idArray = new PDFArray([new PDFString(idHash), new PDFString(idHash)]);

    // 5. Encrypt all Strings and Streams in the AST
    const keys = Array.from(doc.parser.xref.keys());
    for (const keyStr of keys) {
        const [num, gen] = keyStr.split(',').map(Number);

        // Skip the newly generated Encrypt dictionary itself
        if (num === nextId) continue;

        // Force resolve to load the object fully into cache BEFORE encryption
        const obj = await doc._resolve(new PDFRef(num, gen));
        if (!obj) continue;

        // Calculate Object Encryption Key: MD5(DEK + num + gen)
        const objInput = new Uint8Array(5 + 5);
        objInput.set(DEK, 0);
        objInput[5] = num & 0xFF;
        objInput[6] = (num >> 8) & 0xFF;
        objInput[7] = (num >> 16) & 0xFF;
        objInput[8] = gen & 0xFF;
        objInput[9] = (gen >> 8) & 0xFF;

        const objKey = md5(objInput).slice(0, 10);

        // Recursive encryption of complex structures without modifying references
        const encryptRecurse = (item) => {
            if (item instanceof PDFString) {
                if (typeof item.value === 'string') {
                    item.value = new TextEncoder().encode(item.value);
                }
                item.value = rc4(objKey, item.value);
            } else if (item instanceof PDFArray) {
                for (let i = 0; i < item.elements.length; i++) {
                    encryptRecurse(item.elements[i]);
                }
            } else if (item instanceof PDFDict) {
                for (const val of item.map.values()) {
                    encryptRecurse(val);
                }
            } else if (item instanceof PDFStream) {
                // Encrypt the stream dictionary natively
                encryptRecurse(item.dict);

                // Streams without Length are broken, ensure we have bytes
                if (item.buffer && item.buffer.length > 0) {
                    item.buffer = rc4(objKey, item.buffer);
                    // Let serialize handle creating the new /Length based on this buffer
                }
            }
        };

        encryptRecurse(obj);
    }

    return doc;
}

export async function decryptPdfAst(doc, password) {
    const { PDFDict, PDFName, PDFNumber, PDFString, PDFArray, PDFRef, PDFStream } = await import('../ast/pdf_objects.js');

    const trailer = await doc._resolve(doc.parser.trailer);
    const encryptRef = trailer?.get ? trailer.get('Encrypt') : null;
    if (!encryptRef) {
        throw new Error("This PDF is not encrypted.");
    }

    const encryptDict = await doc._resolve(encryptRef);
    const V = encryptDict.get('V')?.value || 1;
    const R = encryptDict.get('R')?.value || 2;
    const O = encryptDict.get('O').value;
    const U = encryptDict.get('U').value;
    const P = encryptDict.get('P').value;
    const length = encryptDict.get('Length')?.value || 40;
    const keyLen = length / 8;

    if (R > 3) {
        throw new Error(`Unsupported encryption revision: R=${R}. Only R=2 and R=3 are supported.`);
    }

    const PADDING_STRING = new Uint8Array([
        0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
        0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
    ]);

    function padPassword(pwd) {
        const bytes = typeof pwd === 'string' ? new TextEncoder().encode(pwd) : (pwd || new Uint8Array(0));
        const res = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            res[i] = i < bytes.length ? bytes[i] : PADDING_STRING[i - bytes.length];
        }
        return res;
    }

    const paddedPwd = padPassword(password);
    const idObj = trailer.get('ID');
    const idArray = await doc._resolve(idObj);
    const idFirst = idArray && idArray.elements ? idArray.elements[0].value : new Uint8Array(16);

    // 1. Derive DEK (Algorithm 3.2)
    const pBytes = new Uint8Array([P & 0xFF, (P >> 8) & 0xFF, (P >> 16) & 0xFF, (P >> 24) & 0xFF]);
    const hashInput = new Uint8Array(32 + 32 + 4 + idFirst.length);
    hashInput.set(paddedPwd, 0);
    hashInput.set(O, 32);
    hashInput.set(pBytes, 64);
    hashInput.set(idFirst, 68);

    let DEK = md5(hashInput);

    // Revision 3: 50 iterations
    if (R >= 3) {
        for (let i = 0; i < 50; i++) {
            DEK = md5(DEK.slice(0, keyLen));
        }
    }
    DEK = DEK.slice(0, keyLen);

    // 2. Validate Password (Algorithm 3.4 / 3.5)
    let validationU;
    if (R === 2) {
        validationU = rc4(DEK, PADDING_STRING);
    } else {
        // R=3 Algorithm 3.5
        let currentHash = md5(new Uint8Array([...PADDING_STRING, ...idFirst]));
        validationU = rc4(DEK, currentHash);
        for (let k = 1; k <= 19; k++) {
            const iterKey = new Uint8Array(DEK.length);
            for (let i = 0; i < DEK.length; i++) iterKey[i] = DEK[i] ^ k;
            validationU = rc4(iterKey, validationU);
        }
    }

    // Compare first 16 bytes of U (Revision 2/3 check)
    const storedU = (typeof U === 'string') ? new TextEncoder().encode(U) : U;
    let match = true;
    for (let i = 0; i < 16; i++) {
        if (validationU[i] !== storedU[i]) {
            match = false; break;
        }
    }

    if (!match) {
        throw new Error("Invalid password.");
    }

    // 3. Decrypt all objects
    const keys = Array.from(doc.parser.xref.keys());
    for (const keyStr of keys) {
        const [num, gen] = keyStr.split(',').map(Number);
        if (new PDFRef(num, gen).toString() === encryptRef.toString()) continue;

        const obj = await doc._resolve(new PDFRef(num, gen));
        if (!obj) continue;

        // PDF Spec 7.6.1: XRef streams and Object streams are NEVER encrypted.
        if (obj instanceof PDFStream) {
            const type = obj.dict.get('Type');
            if (type instanceof PDFName && (type.name === 'XRef' || type.name === 'ObjStm')) {
                continue;
            }
        }

        const objInput = new Uint8Array(DEK.length + 5);
        objInput.set(DEK, 0);
        objInput[DEK.length] = num & 0xFF;
        objInput[DEK.length + 1] = (num >> 8) & 0xFF;
        objInput[DEK.length + 2] = (num >> 16) & 0xFF;
        objInput[DEK.length + 3] = gen & 0xFF;
        objInput[DEK.length + 4] = (gen >> 8) & 0xFF;
        const objKey = md5(objInput).slice(0, Math.min(DEK.length + 5, 16));

        const decryptRecurse = (item) => {
            if (item instanceof PDFString) {
                item.value = rc4(objKey, item.value);
            } else if (item instanceof PDFArray) {
                for (let i = 0; i < item.elements.length; i++) decryptRecurse(item.elements[i]);
            } else if (item instanceof PDFDict) {
                for (const val of item.map.values()) decryptRecurse(val);
            } else if (item instanceof PDFStream) {
                decryptRecurse(item.dict);
                if (item.buffer && item.buffer.length > 0) {
                    item.buffer = rc4(objKey, item.buffer);
                }
            }
        };
        decryptRecurse(obj);
    }

    // 4. Strip Encrypt Dict
    trailer.map.delete('Encrypt');
    doc.encryptRef = null;

    return doc;
}
