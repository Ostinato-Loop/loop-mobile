/**
 * useRoomRealtime
 *
 * Single hook that owns ALL live room state.
 * Replaces the one-shot useEffect loads in RoomScreen.
 *
 * Subscribes via Supabase Realtime (postgres_changes) to:
 *  • public.rooms          WHERE id = roomId
 *  • public.room_participants WHERE room_id = roomId
 *
 * Also exposes helpers to mutate room settings (ptt_enabled, etc.)
 * so the host can flip them from the UI without a page reload.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, authedSupabase } from '@/lib/supabase';
import { getToken } from '@/lib/storage';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';

// ── Shared types ─────────────────────────────────────────────────────
export type RoomState = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  is_live: boolean;
  ptt_enabled: boolean;
  audience_count: number;
  host_id: string;
  host?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
};

export type RoomParticipant = {
  user_id: string;
  role: 'host' | 'moderator' | 'speaker' | 'listener';
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  } | null;
};

export type ChatMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string | null; display_name: string | null } | null;
};

type Status = 'loading' | 'live' | 'error';

export function useRoomRealtime(roomId: string) {
  const [status,       setStatus]       = useState<Status>('loading');
  const [room,         setRoom]         = useState<RoomState | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [error,        setError]        = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef  = useRef<Awaited<ReturnType<typeof authedSupabase>> | null>(null);

  // ── Initial load ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [roomRes, partRes, msgRes] = await Promise.all([
          apiGet<{ room: RoomState }>(ENDPOINTS.rooms.get(roomId)),
          apiGet<{ participants: RoomParticipant[] }>(
            `${ENDPOINTS.rooms.get(roomId)}/participants`
          ).catch(() => ({ participants: [] as RoomParticipant[] })),
          apiGet<{ messages: ChatMessage[] }>(
            `${ENDPOINTS.rooms.get(roomId)}/messages`
          ).catch(() => ({ messages: [] as ChatMessage[] })),
        ]);

        if (cancelled) return;
        setRoom(roomRes.room);
        setParticipants(partRes.participants ?? []);
        setMessages(msgRes.messages ?? []);
        setStatus('live');

        // Boot Realtime after initial load so UI renders fast
        setupRealtime();
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? 'Failed to load room');
          setStatus('error');
        }
      }
    }

    load();
    return () => { cancelled = true; teardown(); };
  }, [roomId]);

  // ── Supabase Realtime channel ────────────────────────────────────────
  async function setupRealtime() {
    const token = await getToken();
    const client = token ? await authedSupabase(token) : supabase;
    clientRef.current = client;

    const channel = client
      .channel(`room-state:${roomId}`, {
        config: { broadcast: { ack: false } },
      })

      // ── Room row updates (ptt_enabled, is_live, audience_count…) ──
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setRoom(prev =>
              prev ? { ...prev, ...(payload.new as Partial<RoomState>) } : prev
            );
          }
          if (payload.eventType === 'DELETE') {
            // Room was deleted / ended
            setRoom(prev => prev ? { ...prev, is_live: false } : prev);
          }
        }
      )

      // ── Participant inserts (joins + role promotions) ──────────────
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const p = payload.new as { user_id: string; role: RoomParticipant['role'] };
          setParticipants(prev => {
            if (prev.find(x => x.user_id === p.user_id)) return prev;
            return [...prev, p as RoomParticipant];
          });
        }
      )

      // ── Participant updates (role changes e.g. listener→speaker) ──
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const updated = payload.new as { user_id: string; role: RoomParticipant['role'] };
          setParticipants(prev =>
            prev.map(p =>
              p.user_id === updated.user_id ? { ...p, role: updated.role } : p
            )
          );
        }
      )

      // ── Participant deletes (leaves) ───────────────────────────────
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const old = payload.old as { user_id: string };
          setParticipants(prev => prev.filter(p => p.user_id !== old.user_id));
        }
      )

      // ── New chat messages (broadcast) ─────────────────────────────
      .on(
        'broadcast',
        { event: 'chat' },
        (event) => {
          const msg = event.payload as ChatMessage;
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )

      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] subscribed to room ${roomId}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn(`[Realtime] channel error for room ${roomId}`);
        }
      });

    channelRef.current = channel;
  }

  function teardown() {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }

  // ── Optimistic chat: push to local state + broadcast ──────────────
  const addOptimisticMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => {
      if (prev.find(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    // Broadcast to other subscribers so they see it without DB round-trip
    channelRef.current?.send({
      type: 'broadcast',
      event: 'chat',
      payload: msg,
    });
  }, []);

  // ── Host: toggle PTT ──────────────────────────────────────────────
  const togglePtt = useCallback(async () => {
    if (!room) return;
    const next = !room.ptt_enabled;
    // Optimistic update
    setRoom(r => r ? { ...r, ptt_enabled: next } : r);
    try {
      await apiPatch(`${ENDPOINTS.rooms.get(roomId)}`, { ptt_enabled: next });
    } catch {
      // Revert on failure
      setRoom(r => r ? { ...r, ptt_enabled: !next } : r);
    }
  }, [room, roomId]);

  // ── Host: end room ─────────────────────────────────────────────────
  const endRoom = useCallback(async () => {
    try { await apiPost(ENDPOINTS.rooms.end(roomId), {}); } catch { /* best-effort */ }
    setRoom(r => r ? { ...r, is_live: false } : r);
    teardown();
  }, [roomId]);

  return {
    status,
    room,
    participants,
    messages,
    error,
    togglePtt,
    endRoom,
    addOptimisticMessage,
  };
}
