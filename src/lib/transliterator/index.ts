/**
 * @fileOverview Central dispatcher for the client-side transliteration engine.
 * Routes transliteration and suggestion requests to the correct language module.
 * Incorporates normalization, variant generation, and a scoring engine for improved accuracy.
 */

interface LanguageRules {
  consonants: Record<string, string>;
  digraphs: Record<string, string>;
  vowelMatras: Record<string, string>;
  independentVowels: Record<string, string>;
  halant: string;
  anusvara: string;
}

// Language-specific rules for transliteration.
const langRules: Record<string, LanguageRules> = {
    te: {
        consonants: {'k':'క','g':'గ','ng':'ఙ','j':'జ','jh':'ఝ','ny':'ఞ','chh':'ఛ','T':'ట','D':'డ','N':'ణ','Th':'ఠ','Dh':'ఢ','t':'త','d':'ద','n':'న','th':'థ','dh':'ధ','p':'ప','b':'బ','m':'మ','ph':'ఫ','bh':'భ','y':'య','r':'ర','l':'ల','v':'వ','L':'ళ','s':'స','h':'హ'},
        digraphs: {'ch':'చ','kh':'ఖ','gh':'ఘ','jh':'ఝ','th':'థ','dh':'ధ','ph':'ఫ','bh':'భ','sh':'శ','ng':'ఙ','ny':'ఞ','Th':'ఠ','Dh':'ఢ','S':'ష'},
        vowelMatras: {'a':'','aa':'ా','i':'ి','ii':'ీ','u':'ు','uu':'ూ','e':'ె','ee':'ే','ai':'ై','o':'ొ','oo':'ో','au':'ౌ'},
        independentVowels: {'a':'అ','aa':'ఆ','i':'ఇ','ii':'ఈ','u':'ఉ','uu':'ఊ','e':'ఎ','ee':'ఏ','ai':'ఐ','o':'ఒ','oo':'ఓ','au':'ఔ'},
        halant: '్',
        anusvara: 'ం'
    },
    bn: {
        consonants: {'k':'ক','kh':'খ','g':'গ','gh':'ঘ','ng':'ঙ','ch':'চ','chh':'ছ','j':'জ','jh':'ঝ','ny':'ঞ','T':'ট','Th':'ঠ','D':'ড','Dh':'ঢ','N':'ণ','t':'ত','th':'থ','d':'দ','dh':'ধ','n':'ন','p':'প','ph':'ফ','b':'ব','bh':'ভ','m':'ম','y':'য','r':'র','l':'ল','v':'ৱ','s':'স','sh':'ষ','h':'হ'},
        digraphs: {},
        vowelMatras: {'a':'','aa':'া','i':'ি','ii':'ী','u':'ു','uu':'ূ','e':'ে','ee':'ো','ai':'ৈ','o':'ো','oo':'ৌ','au':'ৌ'},
        independentVowels: {'a':'অ','aa':'আ','i':'ই','ii':'ঈ','u':'উ','uu':'ঊ','e':'এ','ee':'এা','ai':'ঐ','o':'ও','oo':'ঔ','au':'ঔ'},
        halant: '্',
        anusvara: 'ং'
    },
    gu: {
        consonants: {'k':'ક','kh':'ખ','g':'ગ','gh':'ઘ','ng':'ઙ','ch':'ચ','chh':'છ','j':'જ','jh':'ઝ','ny':'ઞ','T':'ટ','Th':'ઠ','D':'ડ','Dh':'ઢ','N':'ણ','t':'ત','th':'થ','d':'દ','dh':'ધ','n':'ન','p':'પ','ph':'ફ','b':'બ','bh':'ભ','m':'મ','y':'ય','r':'ર','l':'લ','v':'વ','s':'સ','sh':'ષ','h':'હ'},
        digraphs: {},
        vowelMatras: {'a':'','aa':'ા','i':'િ','ii':'ી','u':'ુ','uu':'ૂ','e':'ે','ee':'ે','ai':'ૈ','o':'ો','oo':'ૌ','au':'ૌ'},
        independentVowels: {'a':'અ','aa':'આ','i':'ઇ','ii':'ઈ','u':'ઉ','uu':'ઊ','e':'એ','ee':'એ','ai':'ઐ','o':'ઓ','oo':'ઔ','au':'ઔ'},
        halant: '્',
        anusvara: 'ં'
    },
    hi: {
        consonants: {'k':'क','kh':'ख','g':'ग','gh':'घ','ng':'ङ','ch':'च','chh':'छ','j':'ज','jh':'झ','ny':'ञ','T':'ट','Th':'ठ','D':'ड','Dh':'ढ','N':'ण','t':'त','th':'थ','d':'द','dh':'ध','n':'न','p':'प','ph':'फ','b':'ब','bh':'भ','m':'म','y':'य','r':'र','l':'ल','v':'व','s':'स','sh':'श','h':'ह'},
        digraphs: {},
        vowelMatras: {'a':'','aa':'ा','i':'ि','ii':'ी','u':'ु','uu':'ू','e':'े','ee':'े','ai':'ै','o':'ो','oo':'ौ','au':'ौ'},
        independentVowels: {'a':'अ','aa':'आ','i':'इ','ii':'ई','u':'उ','uu':'ऊ','e':'ए','ee':'ए','ai':'ऐ','o':'ओ','oo':'औ','au':'औ'},
        halant: '्',
        anusvara: 'ं'
    },
    kn: {
        consonants: {'k':'ಕ','kh':'ಖ','g':'ಗ','gh':'ಘ','ng':'ಙ','ch':'ಚ','chh':'ಛ','j':'ಜ','jh':'ಝ','ny':'ಞ','T':'ಟ','Th':'ಠ','D':'ಡ','Dh':'ಢ','N':'ಣ','t':'ತ','th':'ಥ','d':'ದ','dh':'ಧ','n':'ನ','p':'ಪ','ph':'ಫ','b':'ಬ','bh':'ಭ','m':'ಮ','y':'ಯ','r':'ರ','l':'ಲ','v':'ವ','s':'ಸ','sh':'ಷ','h':'ಹ'},
        digraphs: {},
        vowelMatras: {'a':'','aa':'ಾ','i':'ಿ','ii':'ೀ','u':'ು','uu':'ೂ','e':'ೆ','ee':'ೇ','ai':'ೈ','o':'ೊ','oo':'ೋ','au':'ೌ'},
        independentVowels: {'a':'ಅ','aa':'ಆ','i':'ಇ','ii':'ಈ','u':'ಉ','uu':'ಊ','e':'ಎ','ee':'ಏ','ai':'ಐ','o':'ఒ','oo':'ಓ','au':'ಔ'},
        halant: '್',
        anusvara: 'ಂ'
    },
    ml: {
        consonants: {'k':'ക','kh':'ഖ','g':'ഗ','gh':'ഘ','ng':'ങ','ch':'ച','chh':'ഛ','j':'ജ','jh':'ഝ','ny':'ഞ','T':'ട','Th':'ഠ','D':'ഡ','Dh':'ഢ','N':'ണ','t':'ത','th':'ഥ','d':'ദ','dh':'ധ','n':'ന','p':'പ','ph':'ഫ','b':'ಬ','bh':'ഭ','m':'മ','y':'യ','r':'ര','l':'ല','v':'വ','s':'സ','sh':'ഷ','h':'ಹ'},
        digraphs: {},
        vowelMatras: {'a':'','aa':'ా','i':'ി','ii':'ീ','u':'ു','uu':'ൂ','e':'െ','ee':'േ','ai':'ൈ','o':'ൊ','oo':'ോ','au':'ൗ'},
        independentVowels: {'a':'അ','aa':'ആ','i':'ഇ','ii':'ഈ','u':'ഉ','uu':'ഊ','e':'എ','ee':'ഏ','ai':'ഐ','o':'ഒ','oo':'ഓ','au':'ഔ'},
        halant: '്',
        anusvara: 'ം'
    },
    mr: {
        consonants: {'k':'क','kh':'ख','g':'ग','gh':'घ','ng':'ङ','ch':'च','chh':'छ','j':'ज','jh':'झ','ny':'ञ','T':'ट','Th':'ठ','D':'ड','Dh':'ढ','N':'ण','t':'त','th':'थ','d':'द','dh':'ध','n':'न','p':'प','ph':'फ','b':'ब','bh':'भ','m':'म','y':'य','r':'र','l':'ल','v':'व','s':'स','sh':'श','h':'ह'},
        digraphs: {},
        vowelMatras: {'a':'','aa':'ा','i':'ि','ii':'ी','u':'ु','uu':'ू','e':'े','ee':'े','ai':'ै','o':'ो','oo':'ौ','au':'ौ'},
        independentVowels: {'a':'अ','aa':'आ','i':'इ','ii':'ई','u':'उ','uu':'ऊ','e':'ए','ee':'ए','ai':'ऐ','o':'ओ','oo':'औ','au':'औ'},
        halant: '्',
        anusvara: 'ं'
    },
    pa: {
        consonants: {'k':'ਕ','kh':'ਖ','g':'ਗ','gh':'ਘ','ng':'ਙ','ch':'ਚ','chh':'ਛ','j':'ਜ','jh':'ਝ','ny':'ਞ','T':'ਟ','Th':'ਠ','D':'ਡ','Dh':'ਢ','N':'ਣ','t':'ਤ','th':'ਥ','d':'ਦ','dh':'ਧ','n':'ਨ','p':'ਪ','ph':'ਫ','b':'ਬ','bh':'ਭ','m':'ਮ','y':'ਯ','r':'ರ','l':'ਲ','v':'ਵ','s':'ਸ','sh':'ਸ਼','h':'ਹ'},
        digraphs: {},
        vowelMatras: {'a':'','aa':'ਾ','i':'ਿ','ii':'ੀ','u':'ੁ','uu':'ੂ','e':'ੇ','ee':'ੇ','ai':'ੈ','o':'ੋ','oo':'ੌ','au':'ੌ'},
        independentVowels: {'a':'ਅ','aa':'ਆ','i':'ਇ','ii':'ਈ','u':'ਉ','uu':'ਊ','e':'ਏ','ee':'ਏ','ai':'ਐ','o':'ਓ','oo':'ਔ','au':'ਔ'},
        halant: '੍',
        anusvara: 'ਂ'
    },
    sd: {
        consonants: {'k':'ک','kh':'خ','g':'گ','gh':'غ','ng':'ں','ch':'چ','chh':'چھ','j':'ج','jh':'جھ','ny':'ن','t':'ٹ','th':'ٹھ','d':'ڈ','dh':'ڈھ','n':'ن','p':'پ','ph':'ف','b':'ب','bh':'بھ','m':'م','y':'ی','r':'ر','l':'ل','v':'و','s':'س','sh':'ش','h':'ہ'},
        digraphs: {},
        vowelMatras: {'a':'','aa':'ا','i':'ِ','ii':'ِی','u':'ُ','uu':'ُو','e':'ے','ai':'َی','o':'و','au':'َو'},
        independentVowels: {'a':'ا','aa':'آ','i':'اِ','ii':'اِی','u':'اُ','uu':'اُو','e':'اے','ai':'اَی','o':'او','au':'اَو'},
        halant: 'ْ',
        anusvara: 'ں'
    },
    si: {
        consonants: {'k':'ක','kh':'ඛ','g':'ග','gh':'ඝ','ng':'ඞ','ch':'ච','chh':'ඡ','j':'ජ','jh':'ඣ','ny':'ඤ','T':'ට','Th':'ඨ','D':'ඩ','Dh':'ඪ','N':'ණ','t':'ත','th':'ථ','d':'ද','dh':'ධ','n':'න','p':'ප','ph':'ඵ','b':'බ','bh':'භ','m':'ම','y':'ය','r':'ര','l':'ල','v':'ව','s':'ස','sh':'ෂ','h':'හ'},
        digraphs: {},
        vowelMatras: {'a':'','aa':'ා','i':'ି','ii':'ీ','u':'ు','uu':'ూ','e':'ෙ','ee':'ේ','ai':'ෛ','o':'ො','oo':'ෝ','au':'ෞ'},
        independentVowels: {'a':'අ','aa':'ආ','i':'ඉ','ii':'ඊ','u':'උ','uu':'ඌ','e':'එ','ee':'ඒ','ai':'ඓ','o':'ඔ','oo':'ඕ','au':'ඖ'},
        halant: '්',
        anusvara: 'ං'
    },
    ta: {
        consonants: {'k':'க','g':'க','ng':'ங','ch':'ச','j':'ஜ','ny':'ஞ','t':'ட','n':'ண','p':'ப','m':'ம','y':'ய','r':'ர','l':'ல','v':'வ','s':'ஸ','sh':'ஷ','h':'ஹ'},
        digraphs: {},
        vowelMatras: {'a':'','aa':'ா','i':'ி','ii':'ீ','u':'ு','uu':'ூ','e':'ெ','ee':'ே','ai':'ை','o':'ொ','oo':'ோ','au':'ௌ'},
        independentVowels: {'a':'அ','aa':'ஆ','i':'இ','ii':'ஈ','u':'உ','uu':'ஊ','e':'எ','ee':'ஏ','ai':'ஐ','o':'ஒ','oo':'ஓ','au':'ஔ'},
        halant: '்',
        anusvara: 'ம்'
    },
    ur: {
        consonants: {'k':'ک','kh':'خ','g':'گ','gh':'غ','ng':'ں','ch':'چ','chh':'چھ','j':'ج','jh':'جھ','ny':'ن','T':'ٹ','Th':'ٹھ','D':'ڈ','Dh':'ढھ','N':'ں','t':'ت','th':'ث','d':'د','dh':'ذ','n':'ن','p':'پ','ph':'ف','b':'ب','bh':'بھ','m':'م','y':'ی','r':'ر','l':'ل','v':'و','s':'س','sh':'ش','h':'ہ'},
        digraphs: {},
        vowelMatras: {'a':'','aa':'ا','i':'ِ','ii':'ِی','u':'ُ','uu':'ُو','e':'ے','ee':'ے','ai':'َی','o':'و','oo':'و','au':'َو'},
        independentVowels: {'a':'ا','aa':'آ','i':'اِ','ii':'اِی','u':'اُ','uu':'اُو','e':'اے','ee':'اے','ai':'اَی','o':'او','oo':'او','au':'اَو'},
        halant: 'ْ',
        anusvara: 'ں'
    }
};

