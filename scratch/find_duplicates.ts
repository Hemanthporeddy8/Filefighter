import fs from 'fs';
import path from 'path';

const filePath = 'd:/D folder downloads/project (2)/src/lib/transliterator/dictionaries/telugu.ts';
const content = fs.readFileSync(filePath, 'utf8');

const matches = content.match(/'([^']+)':/g);
if (matches) {
    const keys = matches.map(m => m.slice(1, -2));
    const counts: Record<string, number> = {};
    keys.forEach(k => {
        counts[k] = (counts[k] || 0) + 1;
    });
    const duplicates = Object.entries(counts).filter(([k, v]) => v > 1);
    console.log('Duplicates found:', duplicates);
} else {
    console.log('No keys found');
}
