import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

type Props = { size?: number };

export function LoopLogo({ size = 28 }: Props) {
  return (
    <Text style={[styles.logo, { fontSize: size }]}>Loop</Text>
  );
}

const styles = StyleSheet.create({
  logo: {
    color: Colors.primary,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
