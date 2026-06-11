/**
 * FeedScreen — African-First edition
 * AFRICAN-UX-001 (2026-06-11)
 *
 * Changes vs. prior version:
 *  • Bell icon removed — Notifications is now the "Alerts" tab (AFRICAN-UX-001)
 *  • Search icon added — taps open DiscoverScreen as a stack screen
 *  • Skeleton loaders: 5 shimmer cards replace blank state during first load
 *    (Rule 4: every screen must load gracefully on poor networks)
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
import { Search, Radio } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { LoopLogo } from '@/components/LoopLogo';
import { RoomCard } from '@/components/RoomCard';
import { PresenceStrip } from '@/components/PresenceStrip';
import { useRooms, type Room, type RoomCategory } from '@/hooks/useRooms';
import { useLiveRoomCounts } from '@/hooks/useLiveRoomCounts';
import { usePresence } from '@/hooks/usePresence';
import { useAuth } from '@/hooks/useAuth';
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

  const handlePresenceRoomPress = useCallback((roomId: string) => {
    nav.navigate('Room', { roomId });
  }, [nav]);

  // ── List header ───────────────────────────────────────────────────────
  const ListHeader = useMemo(() => (
    <>
      {/* ── Top bar ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <LoopLogo size={26} />
        {/* Search opens Discover as a stack screen (AFRICAN-UX-001) */}
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => nav.navigate('Discover')}
          hitSlop={8}
        >
          <Search size={22} color={Colors.foreground} />
        </TouchableOpacity>
      </View>

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
  ), [insets.top, online, activeCategory, rooms.length, loading]);

  // ── Show skeletons on first load ──────────────────────────────────────
  if (loading && rooms.length === 0) {
    return (
      <View style={styles.root}>
        {/* Header still visible during load */}
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
