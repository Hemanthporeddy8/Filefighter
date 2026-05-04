const fs = require('fs');
const filePath = 'd:/D folder downloads/project (2)/src/lib/transliterator/index.ts';
const content = fs.readFileSync(filePath, 'utf8');

const langRegex = /(\w+): \{\s+consonants: \{([^}]+)\}/g;
let match;
while ((match = langRegex.exec(content)) !== null) {
    const lang = match[1];
    const consonantsStr = match[2];
    const pairs = consonantsStr.split(',').map(p => p.trim()).filter(p => p);
    const keys = pairs.map(p => p.split(':')[0].slice(1, -1));
    const counts = {};
    keys.forEach(k => counts[k] = (counts[k] || 0) + 1);
    const duplicates = Object.entries(counts).filter(([k, v]) => v > 1);
    if (duplicates.length > 0) {
        console.log(`Lang ${lang} has duplicates:`, duplicates);
    }
}
