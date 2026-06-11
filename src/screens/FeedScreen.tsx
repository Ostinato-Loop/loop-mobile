/**
 * FeedScreen — African-First edition
 * AFRICAN-UX-001 (2026-06-11): Bell removed, Search icon, skeleton loaders
 * RETENTION-001 (2026-06-11): "Continue Listening" strip for returning users
 *
 * Spec: "When users return, show: Continue Listening, Recent Rooms.
 *        Never show an empty screen."
 *
 * LILCKY STUDIO LIMITED
 */
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ScrollView, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Search, Radio, History } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, avatarGradient, initials } from '@/constants/colors';
import { LoopLogo } from '@/components/LoopLogo';
import { RoomCard } from '@/components/RoomCard';
import { PresenceStrip } from '@/components/PresenceStrip';
import { useRooms, type Room, type RoomCategory } from '@/hooks/useRooms';
import { useLiveRoomCounts } from '@/hooks/useLiveRoomCounts';
import { usePresence } from '@/hooks/usePresence';
import { useAuth } from '@/hooks/useAuth';
import { useRecentRooms, type RecentRoom } from '@/hooks/useRecentRooms';
import type { RootStackParamList } from '@/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.skeletonLines}>
          <View style={[styles.skeletonLine, { width: '60%' }]} />
          <View style={[styles.skeletonLine, { width: '40%', marginTop: 6 }]} />
        </View>
        <View style={styles.skeletonBadge} />
      </View>
      <View style={[styles.skeletonLine, { width: '85%', marginTop: 12 }]} />
      <View style={[styles.skeletonLine, { width: '55%', marginTop: 8 }]} />
    </Animated.View>
  );
}

const SKELETON_COUNT = 5;

// ── Continue Listening strip ──────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  community: '🏘️', news: '📡', commentary: '🎙️',
  radio: '📻', 'dj-session': '🎧', education: '📚',
  business: '💼', general: '🎵',
};

function RecentRoomCard({
  room,
  onPress,
}: {
  room: RecentRoom;
  onPress: (id: string) => void;
}) {
  const grad     = avatarGradient(room.host_id);
  const ini      = initials(room.host?.display_name ?? room.host?.username ?? '?');
  const emoji    = CATEGORY_EMOJI[room.category] ?? '🎵';
  const hostName = room.host?.display_name ?? room.host?.username ?? 'Host';

  return (
    <TouchableOpacity
      style={styles.recentCard}
      onPress={() => onPress(room.id)}
      activeOpacity={0.8}
    >
      {/* Host avatar */}
      <LinearGradient colors={grad} style={styles.recentAvatar}>
        <Text style={styles.recentAvatarText}>{ini}</Text>
      </LinearGradient>

      {/* Live indicator */}
      {room.is_live && (
        <View style={styles.recentLiveBadge}>
          <View style={styles.recentLiveDot} />
          <Text style={styles.recentLiveText}>LIVE</Text>
        </View>
      )}

      {/* Category emoji */}
      <Text style={styles.recentEmoji}>{emoji}</Text>

      {/* Title */}
      <Text style={styles.recentTitle} numberOfLines={2}>{room.title}</Text>

      {/* Host */}
      <Text style={styles.recentHost} numberOfLines={1}>{hostName}</Text>
    </TouchableOpacity>
  );
}

