/**
 * useHandRaise
 * Real-time hand-raise signalling via RALD realtime WebSocket.
 * Host sees a queue of raised hands and can approve/deny each one.
 * Speakers are promoted to the `speaker` role via REST on approval.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '@/lib/storage';
import { apiPost } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';

const REALTIME_URL = 'wss://realtime.rald.cloud';

export type HandRaiser = {
  user_id: string;
  display_name: string | null;
  raised_at: number;
};

type RealtimeMsg =
  | { type: 'hand_raised';    user_id: string; display_name: string | null }
  | { type: 'hand_lowered';   user_id: string }
  | { type: 'speaker_added';  user_id: string }
  | { type: 'speaker_removed';user_id: string }
  | { type: 'ping' };

type Options = {
  roomId: string;
  userId: string | null | undefined;
  isHost: boolean;
};

export function useHandRaise({ roomId, userId, isHost }: Options) {
  const ws               = useRef<WebSocket | null>(null);
  const reconnectTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmounted      = useRef(false);

  const [raised,      setRaised]      = useState(false);   // local user has raised hand
  const [queue,       setQueue]       = useState<HandRaiser[]>([]);   // host's view
  const [speakers,    setSpeakers]    = useState<Set<string>>(new Set());
  const [connected,   setConnected]   = useState(false);

  // ── Establish WebSocket ──────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (isUnmounted.current) return;
    const token = await getToken();
    if (!token) return;

    const url = `${REALTIME_URL}/rooms/${roomId}/presence?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      // Subscribe to hand-raise channel
      socket.send(JSON.stringify({ type: 'subscribe', channel: `room:${roomId}:hands` }));
    };

    socket.onmessage = (e) => {
      try {
        const msg: RealtimeMsg = JSON.parse(e.data as string);
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        if (msg.type === 'hand_raised') {
          setQueue(q => {
            if (q.find(h => h.user_id === msg.user_id)) return q;
            return [...q, { user_id: msg.user_id, display_name: msg.display_name, raised_at: Date.now() }];
          });
        }
        if (msg.type === 'hand_lowered') {
          setQueue(q => q.filter(h => h.user_id !== msg.user_id));
        }
        if (msg.type === 'speaker_added') {
          setSpeakers(s => new Set([...s, msg.user_id]));
        }
        if (msg.type === 'speaker_removed') {
          setSpeakers(s => { const n = new Set(s); n.delete(msg.user_id); return n; });
        }
      } catch { /* ignore parse errors */ }
    };

    socket.onclose = () => {
      setConnected(false);
      if (!isUnmounted.current) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [roomId]);

  useEffect(() => {
    connect();
    return () => {
      isUnmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  // ── Raise / lower hand ───────────────────────────────────────────────
  const raiseHand = useCallback(async () => {
    try {
      await apiPost(`${ENDPOINTS.rooms.get(roomId)}/hand-raise`, {});
      setRaised(true);
      ws.current?.send(JSON.stringify({ type: 'hand_raised', room_id: roomId }));
    } catch { /* best-effort */ }
  }, [roomId]);

  const lowerHand = useCallback(async () => {
    try {
      await apiPost(`${ENDPOINTS.rooms.get(roomId)}/hand-lower`, {});
      setRaised(false);
      ws.current?.send(JSON.stringify({ type: 'hand_lowered', room_id: roomId }));
    } catch { /* best-effort */ }
  }, [roomId]);

  const toggleHand = useCallback(() => {
    if (raised) lowerHand(); else raiseHand();
  }, [raised, raiseHand, lowerHand]);

  // ── Host: approve / deny ─────────────────────────────────────────────
  const approveHand = useCallback(async (targetUserId: string) => {
    try {
      await apiPost(`${ENDPOINTS.rooms.get(roomId)}/speakers`, { user_id: targetUserId });
      setQueue(q => q.filter(h => h.user_id !== targetUserId));
      setSpeakers(s => new Set([...s, targetUserId]));
    } catch { /* best-effort */ }
  }, [roomId]);

  const denyHand = useCallback(async (targetUserId: string) => {
    try {
      await apiPost(`${ENDPOINTS.rooms.get(roomId)}/hand-deny`, { user_id: targetUserId });
      setQueue(q => q.filter(h => h.user_id !== targetUserId));
    } catch { /* best-effort */ }
  }, [roomId]);

  const removeSpeaker = useCallback(async (targetUserId: string) => {
    try {
      await apiPost(`${ENDPOINTS.rooms.get(roomId)}/speakers/remove`, { user_id: targetUserId });
      setSpeakers(s => { const n = new Set(s); n.delete(targetUserId); return n; });
    } catch { /* best-effort */ }
  }, [roomId]);

  return {
    raised,
    queue,
    speakers,
    connected,
    toggleHand,
    raiseHand,
    lowerHand,
    approveHand,
    denyHand,
    removeSpeaker,
  };
}
