/**
 * PTTToggle
 * Host-only control shown in the room bottom bar.
 * Tapping it flips `ptt_enabled` via the API and broadcasts
 * the change to all participants through Supabase Realtime.
 *
 * When ON  → listeners see a hold-to-speak PTT button instead of raise-hand.
 * When OFF → listeners must raise their hand to get speaker role.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Mic, Hand } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

type Props = {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export function PTTToggle({ enabled, onToggle, disabled }: Props) {
  const progress = useSharedValue(enabled ? 1 : 0);

  // Animate when `enabled` prop changes
  React.useEffect(() => {
    progress.value = withSpring(enabled ? 1 : 0, { damping: 18, stiffness: 160 });
  }, [enabled]);

  // Sliding thumb
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(progress.value * 22, { damping: 18 }) }],
  }));

  // Track background: grey → neon green
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Colors.surfaceElev, Colors.primary + 'AA'],
    ),
  }));

  async function handlePress() {
    if (disabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle();
  }

  return (
    <TouchableOpacity
      style={styles.root}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {/* Icon */}
      <View style={styles.iconWrap}>
        {enabled
          ? <Mic size={14} color={Colors.primary} />
          : <Hand size={14} color={Colors.mutedFg} />
        }
      </View>

      {/* Label */}
      <Text style={[styles.label, enabled && styles.labelActive]}>
        PTT {enabled ? 'on' : 'off'}
      </Text>

      {/* Toggle track */}
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 40,
  },
  iconWrap: { width: 18, alignItems: 'center' },
  label:    { color: Colors.mutedFg, fontSize: 12, fontWeight: '600' },
  labelActive: { color: Colors.primary },
  track: {
    width: 40,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  thumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.foreground,
  },
});
