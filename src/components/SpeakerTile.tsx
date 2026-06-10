/**
 * SpeakerTile — renders a single on-stage participant with:
 * - Avatar + audio indicator ring
 * - Name + role badge
 * - Host-only remove-speaker action (long press)
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, BadgeCheck, MicOff } from 'lucide-react-native';
import { Colors, avatarGradient, initials } from '@/constants/colors';
import { Image } from 'expo-image';
import { AudioIndicator } from './AudioIndicator';
import type { LKParticipant } from '@/hooks/useLiveKitRoom';

type Props = {
  participant: LKParticipant;
  role: 'host' | 'moderator' | 'speaker';
  avatarUrl?: string | null;
  isVerified?: boolean;
  isHostViewer: boolean;
  onLongPress?: () => void;
  size?: 'sm' | 'lg';
};

const SIZE_MAP = { sm: 48, lg: 64 };

export function SpeakerTile({
  participant,
  role,
  avatarUrl,
  isVerified,
  isHostViewer,
  onLongPress,
  size = 'lg',
}: Props) {
  const avatarSize = SIZE_MAP[size];
  const radius     = avatarSize / 2;
  const grad       = avatarGradient(participant.identity);
  const ini        = initials(participant.name);
  const speaking   = participant.isSpeaking && !participant.isMuted;

  const ringColor  = speaking
    ? Colors.primary
    : participant.isMuted
    ? Colors.border
    : Colors.surfaceElev;

  return (
    <TouchableOpacity
      style={styles.tile}
      onLongPress={isHostViewer ? onLongPress : undefined}
      delayLongPress={500}
      activeOpacity={0.85}
    >
      {/* Speaking ring */}
      <View style={[
        styles.ring,
        {
          width:  avatarSize + 8,
          height: avatarSize + 8,
          borderRadius: (avatarSize + 8) / 2,
          borderColor: ringColor,
          borderWidth: speaking ? 2.5 : 1.5,
        },
      ]}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: avatarSize, height: avatarSize, borderRadius: radius }}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={grad}
            style={{ width: avatarSize, height: avatarSize, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[styles.ini, { fontSize: avatarSize * 0.32 }]}>{ini}</Text>
          </LinearGradient>
        )}
      </View>

      {/* Role badge overlay */}
      {role === 'host' && (
        <View style={styles.roleBadge}>
          <Crown size={10} color={Colors.accent} />
        </View>
      )}

      {/* Muted indicator */}
      {participant.isMuted && (
        <View style={styles.muteOverlay}>
          <MicOff size={10} color={Colors.foreground} />
        </View>
      )}

      {/* Name */}
      <Text style={styles.name} numberOfLines={1}>
        {participant.isLocal ? 'You' : (participant.name ?? '…')}
      </Text>

      {/* Audio bars */}
      <View style={styles.bars}>
        <AudioIndicator
          level={participant.audioLevel}
          isSpeaking={participant.isSpeaking}
          isMuted={participant.isMuted}
          size="sm"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    width: 72,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  ini: {
    color: Colors.foreground,
    fontWeight: '700',
  },
  roleBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  muteOverlay: {
    position: 'absolute',
    bottom: 26,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: Colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 68,
  },
  bars: {
    marginTop: 3,
    height: 14,
    justifyContent: 'center',
  },
});
