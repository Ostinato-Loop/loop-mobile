import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { LoopLogo } from '@/components/LoopLogo';
import { useAuth } from '@/hooks/useAuth';

export default function OnboardingScreen() {
  const { updateProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  const valid = displayName.trim().length >= 2;

  async function handleContinue() {
    if (!valid) return;
    setBusy(true);
    setError('');
    try {
      await updateProfile({
        display_name: displayName.trim(),
        onboarded: true,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <LoopLogo size={36} />
        </View>

        <Text style={styles.title}>What should we{'\n'}call you?</Text>
        <Text style={styles.sub}>
          Your name is how the Loop community will know you.
          You can always change it later.
        </Text>

        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={displayName}
            onChangeText={v => { setDisplayName(v); setError(''); }}
            placeholder="Your display name"
            placeholderTextColor={Colors.mutedFg}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={50}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
          <Text style={styles.hint}>{displayName.trim().length}/50</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!valid || busy) && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={!valid || busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color={Colors.primaryFg} />
          ) : (
            <View style={styles.btnInner}>
              <Text style={styles.btnText}>Enter Loop</Text>
              <ArrowRight size={20} color={Colors.primaryFg} />
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.legal}>
          Your name is visible to everyone in Loop.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40 },
  brand:  { marginBottom: 32 },
  title: {
    color: Colors.foreground,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    marginBottom: 12,
  },
  sub: { color: Colors.mutedFg, fontSize: 15, lineHeight: 22, marginBottom: 32 },
  inputWrap: { marginBottom: 4 },
  input: {
    backgroundColor: Colors.input,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.foreground,
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  inputError: { borderColor: Colors.destructive },
  hint: { color: Colors.mutedFg, fontSize: 12, textAlign: 'right', marginTop: 6 },
  error:{ color: Colors.destructive, fontSize: 14, marginTop: 8 },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    minHeight: 52,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:  { color: Colors.primaryFg, fontSize: 17, fontWeight: '700' },
  legal:    { color: Colors.mutedFg, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
