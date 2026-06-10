import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { avatarGradient, initials, Colors } from '@/constants/colors';

type Props = {
  userId: string;
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: number;
};

export function Avatar({ userId, name, avatarUrl, size = 40 }: Props) {
  const grad = avatarGradient(userId);
  const ini  = initials(name);
  const radius = size / 2;
  const fontSize = size * 0.35;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={200}
      />
    );
  }

  return (
    <LinearGradient
      colors={grad}
      style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: Colors.foreground, fontSize, fontWeight: '700' }}>{ini}</Text>
    </LinearGradient>
  );
}
