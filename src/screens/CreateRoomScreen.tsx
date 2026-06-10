import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { apiPost } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';
import type { RootStackParamList } from '@/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES = [
  { value: 'community',  label: '🏘️  Community' },
  { value: 'news',       label: '📡  News' },
  { value: 'commentary', label: '🎙️  Commentary' },
  { value: 'radio',      label: '📻  Radio' },
  { value: 'dj-session', label: '🎧  DJ Session' },
  { value: 'education',  label: '📚  Education' },
  { value: 'business',   label: '💼  Business' },
];

export default function CreateRoomScreen() {
  const nav    = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [category, setCategory] = useState('community');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');

  const valid = title.trim().length >= 3;

  async function handleCreate() {
    if (!valid) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiPost<{ room: { id: string } }>(ENDPOINTS.rooms.create, {
        title: title.trim(),
        description: desc.trim() || null,
        category,
        visibility: 'public',
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      nav.navigate('Room', { roomId: res.room.id });
    } catch (e: any) {
      setError(e.message ?? 'Failed to create room');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Start a room</Text>
        <Text style={styles.sub}>Go live for your community in seconds.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Room title *</Text>
          <TextInput
            style={[styles.input, error && title.trim().length < 3 ? styles.inputError : null]}
            value={title}
            onChangeText={v => { setTitle(v); setError(''); }}
            placeholder="What are you talking about?"
            placeholderTextColor={Colors.mutedFg}
            maxLength={80}
            returnKeyType="next"
          />
          <Text style={styles.hint}>{title.trim().length}/80</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={desc}
            onChangeText={setDesc}
            placeholder="Tell people what the room is about…"
            placeholderTextColor={Colors.mutedFg}
            maxLength={300}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[styles.categoryChip, category === c.value && styles.categoryChipActive]}
                onPress={() => setCategory(c.value)}
                activeOpacity={0.75}
              >
                <Text style={[styles.categoryText, category === c.value && styles.categoryTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!valid || busy) && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={!valid || busy}
          activeOpacity={0.85}
        >
          {busy
            ? <ActivityIndicator color={Colors.primaryFg} />
            : <Text style={styles.btnText}>🎙️  Go live</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { padding: 24, paddingBottom: 48 },
  heading: { color: Colors.foreground, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  sub:     { color: Colors.mutedFg, fontSize: 15, marginBottom: 28 },
  field:   { marginBottom: 20 },
  label:   { color: Colors.mutedFg, fontSize: 13, marginBottom: 8 },
  input: {
    backgroundColor: Colors.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.foreground,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textarea:   { height: 90, paddingTop: 14 },
  inputError: { borderColor: Colors.destructive },
  hint: { color: Colors.mutedFg, fontSize: 12, textAlign: 'right', marginTop: 4 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryText:       { color: Colors.mutedFg, fontSize: 14 },
  categoryTextActive: { color: Colors.primaryFg, fontWeight: '700' },
  error: { color: Colors.destructive, fontSize: 14, marginBottom: 12 },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 56,
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  btnText:     { color: Colors.primaryFg, fontSize: 17, fontWeight: '800' },
});
