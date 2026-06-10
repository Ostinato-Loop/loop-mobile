/**
 * ProfileScreen
 *
 * Sections:
 *   1. Identity card — avatar, name, username, bio, location
 *   2. Stats row — Followers · Following · Rooms hosted
 *   3. Edit profile button → EditProfileSheet slide-up
 *   4. Past rooms section — FlatList of hosted rooms (lazy-loaded)
 *   5. Settings menu — Notifications, Language, Privacy
 *   6. Sign out
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Settings, Bell, BadgeCheck, MapPin,
  LogOut, ChevronRight, Globe2, Shield,
  Pencil, Radio, Mic,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, avatarGradient, initials } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { EditProfileSheet } from '@/components/EditProfileSheet';
import { useAuth } from '@/hooks/useAuth';
import { useHostedRooms } from '@/hooks/useHostedRooms';
import type { Room } from '@/hooks/useRooms';
import type { RootStackParamList } from '@/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORY_EMOJI: Record<string, string> = {
  community: '🏘️', news: '📡', commentary: '🎙️',
  radio: '📻', 'dj-session': '🎧', education: '📚',
  business: '💼', general: '🎵',
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function HostedRoomRow({ room, onPress }: { room: Room; onPress: () => void }) {
  const emoji = CATEGORY_EMOJI[room.category] ?? '🎵';
  return (
    <TouchableOpacity style={styles.roomRow} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.roomIcon, room.is_live && styles.roomIconLive]}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={styles.roomInfo}>
        <View style={styles.roomTitleRow}>
          <Text style={styles.roomTitle} numberOfLines={1}>{room.title}</Text>
          {room.is_live && (
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveChipText}>LIVE</Text>
            </View>
          )}
        </View>
        <View style={styles.roomMeta}>
          <Text style={styles.roomMetaText}>{room.category}</Text>
          <Text style={styles.roomMetaDot}>·</Text>
          <Mic size={11} color={Colors.mutedFg} />
          <Text style={styles.roomMetaText}>{formatCount(room.audience_count)}</Text>
        </View>
      </View>
      <ChevronRight size={16} color={Colors.mutedFg} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const nav    = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [editVisible, setEditVisible] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);

  // Past rooms — load on mount (profile tab is always mounted)
  const {
    rooms: hostedRooms,
    loading: loadingRooms,
    refresh: refreshRooms,
  } = useHostedRooms({ limit: 20 });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), refreshRooms()]);
    setRefreshing(false);
  }, [refreshProfile, refreshRooms]);

  const handleRoomPress = useCallback((room: Room) => {
    nav.navigate('Room', { roomId: room.id });
  }, [nav]);

  const name = profile?.display_name ?? profile?.username ?? user?.phone ?? 'You';
  const grad  = avatarGradient(profile?.id ?? '');
  const ini   = initials(name);

  // ── Header / identity card (used as ListHeaderComponent) ──────────
  const ListHeader = (
    <>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.topBarTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => nav.navigate('Settings')}
          hitSlop={12}
        >
          <Settings size={22} color={Colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Identity card */}
      <View style={styles.card}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {profile?.avatar_url ? (
            <Avatar
              userId={profile.id}
              name={profile.display_name}
              avatarUrl={profile.avatar_url}
              size={80}
            />
          ) : (
            <LinearGradient colors={grad} style={styles.avatarGrad}>
              <Text style={styles.avatarText}>{ini}</Text>
            </LinearGradient>
          )}
          {profile?.is_verified && (
            <View style={styles.verifiedBadge}>
              <BadgeCheck size={16} color={Colors.primary} />
            </View>
          )}
        </View>

        {/* Name + handle */}
        <Text style={styles.displayName}>{name}</Text>
        {profile?.username && (
          <Text style={styles.username}>@{profile.username}</Text>
        )}
        {profile?.bio && (
          <Text style={styles.bio}>{profile.bio}</Text>
        )}
        {(profile?.state_id || profile?.country_id) && (
          <View style={styles.locationRow}>
            <MapPin size={12} color={Colors.mutedFg} />
            <Text style={styles.locationText}>
              {[profile.state_id, profile.country_id].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}

        {/* Stats — Followers · Following · Rooms */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{formatCount(profile?.followers_count ?? 0)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{formatCount(profile?.following_count ?? 0)}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{loadingRooms ? '—' : formatCount(hostedRooms.length)}</Text>
            <Text style={styles.statLabel}>Rooms</Text>
          </View>
        </View>

        {/* Edit profile button */}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => setEditVisible(true)}
          activeOpacity={0.8}
        >
          <Pencil size={14} color={Colors.primary} />
          <Text style={styles.editBtnText}>Edit profile</Text>
        </TouchableOpacity>
      </View>

      {/* Past rooms section header */}
      <View style={styles.sectionHeader}>
        <Radio size={14} color={Colors.mutedFg} />
        <Text style={styles.sectionTitle}>Rooms hosted</Text>
      </View>

      {loadingRooms && (
        <ActivityIndicator
          color={Colors.primary}
          style={{ marginVertical: 24 }}
        />
      )}

      {!loadingRooms && hostedRooms.length === 0 && (
        <View style={styles.emptyRooms}>
          <Text style={styles.emptyRoomsText}>You haven't hosted any rooms yet.</Text>
          <TouchableOpacity onPress={() => nav.navigate('Main')}>
            <Text style={styles.emptyRoomsAction}>Go live now →</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  // ── Settings + sign-out (ListFooterComponent) ─────────────────────
  const ListFooter = (
    <>
      {/* Settings menu */}
      <View style={styles.menu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => nav.navigate('Notifications')}
        >
          <Bell size={20} color={Colors.foreground} />
          <Text style={styles.menuLabel}>Notifications</Text>
          <ChevronRight size={16} color={Colors.mutedFg} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Globe2 size={20} color={Colors.foreground} />
          <Text style={styles.menuLabel}>Language & Region</Text>
          <ChevronRight size={16} color={Colors.mutedFg} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]}>
          <Shield size={20} color={Colors.foreground} />
          <Text style={styles.menuLabel}>Privacy & Safety</Text>
          <ChevronRight size={16} color={Colors.mutedFg} />
        </TouchableOpacity>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <LogOut size={18} color={Colors.destructive} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Loop v1.0.0 · Powered by RALD</Text>
    </>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={hostedRooms}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <HostedRoomRow room={item} onPress={() => handleRoomPress(item)} />
        )}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        removeClippedSubviews
      />

      {/* Edit Profile bottom sheet */}
      {profile && (
        <EditProfileSheet
          visible={editVisible}
          onClose={() => setEditVisible(false)}
          profile={profile}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  list: { paddingBottom: 48 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  topBarTitle: { color: Colors.foreground, fontSize: 22, fontWeight: '800' },
  iconBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.border,
  },

  // Identity card
  card: {
    alignItems: 'center',
    paddingVertical: 24, paddingHorizontal: 20,
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: Colors.surface,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
  },
  avatarWrap:   { position: 'relative', marginBottom: 14 },
  avatarGrad:   { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: Colors.foreground, fontSize: 28, fontWeight: '700' },
  verifiedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: Colors.surface, borderRadius: 10,
    padding: 2,
  },
  displayName: { color: Colors.foreground, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  username:    { color: Colors.mutedFg, fontSize: 14, marginTop: 3 },
  bio: {
    color: Colors.foreground, fontSize: 14, textAlign: 'center',
    marginTop: 10, lineHeight: 20, paddingHorizontal: 8,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText:{ color: Colors.mutedFg, fontSize: 13 },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%', marginTop: 20, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  stat:        { alignItems: 'center', flex: 1 },
  statNum:     { color: Colors.foreground, fontSize: 20, fontWeight: '800' },
  statLabel:   { color: Colors.mutedFg, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  // Edit button
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 18, paddingHorizontal: 22, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.primary + '14',
  },
  editBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, marginBottom: 4, marginTop: 4,
  },
  sectionTitle: { color: Colors.mutedFg, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  // Empty rooms
  emptyRooms: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 40 },
  emptyRoomsText:  { color: Colors.mutedFg, fontSize: 14, textAlign: 'center' },
  emptyRoomsAction:{ color: Colors.primary, fontSize: 14, fontWeight: '600', marginTop: 8 },

  // Hosted room rows
  roomRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  roomIcon: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  roomIconLive: { borderColor: Colors.live + '55', backgroundColor: Colors.live + '12' },
  roomInfo:     { flex: 1 },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  roomTitle:    { flex: 1, color: Colors.foreground, fontSize: 14, fontWeight: '600' },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.live + '22', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  liveDot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.live },
  liveChipText: { color: Colors.live, fontSize: 10, fontWeight: '700' },
  roomMeta:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  roomMetaText: { color: Colors.mutedFg, fontSize: 12 },
  roomMetaDot:  { color: Colors.mutedFg, fontSize: 12 },

  // Settings menu
  menu: {
    marginHorizontal: 16, marginTop: 24,
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    marginBottom: 14,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, minHeight: 56,
  },
  menuLabel: { flex: 1, color: Colors.foreground, fontSize: 15 },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, paddingVertical: 16,
    backgroundColor: Colors.destructive + '15',
    borderRadius: 14, borderWidth: 1, borderColor: Colors.destructive + '33',
    minHeight: 52,
  },
  signOutText: { color: Colors.destructive, fontSize: 15, fontWeight: '600' },
  version:     { color: Colors.mutedFg, fontSize: 11, textAlign: 'center', marginTop: 20 },
});
