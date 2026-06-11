/**
 * useRooms — room list fetching hook
 * useRegionalRooms — REGION-001 (2026-06-11): African-First regional sort
 *
 * LILCKY STUDIO LIMITED
 */
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
  /** When false, the hook skips the network fetch and returns empty state */
  enabled?: boolean;
};

export function useRooms(filters: RoomFilters = {}) {
  const enabled = filters.enabled !== false;

  const [rooms,      setRooms]      = useState<Room[]>([]);
  const [loading,    setLoading]    = useState(enabled);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filterKey = JSON.stringify(filters);

  const load = useCallback(async (isRefresh = false) => {
    if (!enabled) return;
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

  useEffect(() => {
    if (enabled) load();
    else { setLoading(false); setRooms([]); }
  }, [load, enabled]);

  return { rooms, loading, error, refreshing, refresh: () => load(true) };
}

// ── Regional hook ──────────────────────────────────────────────────────────

export type RegionContext = {
  state_id:   string | null;
  country_id: string | null;
};

/** Country code → display name for the region label pill */
const COUNTRY_NAMES: Record<string, string> = {
  NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', ZA: 'South Africa',
  SN: 'Senegal', CI: "Côte d'Ivoire", ET: 'Ethiopia', TZ: 'Tanzania',
  UG: 'Uganda', RW: 'Rwanda', CM: 'Cameroon', ZM: 'Zambia', ZW: 'Zimbabwe',
  EG: 'Egypt', MA: 'Morocco', TN: 'Tunisia', AO: 'Angola', MZ: 'Mozambique',
};

/** Format state_id (e.g. "lagos" → "Lagos", "cross-river" → "Cross River") */
function formatState(stateId: string): string {
  return stateId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Build a human-readable region label for the pill shown in DiscoverScreen.
 * Examples: "Lagos · Nigeria", "Nigeria", "Trending"
 */
export function formatRegionLabel(region: RegionContext | null): string | null {
  if (!region) return null;
  const { state_id, country_id } = region;
  if (!state_id && !country_id) return null;

  const statePart   = state_id   ? formatState(state_id)              : null;
  const countryPart = country_id ? (COUNTRY_NAMES[country_id.toUpperCase()] ?? country_id) : null;

  if (statePart && countryPart) return `${statePart} · ${countryPart}`;
  if (statePart)   return statePart;
  if (countryPart) return countryPart;
  return null;
}

export type RegionalRoomFilters = {
  tags?: string[];
  limit?: number;
};

/**
 * useRegionalRooms — REGION-001
 * Returns public live rooms sorted: same-state → same-country → rest.
 * Requires auth (the server reads the caller's profile region).
 * Falls back gracefully to a global sort if the user has no region set.
 */
export function useRegionalRooms(filters: RegionalRoomFilters = {}) {
  const [rooms,      setRooms]      = useState<Room[]>([]);
  const [region,     setRegion]     = useState<RegionContext | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filterKey = JSON.stringify(filters);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.limit)      params.set('limit', String(filters.limit));
      if (filters.tags?.length) {
        filters.tags.forEach(t => params.append('tags[]', t));
      }
      const url  = `${ENDPOINTS.rooms.regional}?${params.toString()}`;
      const data = await apiGet<{
        rooms: Room[];
        region: RegionContext;
      }>(url);
      setRooms(data.rooms ?? []);
      setRegion(data.region ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => { load(); }, [load]);

  return { rooms, region, loading, error, refreshing, refresh: () => load(true) };
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
