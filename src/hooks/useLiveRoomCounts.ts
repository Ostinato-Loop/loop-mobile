/**
 * useLiveRoomCounts
 *
 * Subscribes to Supabase Realtime postgres_changes on the `rooms` table.
 * Returns a Map<roomId, { count: number; isLive: boolean }> that stays in sync
 * as rooms gain/lose listeners or flip is_live — no polling required.
 *
 * Usage:
 *   const { counts, deltaFor } = useLiveRoomCounts();
 *   const live = counts.get(roomId);   // { count, isLive }
 *   const delta = deltaFor(roomId);    // +N or -N since last render
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, authedSupabase } from '@/lib/supabase';
import { getToken } from '@/lib/storage';

export type RoomCount = {
  count: number;
  isLive: boolean;
};

type CountMap = Map<string, RoomCount>;

type RoomsRow = {
  id: string;
  audience_count: number;
  is_live: boolean;
};

export function useLiveRoomCounts() {
  const [counts,    setCounts]    = useState<CountMap>(new Map());
  const channelRef  = useRef<RealtimeChannel | null>(null);
  // Track previous counts so callers can compute deltas
  const prevRef     = useRef<CountMap>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function subscribe() {
      const token  = await getToken();
      const client = token ? await authedSupabase(token) : supabase;

      const channel = client
        .channel('live-room-counts', {
          config: { broadcast: { ack: false } },
        })
        // Watch every UPDATE on the rooms table (audience_count, is_live)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'rooms' },
          (payload) => {
            if (cancelled) return;
            const row = payload.new as RoomsRow;
            setCounts(prev => {
              const next = new Map(prev);
              next.set(row.id, {
                count:  row.audience_count,
                isLive: row.is_live,
              });
              prevRef.current = prev;
              return next;
            });
          }
        )
        // A new room going live shows up as INSERT
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'rooms' },
          (payload) => {
            if (cancelled) return;
            const row = payload.new as RoomsRow;
            if (!row.is_live) return;
            setCounts(prev => {
              const next = new Map(prev);
              next.set(row.id, { count: row.audience_count, isLive: true });
              prevRef.current = prev;
              return next;
            });
          }
        )
        .subscribe();

      channelRef.current = channel;
    }

    subscribe();
    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, []);

  /** Seed initial counts from the rooms list once it loads */
  const seedCounts = useCallback((
    rooms: Array<{ id: string; audience_count: number; is_live: boolean }>
  ) => {
    setCounts(prev => {
      const next = new Map(prev);
      for (const r of rooms) {
        // Only seed if we don't already have a live Realtime value
        if (!next.has(r.id)) {
          next.set(r.id, { count: r.audience_count, isLive: r.is_live });
        }
      }
      return next;
    });
  }, []);

  /**
   * delta for a given room since the last Realtime update.
   * Positive = grew, negative = shrank, 0 = unchanged/unknown.
   */
  const deltaFor = useCallback((roomId: string): number => {
    const prev = prevRef.current.get(roomId)?.count;
    const curr = counts.get(roomId)?.count;
    if (prev == null || curr == null) return 0;
    return curr - prev;
  }, [counts]);

  return { counts, seedCounts, deltaFor };
}
