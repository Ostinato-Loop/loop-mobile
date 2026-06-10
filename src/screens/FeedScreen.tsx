import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, Radio } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { LoopLogo } from '@/components/LoopLogo';
import { RoomCard } from '@/components/RoomCard';
import { useRooms, type Room, type RoomCategory } from '@/hooks/useRooms';
import { useNotifications } from '@/hooks/useNotifications';
import { useLiveRoomCounts } from '@/hooks/useLiveRoomCounts';
import type { RootStackParamList } from '@/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

export default function FeedScreen() {
  const nav    = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { unread } = useNotifications();

  const [activeCategory, setActiveCategory] = useState<RoomCategory | ''>('');
  const { rooms, loading, refreshing, refresh } = useRooms({ category: activeCategory });

  // ── Live counts from Supabase Realtime ────────────────────────────
  const { counts, seedCounts, deltaFor } = useLiveRoomCounts();

  // Track which rooms just flipped is_live=true for ripple animation
  const [newlyLive, setNewlyLive] = useState<Set<string>>(new Set());
  const prevCountsRef = React.useRef<typeof counts>(new Map());

  // Seed initial counts from the HTTP response once it loads
  useEffect(() => {
    if (rooms.length === 0) return;
    seedCounts(rooms.map(r => ({
      id: r.id,
      audience_count: r.audience_count,
      is_live: r.is_live,
    })));
  }, [rooms, seedCounts]);

  // Detect rooms that just went live via Realtime
  useEffect(() => {
    const justLive = new Set<string>();
    counts.forEach((val, id) => {
      const prev = prevCountsRef.current.get(id);
      if (val.isLive && prev && !prev.isLive) {
        justLive.add(id);
      }
    });
    prevCountsRef.current = counts;

    if (justLive.size > 0) {
      setNewlyLive(justLive);
      // Clear the ripple flags after 2 s
      const timer = setTimeout(() => setNewlyLive(new Set()), 2000);
      return () => clearTimeout(timer);
    }
  }, [counts]);

  const handleRoomPress = useCallback((room: Room) => {
    nav.navigate('Room', { roomId: room.id });
  }, [nav]);

  const ListHeader = (
    <>
      {/* ── Top bar ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <LoopLogo size={26} />
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => nav.navigate('Notifications')}
          >
            <Bell size={22} color={Colors.foreground} />
            {unread > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

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
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={rooms}
        keyExtractor={r => r.id}
        renderItem={({ item }) => {
          const live     = counts.get(item.id);
          const delta    = deltaFor(item.id);
          const ripple   = newlyLive.has(item.id);
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
        // Prevent unnecessary re-renders of off-screen cards
        removeClippedSubviews
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: Colors.live, borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  notifBadgeText: { color: Colors.foreground, fontSize: 10, fontWeight: '700' },
  chipScroll:  { marginBottom: 8 },
  chipContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    minHeight: 44, alignItems: 'center', justifyContent: 'center',
  },
  chipActive:      { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:        { color: Colors.mutedFg, fontSize: 14, fontWeight: '500' },
  chipTextActive:  { color: Colors.primaryFg, fontWeight: '700' },
  list:            { paddingBottom: 24 },
  empty:           { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle:      { color: Colors.foreground, fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptyBody:       { color: Colors.mutedFg, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