let dictionaries: Record<string, Record<string, string>> = {
    te: {}, bn: {}, gu: {}, hi: {}, kn: {}, ml: {},
    mr: {}, pa: {}, sd: {}, si: {}, ta: {}, ur: {}
};

// Global dictionaries object for client-side access
if (typeof window !== 'undefined') {
    (window as any).dictionaries = dictionaries;
}

// STEP 1: NORMALIZATION
function normalize(word: string): string {
    return word.toLowerCase()
      .replace(/ph/g, "f")
      .replace(/bh/g, "b")
      .replace(/dh/g, "d")
      .replace(/th/g, "t")
      .replace(/sh/g, "s")
      .replace(/ch/g, "c")
      .replace(/aa/g, "a")
      .replace(/ee/g, "i")
      .replace(/oo/g, "u")
      .replace(/ck/g, "k");
}

function generateVariants(word: string): string[] {
    const variants = new Set<string>();
    const lowerWord = word.toLowerCase();
    variants.add(lowerWord);
    variants.add(normalize(lowerWord));

    // Simple swaps for common phonetic ambiguities
    variants.add(lowerWord.replace(/sh/g, "s"));
    variants.add(lowerWord.replace(/s/g, "sh"));
    variants.add(lowerWord.replace(/aa/g, "a"));
    variants.add(lowerWord.replace(/a/g, "aa"));
    variants.add(lowerWord.replace(/oo/g, "u"));
    variants.add(lowerWord.replace(/u/g, "oo"));

    return Array.from(variants);
}


