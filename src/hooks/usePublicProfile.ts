/**
 * usePublicProfile
 *
 * Fetches a public user profile + their hosted rooms in parallel.
 * Exposes optimistic follow / unfollow with rollback on API error.
 * Pass the target userId (NOT "me") to use this hook.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';
import type { Room } from '@/hooks/useRooms';

export type PublicProfile = {
  id:               string;
  username:         string | null;
  display_name:     string | null;
  avatar_url:       string | null;
  bio:              string | null;
  is_verified:      boolean;
  is_creator:       boolean;
  state_id:         string | null;
  country_id:       string | null;
  followers_count:  number;
  following_count:  number;
  rooms_count:      number;
  /** Whether the currently-authenticated user follows this person */
  is_following:     boolean;
  /** Whether the currently-authenticated user has blocked this person */
  is_blocked:       boolean;
};

export function usePublicProfile(userId: string) {
  const [profile,    setProfile]    = useState<PublicProfile | null>(null);
  const [rooms,      setRooms]      = useState<Room[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [profData, roomData] = await Promise.all([
        apiGet<{ profile: PublicProfile }>(ENDPOINTS.profile.get(userId)),
        apiGet<{ rooms: Room[] }>(
          `${ENDPOINTS.rooms.list}?host_id=${encodeURIComponent(userId)}&limit=20`
        ),
      ]);
      setProfile(profData.profile);
      setRooms(roomData.rooms ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Could not load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  /** Optimistic follow — rolls back on API failure */
  const follow = useCallback(async () => {
    setProfile(prev =>
      prev ? { ...prev, is_following: true, followers_count: prev.followers_count + 1 } : prev
    );
    try {
      await apiPost(ENDPOINTS.follows.follow(userId), {});
    } catch {
      setProfile(prev =>
        prev ? { ...prev, is_following: false, followers_count: Math.max(0, prev.followers_count - 1) } : prev
      );
    }
  }, [userId]);

  /** Optimistic unfollow — rolls back on API failure */
  const unfollow = useCallback(async () => {
    setProfile(prev =>
      prev ? { ...prev, is_following: false, followers_count: Math.max(0, prev.followers_count - 1) } : prev
    );
    try {
      await apiDelete(ENDPOINTS.follows.unfollow(userId));
    } catch {
      setProfile(prev =>
        prev ? { ...prev, is_following: true, followers_count: prev.followers_count + 1 } : prev
      );
    }
  }, [userId]);

  return {
    profile,
    rooms,
    loading,
    refreshing,
    error,
    refresh:  () => load(true),
    follow,
    unfollow,
  };
}
