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

export type RoomFilters = {
  category?: RoomCategory | '';
  live_only?: boolean;
  trending?: boolean;
  search?: string;
  tags?: string[];
  limit?: number;
};

export function useRooms(filters: RoomFilters = {}) {
  const [rooms,      setRooms]      = useState<Room[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Stable serialisation so useCallback deps don't change on every render
  const filterKey = JSON.stringify(filters);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.live_only) params.set('live_only', 'true');
      if (filters.trending)  params.set('trending', 'true');
      if (filters.search)    params.set('search', filters.search);
      if (filters.limit)     params.set('limit', String(filters.limit));
      if (filters.tags?.length) {
        filters.tags.forEach(t => params.append('tags[]', t));
      }
      const url  = `${ENDPOINTS.rooms.list}?${params.toString()}`;
      const data = await apiGet<{ rooms: Room[] }>(url);
      setRooms(data.rooms ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => { load(); }, [load]);

  return { rooms, loading, error, refreshing, refresh: () => load(true) };
}

/** Derive trending tags from a list of rooms (most frequent first) */
export function trendingTagsFrom(rooms: Room[], maxTags = 12): string[] {
  const freq = new Map<string, number>();
  for (const room of rooms) {
    for (const tag of room.tags ?? []) {
      freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags)
    .map(([tag]) => tag);
}