// Helper functions for rule-based transliteration
function isConsonantStart(ch: string, lang: string) {
    const rules = langRules[lang];
    if (!rules) return false;
    return rules.consonants[ch] || rules.digraphs[ch] || 'kgjtdpbyshmnr'.includes(ch);
}

function isVowelStart(text: string, i: number) {
    if (i >= text.length) return false;
    const ch = text[i];
    if ('aeiou'.includes(ch)) return true;
    if (i + 1 < text.length) {
        const substr = text.substring(i, i + 2);
        return ['aa', 'ii', 'uu', 'ee', 'oo', 'ai', 'au'].includes(substr);
    }
    return false;
}

function matchVowel(text: string, i: number) {
    if (i >= text.length) return '';
    const ch = text[i];
    if (ch === 'a') {
        if (i + 1 < text.length) {
            if (text[i + 1] === 'a') return 'aa';
            if (text[i + 1] === 'i') return 'ai';
            if (text[i + 1] === 'u') return 'au';
        }
        return 'a';
    } else if (ch === 'i') {
        return (i + 1 < text.length && text[i + 1] === 'i') ? 'ii' : 'i';
    } else if (ch === 'u') {
        return (i + 1 < text.length && text[i + 1] === 'u') ? 'uu' : 'u';
    } else if (ch === 'e') {
        return (i + 1 < text.length && text[i + 1] === 'e') ? 'ee' : 'e';
    } else if (ch === 'o') {
        return (i + 1 < text.length && text[i + 1] === 'o') ? 'oo' : 'o';
    }
    return '';
}

