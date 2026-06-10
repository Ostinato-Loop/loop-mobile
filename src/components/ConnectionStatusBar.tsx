/**
 * ConnectionStatusBar
 * Slim banner shown at the top of the room when audio connection
 * drops, reconnects, or errors. Disappears when connected.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { LKConnectionState } from '@/hooks/useLiveKitRoom';

type Props = { state: LKConnectionState };

const CONFIG: Record<
  LKConnectionState,
  { label: string; color: string; bg: string; Icon: any; pulse: boolean } | null
> = {
  connected:    null,     // hidden
  disconnected: {
    label: 'Disconnected',
    color: Colors.mutedFg,
    bg: Colors.surface,
    Icon: WifiOff,
    pulse: false,
  },
  connecting: {
    label: 'Connecting to audio…',
    color: Colors.accent,
    bg: Colors.accent + '18',
    Icon: Wifi,
    pulse: true,
  },
  reconnecting: {
    label: 'Reconnecting…',
    color: Colors.accent,
    bg: Colors.accent + '18',
    Icon: Wifi,
    pulse: true,
  },
  error: {
    label: 'Audio unavailable',
    color: Colors.destructive,
    bg: Colors.destructive + '18',
    Icon: AlertCircle,
    pulse: false,
  },
};

export function ConnectionStatusBar({ state }: Props) {
  const config = CONFIG[state];
  const opacity = useSharedValue(config ? 1 : 0);
  const iconOpacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(config ? 1 : 0, { duration: 200 });
    if (config?.pulse) {
      iconOpacity.value = withRepeat(
        withSequence(withTiming(0.3, { duration: 600 }), withTiming(1, { duration: 600 })),
        -1,
        false
      );
    } else {
      iconOpacity.value = withTiming(1);
    }
  }, [state]);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    height: opacity.value * 36,
    overflow: 'hidden',
  }));

  const iconStyle = useAnimatedStyle(() => ({ opacity: iconOpacity.value }));

  if (!config) return null;

  return (
    <Animated.View style={[styles.banner, { backgroundColor: config.bg }, bannerStyle]}>
      <Animated.View style={iconStyle}>
        <config.Icon size={14} color={config.color} />
      </Animated.View>
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: { fontSize: 12, fontWeight: '600' },
});
