/**
 * GoLiveCountdown
 *
 * Full-screen animated 3 → 2 → 1 → "You're LIVE!" overlay that plays
 * before the app transitions into RoomScreen as host.
 *
 * Rendered as an absolutely-positioned overlay on top of CreateRoomScreen.
 * Parent calls onComplete() when it should navigate away.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '@/constants/colors';

type Props = {
  roomTitle: string;
  onComplete: () => void;
};

const STEPS: Array<string | null> = ['3', '2', '1', null]; // null = "LIVE" frame
const STEP_DURATION = 700; // ms per number
const LIVE_DURATION = 900; // ms for the LIVE flash

export function GoLiveCountdown({ roomTitle, onComplete }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const scaleAnim   = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bgOpacity   = useRef(new Animated.Value(0)).current;

  // Fade the backdrop in once on mount
  useEffect(() => {
    Animated.timing(bgOpacity, {
      toValue: 1, duration: 200, useNativeDriver: true,
    }).start();
  }, []);

  // Pulse animation runs on every step change
  useEffect(() => {
    scaleAnim.setValue(0.4);
    opacityAnim.setValue(0);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    const isLiveFrame = STEPS[stepIdx] === null;
    const delay = isLiveFrame ? LIVE_DURATION : STEP_DURATION;

    const timer = setTimeout(() => {
      if (stepIdx < STEPS.length - 1) {
        setStepIdx(i => i + 1);
      } else {
        // Fade out then call onComplete
        Animated.timing(bgOpacity, {
          toValue: 0, duration: 300, useNativeDriver: true,
        }).start(() => onComplete());
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [stepIdx]);

  const isLive  = STEPS[stepIdx] === null;
  const label   = isLive ? 'LIVE' : STEPS[stepIdx]!;

  return (
    <Animated.View style={[styles.overlay, { opacity: bgOpacity }]}>
      {/* Radial pulse rings */}
      {isLive && <PulseRings />}

      <Animated.View
        style={[
          styles.numberWrap,
          isLive && styles.liveWrap,
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
      >
        {isLive ? (
          <>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>YOU'RE LIVE</Text>
          </>
        ) : (
          <Text style={styles.number}>{label}</Text>
        )}
      </Animated.View>

      {isLive && (
        <Animated.Text style={[styles.roomTitle, { opacity: opacityAnim }]} numberOfLines={2}>
          {roomTitle}
        </Animated.Text>
      )}
    </Animated.View>
  );
}

// Three expanding rings for the LIVE frame
function PulseRings() {
  const rings = [0, 1, 2].map(i => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: 1200,
          delay: i * 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      ).start();
    }, []);
    const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4] });
    const opacity = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.5, 0.2, 0] });
    return (
      <Animated.View
        key={i}
        style={[styles.ring, { transform: [{ scale }], opacity }]}
      />
    );
  });
  return <View style={styles.ringsWrap}>{rings}</View>;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background + 'EE',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  ringsWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: Colors.live,
  },
  numberWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveWrap: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.live + '22',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.live + '66',
  },
  liveDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.live,
    alignSelf: 'center',
  },
  liveText: {
    color: Colors.live,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 3,
  },
  number: {
    color: Colors.foreground,
    fontSize: 100,
    fontWeight: '900',
    lineHeight: 110,
  },
  roomTitle: {
    color: Colors.foreground,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 40,
    lineHeight: 26,
  },
});
