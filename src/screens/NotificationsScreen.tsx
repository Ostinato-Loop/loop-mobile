import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Radio, UserPlus, MessageCircle, Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useNotifications, type Notification } from '@/hooks/useNotifications';

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotifIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'room_live':           return <Radio size={20} color={Colors.live} />;
    case 'room_ended':          return <Radio size={20} color={Colors.mutedFg} />;
    case 'new_follower':        return <UserPlus size={20} color={Colors.primary} />;
    case 'direct_message':      return <MessageCircle size={20} color={Colors.accent} />;
    case 'friend_request':      return <UserPlus size={20} color={Colors.accent} />;
    case 'connection_accepted': return <Check size={20} color={Colors.primary} />;
    default:                    return <Radio size={20} color={Colors.mutedFg} />;
  }
}

export default function NotificationsScreen() {
  const nav    = useNavigation();
  const insets = useSafeAreaInsets();
  const { notifications, loading, markRead, markAllRead } = useNotifications();

  const renderItem = useCallback(({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.item, !item.is_read && styles.itemUnread]}
      onPress={() => markRead(item.id)}
      activeOpacity={0.8}
    >
      <View style={styles.iconWrap}>
        <NotifIcon type={item.type} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
        {item.body ? (
          <Text style={styles.itemBody2} numberOfLines={2}>{item.body}</Text>
        ) : null}
        <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
      </View>
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  ), [markRead]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.back} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {notifications.some(n => !n.is_read) ? (
          <TouchableOpacity onPress={markAllRead} style={styles.markAll}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 80 }} />}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={n => n.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptySub}>You'll see activity here when rooms go live, someone follows you, or messages arrive.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  back:        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title:       { flex: 1, color: Colors.foreground, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  markAll:     { width: 80, alignItems: 'flex-end', paddingRight: 4 },
  markAllText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  list:        { paddingVertical: 8, paddingBottom: 32 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemUnread:  { backgroundColor: Colors.primary + '08' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  itemBody:  { flex: 1 },
  itemTitle: { color: Colors.foreground, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  itemBody2: { color: Colors.mutedFg, fontSize: 13, lineHeight: 18, marginTop: 3 },
  itemTime:  { color: Colors.mutedFg, fontSize: 12, marginTop: 4 },
  unreadDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 6, marginLeft: 8, flexShrink: 0,
  },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { color: Colors.foreground, fontSize: 18, fontWeight: '700', marginBottom: 10 },
  emptySub:   { color: Colors.mutedFg, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
