// src/lib/custom-dictionary-store.ts

const DB_NAME = 'EditroyDictionaryDB';
const STORE_NAME = 'customDictionaries';
const DB_VERSION = 1;

const openDictionaryDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(new Error("Failed to open Dictionary DB"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Store one object per language, where value is a dictionary mapping { phonetic: transliterated }
        db.createObjectStore(STORE_NAME, { keyPath: 'language' });
      }
    };
  });
};

export const getCustomDictionary = async (lang: string): Promise<Record<string, string>> => {
    try {
        const db = await openDictionaryDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const req = store.get(lang);
            req.onsuccess = () => resolve(req.result ? req.result.dictionary : {});
            req.onerror = () => reject(new Error("Failed to read from DB"));
        });
    } catch {
        return {};
    }
};

export const saveCustomWord = async (lang: string, phoneticWord: string, transliteratedWord: string): Promise<{ success: boolean; message: string }> => {
    try {
        const db = await openDictionaryDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getReq = store.get(lang);
            
            getReq.onsuccess = () => {
                const record = getReq.result || { language: lang, dictionary: {} };
                
                const cleanPhonetic = phoneticWord.toLowerCase();
                if (record.dictionary[cleanPhonetic]) {
                    resolve({ success: false, message: `The word "${phoneticWord}" already exists in the custom ${lang} dictionary.` });
                    return;
                }
                
                record.dictionary[cleanPhonetic] = transliteratedWord;
                const putReq = store.put(record);
                putReq.onsuccess = () => resolve({ success: true, message: `Successfully added "${phoneticWord}" to the custom ${lang} dictionary.` });
                putReq.onerror = () => reject(new Error("Failed to save word"));
            };
            getReq.onerror = () => reject(new Error("Failed to read DB"));
        });
    } catch (error: any) {
        return { success: false, message: error.message || 'IndexedDB error' };
    }
};

export const saveCustomDictionaryBatch = async (lang: string, newWords: Record<string, string>): Promise<{ success: boolean; message: string; added: number; skipped: number }> => {
    try {
        const db = await openDictionaryDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getReq = store.get(lang);
            
            getReq.onsuccess = () => {
                const record = getReq.result || { language: lang, dictionary: {} };
                
                let added = 0;
                let skipped = 0;
                
                for (const [phonetic, trans] of Object.entries(newWords)) {
                    const cleanPhonetic = phonetic.toLowerCase();
                    if (!record.dictionary[cleanPhonetic]) {
                        record.dictionary[cleanPhonetic] = Array.isArray(trans) ? trans[0] : trans;
                        added++;
                    } else {
                        skipped++;
                    }
                }
                
                const putReq = store.put(record);
                putReq.onsuccess = () => resolve({ success: true, message: `Successfully added ${added} words to the custom ${lang} dictionary. Skipped ${skipped} duplicates.`, added, skipped });
                putReq.onerror = () => reject(new Error("Failed to save batch"));
            };
            getReq.onerror = () => reject(new Error("Failed to read DB"));
        });
    } catch (error: any) {
        return { success: false, message: error.message || 'IndexedDB error', added: 0, skipped: 0 };
    }
};

export const loadAllCustomDictionariesIntoEngine = async () => {
    try {
        if (typeof window === 'undefined') return;
        if (!(window as any).dictionaries) {
            (window as any).dictionaries = {};
        }

        const db = await openDictionaryDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.getAll();
        
        req.onsuccess = () => {
            const records = req.result;
            for (const record of records) {
                const lang = record.language;
                (window as any).dictionaries[lang] = {
                    ...((window as any).dictionaries[lang] || {}),
                    ...record.dictionary
                };
            }
        };
    } catch (error) {
        console.error("Failed to load custom dictionaries into engine", error);
    }
};
