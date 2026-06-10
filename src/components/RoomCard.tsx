import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck } from 'lucide-react-native';
import { Colors, avatarGradient, initials } from '@/constants/colors';
import { LiveCountBadge } from './LiveCountBadge';
import type { Room } from '@/hooks/useRooms';

const CATEGORY_EMOJI: Record<string, string> = {
  community: '🏘️', news: '📡', commentary: '🎙️',
  radio: '📻', 'dj-session': '🎧', education: '📚',
  business: '💼', general: '🎵',
};

type Props = {
  room: Room;
  onPress: (room: Room) => void;
  /** Live audience count from Realtime (overrides room.audience_count) */
  liveCount?: number;
  /** Whether this room just transitioned to is_live=true */
  justWentLive?: boolean;
  /** +N since last Realtime push */
  delta?: number;
};

export function RoomCard({ room, onPress, liveCount, justWentLive, delta }: Props) {
  const hostName  = room.host?.display_name ?? room.host?.username ?? 'Host';
  const grad      = avatarGradient(room.host_id);
  const ini       = initials(hostName);
  const emoji     = CATEGORY_EMOJI[room.category] ?? '🎵';
  const count     = liveCount ?? room.audience_count;
  const isLive    = room.is_live;

  return (
    <TouchableOpacity
      style={[styles.card, justWentLive && styles.cardJustLive]}
      onPress={() => onPress(room)}
      activeOpacity={0.8}
    >
      {/* ── Card header: host + live badge ── */}
      <View style={styles.header}>
        <View style={styles.hostRow}>
          <LinearGradient colors={grad} style={styles.avatar}>
            <Text style={styles.avatarText}>{ini}</Text>
          </LinearGradient>
          <View style={styles.hostInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.hostName} numberOfLines={1}>{hostName}</Text>
              {room.host?.is_verified && (
                <BadgeCheck size={14} color={Colors.primary} style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.categoryBadge}>{emoji} {room.category}</Text>
          </View>
        </View>

        {isLive && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* ── Title + description ── */}
      <Text style={styles.title} numberOfLines={2}>{room.title}</Text>
      {room.description ? (
        <Text style={styles.description} numberOfLines={2}>{room.description}</Text>
      ) : null}

      {/* ── Footer: live count badge + tags ── */}
      <View style={styles.footer}>
        <LiveCountBadge
          count={count}
          isLive={isLive}
          delta={delta}
          showRipple={justWentLive}
        />

        {room.tags && room.tags.length > 0 && (
          <View style={styles.tags}>
            {room.tags.slice(0, 2).map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardJustLive: {
    borderColor: Colors.live + '55',
    shadowColor: Colors.live,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  hostRow:    { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  avatarText:    { color: Colors.foreground, fontSize: 14, fontWeight: '700' },
  hostInfo:      { flex: 1 },
  nameRow:       { flexDirection: 'row', alignItems: 'center' },
  hostName:      { color: Colors.foreground, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  categoryBadge: { color: Colors.mutedFg, fontSize: 12, marginTop: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.live + '22',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.live + '44',
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.live, marginRight: 5 },
  liveText: { color: Colors.live, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  title: {
    color: Colors.foreground, fontSize: 16, fontWeight: '700',
    lineHeight: 22, marginBottom: 6,
  },
  description: {
    color: Colors.mutedFg, fontSize: 13, lineHeight: 18, marginBottom: 10,
  },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  tags: { flexDirection: 'row', gap: 6 },
  tag: {
    backgroundColor: Colors.muted, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { color: Colors.mutedFg, fontSize: 11 },
});