// Purely rule-based transliteration engine, used as a fallback.
export function transliterate(text: string, lang: string): string {
    text = text.toLowerCase();
    const rules = langRules[lang];
    if (!rules) return text;
    // Don't check dictionary here, this is the fallback engine.

    let result = '';
    let i = 0;
    while (i < text.length) {
        let vRom = '';
        if (isVowelStart(text, i)) {
            vRom = matchVowel(text, i);
            if (rules.independentVowels[vRom]) {
                result += rules.independentVowels[vRom];
                i += vRom.length;
                if (i < text.length && text[i] === 'm' && (i + 1 >= text.length || isConsonantStart(text[i + 1], lang))) {
                    result += rules.anusvara;
                    i += 1;
                }
                continue;
            }
        }
        let telC = '';
        const digraphKey = text.substring(i, i + 2);
        if (digraphKey.length === 2 && rules.digraphs[digraphKey]) {
            telC = rules.digraphs[digraphKey];
            i += 2;
        } else if (rules.consonants[text[i]]) {
            telC = rules.consonants[text[i]];
            i += 1;
        } else {
            result += text[i];
            i += 1;
            continue;
        }
        vRom = matchVowel(text, i);
        if (vRom) {
            const matra = rules.vowelMatras[vRom];
            telC += matra;
            i += vRom.length;
        }
        const hasVowel = vRom !== '';
        if (!hasVowel && i < text.length && isConsonantStart(text[i], lang)) {
            telC += rules.halant;
        }
        result += telC;
        if (hasVowel && i < text.length && text[i] === 'm' && (i + 1 >= text.length || isConsonantStart(text[i + 1], lang))) {
            result += rules.anusvara;
            i += 1;
        }
    }
    return result;
}

