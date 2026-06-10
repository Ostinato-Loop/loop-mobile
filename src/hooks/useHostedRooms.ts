/**
 * useHostedRooms
 *
 * Fetches rooms the authenticated user has hosted (past + active).
 * Hits GET /api/rooms?host_id=me&limit=N
 * Re-fetches when `enabled` flips true (lazy — only loaded when
 * the profile tab scrolls to the rooms section).
 */
import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';
import type { Room } from '@/hooks/useRooms';

type Options = {
  enabled?: boolean;
  limit?: number;
};

export function useHostedRooms({ enabled = true, limit = 20 }: Options = {}) {
  const [rooms,      setRooms]      = useState<Room[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!enabled) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ host_id: 'me', limit: String(limit) });
      const data   = await apiGet<{ rooms: Room[] }>(
        `${ENDPOINTS.rooms.list}?${params.toString()}`
      );
      setRooms(data.rooms ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled, limit]);

  useEffect(() => { if (enabled) load(); }, [load, enabled]);

  return { rooms, loading, error, refreshing, refresh: () => load(true) };
}
