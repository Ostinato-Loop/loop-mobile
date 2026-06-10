/**
 * PresenceStrip
 *
 * Horizontal scroll of friends currently online.
 * • Green dot  → browsing the feed
 * • Mic badge  → currently inside a live room
 * • Tapping a tile navigates into that room (if in_room)
 *
 * Entrance animation: each avatar slides up + fades in as the list syncs.
 * Exit: avatars shrink + fade out when a user goes offline.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mic, Wifi } from 'lucide-react-native';
import { Colors, avatarGradient, initials } from '@/constants/colors';
import { Image } from 'expo-image';
import type { PresenceUser } from '@/hooks/usePresence';

type Props = {
  users:    PresenceUser[];
  onRoomPress?: (roomId: string) => void;
};

// Animated wrapper for each tile so we can stagger entrance
function PresenceTile({
  user,
  index,
  onPress,
}: {
  user:    PresenceUser;
  index:   number;
  onPress?: () => void;
}) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY= useRef(new Animated.Value(10)).current;
  const scale     = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 240, delay: index * 40, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: index * 40, useNativeDriver: true }),
      Animated.spring(scale,      { toValue: 1, delay: index * 40, useNativeDriver: true }),
    ]).start();

    return () => {
      // Fade out on unmount (user left)
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(scale,   { toValue: 0.7, duration: 180, useNativeDriver: true }),
      ]).start();
    };
  }, []);

  const grad  = avatarGradient(user.user_id);
  const ini   = initials(user.display_name);
  const inRoom= user.status === 'in_room';
  const name  = user.display_name ?? 'User';

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <TouchableOpacity
        style={styles.tile}
        onPress={inRoom ? onPress : undefined}
        activeOpacity={inRoom ? 0.75 : 1}
        disabled={!inRoom}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {user.avatar_url ? (
            <Image
              source={{ uri: user.avatar_url }}
              style={styles.avatar}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <LinearGradient colors={grad} style={styles.avatar}>
              <Text style={styles.avatarText}>{ini}</Text>
            </LinearGradient>
          )}

          {/* Status indicator */}
          {inRoom ? (
            <View style={[styles.statusBadge, styles.statusRoom]}>
              <Mic size={9} color={Colors.primaryFg} />
            </View>
          ) : (
            <View style={[styles.statusBadge, styles.statusOnline]} />
          )}
        </View>

        {/* Name */}
        <Text style={styles.name} numberOfLines={1}>{name.split(' ')[0]}</Text>

        {/* Room label */}
        {inRoom && user.room_title && (
          <Text style={styles.roomLabel} numberOfLines={1}>
            {user.room_title}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function PresenceStrip({ users, onRoomPress }: Props) {
  if (users.length === 0) return null;

  const inRoomCount   = users.filter(u => u.status === 'in_room').length;
  const browsingCount = users.length - inRoomCount;

  return (
    <View style={styles.root}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.onlinePill}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{users.length} online</Text>
        </View>
        {inRoomCount > 0 && (
          <Text style={styles.subText}>{inRoomCount} in a room</Text>
        )}
      </View>

      {/* Tile strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        decelerationRate="fast"
      >
        {users.map((u, i) => (
          <PresenceTile
            key={u.presenceRef}
            user={u}
            index={i}
            onPress={u.room_id ? () => onRoomPress?.(u.room_id!) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const AVATAR_SIZE = 46;

const styles = StyleSheet.create({
  root: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary + '14',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  onlineDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  onlineText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  subText:    { color: Colors.mutedFg, fontSize: 12 },
  strip: {
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  tile: {
    alignItems: 'center',
    width: 58,
  },
  avatarWrap: {
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    position: 'relative',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    color: Colors.foreground,
    fontSize: AVATAR_SIZE * 0.32,
    fontWeight: '700',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOnline: { backgroundColor: Colors.primary },
  statusRoom:   { backgroundColor: Colors.live },
  name: {
    color: Colors.foreground,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 56,
  },
  roomLabel: {
    color: Colors.live,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 56,
    marginTop: 2,
  },
});
