/**
 * UserProfileScreen
 *
 * Public read-only creator / listener profile.
 * Navigated to from: notification taps, Discover cards,
 * room participant strips, and @mentions.
 *
 * Sections
 * ────────
 *  1. Header bar — back + username + overflow (share / report)
 *  2. Identity card — avatar (88 px), verified + creator badges,
 *     display name, @handle, bio, location
 *  3. Stats strip — Followers · Following · Rooms
 *  4. Action bar — Follow/Following/Unfollow + Message
 *  5. Hosted rooms FlatList (same visual as ProfileScreen)
 *
 * Own-profile guard: if userId === currentUser.id the screen shows
 * an "Edit Profile" button instead of Follow/Message and redirects
 * to the tab's Profile tab on press.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, RefreshControl, ActivityIndicator,
  Share, Animated, Modal, TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  ArrowLeft, BadgeCheck, MapPin, Mic, UserPlus,
  UserCheck, MessageCircle, MoreHorizontal,
  Radio, Share2, Flag, ChevronRight, Sparkles,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, avatarGradient, initials } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useAuth } from '@/hooks/useAuth';
import type { Room } from '@/hooks/useRooms';
import type { RootStackParamList } from '@/navigation';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'UserProfile'>;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Room row ──────────────────────────────────────────────────────────────────

function RoomRow({ room, onPress }: { room: Room; onPress: () => void }) {
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
              <Text style={styles.liveText}>LIVE</Text>
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

// ── Overflow menu ─────────────────────────────────────────────────────────────

type OverflowMenuProps = {
  visible:        boolean;
  displayName:    string | null;
  onShare:        () => void;
  onReport:       () => void;
  onClose:        () => void;
};

function OverflowMenu({ visible, displayName, onShare, onReport, onClose }: OverflowMenuProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.overflowMenu, { opacity }]}>
        <TouchableOpacity style={styles.overflowItem} onPress={onShare}>
          <Share2 size={17} color={Colors.foreground} />
          <Text style={styles.overflowLabel}>Share profile</Text>
        </TouchableOpacity>
        <View style={styles.overflowDivider} />
        <TouchableOpacity style={styles.overflowItem} onPress={onReport}>
          <Flag size={17} color={Colors.destructive} />
          <Text style={[styles.overflowLabel, { color: Colors.destructive }]}>Report user</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ── Follow button ─────────────────────────────────────────────────────────────

type FollowBtnProps = {
  isFollowing: boolean;
  onFollow:    () => void;
  onUnfollow:  () => void;
};

function FollowButton({ isFollowing, onFollow, onUnfollow }: FollowBtnProps) {
  const [pressing, setPressing] = useState(false);

  async function handlePress() {
    setPressing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isFollowing) onUnfollow(); else onFollow();
    setTimeout(() => setPressing(false), 400);
  }

  if (isFollowing) {
    return (
      <TouchableOpacity
        style={[styles.followingBtn, pressing && { opacity: 0.7 }]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <UserCheck size={16} color={Colors.foreground} />
        <Text style={styles.followingBtnText}>Following</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.followBtn, pressing && { opacity: 0.7 }]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <UserPlus size={16} color={Colors.primaryFg} />
      <Text style={styles.followBtnText}>Follow</Text>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { userId } = route.params;
  const isOwnProfile = userId === user?.id;

  const {
    profile, rooms, loading, refreshing, error,
    refresh, follow, unfollow,
  } = usePublicProfile(userId);

  const [menuVisible, setMenuVisible] = useState(false);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    setMenuVisible(false);
    const name = profile?.username ? `@${profile.username}` : profile?.display_name ?? 'this creator';
    await Share.share({
      message: `Check out ${name} on Loop 🎙️\nhttps://loop.rald.cloud/u/${profile?.username ?? userId}`,
    });
  }, [profile, userId]);

  const handleReport = useCallback(() => {
    setMenuVisible(false);
    Alert.alert(
      'Report user',
      `Are you sure you want to report ${profile?.display_name ?? 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Reported', 'Our team will review this account. Thank you.'),
        },
      ]
    );
  }, [profile]);

  const handleRoomPress = useCallback((room: Room) => {
    nav.navigate('Room', { roomId: room.id });
  }, [nav]);

  const handleMessage = useCallback(() => {
    // Conversations are keyed on the other user's id
    nav.navigate('Thread', { conversationId: userId });
  }, [nav, userId]);

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.absBack} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <AlertCircle size={44} color={Colors.destructive} />
        <Text style={styles.errorText}>{error ?? 'Profile not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = profile.display_name ?? profile.username ?? 'Loop user';
  const grad        = avatarGradient(profile.id);
  const ini         = initials(displayName);

  // ── List header ──────────────────────────────────────────────────────────
  const ListHeader = (
    <>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.iconBtn} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.foreground} />
        </TouchableOpacity>

        <Text style={styles.topBarHandle} numberOfLines={1}>
          {profile.username ? `@${profile.username}` : displayName}
        </Text>

        <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuVisible(true)} hitSlop={12}>
          <MoreHorizontal size={22} color={Colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Identity card */}
      <View style={styles.card}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {profile.avatar_url ? (
            <Avatar
              userId={profile.id}
              name={profile.display_name}
              avatarUrl={profile.avatar_url}
              size={88}
            />
          ) : (
            <LinearGradient colors={[...grad]} style={styles.avatarGrad}>
              <Text style={styles.avatarInitials}>{ini}</Text>
            </LinearGradient>
          )}

          {profile.is_verified && (
            <View style={styles.verifiedBadge}>
              <BadgeCheck size={18} color={Colors.primary} fill={Colors.surface} />
            </View>
          )}
        </View>

        {/* Name */}
        <View style={styles.nameRow}>
          <Text style={styles.displayName}>{displayName}</Text>
          {profile.is_creator && (
            <View style={styles.creatorBadge}>
              <Sparkles size={11} color={Colors.primary} />
              <Text style={styles.creatorBadgeText}>Creator</Text>
            </View>
          )}
        </View>

        {profile.username && (
          <Text style={styles.username}>@{profile.username}</Text>
        )}

        {profile.bio && (
          <Text style={styles.bio}>{profile.bio}</Text>
        )}

        {(profile.state_id || profile.country_id) && (
          <View style={styles.locationRow}>
            <MapPin size={12} color={Colors.mutedFg} />
            <Text style={styles.locationText}>
              {[profile.state_id, profile.country_id].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{formatCount(profile.followers_count)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{formatCount(profile.following_count)}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{formatCount(profile.rooms_count)}</Text>
            <Text style={styles.statLabel}>Rooms</Text>
          </View>
        </View>

        {/* Action bar */}
        {isOwnProfile ? (
          <TouchableOpacity
            style={styles.editOwnBtn}
            onPress={() => nav.navigate('Main')}
            activeOpacity={0.8}
          >
            <Text style={styles.editOwnBtnText}>Go to my profile</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionBar}>
            <FollowButton
              isFollowing={profile.is_following}
              onFollow={follow}
              onUnfollow={unfollow}
            />
            <TouchableOpacity style={styles.messageBtn} onPress={handleMessage} activeOpacity={0.8}>
              <MessageCircle size={16} color={Colors.foreground} />
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Rooms section header */}
      <View style={styles.sectionHeader}>
        <Radio size={13} color={Colors.mutedFg} />
        <Text style={styles.sectionTitle}>Rooms hosted</Text>
        {rooms.length > 0 && (
          <Text style={styles.sectionCount}>{rooms.length}</Text>
        )}
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={rooms}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <RoomRow room={item} onPress={() => handleRoomPress(item)} />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyRooms}>
            <Mic size={32} color={Colors.mutedFg} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No rooms yet</Text>
            <Text style={styles.emptySub}>
              {displayName} hasn't hosted any rooms yet.
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        removeClippedSubviews
      />

      <OverflowMenu
        visible={menuVisible}
        displayName={displayName}
        onShare={handleShare}
        onReport={handleReport}
        onClose={() => setMenuVisible(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 88;

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  list:   { paddingBottom: 40 },

  absBack: {
    position: 'absolute', top: 60, left: 20,
    zIndex: 10,
  },
  errorText: { color: Colors.destructive, fontSize: 15, marginTop: 12, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:  { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.surface, borderRadius: 12 },
  retryText: { color: Colors.foreground, fontWeight: '600' },

  // Header bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 4,
  },
  iconBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBarHandle: {
    flex: 1, textAlign: 'center',
    color: Colors.foreground, fontSize: 16, fontWeight: '700',
    marginHorizontal: 4,
  },

  // Identity card
  card: {
    alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  avatarWrap: {
    position: 'relative',
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    marginBottom: 14,
  },
  avatarGrad: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { color: Colors.foreground, fontSize: 30, fontWeight: '800' },
  verifiedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.surface,
    borderWidth: 2, borderColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },

  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  displayName: { color: Colors.foreground, fontSize: 22, fontWeight: '800' },
  creatorBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary + '18',
    borderRadius: 10, borderWidth: 1, borderColor: Colors.primary + '44',
    paddingHorizontal: 8, paddingVertical: 3,
  },
  creatorBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },

  username: { color: Colors.mutedFg, fontSize: 14, marginBottom: 10 },
  bio: {
    color: Colors.foreground, fontSize: 14, lineHeight: 20,
    textAlign: 'center', paddingHorizontal: 8, marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 16,
  },
  locationText: { color: Colors.mutedFg, fontSize: 13 },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, marginBottom: 16,
  },
  stat:        { flex: 1, alignItems: 'center' },
  statNum:     { color: Colors.foreground, fontSize: 18, fontWeight: '800' },
  statLabel:   { color: Colors.mutedFg, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  // Action bar
  actionBar: {
    flexDirection: 'row', gap: 10, width: '100%',
  },
  followBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 13,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  followBtnText:    { color: Colors.primaryFg, fontSize: 15, fontWeight: '800' },
  followingBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 13,
  },
  followingBtnText: { color: Colors.foreground, fontSize: 15, fontWeight: '700' },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 13, paddingHorizontal: 20,
  },
  messageBtnText: { color: Colors.foreground, fontSize: 15, fontWeight: '700' },
  editOwnBtn: {
    width: '100%', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 13,
  },
  editOwnBtnText: { color: Colors.foreground, fontSize: 15, fontWeight: '700' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4,
  },
  sectionTitle: { color: Colors.mutedFg, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, flex: 1 },
  sectionCount: {
    color: Colors.mutedFg, fontSize: 12, fontWeight: '600',
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.border,
  },

  // Room rows
  roomRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  roomIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  roomIconLive: { borderColor: Colors.live, backgroundColor: Colors.live + '14' },
  roomInfo:     { flex: 1 },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  roomTitle:    { flex: 1, color: Colors.foreground, fontSize: 14, fontWeight: '600' },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.live + '22', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.live },
  liveText: { color: Colors.live, fontSize: 10, fontWeight: '800' },
  roomMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  roomMetaText: { color: Colors.mutedFg, fontSize: 12 },
  roomMetaDot:  { color: Colors.mutedFg, fontSize: 12 },

  // Empty
  emptyRooms: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 40 },
  emptyTitle: { color: Colors.foreground, fontSize: 16, fontWeight: '700', marginTop: 14 },
  emptySub:   { color: Colors.mutedFg, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  // Overflow menu
  overflowMenu: {
    position: 'absolute', top: 60, right: 16,
    backgroundColor: Colors.surfaceElev,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', minWidth: 190,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  overflowItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  overflowLabel:   { color: Colors.foreground, fontSize: 15, fontWeight: '500' },
  overflowDivider: { height: 1, backgroundColor: Colors.border },
});
