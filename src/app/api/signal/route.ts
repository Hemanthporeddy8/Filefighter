import { NextRequest, NextResponse } from 'next/server';

type SessionData = {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  hostCandidates: RTCIceCandidateInit[];
  clientCandidates: RTCIceCandidateInit[];
};

// In-memory store for signaling data. In a production app, use Redis or a database.
const sessions = new Map<string, SessionData>();

export async function POST(req: NextRequest) {
  try {
    const { sessionId, sdp, candidate } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
    }

    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { hostCandidates: [], clientCandidates: [] });
    }
    const session = sessions.get(sessionId)!;

    if (sdp) {
      if (sdp.type === 'offer') {
        session.offer = sdp;
        // When a new offer comes in, clear old data
        session.answer = undefined;
        session.hostCandidates = [];
        session.clientCandidates = [];
      } else if (sdp.type === 'answer') {
        session.answer = sdp;
      }
    }

    if (candidate) {
      // Simple logic: if there's an offer but no answer, it's the host's candidate.
      if (session.offer && !session.answer) {
        session.hostCandidates.push(candidate);
      } else {
        session.clientCandidates.push(candidate);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Signaling POST error:", e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
    try {
      const { searchParams } = new URL(req.url);
      const sessionId = searchParams.get('sessionId');
      const peerType = searchParams.get('peerType'); // 'host' or 'client'

      if (!sessionId || !peerType) {
          return NextResponse.json({ error: 'Session ID and Peer Type are required.' }, { status: 400 });
      }

      const session = sessions.get(sessionId);
      if (!session) {
          return NextResponse.json({ status: 'waiting' });
      }

      const response: { sdp?: RTCSessionDescriptionInit, candidates?: RTCIceCandidateInit[] } = {};

      if (peerType === 'client') {
          // Client is looking for an offer from the host
          if (session.offer) {
              response.sdp = session.offer;
          }
          // And any candidates the host has sent
          if (session.hostCandidates.length > 0) {
              response.candidates = [...session.hostCandidates];
              session.hostCandidates = []; // Consume candidates
          }
      } else { // peerType is 'host'
          // Host is looking for an answer from the client
          if (session.answer) {
              response.sdp = session.answer;
              session.offer = undefined; // Consume offer once answered
              session.answer = undefined; // Consume answer
          }
          // And any candidates the client has sent
          if (session.clientCandidates.length > 0) {
              response.candidates = [...session.clientCandidates];
              session.clientCandidates = []; // Consume candidates
          }
      }
      
      return NextResponse.json(response);
    } catch(e) {
        console.error("Signaling GET error:", e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
