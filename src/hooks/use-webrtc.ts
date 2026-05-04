// src/hooks/use-webrtc.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const iceServers = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

interface WebRTCFile {
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer;
}

export function useWebRTC(isHost: boolean, sessionId: string | null) {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<WebRTCFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Initializing...');

  const CHUNK_SIZE = 64 * 1024; // 64KB
  const fileToSendRef = useRef<{ file: File; name: string; size: number; type: string; sentSize: number } | null>(null);
  const receiveBufferRef = useRef<ArrayBuffer[]>([]);
  const receivedSizeRef = useRef(0);
  const receivingFileMetaRef = useRef<{ name: string; size: number; type: string } | null>(null);

  const handleReceiveMessage = useCallback((event: MessageEvent) => {
    const data = event.data;
    if (typeof data === 'string') {
      try {
        const meta = JSON.parse(data);
        if (meta.type === 'file-meta') {
          setStatusMessage(`Receiving ${meta.payload.name}...`);
          receivingFileMetaRef.current = meta.payload;
          receiveBufferRef.current = [];
          receivedSizeRef.current = 0;
        } else if (meta.type === 'transfer-complete') {
          const receivedData = new Blob(receiveBufferRef.current, { type: receivingFileMetaRef.current?.type });
          
          receivedData.arrayBuffer().then(buffer => {
            const newFile: WebRTCFile = {
              name: receivingFileMetaRef.current!.name,
              type: receivingFileMetaRef.current!.type,
              size: buffer.byteLength,
              data: buffer,
            };
            setReceivedFiles(prev => [...prev, newFile]);
          });
          
          receivingFileMetaRef.current = null;
          setStatusMessage('File received!');
        }
      } catch (e) {
        console.error('Error parsing signaling message:', e);
      }
    } else if (data instanceof ArrayBuffer) {
      receiveBufferRef.current.push(data);
      receivedSizeRef.current += data.byteLength;
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    try {
      const pc = new RTCPeerConnection(iceServers);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          fetch('/api/signal', {
            method: 'POST',
            body: JSON.stringify({ sessionId, candidate: event.candidate, peerType: isHost ? 'host' : 'client' }),
          }).catch(e => console.error("Failed to send candidate:", e));
        }
      };

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        channel.binaryType = 'arraybuffer';
        channel.onmessage = handleReceiveMessage;
        dataChannelRef.current = channel;
      };

      pc.onconnectionstatechange = () => {
        switch(pc.connectionState) {
          case 'connected':
            setIsConnected(true);
            setStatusMessage('Peer connected.');
            break;
          case 'disconnected':
          case 'closed':
          case 'failed':
            setIsConnected(false);
            setStatusMessage('Peer disconnected.');
            break;
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    } catch (e) {
      console.error("Failed to create Peer Connection", e);
      setError("WebRTC not supported on this browser.");
      return null;
    }
  }, [sessionId, isHost, handleReceiveMessage]);

  useEffect(() => {
    if (!sessionId) return;
    const pc = createPeerConnection();
    if (!pc) return;

    let isCancelled = false;
    let signalingInterval: NodeJS.Timeout;

    async function startSignaling() {
      if (isHost && pc) {
        setStatusMessage('Waiting for peer...');
        const dataChannel = pc.createDataChannel('fileTransfer');
        dataChannel.binaryType = 'arraybuffer';
        dataChannel.onmessage = handleReceiveMessage;
        dataChannelRef.current = dataChannel;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await fetch('/api/signal', {
          method: 'POST',
          body: JSON.stringify({ sessionId, sdp: offer }),
        });
      } else {
        setStatusMessage('Connecting to host...');
      }

      signalingInterval = setInterval(async () => {
        if (isCancelled) return;
        try {
          const response = await fetch(`/api/signal?sessionId=${sessionId}&peerType=${isHost ? 'host' : 'client'}`);
          if (!response.ok) return;

          const signal = await response.json();
          if (isCancelled || !signal) return;

          if (signal.sdp && pc && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            if (signal.sdp.type === 'offer' && !isHost) {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await fetch('/api/signal', {
                method: 'POST',
                body: JSON.stringify({ sessionId, sdp: answer }),
              });
            }
          }

          if (signal.candidates && pc) {
            for (const candidate of signal.candidates) {
                if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding ICE candidate:", e));
            }
          }
        } catch (e) {
          console.error("Signaling error:", e);
        }
      }, 2000);
    }

    startSignaling();

    return () => {
      isCancelled = true;
      clearInterval(signalingInterval);
      if (pc) pc.close();
      peerConnectionRef.current = null;
    };
  }, [sessionId, isHost, createPeerConnection, handleReceiveMessage]);

  const sendFile = (file: File) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== 'open') {
      setError('Data channel is not open. Cannot send file.');
      return Promise.reject('Data channel not open');
    }

    return new Promise<void>((resolve, reject) => {
        fileToSendRef.current = { file, name: file.name, size: file.size, type: file.type, sentSize: 0 };
        setUploadProgress(0);
        setStatusMessage(`Sending ${file.name}...`);

        channel.send(JSON.stringify({
          type: 'file-meta',
          payload: { name: file.name, size: file.size, type: file.type },
        }));
        
        const reader = new FileReader();
        reader.onload = (e) => {
            if (!e.target?.result || !fileToSendRef.current) return;
            try {
                channel.send(e.target.result as ArrayBuffer);
                fileToSendRef.current.sentSize += (e.target.result as ArrayBuffer).byteLength;
                setUploadProgress((fileToSendRef.current.sentSize / fileToSendRef.current.size) * 100);
                
                if (fileToSendRef.current.sentSize < fileToSendRef.current.size) {
                    readNextChunk();
                } else {
                    channel.send(JSON.stringify({ type: 'transfer-complete' }));
                    setStatusMessage('File sent successfully!');
                    resolve();
                }
            } catch (e) {
                setError(`Error sending chunk: ${e}`);
                reject(e);
            }
        };
        reader.onerror = () => {
          setError('Error reading file chunk.');
          reject('Error reading file chunk.');
        };

        const readNextChunk = () => {
            if (!fileToSendRef.current) return;
            const start = fileToSendRef.current.sentSize;
            const end = Math.min(start + CHUNK_SIZE, fileToSendRef.current.size);
            reader.readAsArrayBuffer(fileToSendRef.current.file.slice(start, end));
        };

        readNextChunk();
    });
  };

  const clearReceivedFiles = () => {
      setReceivedFiles([]);
  };

  return { isConnected, error, sendFile, receivedFiles, uploadProgress, statusMessage, clearReceivedFiles };
}
