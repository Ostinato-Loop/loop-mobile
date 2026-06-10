/**
 * AudioIndicator — animated bars that visualise audio level (0–1).
 * Uses Reanimated 3 shared values for GPU-driven animation.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';

type Props = {
  level: number;       // 0–1 audio level
  isSpeaking: boolean;
  isMuted: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
};

const BAR_COUNTS = { sm: 3, md: 4, lg: 5 };
const BAR_HEIGHTS = { sm: [6, 10, 6], md: [5, 9, 12, 7], lg: [5, 8, 14, 9, 5] };

function AnimatedBar({
  baseHeight,
  level,
  isSpeaking,
  delay,
  color,
}: {
  baseHeight: number;
  level: number;
  isSpeaking: boolean;
  delay: number;
  color: string;
}) {
  const height = useSharedValue(baseHeight * 0.3);

  useEffect(() => {
    cancelAnimation(height);
    if (!isSpeaking || level < 0.05) {
      height.value = withSpring(baseHeight * 0.3, { damping: 20 });
      return;
    }
    const targetH = baseHeight * (0.3 + level * 0.7);
    height.value = withRepeat(
      withSequence(
        withTiming(targetH,          { duration: 120 + delay }),
        withTiming(baseHeight * 0.3, { duration: 120 + delay }),
      ),
      -1,
      true,
    );
  }, [isSpeaking, level]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        animStyle,
        { backgroundColor: color, maxHeight: baseHeight },
      ]}
    />
  );
}

export function AudioIndicator({
  level,
  isSpeaking,
  isMuted,
  size = 'md',
  color,
}: Props) {
  const c      = color ?? (isMuted ? Colors.mutedFg : Colors.primary);
  const bars   = BAR_COUNTS[size];
  const heights = BAR_HEIGHTS[size];

  return (
    <View style={styles.row}>
      {Array.from({ length: bars }).map((_, i) => (
        <AnimatedBar
          key={i}
          baseHeight={heights[i]}
          level={isMuted ? 0 : level}
          isSpeaking={!isMuted && isSpeaking}
          delay={i * 30}
          color={c}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    minHeight: 3,
  },
});
