import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';

export type RoomCategory =
  | 'community' | 'news' | 'commentary' | 'radio'
  | 'dj-session' | 'education' | 'business' | 'general';

export type Room = {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  category: RoomCategory;
  visibility: 'public' | 'private' | 'livestream';
  cover_url: string | null;
  language: string | null;
  is_live: boolean;
  audience_count: number;
  tags: string[] | null;
  created_at: string;
  host?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
};

type RoomFilters = {
  category?: RoomCategory | '';
  live_only?: boolean;
  limit?: number;
};

export function useRooms(filters: RoomFilters = {}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.live_only) params.set('live_only', 'true');
      if (filters.limit) params.set('limit', String(filters.limit));
      const url = `${ENDPOINTS.rooms.list}?${params.toString()}`;
      const data = await apiGet<{ rooms: Room[] }>(url);
      setRooms(data.rooms ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters.category, filters.live_only, filters.limit]);

  useEffect(() => { load(); }, [load]);

  return { rooms, loading, error, refreshing, refresh: () => load(true) };
}
