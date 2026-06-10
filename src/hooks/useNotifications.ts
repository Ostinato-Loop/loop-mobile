import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';

export type Notification = {
  id: string;
  type: 'room_live' | 'room_ended' | 'new_follower' | 'direct_message' | 'friend_request' | 'connection_accepted';
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  data: Record<string, unknown> | null;
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ notifications: Notification[] }>(ENDPOINTS.notifications.list);
      const list = data.notifications ?? [];
      setNotifications(list);
      setUnread(list.filter(n => !n.is_read).length);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = useCallback(async (id: string) => {
    await apiPost(ENDPOINTS.notifications.read, { notification_id: id });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await apiPost(ENDPOINTS.notifications.readAll, {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  }, []);

  return { notifications, unread, loading, refresh: load, markRead, markAllRead };
}
