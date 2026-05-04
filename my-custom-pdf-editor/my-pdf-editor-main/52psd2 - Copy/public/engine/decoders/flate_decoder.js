/**
 * @module FlateDecoder
 * @description Zero-dependency PDF Stream Decompressor utilizing the browser's native C++ `DecompressionStream`.
 * Emulates pdf.js FlateStream extraction without massive external libraries like pako.js.
 */

export class FlateDecoder {
    /**
     * Unzips PDF FlateDecode vector/text streams instantly inside the Web Worker.
     * @param {Uint8Array} compressedBuffer 
     * @returns {Promise<Uint8Array>} Unzipped stream data
     */
    static async decode(compressedBuffer) {
        try {
            // FlateDecode in PDF is usually ZLib-compressed (RFC 1950)
            const ds = new DecompressionStream('deflate');

            // Pipe the raw math into the browser's native C++ unzipper
            const writer = ds.writable.getWriter();
            writer.write(compressedBuffer);
            writer.close();

            // Read the unzipped bytes back
            const reader = ds.readable.getReader();
            const chunks = [];
            let totalLength = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                totalLength += value.length;
            }

            // Reconstruct the exact decompressed byte array
            const unzipped = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                unzipped.set(chunk, offset);
                offset += chunk.length;
            }

            return unzipped;

        } catch (e) {
            // Safari/Firefox occasionally throw if the FlateDecode lacks a zlib header (raw deflate)
            console.warn("FlateDecoder: Standard deflate failed, attempting raw inflate...", e);
            try {
                const dsRaw = new DecompressionStream('deflate-raw');
                const writerRaw = dsRaw.writable.getWriter();
                writerRaw.write(compressedBuffer);
                writerRaw.close();

                const readerRaw = dsRaw.readable.getReader();
                const chunksRaw = [];
                let totalLengthRaw = 0;
                while (true) {
                    const { done, value } = await readerRaw.read();
                    if (done) break;
                    chunksRaw.push(value);
                    totalLengthRaw += value.length;
                }
                const unzippedRaw = new Uint8Array(totalLengthRaw);
                let offsetRaw = 0;
                for (const chunk of chunksRaw) {
                    unzippedRaw.set(chunk, offsetRaw);
                    offsetRaw += chunk.length;
                }
                return unzippedRaw;
            } catch (errRaw) {
                console.warn("FlateDecoder: Raw inflate failed. Executing deep binary sequence hunting for Zlib Signature (78 9c)...");

                // Deep hunt for ZLib Magic Headers 
                // 78 01 (No/Low Compression)
                // 78 9C (Default Compression) -> Most common
                // 78 DA (Best Compression)
                let zlibStart = -1;
                for (let i = 0; i < compressedBuffer.length - 1; i++) {
                    if (compressedBuffer[i] === 0x78 && (compressedBuffer[i + 1] === 0x01 || compressedBuffer[i + 1] === 0x9c || compressedBuffer[i + 1] === 0xda)) {
                        zlibStart = i;
                        break;
                    }
                }

                if (zlibStart > 0) {
                    console.log(`FlateDecoder: Zlib signature found buried at offset ${zlibStart}! Slicing and reviving stream...`);
                    const slicedBuffer = compressedBuffer.subarray(zlibStart);

                    try {
                        const dsRevived = new DecompressionStream('deflate');
                        const writerRevived = dsRevived.writable.getWriter();
                        writerRevived.write(slicedBuffer);
                        writerRevived.close();

                        const readerRevived = dsRevived.readable.getReader();
                        const chunksRevived = [];
                        let totalLengthRevived = 0;
                        while (true) {
                            const { done, value } = await readerRevived.read();
                            if (done) break;
                            chunksRevived.push(value);
                            totalLengthRevived += value.length;
                        }
                        const finalRevived = new Uint8Array(totalLengthRevived);
                        let offsetRevived = 0;
                        for (const c of chunksRevived) {
                            finalRevived.set(c, offsetRevived);
                            offsetRevived += c.length;
                        }
                        return finalRevived;
                    } catch (eRevived) {
                        console.error("FlateDecoder: Sliced stream still failed to decompress:", eRevived);
                    }
                }

                console.error("FlateDecoder: Fatal decompression failure immediately aborted.", errRaw);
                throw new Error("Could not decompress the FlateStream.");
            }
        }
    }
}
