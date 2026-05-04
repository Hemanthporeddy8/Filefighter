// src/lib/auth.ts

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

const DB_NAME = 'FileFlowAuthDB';
const STORE_NAME = 'users';

const openAuthDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(new Error("Failed to open auth DB"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'email' });
      }
    };
  });
};

const hashPassword = async (password: string, salt: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const generateSalt = () => {
    return Math.random().toString(36).substring(2, 15);
};

export const signUp = async (email: string, password: string): Promise<User> => {
    const db = await openAuthDB();
    return new Promise(async (resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const checkReq = store.get(email);
        
        checkReq.onsuccess = async () => {
            if (checkReq.result) {
                reject(new Error("User already exists"));
                return;
            }
            const salt = generateSalt();
            const hash = await hashPassword(password, salt);
            const newUser = {
                id: `user-${Date.now()}`,
                email,
                role: 'admin', // Default to admin for this application
                hash,
                salt
            };
            const putReq = store.put(newUser);
            putReq.onsuccess = () => resolve({ id: newUser.id, email: newUser.email, role: 'admin' });
            putReq.onerror = () => reject(new Error("Failed to save user"));
        };
        checkReq.onerror = () => reject(new Error("DB error"));
    });
};

export const signIn = async (email: string, password: string): Promise<User> => {
    const db = await openAuthDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getReq = store.get(email);
        
        getReq.onsuccess = async () => {
            const userRecord = getReq.result;
            if (!userRecord) {
                reject(new Error("User not found"));
                return;
            }
            const inputHash = await hashPassword(password, userRecord.salt);
            if (inputHash === userRecord.hash) {
                resolve({ id: userRecord.id, email: userRecord.email, role: userRecord.role as 'user' | 'admin' });
            } else {
                reject(new Error("Invalid password"));
            }
        };
        getReq.onerror = () => reject(new Error("DB error"));
    });
};
