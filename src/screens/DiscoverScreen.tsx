/**
 * DiscoverScreen
 *
 * Three modes controlled by the tab bar + search input:
 *
 *  DEFAULT (Trending tab, no query)
 *    • Trending tags strip — chips derived from top live rooms
 *    • Tap a tag → filters rooms to that tag (active tag shown as dismissible pill)
 *    • Room list sorted by audience_count (trending=true API param)
 *
 *  LIVE tab
 *    • live_only=true, same tag filtering
 *
 *  PEOPLE tab
 *    • Suggested follows from /api/follows/suggestions
 *    • Follow / Unfollow with optimistic UI
 *
 *  SEARCH mode (query.length >= 2)
 *    • Debounced 350ms — sends search=query to API
 *    • Replaces tab content with two sections: Rooms + People
 *    • Active tab is remembered; clear query to return to it
 */
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, TextInput, FlatList, SectionList,
  TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Search, X, Globe2, Radio, Users,
  TrendingUp, BadgeCheck, Hash,
} from 'lucide-react-native';
import { Colors, avatarGradient, initials } from '@/constants/colors';
import { RoomCard } from '@/components/RoomCard';
import { Avatar } from '@/components/Avatar';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';
import { useRooms, trendingTagsFrom, type Room } from '@/hooks/useRooms';
import type { RootStackParamList } from '@/navigation';
import { LinearGradient } from 'expo-linear-gradient';

type Nav  = NativeStackNavigationProp<RootStackParamList>;
type Tab  = 'trending' | 'live' | 'people';

type Person = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  followers_count: number;
  is_following?: boolean;
};

const TABS: { key: Tab; label: string; Icon: React.ComponentType<any> }[] = [
  { key: 'trending', label: 'Trending', Icon: TrendingUp },
  { key: 'live',     label: 'Live now', Icon: Radio },
  { key: 'people',   label: 'People',   Icon: Users },
];

