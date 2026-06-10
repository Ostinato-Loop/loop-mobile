import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Search, Globe2, Radio, MapPin, TrendingUp, Users } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { RoomCard } from '@/components/RoomCard';
import { Avatar } from '@/components/Avatar';
import { apiGet } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';
import { useRooms, type Room } from '@/hooks/useRooms';
import type { RootStackParamList } from '@/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FeedTab = 'all' | 'live' | 'people' | 'trending';

const TABS: { key: FeedTab; label: string; Icon: React.ComponentType<any> }[] = [
  { key: 'all',      label: 'All',     Icon: Globe2 },
  { key: 'live',     label: 'Live',    Icon: Radio },
  { key: 'people',   label: 'People',  Icon: Users },
  { key: 'trending', label: 'Trending',Icon: TrendingUp },
];

type Person = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  followers_count: number;
};

export default function DiscoverScreen() {
  const nav    = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [tab,    setTab]    = useState<FeedTab>('all');
  const [query,  setQuery]  = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);

  const liveOnly = tab === 'live';
  const { rooms, loading, refreshing, refresh } = useRooms({ live_only: liveOnly });

  useEffect(() => {
    if (tab !== 'people') return;
    setLoadingPeople(true);
    apiGet<{ people: Person[] }>(ENDPOINTS.follows.suggestions)
      .then(d => setPeople(d.people ?? []))
      .catch(() => {})
      .finally(() => setLoadingPeople(false));
  }, [tab]);

  const handleRoomPress = useCallback((room: Room) => {
    nav.navigate('Room', { roomId: room.id });
  }, [nav]);

  const filteredRooms = query
    ? rooms.filter(r => r.title.toLowerCase().includes(query.toLowerCase()))
    : rooms;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Search size={18} color={Colors.mutedFg} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search rooms, people…"
          placeholderTextColor={Colors.mutedFg}
          returnKeyType="search"
        />
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContent}
      >
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.75}
            >
              <t.Icon size={15} color={active ? Colors.primaryFg : Colors.mutedFg} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {tab === 'people' ? (
        <FlatList
          data={people}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            loadingPeople
              ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
              : <Text style={styles.emptyText}>No suggestions yet</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.personCard}>
              <Avatar userId={item.id} name={item.display_name} avatarUrl={item.avatar_url} size={48} />
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{item.display_name ?? item.username}</Text>
                {item.username && <Text style={styles.personHandle}>@{item.username}</Text>}
                <Text style={styles.personSubs}>{item.followers_count} followers</Text>
              </View>
              <TouchableOpacity style={styles.followBtn}>
                <Text style={styles.followBtnText}>Follow</Text>
              </TouchableOpacity>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <RoomCard room={item} onPress={handleRoomPress} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh}
              tintColor={Colors.primary} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            loading
              ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
              : <Text style={styles.emptyText}>No rooms found</Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, color: Colors.foreground, fontSize: 16 },
  tabScroll:   { flexGrow: 0, marginBottom: 8 },
  tabContent:  { paddingHorizontal: 16, gap: 8 },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
  },
  tabBtnActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabLabel:      { color: Colors.mutedFg, fontSize: 13, fontWeight: '500' },
  tabLabelActive:{ color: Colors.primaryFg, fontWeight: '700' },
  list: { paddingBottom: 24 },
  emptyText: { color: Colors.mutedFg, textAlign: 'center', marginTop: 60, fontSize: 15 },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  personInfo: { flex: 1, marginLeft: 12 },
  personName: { color: Colors.foreground, fontSize: 15, fontWeight: '600' },
  personHandle:{ color: Colors.mutedFg, fontSize: 13, marginTop: 2 },
  personSubs:  { color: Colors.mutedFg, fontSize: 12, marginTop: 2 },
  followBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