// STEP 4: GARBAGE FILTER
function isValid(word: string): boolean {
    // no more than 2 repeated chars
    return !/(.)\1{2,}/.test(word); 
}

interface Candidate {
    word: string;
    score: number;
    source: 'dictionary' | 'rule' | 'variant';
}

// Main function to get suggestions, incorporating the new strategy.
export function getSuggestions(originalInput: string, lang: string): string[] {
    const dict = (window as any).dictionaries ? (window as any).dictionaries[lang] : {};
    if (!langRules[lang]) return [originalInput]; // Return original if lang not supported
    
    let candidates: Candidate[] = [];
    const lowerInput = originalInput.toLowerCase();

    // STEP 2: MULTI-DICTIONARY LOOKUP
    const variants = generateVariants(lowerInput);
    
    for (const v of variants) {
        if (dict[v]) {
            let score = 200; // Base score for any dictionary match
            if (v === lowerInput) score += 500; // Exact match boost
            else score += 100; // Variant match boost
            candidates.push({ word: dict[v], score, source: 'dictionary' });
        }
    }

    // Add rule-based transliteration as a low-priority candidate
    const ruleBasedResult = transliterate(lowerInput, lang);
    if (ruleBasedResult) {
        candidates.push({ word: ruleBasedResult, score: 50, source: 'rule' });
    }
    
    // Filter out garbage and duplicates
    const seen = new Set<string>();
    const uniqueValidCandidates = candidates.filter(c => {
        if (!isValid(c.word) || seen.has(c.word)) {
            return false;
        }
        seen.add(c.word);
        return true;
    });

    // STEP 3: STRONG RANKING
    uniqueValidCandidates.sort((a, b) => b.score - a.score);

    // STEP 5: TOP 5 SUGGESTIONS
    return uniqueValidCandidates.map(c => c.word).slice(0, 5);
}


export function loadDictionary(file: File, lang: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const jsContent = e.target?.result as string;
            try {
                // This is a controlled environment; we create a function to evaluate the content.
                const varName = `${lang}Dictionary`;
                const fn = new Function(jsContent + `\nreturn typeof ${varName} !== 'undefined' ? ${varName} : null;`);
                const newDict = fn();
                
                if (newDict && typeof newDict === 'object' && !Array.isArray(newDict)) {
                    if(!(window as any).dictionaries) { (window as any).dictionaries = {}; }
                    (window as any).dictionaries[lang] = { ...((window as any).dictionaries[lang] || {}), ...newDict };
                    resolve();
                } else {
                    reject(new Error(`Invalid JS file for ${lang}: No valid dictionary object found named '${varName}'.`));
                }
            } catch (error: any) {
                reject(new Error('Error executing dictionary file: ' + error.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read the dictionary file.'));
        reader.readAsText(file);
    });
}
