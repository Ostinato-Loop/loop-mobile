import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';

export type NotificationType =
  | 'room_live'
  | 'room_ended'
  | 'new_follower'
  | 'direct_message'
  | 'friend_request'
  | 'connection_accepted'
  | 'coin_received'
  | 'mention';

export type Notification = {
  id:         string;
  type:       NotificationType;
  title:      string;
  body:       string | null;
  is_read:    boolean;
  created_at: string;
  data: {
    /** For room_live / room_ended */
    room_id?:             string;
    room_title?:          string;
    /** For new_follower / friend_request / connection_accepted / mention */
    sender_id?:           string;
    sender_display_name?: string;
    sender_avatar?:       string;
    sender_username?:     string;
    /** For direct_message */
    conversation_id?:     string;
    /** For coin_received */
    amount_coins?:        number;
  } | null;
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread,        setUnread]        = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await apiGet<{ notifications: Notification[] }>(ENDPOINTS.notifications.list);
      const list = data.notifications ?? [];
      setNotifications(list);
      setUnread(list.filter(n => !n.is_read).length);
    } catch {
      /* silent — badge count stays stale rather than crashing */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
    try {
      await apiPost(ENDPOINTS.notifications.read, { notification_id: id });
    } catch { /* optimistic — ignore errors */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
    try {
      await apiPost(ENDPOINTS.notifications.readAll, {});
    } catch { /* optimistic */ }
  }, []);

  return {
    notifications,
    unread,
    loading,
    refreshing,
    refresh:     () => load(true),
    markRead,
    markAllRead,
  };
}
