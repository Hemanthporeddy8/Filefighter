// src/contexts/document-context.tsx
"use client";

import type React from 'react';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { DocumentQueueItem, DocumentSource } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './auth-context';
import { formatDistanceToNow } from 'date-fns';
import { playNotificationSound, playSuccessSound } from '@/lib/audio-player';

const MAX_QUEUE_SIZE = 50;

// IndexedDB setup
const DB_NAME = 'EditroyDB';
const DB_VERSION = 1;
const DOC_STORE_NAME = 'documents';
const POLICY_STORE_NAME = 'settings';
const POLICY_KEY = 'autoDeletePolicy';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(new Error("Failed to open IndexedDB."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DOC_STORE_NAME)) {
        db.createObjectStore(DOC_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(POLICY_STORE_NAME)) {
        db.createObjectStore(POLICY_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};


interface DocumentContextType {
  documents: DocumentQueueItem[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentQueueItem[]>>;
  addDocuments: (newDocs: DocumentQueueItem[], source?: DocumentSource) => void;
  deleteDocument: (docId: string) => void;
  deleteMultipleDocuments: (docIds: string[]) => void;
  updateDocument: (docId: string, updates: Partial<DocumentQueueItem>) => void;
  autoDeletePolicy: string;
  setAutoDeletePolicy: (policy: string) => void;
  qrSessionId: string;
  whatsAppSessionId: string;
  notifications: { id: string; message: string; time: Date; type: 'info' | 'success'; fileCount?: number }[];
  clearNotifications: () => void;
  qrUserStatus: 'live' | 'offline' | 'assembling' | 'completed' | 'unknown';
  isPollingActive: boolean;
  setIsPollingActive: (active: boolean) => void;
  forcePoll: () => void;
  isPolling: boolean;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);
const QR_SESSION_ID_KEY = 'editroy_qr_session_id';
const WA_SESSION_ID_KEY = 'editroy_wa_session_id';

type UploadNotificationState = {
  [key in DocumentSource]?: boolean;
};

function getDocumentType(fileType: string, fileName: string): DocumentQueueItem['type'] {
  const lowerName = fileName.toLowerCase();
  if (fileType.startsWith('application/pdf') || lowerName.endsWith('.pdf')) return 'PDF';
  if (fileType.startsWith('application/msword') || fileType.startsWith('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || lowerName.endsWith('.doc') || lowerName.endsWith('.docx')) return 'Word';
  if (fileType.startsWith('application/vnd.ms-excel') || fileType.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')) return 'Excel';
  if (fileType.startsWith('image/')) return 'Image';
  if (fileType.startsWith('video/')) return 'Video';
  if (fileType.startsWith('application/vnd.ms-powerpoint') || fileType.startsWith('application/vnd.openxmlformats-officedocument.presentationml.presentation') || lowerName.endsWith('.ppt') || lowerName.endsWith('.pptx')) return 'PowerPoint';
  if (fileType.startsWith('text/')) return 'Text';
  return 'PDF';
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const [documents, setDocuments] = useState<DocumentQueueItem[]>([]);
  const [autoDeletePolicy, setAutoDeletePolicyState] = useState('never');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [qrSessionId, setQrSessionId] = useState('');
  const [whatsAppSessionId, setWhatsAppSessionId] = useState('');
  const [notifications, setNotifications] = useState<DocumentContextType['notifications']>([]);
  const [uploadNotified, setUploadNotified] = useState<UploadNotificationState>({});
  const [qrUserStatus, setQrUserStatus] = useState<DocumentContextType['qrUserStatus']>('unknown');
  const [isPollingActive, setIsPollingActive] = useState(true);
  const [isPolling, setIsPolling] = useState(false);



  useEffect(() => {
    if (user?.id) {
        try {
            let storedQrId = localStorage.getItem(QR_SESSION_ID_KEY);
            if (!storedQrId) {
                storedQrId = `session-qr-${user.id}-${Date.now()}`;
                localStorage.setItem(QR_SESSION_ID_KEY, storedQrId);
            }
            setQrSessionId(storedQrId);

            let storedWaId = localStorage.getItem(WA_SESSION_ID_KEY);
             if (!storedWaId) {
                storedWaId = `session-wa-${user.id}`;
                localStorage.setItem(WA_SESSION_ID_KEY, storedWaId);
            }
            setWhatsAppSessionId(storedWaId);
        } catch (error) {
            console.error("Could not access localStorage for session IDs:", error);
            setQrSessionId(`session-qr-${user.id}-${Date.now()}`);
            setWhatsAppSessionId(`session-wa-${user.id}`);
        }
    }
  }, [user?.id]);

  useEffect(() => {
    const loadFromDB = async () => {
        try {
            const db = await openDB();
            const docTransaction = db.transaction(DOC_STORE_NAME, 'readonly');
            const docStore = docTransaction.objectStore(DOC_STORE_NAME);
            const docsReq = docStore.getAll();

            docsReq.onsuccess = () => {
                const docsFromDB: DocumentQueueItem[] = docsReq.result.map((d: any) => ({...d, uploadedAt: new Date(d.uploadedAt)}));
                setDocuments(docsFromDB.sort((a,b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()));
            };

            const settingTransaction = db.transaction(POLICY_STORE_NAME, 'readonly');
            const settingStore = settingTransaction.objectStore(POLICY_STORE_NAME);
            const policyReq = settingStore.get(POLICY_KEY);

            policyReq.onsuccess = () => {
                if (policyReq.result) {
                    setAutoDeletePolicyState(policyReq.result.value);
                }
            };
        } catch (error) {
            console.error("Failed to load data from IndexedDB:", error);
            toast({ title: 'Could not load saved documents', variant: 'destructive'});
        } finally {
            setIsInitialLoad(false);
        }
    };
    loadFromDB();
  }, [toast]);
  


  const addDocuments = useCallback(async (newDocs: DocumentQueueItem[], source: DocumentSource = 'Direct Upload') => {
    // Convert any blob: dataUris to Base64 for persistence in IndexedDB
    const processedDocs = await Promise.all(newDocs.map(async (doc) => {
      if (doc.dataUri?.startsWith('blob:')) {
        try {
          const res = await fetch(doc.dataUri);
          const blob = await res.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          // Revoke the old blob URL only after successful conversion
          URL.revokeObjectURL(doc.dataUri);
          return { ...doc, dataUri: base64 };
        } catch (error) {
          console.error("Failed to convert blob to base64 for doc:", doc.name, error);
          return doc;
        }
      }
      return doc;
    }));

    const enrichedDocs = processedDocs.map(doc => ({
      ...doc,
      id: doc.id || `doc-${doc.name}-${Date.now()}`,
      source,
      senderContact: source === 'Direct Upload' ? (user?.email || 'user@editroy.com') : doc.senderContact,
      senderSessionId: source === 'QR Upload' ? qrSessionId : undefined,
    }));

    try {
        const db = await openDB();
        const transaction = db.transaction(DOC_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(DOC_STORE_NAME);
        enrichedDocs.forEach(doc => store.put(doc));
        
        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });

        setDocuments((prevDocs: DocumentQueueItem[]) => {
            const combined = [...enrichedDocs, ...prevDocs];
            if (combined.length > MAX_QUEUE_SIZE) {
                toast({
                    title: "Queue Limit Reached",
                    description: `The oldest ${combined.length - MAX_QUEUE_SIZE} document(s) will be removed.`,
                    variant: "default"
                });
                const docsToDelete = combined.slice(MAX_QUEUE_SIZE);
                const deleteTransaction = db.transaction(DOC_STORE_NAME, 'readwrite');
                const deleteStore = deleteTransaction.objectStore(DOC_STORE_NAME);
                docsToDelete.forEach((d: DocumentQueueItem) => deleteStore.delete(d.id));
            }
            const finalDocs = combined.slice(0, MAX_QUEUE_SIZE).sort((a: DocumentQueueItem, b: DocumentQueueItem) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
            return finalDocs;
        });
    } catch (error) {
        console.error("Failed to save documents to IndexedDB", error);
        toast({ title: "Failed to save documents", variant: "destructive" });
    }
  }, [toast, user, qrSessionId]);
  
  const deleteDocument = useCallback(async (docId: string) => {
    try {
        const db = await openDB();
        const transaction = db.transaction(DOC_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(DOC_STORE_NAME);
        store.delete(docId);
        
        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        setDocuments((prevDocs: DocumentQueueItem[]) => prevDocs.filter((doc: DocumentQueueItem) => doc.id !== docId));
    } catch (error) {
        console.error("Failed to delete document from IndexedDB", error);
        toast({ title: "Failed to delete document", variant: "destructive" });
    }
  }, [toast]);
  
  const deleteMultipleDocuments = useCallback(async (docIds: string[]) => {
    if (docIds.length === 0) return;
    try {
        const db = await openDB();
        const transaction = db.transaction(DOC_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(DOC_STORE_NAME);
        docIds.forEach(id => store.delete(id));
        
        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        setDocuments((prevDocs: DocumentQueueItem[]) => prevDocs.filter((doc: DocumentQueueItem) => !docIds.includes(doc.id)));
    } catch (error) {
        console.error("Failed to delete multiple documents from IndexedDB", error);
        toast({ title: "Failed to delete documents", variant: "destructive" });
    }
  }, [toast]);

  const updateDocument = useCallback(async (docId: string, updates: Partial<DocumentQueueItem>) => {
    setDocuments((prevDocs: DocumentQueueItem[]) => {
        const updatedDocs = prevDocs.map((doc: DocumentQueueItem) =>
            doc.id === docId ? { ...doc, ...updates, status: 'Edited' as const, uploadedAt: new Date() } : doc
        );

        const docToUpdate = updatedDocs.find(d => d.id === docId);
        if (docToUpdate) {
            openDB().then(db => {
                const transaction = db.transaction(DOC_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(DOC_STORE_NAME);
                store.put(docToUpdate);
            }).catch(error => console.error("Failed to update doc in DB:", error));
        }
        return updatedDocs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    });
  }, []);

  const setAutoDeletePolicy = useCallback(async (policy: string) => {
    setAutoDeletePolicyState(policy);
     try {
        const db = await openDB();
        const transaction = db.transaction(POLICY_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(POLICY_STORE_NAME);
        store.put({ id: POLICY_KEY, value: policy });
    } catch (error) {
        console.error("Failed to save auto-delete policy", error);
    }
  }, []);
  
  const clearNotifications = useCallback(() => setNotifications([]), []);
  
  // This effect pings the server to keep the QR session alive.
  useEffect(() => {
      if (!isPollingActive || !qrSessionId) return;

      const ping = () => {
          try {
              const formData = new FormData();
              formData.append('sessionId', qrSessionId);
              navigator.sendBeacon('/api/ping', formData);
          } catch (error) {
              console.error('Failed to send beacon:', error);
          }
      };

      ping();
      const intervalId = setInterval(ping, 15000);
      return () => clearInterval(intervalId);
  }, [qrSessionId, isPollingActive]);

  const pollForFiles = useCallback(async (sessionId: string, source: DocumentSource, signal: AbortSignal) => {
    if (!sessionId || signal.aborted) return;
    try {
      const response = await fetch(`/api/poll?sessionId=${sessionId}`, { signal });
      if (!response.ok) {
          if (source === 'QR Upload') setQrUserStatus('offline');
          return;
      }

      const data = await response.json();
      
      if (source === 'QR Upload') {
          setQrUserStatus(data.status || 'offline');
      }
      
      if (data.status === 'completed' && data.files && data.files.length > 0) {
          const newDocs: DocumentQueueItem[] = data.files.map((file: any) => ({
              id: `doc-${file.name}-${Date.now()}-${Math.random()}`,
              name: file.name,
              type: getDocumentType(file.type, file.name),
              status: 'Queued',
              uploadedAt: new Date(),
              size: formatFileSize(file.size),
              source: source,
              senderSessionId: sessionId,
              senderContact: file.senderName || 'Anonymous',
              dataUri: file.dataUri,
          }));
          addDocuments(newDocs, source);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(`Polling error for ${source}:`, error);
      }
    }
  }, [addDocuments]);

  const forcePoll = useCallback(async () => {
      if (isPolling) return;
      setIsPolling(true);
      toast({ title: 'Refreshing...', description: 'Checking for new documents.' });
      
      if (qrSessionId) {
          await pollForFiles(qrSessionId, 'QR Upload', new AbortController().signal);
      }

      setTimeout(() => {
        setIsPolling(false);
        toast({ title: 'Queue is up to date.' });
      }, 500);
  }, [isPolling, qrSessionId, pollForFiles, toast]);


  // This effect handles polling for new files from QR Upload.
  useEffect(() => {
    if (!isPollingActive || !qrSessionId) {
        if (!isPollingActive) setQrUserStatus('offline');
        return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    
    const intervalId = setInterval(() => {
        pollForFiles(qrSessionId, 'QR Upload', signal);
    }, 3000);

    return () => {
      clearInterval(intervalId);
      controller.abort();
    };
  }, [isPollingActive, qrSessionId, whatsAppSessionId, pollForFiles]);

  useEffect(() => {
    if (isInitialLoad) return;

    const checkAndDelete = () => {
        if (autoDeletePolicy === 'never') return;
        
        const now = new Date();
        let policyMillis: number;
        
        if (autoDeletePolicy.endsWith('m')) {
            policyMillis = Number(autoDeletePolicy.slice(0, -1)) * 60 * 1000;
        } else if (autoDeletePolicy.endsWith('h')) {
            policyMillis = Number(autoDeletePolicy.slice(0, -1)) * 60 * 60 * 1000;
        } else if (autoDeletePolicy === '1') {
            policyMillis = 24 * 60 * 60 * 1000;
        } else {
            return; // Unknown or 'never'
        }

        if (isNaN(policyMillis) || policyMillis <= 0) return;
        
        const docsToDelete = documents.filter(doc => (now.getTime() - new Date(doc.uploadedAt).getTime()) > policyMillis);

        if (docsToDelete.length > 0) {
            deleteMultipleDocuments(docsToDelete.map((d: DocumentQueueItem) => d.id));
            toast({
              title: 'Auto-deletion Applied',
              description: `${docsToDelete.length} old document(s) were removed from the queue.`,
            });
        }
    };

    const intervalId = setInterval(checkAndDelete, 60000); // Check every minute
    checkAndDelete(); // Initial check

    return () => clearInterval(intervalId);
  }, [autoDeletePolicy, documents, isInitialLoad, deleteMultipleDocuments, toast]);

  const value = {
    documents,
    setDocuments,
    addDocuments,
    deleteDocument,
    deleteMultipleDocuments,
    updateDocument,
    autoDeletePolicy,
    setAutoDeletePolicy,
    qrSessionId,
    whatsAppSessionId,
    notifications,
    clearNotifications,
    qrUserStatus,
    isPollingActive,
    setIsPollingActive,
    forcePoll,
    isPolling,
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocumentQueue() {
  const context = useContext(DocumentContext);
  if (context === undefined) {
    throw new Error('useDocumentQueue must be used within a DocumentProvider');
  }
  return context;
}
