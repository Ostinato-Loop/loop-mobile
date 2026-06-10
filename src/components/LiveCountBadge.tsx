/**
 * LiveCountBadge
 *
 * Animated listener count shown on room cards.
 * - Smoothly animates the number when it changes
 * - Briefly pulses neon-green when the count increases
 * - Shows a "just went live" ripple when a room flips is_live
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Users } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

type Props = {
  count: number;
  isLive: boolean;
  delta?: number;          // positive = growing audience
  showRipple?: boolean;    // flash when room first goes live
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function LiveCountBadge({ count, isLive, delta = 0, showRipple = false }: Props) {
  const glowAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const prevCount  = useRef(count);

  // Pulse when count increases
  useEffect(() => {
    if (count > prevCount.current) {
      Animated.sequence([
        Animated.timing(glowAnim,  { toValue: 1, duration: 180, useNativeDriver: false }),
        Animated.timing(scaleAnim, { toValue: 1.18, duration: 120, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(glowAnim,  { toValue: 0, duration: 600, useNativeDriver: false }),
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
        ]),
      ]).start();
    }
    prevCount.current = count;
  }, [count]);

  // Ripple when room just went live
  useEffect(() => {
    if (!showRipple) return;
    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, [showRipple]);

  const bgColor = glowAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [Colors.surface, Colors.primary + '30'],
  });

  const borderColor = glowAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [Colors.border, Colors.primary + '88'],
  });

  const textColor = glowAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [Colors.mutedFg, Colors.primary],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange:  [0, 0.3, 1],
    outputRange: [0, 0.6, 0],
  });

  const rippleScale = rippleAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [1, 2.4],
  });

  return (
    <View style={styles.wrapper}>
      {/* Ripple ring for "just went live" */}
      {showRipple && (
        <Animated.View
          style={[
            styles.ripple,
            {
              opacity:   rippleOpacity,
              transform: [{ scale: rippleScale }],
            },
          ]}
        />
      )}

      <Animated.View
        style={[
          styles.badge,
          { backgroundColor: bgColor, borderColor },
        ]}
      >
        {/* Live dot */}
        {isLive && <View style={styles.dot} />}

        <Users size={11} color={Colors.mutedFg} style={styles.icon} />

        <Animated.Text style={[styles.count, { color: textColor }]}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Text style={styles.countText}>{formatCount(count)}</Text>
          </Animated.View>
        </Animated.Text>

        {/* Delta indicator (+N) when audience grows */}
        {delta > 0 && (
          <View style={styles.delta}>
            <Text style={styles.deltaText}>+{delta}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  ripple: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.live,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  dot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: Colors.live,
  },
  icon:  {},
  count: { fontSize: 12, fontWeight: '600' },
  countText: { fontSize: 12, fontWeight: '600', color: Colors.mutedFg },
  delta: {
    backgroundColor: Colors.primary + '22',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  deltaText: { color: Colors.primary, fontSize: 10, fontWeight: '700' },
});