const SEARCH_DEBOUNCE_MS = 350;

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const nav    = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  // ── State ──────────────────────────────────────────────────────────
  const [tab,        setTab]        = useState<Tab>('trending');
  const [query,      setQuery]      = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [activeTag,  setActiveTag]  = useState<string | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout>>();

  // Search mode when query has meaningful content
  const isSearching = debouncedQ.length >= 2;

  // ── Debounce ────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length === 0) { setDebouncedQ(''); return; }
    debounceRef.current = setTimeout(() => setDebouncedQ(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // ── Rooms data ──────────────────────────────────────────────────────
  const roomFilters = useMemo(() => {
    if (isSearching)        return { search: debouncedQ, limit: 20 };
    if (tab === 'live')     return { live_only: true, ...(activeTag ? { tags: [activeTag] } : {}) };
    return { trending: true, ...(activeTag ? { tags: [activeTag] } : {}), limit: 30 };
  }, [tab, debouncedQ, isSearching, activeTag]);

  const { rooms, loading, refreshing, refresh } = useRooms(roomFilters);

  // Trending tags derived from current room list (stable between re-renders)
  const trendingTags = useMemo(
    () => trendingTagsFrom(rooms, 14),
    [rooms]
  );

  // ── People (suggestions + search) ──────────────────────────────────
  const [people,        setPeople]        = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [followLoading, setFollowLoading] = useState<Set<string>>(new Set());

  const fetchPeople = useCallback(async (q?: string) => {
    setLoadingPeople(true);
    try {
      const url = q
        ? `${ENDPOINTS.follows.suggestions}?search=${encodeURIComponent(q)}`
        : ENDPOINTS.follows.suggestions;
      const data = await apiGet<{ people: Person[] }>(url);
      setPeople(data.people ?? []);
    } catch {
      /* silent */
    } finally {
      setLoadingPeople(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'people' && !isSearching) fetchPeople();
  }, [tab, isSearching]);

  useEffect(() => {
    if (isSearching) fetchPeople(debouncedQ);
  }, [isSearching, debouncedQ]);

  // ── Follow / Unfollow ───────────────────────────────────────────────
  const toggleFollow = useCallback(async (person: Person) => {
    setFollowLoading(prev => new Set(prev).add(person.id));
    // Optimistic update
    setPeople(prev =>
      prev.map(p => p.id === person.id ? { ...p, is_following: !p.is_following } : p)
    );
    try {
      if (person.is_following) {
        await apiDelete(ENDPOINTS.follows.unfollow(person.id));
      } else {
        await apiPost(ENDPOINTS.follows.follow(person.id), {});
      }
    } catch {
      // Revert on failure
      setPeople(prev =>
        prev.map(p => p.id === person.id ? { ...p, is_following: !p.is_following } : p)
      );
    } finally {
      setFollowLoading(prev => { const s = new Set(prev); s.delete(person.id); return s; });
    }
  }, []);

  const handleRoomPress = useCallback((room: Room) => {
    nav.navigate('Room', { roomId: room.id });
  }, [nav]);

  // ── Render helpers ──────────────────────────────────────────────────

  function renderRoomItem({ item }: { item: Room }) {
    return <RoomCard room={item} onPress={handleRoomPress} />;
  }

  function renderPersonItem({ item }: { item: Person }) {
    const grad    = avatarGradient(item.id);
    const ini     = initials(item.display_name);
    const loading = followLoading.has(item.id);
    return (
      <View style={styles.personCard}>
        {item.avatar_url ? (
          <Avatar userId={item.id} name={item.display_name} avatarUrl={item.avatar_url} size={48} />
        ) : (
          <LinearGradient colors={grad} style={styles.personAvatar}>
            <Text style={styles.personAvatarText}>{ini}</Text>
          </LinearGradient>
        )}
        <View style={styles.personInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.personName} numberOfLines={1}>
              {item.display_name ?? item.username ?? 'User'}
            </Text>
            {item.is_verified && (
              <BadgeCheck size={13} color={Colors.primary} style={{ marginLeft: 4 }} />
            )}
          </View>
          {item.username && (
            <Text style={styles.personHandle}>@{item.username}</Text>
          )}
          <Text style={styles.personSubs}>
            {item.followers_count.toLocaleString()} followers
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.followBtn, item.is_following && styles.followingBtn]}
          onPress={() => toggleFollow(item)}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator size="small" color={item.is_following ? Colors.mutedFg : Colors.primary} />
            : <Text style={[styles.followBtnText, item.is_following && styles.followingBtnText]}>
                {item.is_following ? 'Following' : 'Follow'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    );
  }

  // ── Trending tag strip ──────────────────────────────────────────────
  function TagStrip() {
    if (trendingTags.length === 0) return null;
    return (
      <View style={styles.tagStripWrap}>
        <View style={styles.tagStripHeader}>
          <Hash size={13} color={Colors.mutedFg} />
          <Text style={styles.tagStripTitle}>Trending tags</Text>
          {activeTag && (
            <TouchableOpacity
              onPress={() => setActiveTag(null)}
              style={styles.clearTagBtn}
            >
              <Text style={styles.clearTagText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagStripScroll}
        >
          {trendingTags.map(tag => {
            const active = activeTag === tag;
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tagChip, active && styles.tagChipActive]}
                onPress={() => setActiveTag(active ? null : tag)}
                activeOpacity={0.75}
              >
                <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                  #{tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ── Search results (combined rooms + people sections) ───────────────
  function SearchResults() {
    const roomSection   = { title: 'Rooms',  data: rooms,  type: 'rooms'  as const };
    const peopleSection = { title: 'People', data: people, type: 'people' as const };
    const sections      = [roomSection, peopleSection].filter(s => s.data.length > 0);

    if (loading || loadingPeople) {
      return <ActivityIndicator color={Colors.primary} style={styles.centeredSpinner} />;
    }
    if (sections.length === 0) {
      return (
        <View style={styles.emptyWrap}>
          <Search size={36} color={Colors.mutedFg} />
          <Text style={styles.emptyTitle}>No results for "{debouncedQ}"</Text>
          <Text style={styles.emptyBody}>Try a different word or check for typos.</Text>
        </View>
      );
    }

    return (
      <SectionList
        sections={sections}
        keyExtractor={(item: any) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item, section }: any) =>
          section.type === 'rooms'
            ? renderRoomItem({ item })
            : renderPersonItem({ item })
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    );
  }

  // ── Main render ─────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Search size={17} color={Colors.mutedFg} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search rooms, people, tags…"
          placeholderTextColor={Colors.mutedFg}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setDebouncedQ(''); }}>
            <X size={16} color={Colors.mutedFg} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs (hidden while searching) */}
      {!isSearching && (
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
                onPress={() => { setTab(t.key); setActiveTag(null); }}
                activeOpacity={0.75}
              >
                <t.Icon size={14} color={active ? Colors.primaryFg : Colors.mutedFg} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Body */}
      {isSearching ? (
        <SearchResults />
      ) : tab === 'people' ? (
        <FlatList
          data={people}
          keyExtractor={p => p.id}
          renderItem={renderPersonItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loadingPeople
              ? <ActivityIndicator color={Colors.primary} style={styles.centeredSpinner} />
              : <Text style={styles.emptyText}>No suggestions yet</Text>
          }
        />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={r => r.id}
          renderItem={renderRoomItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<TagStrip />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            loading
              ? <ActivityIndicator color={Colors.primary} style={styles.centeredSpinner} />
              : (
                <View style={styles.emptyWrap}>
                  <Radio size={36} color={Colors.mutedFg} />
                  <Text style={styles.emptyTitle}>
                    {activeTag ? `No rooms tagged #${activeTag}` : 'No rooms right now'}
                  </Text>
                  {activeTag && (
                    <TouchableOpacity onPress={() => setActiveTag(null)}>
                      <Text style={styles.emptyAction}>Clear tag filter</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
          }
          removeClippedSubviews
          windowSize={5}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 14,
    marginHorizontal: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, height: 48,
  },
  searchInput: { flex: 1, color: Colors.foreground, fontSize: 15 },

  tabScroll:   { flexGrow: 0, marginBottom: 8 },
  tabContent:  { paddingHorizontal: 16, gap: 8 },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    minHeight: 44,
  },
  tabBtnActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabLabel:      { color: Colors.mutedFg, fontSize: 13, fontWeight: '500' },
  tabLabelActive:{ color: Colors.primaryFg, fontWeight: '700' },

  // Trending tag strip
  tagStripWrap: { paddingBottom: 14, marginBottom: 4 },
  tagStripHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, marginBottom: 10,
  },
  tagStripTitle: { color: Colors.mutedFg, fontSize: 12, fontWeight: '600', flex: 1 },
  clearTagBtn: {
    backgroundColor: Colors.primary + '18', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  clearTagText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  tagStripScroll: { paddingHorizontal: 16, gap: 8 },
  tagChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  tagChipActive:     { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  tagChipText:       { color: Colors.mutedFg, fontSize: 13, fontWeight: '500' },
  tagChipTextActive: { color: Colors.primary, fontWeight: '700' },

  list:             { paddingBottom: 32 },
  centeredSpinner:  { marginTop: 48 },
  emptyText:        { color: Colors.mutedFg, textAlign: 'center', marginTop: 60, fontSize: 15 },
  emptyWrap:        { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle:       { color: Colors.foreground, fontSize: 16, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  emptyBody:        { color: Colors.mutedFg, fontSize: 13, marginTop: 6, textAlign: 'center' },
  emptyAction:      { color: Colors.primary, fontSize: 14, fontWeight: '600', marginTop: 10 },

  // Search section headers
  sectionHeader: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sectionTitle: { color: Colors.foreground, fontSize: 14, fontWeight: '700' },

  // People
  personCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 12,
  },
  personAvatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  personAvatarText: { color: Colors.foreground, fontSize: 16, fontWeight: '700' },
  nameRow:          { flexDirection: 'row', alignItems: 'center' },
  personInfo:       { flex: 1 },
  personName:       { color: Colors.foreground, fontSize: 15, fontWeight: '600' },
  personHandle:     { color: Colors.mutedFg, fontSize: 12, marginTop: 2 },
  personSubs:       { color: Colors.mutedFg, fontSize: 12, marginTop: 2 },
  followBtn: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1.5, borderColor: Colors.primary, minWidth: 82, minHeight: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  followingBtn:     { borderColor: Colors.border, backgroundColor: Colors.surface },
  followBtnText:    { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  followingBtnText: { color: Colors.mutedFg },
});