function ContinueListeningStrip({
  rooms,
  onPress,
}: {
  rooms: RecentRoom[];
  onPress: (id: string) => void;
}) {
  if (rooms.length === 0) return null;

  return (
    <View style={styles.recentSection}>
      <View style={styles.recentHeader}>
        <History size={14} color={Colors.mutedFg} />
        <Text style={styles.recentHeaderText}>Continue Listening</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recentScroll}
      >
        {rooms.map(r => (
          <RecentRoomCard key={r.id} room={r} onPress={onPress} />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Category chips ────────────────────────────────────────────────────────────

const CATEGORIES: { label: string; value: RoomCategory | '' }[] = [
  { label: 'For you',    value: '' },
  { label: 'Community',  value: 'community' },
  { label: 'News',       value: 'news' },
  { label: 'Commentary', value: 'commentary' },
  { label: 'Radio',      value: 'radio' },
  { label: 'DJ',         value: 'dj-session' },
  { label: 'Education',  value: 'education' },
  { label: 'Business',   value: 'business' },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const nav    = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [activeCategory, setActiveCategory] = useState<RoomCategory | ''>('');
  const { rooms, loading, refreshing, refresh } = useRooms({ category: activeCategory });
  const { recentRooms } = useRecentRooms();

  // ── Live listener counts ──────────────────────────────────────────────
  const { counts, seedCounts, deltaFor } = useLiveRoomCounts();
  const [newlyLive, setNewlyLive] = useState<Set<string>>(new Set());
  const prevCountsRef = useRef<typeof counts>(new Map());

  useEffect(() => {
    if (rooms.length === 0) return;
    seedCounts(rooms.map(r => ({
      id:             r.id,
      audience_count: r.audience_count,
      is_live:        r.is_live,
    })));
  }, [rooms, seedCounts]);

  useEffect(() => {
    const justLive = new Set<string>();
    counts.forEach((val, id) => {
      const prev = prevCountsRef.current.get(id);
      if (val.isLive && prev && !prev.isLive) justLive.add(id);
    });
    prevCountsRef.current = counts;
    if (justLive.size === 0) return;
    setNewlyLive(justLive);
    const t = setTimeout(() => setNewlyLive(new Set()), 2000);
    return () => clearTimeout(t);
  }, [counts]);

  // ── Presence ──────────────────────────────────────────────────────────
  const selfPayload = useMemo(() => {
    if (!user?.id) return null;
    return {
      user_id:      user.id,
      display_name: profile?.display_name ?? profile?.username ?? null,
      avatar_url:   profile?.avatar_url ?? null,
      status:       'browsing' as const,
    };
  }, [user?.id, profile?.display_name, profile?.username, profile?.avatar_url]);

  const { online } = usePresence(selfPayload);

  // ── Navigation ────────────────────────────────────────────────────────
  const handleRoomPress = useCallback((room: Room) => {
    nav.navigate('Room', { roomId: room.id });
  }, [nav]);

  const handleRecentRoomPress = useCallback((roomId: string) => {
    nav.navigate('Room', { roomId });
  }, [nav]);

  const handlePresenceRoomPress = useCallback((roomId: string) => {
    nav.navigate('Room', { roomId });
  }, [nav]);

  // ── List header ───────────────────────────────────────────────────────
  const ListHeader = useMemo(() => (
    <>
      {/* ── Top bar ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <LoopLogo size={26} />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => nav.navigate('Discover')}
          hitSlop={8}
        >
          <Search size={22} color={Colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* ── Continue Listening strip (RETENTION-001) ── */}
      <ContinueListeningStrip
        rooms={recentRooms}
        onPress={handleRecentRoomPress}
      />

      {/* ── Who's online strip ── */}
      {online.length > 0 && (
        <PresenceStrip
          users={online}
          onRoomPress={handlePresenceRoomPress}
        />
      )}

      {/* ── Category filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContent}
      >
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat.value;
          return (
            <TouchableOpacity
              key={cat.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveCategory(cat.value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {rooms.length === 0 && !loading && (
        <View style={styles.empty}>
          <Radio size={40} color={Colors.mutedFg} />
          <Text style={styles.emptyTitle}>No live rooms right now</Text>
          <Text style={styles.emptyBody}>Be the first to go live for your community.</Text>
        </View>
      )}
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [insets.top, online, activeCategory, rooms.length, loading, recentRooms]);

  // ── First-load skeleton ───────────────────────────────────────────────
  if (loading && rooms.length === 0) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <LoopLogo size={26} />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={() => nav.navigate('Discover')}
            hitSlop={8}
          >
            <Search size={22} color={Colors.foreground} />
          </TouchableOpacity>
        </View>
        {/* Show recent rooms even during load — they're cached locally */}
        <ContinueListeningStrip
          rooms={recentRooms}
          onPress={handleRecentRoomPress}
        />
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={rooms}
        keyExtractor={r => r.id}
        renderItem={({ item }) => {
          const live   = counts.get(item.id);
          const delta  = deltaFor(item.id);
          const ripple = newlyLive.has(item.id);
          return (
            <RoomCard
              room={item}
              onPress={handleRoomPress}
              liveCount={live?.count}
              delta={delta > 0 ? delta : undefined}
              justWentLive={ripple}
            />
          );
        }}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        windowSize={5}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingBottom:     14,
  },
  searchBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: Colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Continue Listening (RETENTION-001) ───────────────────────────────
  recentSection: {
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 14,
  },
  recentHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 16,
    paddingTop:        12,
    paddingBottom:     10,
  },
  recentHeaderText: {
    color:       Colors.mutedFg,
    fontSize:    12,
    fontWeight:  '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  recentScroll: { paddingHorizontal: 16, gap: 10 },
  recentCard: {
    width:           160,
    backgroundColor: Colors.surface,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         12,
    position:        'relative',
  },
  recentAvatar: {
    width:          38,
    height:         38,
    borderRadius:   19,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   8,
  },
  recentAvatarText: { color: Colors.primaryFg, fontSize: 14, fontWeight: '700' },
  recentLiveBadge: {
    position:        'absolute',
    top:             8,
    right:           8,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: Colors.live + '22',
    borderRadius:    6,
    paddingHorizontal: 5,
    paddingVertical:   2,
  },
  recentLiveDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: Colors.live,
  },
  recentLiveText:  { color: Colors.live, fontSize: 10, fontWeight: '700' },
  recentEmoji:     { fontSize: 16, marginBottom: 4 },
  recentTitle: {
    color:      Colors.foreground,
    fontSize:   13,
    fontWeight: '600',
    lineHeight: 17,
    marginBottom: 4,
  },
  recentHost: { color: Colors.mutedFg, fontSize: 11 },

  // ── Category chips ────────────────────────────────────────────────────
  chipScroll:     { marginBottom: 8, marginTop: 10 },
  chipContent:    { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderRadius:      20,
    backgroundColor:   Colors.surface,
    borderWidth:       1,
    borderColor:       Colors.border,
    minHeight:         44,
    alignItems:        'center',
    justifyContent:    'center',
  },
  chipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:       { color: Colors.mutedFg, fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: Colors.primaryFg, fontWeight: '700' },
  list:           { paddingBottom: 24 },

  empty: {
    alignItems:        'center',
    paddingVertical:   60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color:      Colors.foreground,
    fontSize:   18,
    fontWeight: '700',
    marginTop:  16,
    textAlign:  'center',
  },
  emptyBody: {
    color:      Colors.mutedFg,
    fontSize:   14,
    textAlign:  'center',
    marginTop:  8,
    lineHeight: 20,
  },

  // ── Skeleton ──────────────────────────────────────────────────────────
  skeletonCard: {
    marginHorizontal: 16,
    marginTop:        12,
    padding:          14,
    borderRadius:     14,
    backgroundColor:  Colors.surface,
    borderWidth:      1,
    borderColor:      Colors.border,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  skeletonAvatar: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: Colors.border,
  },
  skeletonLines:  { flex: 1 },
  skeletonLine: {
    height:          10,
    borderRadius:    6,
    backgroundColor: Colors.border,
  },
  skeletonBadge: {
    width:           36,
    height:          18,
    borderRadius:    9,
    backgroundColor: Colors.border,
  },
});
