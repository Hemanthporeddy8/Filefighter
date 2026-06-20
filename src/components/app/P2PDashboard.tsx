"use client";

import React, { useState, useEffect, useRef } from 'react';

// STUN/TURN ICE Servers
const ICE_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    {
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

// Default Backend URL configuration
const DEFAULT_API_BASE = 'https://fileshare-qhgn.onrender.com';
const DEFAULT_SIG = 'wss://fileshare-qhgn.onrender.com/ws';

interface P2PDashboardProps {
  apiBase?: string;
  sigServer?: string;
  onLogout?: (() => void) | null;
}

export default function P2PDashboard({
  apiBase = DEFAULT_API_BASE,
  sigServer = DEFAULT_SIG,
  onLogout = null
}: P2PDashboardProps) {
  // Authentication & Room Code state
  const [code, setCode] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [isPermanent, setIsPermanent] = useState<boolean>(false);

  // Room Plan / Subscription Status
  const [planMode, setPlanMode] = useState<string>('Standard'); // 'Standard', 'Free Trial', 'Premium'
  const [trialDays, setTrialDays] = useState<number | null>(null);

  // Connection & UI states
  const [connStatus, setConnStatus] = useState<string>('connecting'); // 'connecting', 'connected', 'reconnecting', 'disconnected'
  const [connectedPeersCount, setConnectedPeersCount] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('Connecting to signaling server...');
  const [timerText, setTimerText] = useState<string>('0s');

  // Real-time transfer data
  const [filesList, setFilesList] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [zipping, setZipping] = useState<boolean>(false);

  // Settings
  const [alwaysAwake, setAlwaysAwake] = useState<boolean>(false);
  const [autoAccept, setAutoAccept] = useState<boolean>(false);

  // Modal Previews
  const [previewFile, setPreviewFile] = useState<any | null>(null);

  // WebRTC / WebSocket persistence refs
  const inboxWsRef = useRef<WebSocket | null>(null);
  const inboxPeersRef = useRef<Map<string, any>>(new Map()); // senderId -> { pc, dc, pIce, activeFileId }
  const filesRef = useRef<Map<string, any>>(new Map()); // fileId -> { id, name, size, mimeType, chunks, blob, status, etc. }
  const acceptedBatchesRef = useRef<Record<string, boolean>>({});
  const wakeLockRef = useRef<any>(null);
  const logTimerRef = useRef<any>(null);
  const logSecondsRef = useRef<number>(0);

  // Load credentials on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('fs_auth_token') || '';
    const savedCode = localStorage.getItem('fs_auth_code') || '';
    setToken(savedToken);
    setCode(savedCode);
    setIsPermanent(!!savedToken && !!savedCode);

    // Clean up temporary OPFS files on start to reclaim space
    if (typeof window !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
      (navigator.storage as any).getDirectory().then(async (root: any) => {
        try {
          for await (const name of root.keys()) {
            if (name.startsWith('f_')) {
              await root.removeEntry(name).catch(() => {});
            }
          }
        } catch (e) {
          console.warn('Failed to clean up old OPFS files:', e);
        }
      }).catch(() => {});
    }

    if (savedCode) {
      checkPlanStatus(savedCode, !!savedToken);
      startInbox(savedCode, savedToken);
    } else {
      setConnStatus('disconnected');
      setStatusText('No active session. Please open or register an inbox.');
    }

    return () => {
      stopSessionTimer();
      cleanupAllConnections();
      releaseWakeLock();
    };
  }, []);

  // Room status check
  const checkPlanStatus = (roomCode: string, isPerm: boolean) => {
    if (!isPerm) {
      setPlanMode('Standard');
      return;
    }
    fetch(`${apiBase}/api/auth/room-status/${roomCode}`)
      .then(r => r.json())
      .then(d => {
        if (d.isPremium) {
          setPlanMode('Premium');
        } else if (d.hasTrial) {
          setPlanMode('Free Trial');
          setTrialDays(d.trialDaysRemaining);
        } else {
          setPlanMode('Standard');
        }
      })
      .catch(err => {
        console.warn('Failed to fetch room status:', err);
        setPlanMode('Standard');
      });
  };

  // Timer trackers
  const startSessionTimer = () => {
    stopSessionTimer();
    logSecondsRef.current = 0;
    setTimerText('0s');
    logTimerRef.current = setInterval(() => {
      logSecondsRef.current += 1;
      setTimerText(logSecondsRef.current + 's');
    }, 1000);
  };

  const stopSessionTimer = () => {
    if (logTimerRef.current) {
      clearInterval(logTimerRef.current);
      logTimerRef.current = null;
    }
  };

  // Connection cleaners
  const cleanupAllConnections = () => {
    if (inboxWsRef.current) {
      inboxWsRef.current.onclose = null;
      inboxWsRef.current.onerror = null;
      inboxWsRef.current.close();
      inboxWsRef.current = null;
    }
    inboxPeersRef.current.forEach(p => {
      if (p.dc) p.dc.close();
      if (p.pc) p.pc.close();
    });
    inboxPeersRef.current.clear();
    setConnectedPeersCount(0);
  };

  const cleanupPeer = (senderId: string) => {
    const peer = inboxPeersRef.current.get(senderId);
    if (peer) {
      if (peer.dc) peer.dc.close();
      if (peer.pc) peer.pc.close();
      inboxPeersRef.current.delete(senderId);
      updateConnectedPeersCount();
    }
  };

  const updateConnectedPeersCount = () => {
    const active = Array.from(inboxPeersRef.current.values()).filter(
      p => p.pc && p.pc.connectionState !== 'closed'
    ).length;
    setConnectedPeersCount(active);
  };

  // Start WebSocket Receiver
  const startInbox = (roomCode: string, authToken: string) => {
    startSessionTimer();
    setConnStatus('connecting');
    setStatusText('Connecting to signaling server...');

    const tokenQuery = authToken ? `&token=${authToken}` : '';
    const socket = new WebSocket(`${sigServer}?code=${roomCode}&role=inbox${tokenQuery}`);
    inboxWsRef.current = socket;

    socket.onopen = () => {
      setConnStatus('connected');
      setStatusText('Dashboard live — waiting for senders…');
    };

    socket.onmessage = async ({ data }) => {
      try {
        const m = JSON.parse(data);
        const senderId = m.senderId;

        if (m.type === 'peer-joined') {
          setupPeer(roomCode, senderId);
        } else if (m.type === 'offer') {
          let peer = inboxPeersRef.current.get(senderId);
          if (!peer) {
            peer = setupPeer(roomCode, senderId);
          }
          const pc = peer.pc;
          await pc.setRemoteDescription(m.sdp).catch(() => {});
          const ans = await pc.createAnswer().catch(() => null);
          if (!ans) return;
          await pc.setLocalDescription(ans).catch(() => {});
          socket.send(
            JSON.stringify({
              type: 'answer',
              sdp: pc.localDescription,
              targetSenderId: senderId
            })
          );
        } else if (m.type === 'ice') {
          const peer = inboxPeersRef.current.get(senderId);
          if (peer && peer.pc) {
            if (peer.pc.remoteDescription) {
              try {
                await peer.pc.addIceCandidate(m.candidate);
              } catch {}
            } else {
              peer.pIce.push(m.candidate);
            }
          }
        } else if (m.type === 'peer-left') {
          cleanupPeer(senderId);
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      if (inboxWsRef.current !== null) {
        setConnStatus('reconnecting');
        setStatusText('Dashboard disconnected. Reconnecting...');
        setTimeout(() => {
          if (inboxWsRef.current !== null) {
            startInbox(roomCode, authToken);
          }
        }, 3000);
      } else {
        setConnStatus('disconnected');
        setStatusText('Dashboard disconnected.');
        stopSessionTimer();
      }
    };

    socket.onerror = () => {
      setStatusText('Error connecting to signal server.');
      stopSessionTimer();
    };
  };

  // WebRTC Peer setup
  const setupPeer = (roomCode: string, senderId: string) => {
    if (inboxPeersRef.current.has(senderId)) {
      cleanupPeer(senderId);
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    const peer = {
      pc,
      dc: null as RTCDataChannel | null,
      pIce: [] as any[],
      activeFileId: null as string | null
    };

    inboxPeersRef.current.set(senderId, peer);
    updateConnectedPeersCount();

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && inboxWsRef.current && inboxWsRef.current.readyState === 1) {
        inboxWsRef.current.send(
          JSON.stringify({
            type: 'ice',
            candidate,
            targetSenderId: senderId
          })
        );
      }
    };

    pc.ondatachannel = ({ channel }) => {
      peer.dc = channel;
      peer.dc.binaryType = 'arraybuffer';

      peer.pIce.forEach(async c => {
        try {
          await pc.addIceCandidate(c);
        } catch {}
      });
      peer.pIce = [];

      channel.onmessage = e => {
        const d = e.data;
        if (typeof d === 'string') {
          const msg = JSON.parse(d);
          if (msg.type === 'meta') {
            const fileId = 'f_' + Math.random().toString(36).substr(2, 9).toUpperCase();
            const newFile = {
              id: fileId,
              senderId,
              name: msg.name,
              size: msg.size,
              mimeType: msg.mimeType,
              nickname: msg.nickname,
              batchId: msg.batchId,
              batchIndex: msg.batchIndex,
              batchCount: msg.batchCount,
              printSettings: msg.printSettings,
              status: 'waiting',
              ratio: 0,
              speed: 0,
              eta: 0,
              accepted: false,
              blob: null as Blob | null
            };

            const hasOPFS = typeof window !== 'undefined' && !!(navigator.storage && (navigator.storage as any).getDirectory);
            filesRef.current.set(fileId, {
              ...newFile,
              chunks: [] as any[],
              lT: 0,
              lR: 0,
              hasOPFS,
              opfsHandle: null as any,
              opfsWritable: null as any,
              useMemoryFallback: !hasOPFS,
              receivedBytes: 0
            });
            peer.activeFileId = fileId;

            setFilesList(prev => [newFile, ...prev]);

            // Auto accept if checked
            if (autoAccept || (msg.batchId && acceptedBatchesRef.current[msg.batchId])) {
              acceptFile(fileId);
            }
          } else if (msg.type === 'done') {
            const fileId = peer.activeFileId;
            if (!fileId) return;
            const fileData = filesRef.current.get(fileId);
            if (fileData) {
              const finalizeFile = async () => {
                if (fileData.opfsPromise) {
                  await fileData.opfsPromise;
                }

                let assembledBlob: Blob;
                if (fileData.opfsWritable && !fileData.useMemoryFallback) {
                  try {
                    await fileData.opfsWritable.close();
                    fileData.opfsWritable = null;
                    assembledBlob = await fileData.opfsHandle.getFile();
                  } catch (err) {
                    console.error('Failed to finalize OPFS file, reverting to RAM:', err);
                    assembledBlob = new Blob(fileData.chunks, {
                      type: fileData.mimeType || 'application/octet-stream'
                    });
                  }
                } else {
                  assembledBlob = new Blob(fileData.chunks, {
                    type: fileData.mimeType || 'application/octet-stream'
                  });
                }

                fileData.blob = assembledBlob;
                fileData.status = 'completed';
                fileData.ratio = 1;
                fileData.chunks = []; // Clear chunks to release memory

                updateFileProgress(fileId, 'completed', 1, 0, 0, assembledBlob);
              };

              finalizeFile();
            }
            peer.activeFileId = null;
          }
        } else {
          // ArrayBuffer chunk
          const fileId = peer.activeFileId;
          if (!fileId) return;
          const fileData = filesRef.current.get(fileId);
          if (fileData) {
            if (!fileData.lT) fileData.lT = Date.now();

            const processChunk = async (chunkData: ArrayBuffer) => {
              if (fileData.opfsPromise) {
                await fileData.opfsPromise;
              }

              if (fileData.opfsWritable && !fileData.useMemoryFallback) {
                try {
                  await fileData.opfsWritable.write(chunkData);
                  fileData.receivedBytes += chunkData.byteLength;
                } catch (writeErr) {
                  console.error('OPFS write error, switching to RAM fallback:', writeErr);
                  fileData.useMemoryFallback = true;
                  fileData.chunks.push(chunkData);
                  fileData.receivedBytes += chunkData.byteLength;
                }
              } else {
                fileData.chunks.push(chunkData);
                fileData.receivedBytes = fileData.chunks.reduce((acc: number, c: any) => acc + c.byteLength, 0);
              }

              const receivedBytes = fileData.receivedBytes;
              const now = Date.now();
              const dt = now - fileData.lT;

              if (dt >= 400) {
                fileData.speed = ((receivedBytes - fileData.lR) / dt) * 1000;
                fileData.lR = receivedBytes;
                fileData.lT = now;
              }

              const eta = fileData.speed > 0 ? Math.round((fileData.size - receivedBytes) / fileData.speed) : 0;
              fileData.ratio = receivedBytes / fileData.size;

              updateFileProgress(fileId, 'downloading', fileData.ratio, fileData.speed, eta);
            };

            processChunk(d);
          }
        }
      };

      channel.onclose = () => {
        const fileId = peer.activeFileId;
        if (fileId) {
          const fileData = filesRef.current.get(fileId);
          if (fileData && fileData.status !== 'completed') {
            fileData.status = 'disconnected';
            updateFileProgress(fileId, 'disconnected', null, 0, 0);
          }
        }
      };
    };

    return peer;
  };

  const updateFileProgress = (fileId: string, status: string, ratio: number | null, speed: number, eta: number, blob: Blob | null = null) => {
    setFilesList(prev =>
      prev.map(f => {
        if (f.id === fileId) {
          const updated = { ...f, status, ratio, speed, eta };
          if (blob) updated.blob = blob;
          return updated;
        }
        return f;
      })
    );
  };

  // Manual Trigger Reconnect
  const reconnectInbox = () => {
    if (!code) return;
    cleanupAllConnections();
    startInbox(code, token);
  };

  // Actions
  const acceptFile = (fileId: string) => {
    const fileData = filesRef.current.get(fileId);
    if (!fileData) return;

    const peer = inboxPeersRef.current.get(fileData.senderId);
    if (peer && peer.dc && peer.dc.readyState === 'open') {
      fileData.accepted = true;
      fileData.status = 'downloading';

      // Initialize OPFS if supported and not already initialized
      if (fileData.hasOPFS && !fileData.opfsPromise) {
        fileData.opfsPromise = (async () => {
          try {
            const root = await (navigator.storage as any).getDirectory();
            const fileHandle = await root.getFileHandle(fileId, { create: true });
            fileData.opfsHandle = fileHandle;
            fileData.opfsWritable = await fileHandle.createWritable();
          } catch (err) {
            console.error('Failed to initialize OPFS storage, falling back to RAM:', err);
            fileData.useMemoryFallback = true;
          }
        })();
      }

      peer.dc.send(JSON.stringify({ type: 'accept' }));

      updateFileProgress(fileId, 'downloading', 0, 0, 0);

      if (fileData.batchId) {
        acceptedBatchesRef.current[fileData.batchId] = true;
      }
    }
  };

  const rejectFile = (fileId: string) => {
    const fileData = filesRef.current.get(fileId);
    if (!fileData) return;

    // Clean up temporary OPFS file if it was created
    if (fileData.opfsHandle) {
      if (typeof window !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
        (navigator.storage as any).getDirectory().then(async (root: any) => {
          try {
            await root.removeEntry(fileId).catch(() => {});
          } catch (e) {}
        }).catch(() => {});
      }
    }

    const peer = inboxPeersRef.current.get(fileData.senderId);
    if (peer) {
      if (peer.dc && peer.dc.readyState === 'open') {
        peer.dc.send(JSON.stringify({ type: 'reject' }));
        peer.dc.close();
      }
      cleanupPeer(fileData.senderId);
    }
    setFilesList(prev => prev.filter(f => f.id !== fileId));
    filesRef.current.delete(fileId);
  };

  const deleteInboxFile = (fileId: string) => {
    const fileData = filesRef.current.get(fileId);
    if (fileData && fileData.opfsHandle) {
      if (typeof window !== 'undefined' && navigator.storage && (navigator.storage as any).getDirectory) {
        (navigator.storage as any).getDirectory().then(async (root: any) => {
          try {
            await root.removeEntry(fileId).catch(() => {});
          } catch (e) {}
        }).catch(() => {});
      }
    }

    filesRef.current.delete(fileId);
    setFilesList(prev => prev.filter(f => f.id !== fileId));
    setSelectedFiles(prev => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
  };

  const downloadInboxFile = (fileId: string) => {
    const fileData = filesRef.current.get(fileId);
    if (!fileData || !fileData.blob) return;

    const url = URL.createObjectURL(fileData.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // Batch actions
  const toggleSelectFile = (fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const toggleSelectAllFiles = (checked: boolean) => {
    if (checked) {
      const completedIds = filesList.filter(f => f.status === 'completed').map(f => f.id);
      setSelectedFiles(new Set(completedIds));
    } else {
      setSelectedFiles(new Set());
    }
  };

  const downloadSelectedFiles = () => {
    let delay = 0;
    filesList.forEach(f => {
      if (selectedFiles.has(f.id) && f.blob) {
        setTimeout(() => {
          downloadInboxFile(f.id);
        }, delay);
        delay += 250;
      }
    });
  };

  const zipSelectedFiles = async () => {
    const list = filesList.filter(f => selectedFiles.has(f.id) && f.blob);
    if (list.length === 0) return;

    setZipping(true);
    try {
      const zipBlob = await generateZipBlob(list);
      const dateString = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `editroy_inbox_${dateString}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Error zipping files:', err);
    } finally {
      setZipping(false);
    }
  };

  // Zip Generator logic
  const generateZipBlob = async (files: any[]) => {
    const crcTable = (window as any).crcTable || ((window as any).crcTable = (() => {
      const table = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
          c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c;
      }
      return table;
    })());

    function getCrc32(arr: Uint8Array) {
      let crc = 0 ^ (-1);
      for (let i = 0; i < arr.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ arr[i]) & 0xff];
      }
      return (crc ^ (-1)) >>> 0;
    }

    const parts = [];
    const cdParts = [];
    let currentOffset = 0;

    const d = new Date();
    const dosTime = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f);
    const dosDate = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);

    for (const f of files) {
      const nameBytes = new TextEncoder().encode(f.name);
      const ab = await f.blob.arrayBuffer();
      const dataBytes = new Uint8Array(ab);
      const crc = getCrc32(dataBytes);
      const size = dataBytes.length;

      const lfh = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(lfh.buffer);

      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 10, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, dosTime, true);
      view.setUint16(12, dosDate, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, size, true);
      view.setUint32(22, size, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
      lfh.set(nameBytes, 30);

      parts.push(lfh);
      parts.push(dataBytes);

      const cdh = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(cdh.buffer);

      cdView.setUint32(0, 0x02014b50, true);
      cdView.setUint16(4, 20, true);
      cdView.setUint16(6, 10, true);
      cdView.setUint16(8, 0, true);
      cdView.setUint16(10, 0, true);
      cdView.setUint16(12, dosTime, true);
      cdView.setUint16(14, dosDate, true);
      cdView.setUint32(16, crc, true);
      cdView.setUint32(20, size, true);
      cdView.setUint32(24, size, true);
      cdView.setUint16(28, nameBytes.length, true);
      cdView.setUint16(30, 0, true);
      cdView.setUint16(32, 0, true);
      cdView.setUint16(34, 0, true);
      cdView.setUint16(36, 0, true);
      cdView.setUint32(38, 0, true);
      cdView.setUint32(42, currentOffset, true);
      cdh.set(nameBytes, 46);

      cdParts.push(cdh);
      currentOffset += lfh.length + size;
    }

    const cdOffset = currentOffset;
    let cdSize = 0;
    for (const part of cdParts) {
      cdSize += part.length;
    }

    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);

    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, files.length, true);
    eocdView.setUint16(10, files.length, true);
    eocdView.setUint32(12, cdSize, true);
    eocdView.setUint32(16, cdOffset, true);
    eocdView.setUint16(20, 0, true);

    const allParts = [...parts, ...cdParts, eocd];
    return new Blob(allParts, { type: 'application/zip' });
  };

  // Custom Printing implementation
  const printInboxFile = (fileId: string) => {
    const f = filesList.find(item => item.id === fileId);
    if (!f || !f.blob) return;

    const mime = f.mimeType || '';
    const url = URL.createObjectURL(f.blob);

    if (mime.startsWith('image/') || mime.startsWith('text/') || mime === 'application/pdf') {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
            } else {
              throw new Error('No content window');
            }
          } catch (e) {
            const win = window.open(url, '_blank');
            if (win) win.print();
          }
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
          }, 1000);
        }, 500);
      };

      if (mime === 'application/pdf' || mime.startsWith('text/')) {
        iframe.src = url;
      } else {
        iframe.srcdoc = `
          <html>
            <body style="margin:0; display:flex; align-items:center; justify-content:center;">
              <img src="${url}" style="max-width:100%; max-height:100%; object-fit:contain;" />
            </body>
          </html>
        `;
      }
    } else {
      const win = window.open(url, '_blank');
      if (win) {
        win.onload = () => {
          win.print();
        };
      }
    }
  };

  // Print QR Flyer
  const printQRFlyer = () => {
    if (!code) return;
    const url = `${window.location.origin}${window.location.pathname}?inbox=${code}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(url)}`;
    
    const flyWin = window.open('', '_blank');
    if (!flyWin) {
      alert('Popup blocked. Please allow popups to print flyer.');
      return;
    }

    let adBlockHTML = '';
    if (planMode === 'Premium') {
      adBlockHTML = `
        <div class="flyer-ad-placeholder">
          <div style="font-size: 0.62rem; color: #22d3ee; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.35rem; font-weight: 600;">Custom Advertisement / Sponsor Space</div>
          <div class="ad-content" style="border: 1.5px dashed #22d3ee; border-radius: 8px; padding: 0.8rem; background: #fafafc; text-align: center;">
            <div style="font-size: 0.85rem; font-weight: 800; color: #333344; text-transform: uppercase; letter-spacing: 0.05em;">[ Your Sponsor Ad / Logo Here ]</div>
            <div style="font-size: 0.65rem; color: #777788; margin-top: 0.2rem;">Premium Member Option — Edit this card to display your own business or sponsor logo!</div>
          </div>
        </div>
      `;
    } else {
      adBlockHTML = `
        <div class="flyer-ad-placeholder">
          <div style="font-size: 0.62rem; color: #888899; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.35rem; font-weight: 600;">Sponsored Advertisement</div>
          <div class="ad-content" style="border: 1.5px dashed #a0a0b0; border-radius: 8px; padding: 0.8rem; background: #f4f4f8; text-align: center;">
            <div style="font-size: 0.85rem; font-weight: 800; color: #333344; text-transform: uppercase; letter-spacing: 0.05em;">FileShare Ads</div>
            <div style="font-size: 0.65rem; color: #777788; margin-top: 0.2rem;">Want to print your own sponsor logo here? Upgrade to Premium!</div>
          </div>
        </div>
      `;
    }

    flyWin.document.write(`
      <html>
        <head>
          <title>Express Permanent Share QR Flyer - ${code}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=Syne:wght@700;800&display=swap');
            body { font-family: 'Outfit', sans-serif; margin: 0; padding: 3rem; text-align: center; color: #0d0d1a; background: #ffffff; }
            .container { border: 3px double #0d0d1a; border-radius: 20px; padding: 2.5rem; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            h1 { font-family: 'Syne', sans-serif; font-size: 2.6rem; font-weight: 800; margin: 0 0 0.5rem 0; text-transform: uppercase; }
            p.sub { font-size: 1.1rem; color: #555566; margin-bottom: 2rem; }
            .qr-box { margin: 2rem 0; display: inline-block; padding: 1rem; border: 1px solid #e0e0e8; border-radius: 12px; }
            .qr-box img { display: block; width: 320px; height: 320px; }
            .code-label { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; color: #777788; margin-bottom: 0.2rem; }
            .code-val { font-family: monospace; font-size: 2.2rem; font-weight: 800; letter-spacing: 0.2em; color: #0d0d1a; background: #f4f4f8; display: inline-block; padding: 0.3rem 1rem; border-radius: 8px; margin-bottom: 2rem; }
            .instructions { text-align: left; max-width: 480px; margin: 0 auto; background: #f8f8fb; border-radius: 12px; padding: 1.25rem 1.5rem; }
            .step { display: flex; gap: 0.75rem; margin-bottom: 0.8rem; font-size: 0.95rem; color: #333344; }
            .flyer-ad-placeholder { margin-top: 1.5rem; border-top: 1.5px dashed #cbcbd6; padding-top: 1rem; max-width: 480px; margin: 1.5rem auto 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>FileShare</h1>
            <p class="sub">Direct Peer-to-Peer Drop Zone</p>
            <div class="qr-box">
              <img src="${qrUrl}" alt="Flyer QR Code" />
            </div>
            <div class="code-label">Room Code</div>
            <div class="code-val">${code}</div>
            <div class="instructions">
              <div class="step"><div>1.</div><div>Scan the QR code or visit <strong>${url}</strong> on your phone.</div></div>
              <div class="step"><div>2.</div><div>Choose files or take photos you want to send.</div></div>
              <div class="step"><div>3.</div><div>Tap Send. Files stream directly to this dashboard!</div></div>
            </div>
            ${adBlockHTML}
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    flyWin.document.close();
  };

  // Keep Awake (Wake Lock)
  const handleAlwaysAwake = async (checked: boolean) => {
    setAlwaysAwake(checked);
    if (checked) {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.warn('Wake Lock request failed:', err);
        }
      }
    } else {
      releaseWakeLock();
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // Helper formats
  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getMimeIcon = (mimeType: string) => {
    if (!mimeType) return '📁';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.startsWith('text/') || mimeType.includes('pdf') || mimeType.includes('document')) return '📄';
    return '📁';
  };

  // Inline styling provider that mimics CSS variables
  const rootVars: any = {
    '--a': '#22d3ee',
    '--ad': 'rgba(34,211,238,.1)',
    '--ag': 'rgba(34,211,238,.2)',
    '--s': '#0d0d1a',
    '--b': 'rgba(255,255,255,0.06)',
    '--bh': 'rgba(255,255,255,0.12)',
    '--r': '12px',
    '--rl': '16px',
    '--t': '#ffffff',
    '--m': '#888899',
    '--m2': '#555566',
    '--ok': '#10b981',
    '--okd': 'rgba(16,185,129,0.1)',
    '--wn': '#fbbf24',
    '--wnd': 'rgba(251,191,36,0.1)',
    '--er': '#ef4444',
    '--erd': 'rgba(239,68,68,0.1)'
  };

  // Mode badge components
  const getBadgeStyleAndText = () => {
    switch (connStatus) {
      case 'connected':
        return {
          class: 'bdg bok',
          text: ` Live Dashboard · ${connectedPeersCount} connected`,
          color: '#10b981',
          bg: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.2)'
        };
      case 'reconnecting':
        return {
          class: 'bdg bwn',
          text: ' Reconnecting...',
          color: '#fbbf24',
          bg: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.2)'
        };
      case 'disconnected':
        return {
          class: 'bdg bwn',
          text: ' Disconnected',
          color: '#ef4444',
          bg: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)'
        };
      default:
        return {
          class: 'bdg binf',
          text: ' Connecting...',
          color: '#22d3ee',
          bg: 'rgba(34,211,238,0.1)',
          border: '1px solid rgba(34,211,238,0.2)'
        };
    }
  };

  const badge = getBadgeStyleAndText();
  const dropLink = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?inbox=${code}` : '';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(dropLink)}`;

  // Title render details
  const displayTitle = isPermanent
    ? planMode === 'Premium'
      ? 'Express Permanent Share Mode (Premium)'
      : planMode === 'Free Trial'
      ? `Express Permanent Share Mode (Free Trial: ${trialDays || 0}d remaining)`
      : 'Express Permanent Share Mode (Standard)'
    : 'Create Inbox (Standard)';

  return (
    <div
      style={{
        ...rootVars,
        display: 'flex',
        gap: '1.5rem',
        justifyContent: 'center',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        width: '100%',
        maxWidth: '1000px',
        margin: '0 auto',
        fontFamily: "'Inter', sans-serif",
        color: '#ffffff'
      }}
    >
      {/* Main card */}
      <div
        style={{
          flex: 1,
          maxWidth: '600px',
          margin: 0,
          background: 'var(--s)',
          border: '1px solid var(--b)',
          borderRadius: 'var(--rl)',
          padding: '2rem',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        }}
      >
        {/* Status header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.38rem',
                padding: '0.25rem 0.72rem',
                borderRadius: '99px',
                fontSize: '0.7rem',
                fontWeight: 500,
                color: badge.color,
                background: badge.bg,
                border: badge.border
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: badge.color
                }}
              />
              {badge.text}
            </span>
            {(connStatus === 'reconnecting' || connStatus === 'disconnected') && (
              <button
                onClick={reconnectInbox}
                style={{
                  border: '1px solid var(--a)',
                  color: 'var(--a)',
                  background: 'transparent',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.7rem',
                  borderRadius: 'var(--r)',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Reconnect
              </button>
            )}
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                border: '1px solid var(--er)',
                color: 'var(--er)',
                background: 'transparent',
                padding: '0.35rem 0.8rem',
                fontSize: '0.75rem',
                borderRadius: 'var(--r)',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          )}
        </div>

        <h2
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: '1.25rem',
            fontWeight: 800,
            marginBottom: '1.5rem',
            color: 'var(--t)'
          }}
        >
          {displayTitle}
        </h2>

        {/* Room QR Card */}
        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1.2, minWidth: '240px' }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--b)',
                borderRadius: 'var(--r)',
                padding: '0.9rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem'
              }}
            >
              <div>
                <div style={{ fontSize: '0.65rem', color: 'var(--m)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inbox Code</div>
                <div style={{ fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 600, color: 'var(--t)', letterSpacing: '0.15em' }}>{code}</div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(code);
                }}
                style={{
                  border: '1px solid var(--b)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '0.38rem 0.8rem',
                  fontSize: '0.74rem',
                  borderRadius: 'var(--r)',
                  color: 'var(--t)',
                  cursor: 'pointer'
                }}
              >
                Copy
              </button>
            </div>

            <div style={{ fontSize: '0.65rem', color: 'var(--m)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>Share Drop Link</div>
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--b)',
                borderRadius: 'var(--r)',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontSize: '0.78rem', color: 'var(--m2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{dropLink}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(dropLink);
                }}
                style={{
                  border: '1px solid var(--b)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '0.38rem 0.8rem',
                  fontSize: '0.74rem',
                  borderRadius: 'var(--r)',
                  color: 'var(--t)',
                  cursor: 'pointer'
                }}
              >
                Copy
              </button>
            </div>

            {isPermanent && (
              <button
                onClick={printQRFlyer}
                style={{
                  width: '100%',
                  fontSize: '0.75rem',
                  background: 'rgba(16,185,129,0.1)',
                  borderColor: 'rgba(16,185,129,0.2)',
                  color: '#10b981',
                  border: '1px solid',
                  borderRadius: 'var(--r)',
                  padding: '0.5rem',
                  marginTop: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                🖨️ Print QR Flyer for Wall
              </button>
            )}
          </div>

          <div style={{ textAlign: 'center', margin: '0 auto', flexShrink: 0 }}>
            <div style={{ background: '#fff', borderRadius: 'var(--r)', padding: '9px', display: 'inline-block' }}>
              <img src={qrCodeUrl} alt="Drop Zone QR Code" style={{ width: '130px', height: '130px', display: 'block' }} />
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--m)', marginTop: '0.3rem' }}>Scan to drop files</div>
          </div>
        </div>

        {/* AdSense Dashboard Header Ad (Hidden for premium) */}
        {planMode !== 'Premium' && (
          <div style={{ margin: '1.25rem 0', textAlign: 'center', borderTop: '1px dashed var(--b)', borderBottom: '1px dashed var(--b)', padding: '0.75rem 0' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--m2)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Advertisement</div>
            <div style={{ background: 'rgba(0,0,0,0.15)', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--m2)' }}>
              [ Header Banner Ad Slot ]
            </div>
          </div>
        )}

        {/* Options */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--b)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--m)', fontWeight: 500 }}>Received Files</div>
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--t)', cursor: 'pointer' }}>
              <input type="checkbox" checked={alwaysAwake} onChange={e => handleAlwaysAwake(e.target.checked)} style={{ accentColor: 'var(--a)' }} /> ☕ Keep PC Awake
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--t)', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoAccept} onChange={e => setAutoAccept(e.target.checked)} style={{ accentColor: 'var(--a)' }} /> Auto-accept downloads
            </label>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {filesList.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--b)', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--t)', cursor: 'pointer', userSelect: 'none', marginRight: 'auto' }}>
              <input type="checkbox" onChange={e => toggleSelectAllFiles(e.target.checked)} style={{ accentColor: 'var(--a)' }} /> Select All
            </label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                disabled={selectedFiles.size === 0}
                onClick={downloadSelectedFiles}
                style={{
                  border: '1px solid var(--b)',
                  background: selectedFiles.size > 0 ? 'var(--a)' : 'rgba(255,255,255,0.03)',
                  color: selectedFiles.size > 0 ? '#000' : 'var(--m2)',
                  fontSize: '0.7rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: 'var(--r)',
                  cursor: selectedFiles.size > 0 ? 'pointer' : 'default'
                }}
              >
                ⬇️ Download Selected ({selectedFiles.size})
              </button>
              <button
                disabled={selectedFiles.size === 0 || zipping}
                onClick={zipSelectedFiles}
                style={{
                  border: '1px solid var(--a)',
                  background: 'transparent',
                  color: 'var(--a)',
                  fontSize: '0.7rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: 'var(--r)',
                  cursor: (selectedFiles.size > 0 && !zipping) ? 'pointer' : 'default',
                  opacity: zipping ? 0.6 : 1
                }}
              >
                {zipping ? '🤐 Zipping...' : '📦 Zip Selected'}
              </button>
            </div>
          </div>
        )}

        {/* Files Queue List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {filesList.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--m2)', fontSize: '0.8rem', padding: '2rem 1rem', border: '1px dashed var(--b)', borderRadius: 'var(--r)' }}>
              No files dropped yet.<br />Scan the QR or open the link on another device to start sending.
            </div>
          ) : (
            filesList.map(f => {
              const formattedSize = formatBytes(f.size);
              const icon = getMimeIcon(f.mimeType);
              const senderLabel = f.nickname ? `${f.nickname} (${f.senderId.slice(0, 8)})` : f.senderId.slice(0, 8);

              return (
                <div key={f.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--b)', borderRadius: 'var(--r)', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.65rem', minWidth: 0, flex: 1, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(f.id)}
                        disabled={f.status !== 'completed'}
                        onChange={() => toggleSelectFile(f.id)}
                        style={{ accentColor: 'var(--a)', cursor: f.status === 'completed' ? 'pointer' : 'default' }}
                      />
                      <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{icon}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--m)', marginTop: '0.1rem' }}>
                          {formattedSize} · From <span style={{ fontFamily: 'monospace', color: 'var(--a)' }}>{senderLabel}</span>
                          {f.batchCount && f.batchCount > 1 && ` · [File ${f.batchIndex + 1} of ${f.batchCount}]`}
                        </div>
                        {f.printSettings && (
                          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--a)', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--b)', borderRadius: '4px', padding: '0.2rem 0.5rem', marginTop: '0.35rem', display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                            🖨️ {f.printSettings.copies > 1 ? `${f.printSettings.copies} Copies` : '1 Copy'} · {f.printSettings.color === 'color' ? '🎨 Color' : '⚫ B&W'} · {f.printSettings.sides === 'double' ? '↕️ Double-sided' : '📄 Single-sided'}
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 500,
                        color: f.status === 'completed' ? '#10b981' : f.status === 'downloading' ? '#22d3ee' : '#fbbf24',
                        background: f.status === 'completed' ? 'rgba(16,185,129,0.1)' : f.status === 'downloading' ? 'rgba(34,211,238,0.1)' : 'rgba(251,191,36,0.1)'
                      }}
                    >
                      {f.status === 'completed' ? 'Completed' : f.status === 'downloading' ? 'Downloading' : 'Waiting Accept'}
                    </span>
                  </div>

                  {f.status === 'waiting' && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button onClick={() => acceptFile(f.id)} style={{ flex: 1, border: 'none', background: 'var(--a)', color: '#000', padding: '0.38rem 0.8rem', borderRadius: 'var(--r)', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}>⬇️ Accept</button>
                      <button onClick={() => rejectFile(f.id)} style={{ width: 'auto', border: '1px solid var(--b)', background: 'rgba(255,255,255,0.03)', color: 'var(--t)', padding: '0 0.75rem', borderRadius: 'var(--r)', cursor: 'pointer' }}>✕</button>
                    </div>
                  )}

                  {f.status === 'completed' && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      {f.blob && (f.mimeType?.startsWith('image/') || f.mimeType?.startsWith('audio/') || f.mimeType?.startsWith('video/')) && (
                        <button onClick={() => setPreviewFile(f)} style={{ flex: 1.5, background: 'var(--a)', color: '#000', padding: '0.38rem 0.8rem', border: 'none', borderRadius: 'var(--r)', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600 }}>👁️ Preview</button>
                      )}
                      <button onClick={() => printInboxFile(f.id)} style={{ flex: 1, border: '1px solid var(--a)', background: 'transparent', color: 'var(--a)', padding: '0.38rem 0.8rem', borderRadius: 'var(--r)', fontSize: '0.74rem', cursor: 'pointer' }}>🖨️ Print</button>
                      <button onClick={() => downloadInboxFile(f.id)} style={{ flex: 1, border: '1px solid var(--b)', background: 'rgba(255,255,255,0.03)', color: 'var(--t)', padding: '0.38rem 0.8rem', borderRadius: 'var(--r)', fontSize: '0.74rem', cursor: 'pointer' }}>⬇️ Download</button>
                      <button onClick={() => deleteInboxFile(f.id)} style={{ flex: 1, border: '1px solid var(--er)', background: 'transparent', color: 'var(--er)', padding: '0.38rem 0.8rem', borderRadius: 'var(--r)', fontSize: '0.74rem', cursor: 'pointer' }}>🗑️ Delete</button>
                    </div>
                  )}

                  {f.status === 'downloading' && (
                    <div style={{ marginTop: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--m2)', marginBottom: '0.3rem' }}>
                        <span>Receiving...</span>
                        <span>
                          {f.speed > 0 && `${formatBytes(f.speed)}/s · `}
                          {f.pageIndex !== undefined && `Page ${f.pageIndex + 1} · `}
                          <strong>{Math.round(f.ratio * 100)}%</strong>
                        </span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--b)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--a), #818cf8)', width: `${f.ratio * 100}%`, transition: 'width 0.1s ease' }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info logs */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.5rem', fontSize: '0.78rem', color: 'var(--m2)', padding: '0.55rem 0.85rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--b)', borderRadius: '8px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: connStatus === 'connected' ? '#10b981' : '#fbbf24', marginRight: '0.5rem' }} />
          <span>{statusText}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.75rem' }}>{timerText}</span>
        </div>
      </div>

      {/* Sidebar AdSense Banner (Hidden for premium) */}
      {planMode !== 'Premium' && (
        <div
          style={{
            width: '340px',
            padding: '1.25rem',
            flexShrink: 0,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '520px',
            margin: 0,
            background: 'var(--s)',
            border: '1px solid var(--b)',
            borderRadius: 'var(--rl)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
          }}
        >
          <div style={{ fontSize: '0.65rem', color: 'var(--m2)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Advertisement</div>
          <div style={{ background: 'rgba(0,0,0,0.15)', width: '300px', height: '450px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--m2)' }}>
            [ Sidebar Tall Banner Ad Slot ]
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div
          onClick={() => setPreviewFile(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7,7,14,0.92)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--s)',
              border: '1px solid var(--b)',
              borderRadius: 'var(--rl)',
              padding: '1.5rem',
              maxWidth: '500px',
              width: '100%',
              textAlign: 'center'
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--t)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewFile.name}</h3>
            
            <div style={{ maxHeight: '350px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.5rem', marginBottom: '1.5rem' }}>
              {previewFile.mimeType.startsWith('image/') && (
                <img src={URL.createObjectURL(previewFile.blob)} alt="Preview" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />
              )}
              {previewFile.mimeType.startsWith('video/') && (
                <video src={URL.createObjectURL(previewFile.blob)} controls style={{ maxWidth: '100%', maxHeight: '300px' }} />
              )}
              {previewFile.mimeType.startsWith('audio/') && (
                <audio src={URL.createObjectURL(previewFile.blob)} controls style={{ width: '100%' }} />
              )}
            </div>

            <button
              onClick={() => setPreviewFile(null)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--b)',
                color: 'var(--t)',
                padding: '0.6rem',
                borderRadius: 'var(--r)',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
