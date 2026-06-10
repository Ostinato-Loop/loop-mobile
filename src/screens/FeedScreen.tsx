import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, Search, Radio } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { LoopLogo } from '@/components/LoopLogo';
import { RoomCard } from '@/components/RoomCard';
import { useRooms, type Room, type RoomCategory } from '@/hooks/useRooms';
import { useNotifications } from '@/hooks/useNotifications';
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

  const handleRoomPress = useCallback((room: Room) => {
    nav.navigate('Room', { roomId: room.id });
  }, [nav]);

  const ListHeader = (
    <>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <LoopLogo size={26} />
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => nav.navigate('Notifications')}
          >
            <Bell size={22} color={Colors.foreground} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Category chips ── */}
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
    <View style={[styles.root, { backgroundColor: Colors.background }]}>
      <FlatList
        data={rooms}
        keyExtractor={r => r.id}
        renderItem={({ item }) => <RoomCard room={item} onPress={handleRoomPress} />}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Colors.live,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: Colors.foreground, fontSize: 10, fontWeight: '700' },
  chipScroll: { marginBottom: 8 },
  chipContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText:       { color: Colors.mutedFg, fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: Colors.primaryFg, fontWeight: '700' },
  list: { paddingBottom: 24 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { color: Colors.foreground, fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptyBody:  { color: Colors.mutedFg, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
