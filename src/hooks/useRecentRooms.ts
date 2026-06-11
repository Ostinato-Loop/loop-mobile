/**
 * useRecentRooms — retention hook
 * RETENTION-001 (2026-06-11)
 *
 * Persists the last MAX_ROOMS rooms a user entered to AsyncStorage.
 * Used by FeedScreen to show the "Continue Listening / Recent Rooms"
 * retention strip on return visits.
 *
 * Spec (African-First UX):
 *   "When users return, show: Continue Listening, Recent Rooms,
 *    Missed Conversations. Never show an empty screen."
 *
 * Public API:
 *   recentRooms  — sorted newest-first, ready to render
 *   addRecentRoom(room) — called by RoomScreen on entry
 *   clearRecentRooms()  — exposed for testing / settings
 *
 * LILCKY STUDIO LIMITED
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────────────────────────────

export type RecentRoom = {
  id:            string;
  title:         string;
  host_id:       string;
  category:      string;
  is_live:       boolean;
  audience_count: number;
  host?: {
    username:     string | null;
    display_name: string | null;
    avatar_url:   string | null;
    is_verified:  boolean;
  };
  /** Unix ms timestamp of the most recent visit */
  visitedAt: number;
};

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'loop:recent_rooms:v1';
const MAX_ROOMS   = 8;

// ── Storage helpers ────────────────────────────────────────────────────────

async function readStorage(): Promise<RecentRoom[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentRoom[];
  } catch {
    return [];
  }
}

async function writeStorage(rooms: RecentRoom[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch { /* quota — ignore */ }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useRecentRooms() {
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);

  // Load on mount
  useEffect(() => {
    readStorage().then(setRecentRooms);
  }, []);

  /**
   * addRecentRoom — upsert a visited room.
   * Called by RoomScreen as soon as rt.room is available.
   * Caps at MAX_ROOMS, sorted newest-first.
   */
  const addRecentRoom = useCallback(async (
    room: Omit<RecentRoom, 'visitedAt'>,
  ) => {
    const entry: RecentRoom = { ...room, visitedAt: Date.now() };
    const existing = await readStorage();

    const updated = [
      entry,
      ...existing.filter(r => r.id !== room.id),
    ].slice(0, MAX_ROOMS);

    setRecentRooms(updated);
    await writeStorage(updated);
  }, []);

  const clearRecentRooms = useCallback(async () => {
    setRecentRooms([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return { recentRooms, addRecentRoom, clearRecentRooms };
}

/**
 * Standalone add — callable outside React (e.g. from RoomScreen
 * where the hook is not mounted in the same subtree).
 */
export async function saveRecentRoom(
  room: Omit<RecentRoom, 'visitedAt'>,
): Promise<void> {
  const entry: RecentRoom = { ...room, visitedAt: Date.now() };
  const existing = await readStorage();
  const updated  = [
    entry,
    ...existing.filter(r => r.id !== room.id),
  ].slice(0, MAX_ROOMS);
  await writeStorage(updated);
}
