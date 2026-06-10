/**
 * NotificationsScreen
 *
 * Grouped, deep-linked notification feed.
 *
 * Groups: Today · Yesterday · This week · Earlier
 * Filter tabs: All | Unread
 *
 * Tap actions:
 *   room_live / room_ended      → Room (if room_id available)
 *   new_follower / friend_req / connection_accepted → UserProfile
 *   direct_message              → Thread
 *   coin_received               → Earnings
 *   mention                     → Room (if room_id available)
 *
 * Avatar: shown for people-based types using sender_avatar or
 *         a gradient initial fallback.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft, Radio, UserPlus, MessageCircle,
  CheckCircle2, Coins, AtSign, BellOff,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, avatarGradient, initials } from '@/constants/colors';
import { useNotifications, type Notification, type NotificationType } from '@/hooks/useNotifications';
import type { RootStackParamList } from '@/navigation/index';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Time helpers ──────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dayBucket(iso: string): string {
  const now  = new Date();
  const date = new Date(iso);
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = todayStart.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (diff <= 0)        return 'Today';
  if (diff <= 86400000) return 'Yesterday';
  if (diff <= 6 * 86400000) return 'This week';
  return 'Earlier';
}

const BUCKET_ORDER = ['Today', 'Yesterday', 'This week', 'Earlier'];

// ── Icon / color config ───────────────────────────────────────────────────────

type IconCfg = { bg: string; icon: React.ReactElement };

function iconConfig(type: NotificationType): IconCfg {
  switch (type) {
    case 'room_live':
      return { bg: Colors.live + '22',    icon: <Radio        size={18} color={Colors.live}    /> };
    case 'room_ended':
      return { bg: Colors.mutedFg + '22', icon: <Radio        size={18} color={Colors.mutedFg} /> };
    case 'new_follower':
      return { bg: Colors.primary + '22', icon: <UserPlus     size={18} color={Colors.primary} /> };
    case 'friend_request':
      return { bg: Colors.accent + '22',  icon: <UserPlus     size={18} color={Colors.accent}  /> };
    case 'connection_accepted':
      return { bg: Colors.primary + '22', icon: <CheckCircle2 size={18} color={Colors.primary} /> };
    case 'direct_message':
      return { bg: Colors.accent + '22',  icon: <MessageCircle size={18} color={Colors.accent} /> };
    case 'coin_received':
      return { bg: Colors.primary + '22', icon: <Coins        size={18} color={Colors.primary} /> };
    case 'mention':
      return { bg: Colors.accent + '22',  icon: <AtSign       size={18} color={Colors.accent}  /> };
    default:
      return { bg: Colors.border,          icon: <Radio        size={18} color={Colors.mutedFg} /> };
  }
}

const PEOPLE_TYPES: NotificationType[] = [
  'new_follower', 'friend_request', 'connection_accepted', 'direct_message', 'mention',
];

// ── Avatar ────────────────────────────────────────────────────────────────────

function NotifAvatar({ item }: { item: Notification }) {
  const isPeople = PEOPLE_TYPES.includes(item.type);
  const cfg      = iconConfig(item.type);

  if (isPeople && item.data?.sender_avatar) {
    return (
      <View style={styles.avatarWrap}>
        <Image source={{ uri: item.data.sender_avatar }} style={styles.avatarImg} />
        <View style={[styles.typeChip, { backgroundColor: cfg.bg }]}>
          {cfg.icon}
        </View>
      </View>
    );
  }

  if (isPeople && item.data?.sender_id) {
    const grad = avatarGradient(item.data.sender_id);
    const name = initials(item.data.sender_display_name ?? item.data.sender_username ?? '?');
    return (
      <View style={styles.avatarWrap}>
        <LinearGradient colors={[...grad]} style={styles.avatarGrad}>
          <Text style={styles.avatarInitials}>{name}</Text>
        </LinearGradient>
        <View style={[styles.typeChip, { backgroundColor: cfg.bg }]}>
          {cfg.icon}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
      {cfg.icon}
    </View>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

type RowProps = {
  item:     Notification;
  onPress:  (item: Notification) => void;
};

function NotifRow({ item, onPress }: RowProps) {
  const coinAmt = item.data?.amount_coins;

  return (
    <TouchableOpacity
      style={[styles.row, !item.is_read && styles.rowUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <NotifAvatar item={item} />

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, !item.is_read && styles.rowTitleUnread]} numberOfLines={2}>
            {item.title}
            {coinAmt ? (
              <Text style={styles.coinInline}>  ⬡ +{coinAmt.toLocaleString()}</Text>
            ) : null}
          </Text>
        </View>
        {item.body ? (
          <Text style={styles.rowBody2} numberOfLines={2}>{item.body}</Text>
        ) : null}
        <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
      </View>

      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

type Filter = 'all' | 'unread';

function FilterTabs({ active, onChange, unreadCount }: {
  active:       Filter;
  onChange:     (f: Filter) => void;
  unreadCount:  number;
}) {
  return (
    <View style={styles.tabs}>
      {(['all', 'unread'] as Filter[]).map(f => (
        <TouchableOpacity
          key={f}
          style={[styles.tab, active === f && styles.tabActive]}
          onPress={() => onChange(f)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, active === f && styles.tabTextActive]}>
            {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const nav    = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const { notifications, unread, loading, refreshing, refresh, markRead, markAllRead } =
    useNotifications();

  const [filter, setFilter] = useState<Filter>('all');

  // ── Build sections ─────────────────────────────────────────────────────────
  const sections = useMemo(() => {
    const filtered = filter === 'unread'
      ? notifications.filter(n => !n.is_read)
      : notifications;

    const buckets: Record<string, Notification[]> = {};
    for (const n of filtered) {
      const b = dayBucket(n.created_at);
      if (!buckets[b]) buckets[b] = [];
      buckets[b].push(n);
    }

    return BUCKET_ORDER
      .filter(b => buckets[b]?.length > 0)
      .map(b => ({
        title: b,
        data:  buckets[b],
        unread: buckets[b].filter(n => !n.is_read).length,
      }));
  }, [notifications, filter]);

  // ── Tap handler ────────────────────────────────────────────────────────────
  const handlePress = useCallback(async (item: Notification) => {
    if (!item.is_read) {
      await markRead(item.id);
      await Haptics.selectionAsync();
    }

    const { type, data } = item;

    if ((type === 'room_live' || type === 'room_ended' || type === 'mention') && data?.room_id) {
      nav.navigate('Room', { roomId: data.room_id });
      return;
    }
    if (
      (type === 'new_follower' || type === 'friend_request' || type === 'connection_accepted')
      && data?.sender_id
    ) {
      nav.navigate('UserProfile', { userId: data.sender_id });
      return;
    }
    if (type === 'direct_message' && data?.conversation_id) {
      nav.navigate('Thread', { conversationId: data.conversation_id });
      return;
    }
    if (type === 'coin_received') {
      nav.navigate('Earnings');
      return;
    }
  }, [markRead, nav]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const hasUnread = unread > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread ? (
          <TouchableOpacity
            onPress={async () => {
              await markAllRead();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
            style={styles.markAllBtn}
          >
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 88 }} />}
      </View>

      {/* Filter tabs */}
      <FilterTabs active={filter} onChange={setFilter} unreadCount={unread} />

      {/* List */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={n => n.id}
          renderItem={({ item }) => <NotifRow item={item} onPress={handlePress} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.unread > 0 && (
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{section.unread}</Text>
                </View>
              )}
            </View>
          )}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <BellOff size={48} color={Colors.mutedFg} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>
                {filter === 'unread' ? 'All caught up' : 'Nothing yet'}
              </Text>
              <Text style={styles.emptySub}>
                {filter === 'unread'
                  ? 'No unread notifications right now.'
                  : 'You\'ll see rooms going live, new followers, messages and coin drops here.'}
              </Text>
            </View>
          }
          removeClippedSubviews
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 46;
const CHIP_SIZE   = 20;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10, paddingTop: 2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', color: Colors.foreground, fontSize: 17, fontWeight: '700' },
  markAllBtn:   { width: 88, alignItems: 'flex-end', paddingRight: 4 },
  markAllText:  { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  // Filter tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16, paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
  },
  tabActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText:       { color: Colors.mutedFg, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: Colors.primaryFg },

  // Section
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
    backgroundColor: Colors.background,
  },
  sectionTitle: { color: Colors.mutedFg, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  sectionBadge: {
    backgroundColor: Colors.primary + '22',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1,
  },
  sectionBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },

  listContent: { paddingBottom: 40 },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 12,
  },
  rowUnread:      { backgroundColor: Colors.primary + '07' },
  rowBody:        { flex: 1 },
  rowTop:         { flexDirection: 'row', alignItems: 'flex-start' },
  rowTitle:       { flex: 1, color: Colors.mutedFg, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  rowTitleUnread: { color: Colors.foreground, fontWeight: '700' },
  rowBody2:       { color: Colors.mutedFg, fontSize: 13, lineHeight: 18, marginTop: 3 },
  rowTime:        { color: Colors.mutedFg, fontSize: 12, marginTop: 4 },
  coinInline:     { color: Colors.primary, fontWeight: '700' },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 7, flexShrink: 0,
  },

  // Icon circle (non-people)
  iconCircle: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  // Avatar (people)
  avatarWrap: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    flexShrink: 0,
  },
  avatarImg: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.surface,
  },
  avatarGrad: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { color: '#fff', fontSize: 15, fontWeight: '700' },
  typeChip: {
    position: 'absolute', bottom: -2, right: -2,
    width: CHIP_SIZE, height: CHIP_SIZE, borderRadius: CHIP_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.background,
  },

  // Empty
  empty:       { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle:  { color: Colors.foreground, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 10 },
  emptySub:    { color: Colors.mutedFg, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
