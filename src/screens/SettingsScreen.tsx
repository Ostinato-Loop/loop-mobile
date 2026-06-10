import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';

export default function SettingsScreen() {
  const nav    = useNavigation();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username,    setUsername]    = useState(profile?.username ?? '');
  const [bio,         setBio]         = useState(profile?.bio ?? '');
  const [busy,        setBusy]        = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');

  async function handleSave() {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await updateProfile({
        display_name: displayName.trim() || undefined,
        username:     username.trim() || undefined,
        bio:          bio.trim() || undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.back} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={Colors.mutedFg}
            maxLength={50}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.handleWrap}>
            <Text style={styles.handleAt}>@</Text>
            <TextInput
              style={styles.handleInput}
              value={username}
              onChangeText={v => setUsername(v.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
              placeholder="handle"
              placeholderTextColor={Colors.mutedFg}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell Loop who you are…"
            placeholderTextColor={Colors.mutedFg}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={160}
          />
          <Text style={styles.hint}>{bio.length}/160</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved  ? <Text style={styles.saved}>Changes saved ✓</Text> : null}

        <TouchableOpacity
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={handleSave}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy
            ? <ActivityIndicator color={Colors.primaryFg} />
            : <Text style={styles.btnText}>Save changes</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  back:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: Colors.foreground, fontSize: 17, fontWeight: '700' },
  form:  { padding: 24, paddingBottom: 48 },
  field: { marginBottom: 20 },
  label: { color: Colors.mutedFg, fontSize: 13, marginBottom: 8 },
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
  textarea: { height: 100, paddingTop: 14 },
  handleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
  },
  handleAt: { color: Colors.mutedFg, fontSize: 18, marginRight: 4 },
  handleInput: { flex: 1, color: Colors.foreground, fontSize: 16, paddingVertical: 14 },
  hint:  { color: Colors.mutedFg, fontSize: 12, textAlign: 'right', marginTop: 4 },
  error: { color: Colors.destructive, fontSize: 14, marginBottom: 12 },
  saved: { color: Colors.primary, fontSize: 14, marginBottom: 12, fontWeight: '600' },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: Colors.primaryFg, fontSize: 16, fontWeight: '700' },
});
