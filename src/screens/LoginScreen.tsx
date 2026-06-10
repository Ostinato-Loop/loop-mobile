import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Shield } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { LoopLogo } from '@/components/LoopLogo';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from '@/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const nav = useNavigation<Nav>();
  const { signInWithOtp } = useAuth();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState('');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  const valid = phone.replace(/\D/g, '').length >= 10;

  async function handleContinue() {
    if (!valid) return;
    setBusy(true);
    setError('');
    try {
      const normalized = phone.startsWith('+') ? phone : `+234${phone.replace(/^0/, '')}`;
      await signInWithOtp(normalized);
      nav.navigate('Otp', { phone: normalized });
    } catch (e: any) {
      setError(e.message ?? 'Failed to send OTP');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <LoopLogo size={42} />
          <Text style={styles.tagline}>African-first social audio</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Shield size={22} color={Colors.primary} />
            <Text style={styles.cardTitle}>Sign in with phone</Text>
          </View>
          <Text style={styles.cardSub}>
            We'll send a 6-digit code to verify your number.
            No password needed.
          </Text>

          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Phone number</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              value={phone}
              onChangeText={v => { setPhone(v); setError(''); }}
              placeholder="+234 800 000 0000"
              placeholderTextColor={Colors.mutedFg}
              keyboardType="phone-pad"
              autoComplete="tel"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, (!valid || busy) && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={!valid || busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color={Colors.primaryFg} />
              : <Text style={styles.btnText}>Send code</Text>
            }
          </TouchableOpacity>

          <Text style={styles.legal}>
            By continuing you agree to Loop's Terms of Service and Privacy Policy.
            Your number is handled by RALD Identity.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, justifyContent: 'center' },
  brand:  { alignItems: 'center', marginBottom: 40 },
  tagline:{ color: Colors.mutedFg, fontSize: 15, marginTop: 6 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { color: Colors.foreground, fontSize: 18, fontWeight: '700' },
  cardSub:   { color: Colors.mutedFg, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  inputWrap: { marginBottom: 4 },
  inputLabel:{ color: Colors.mutedFg, fontSize: 13, marginBottom: 6 },
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
  inputError: { borderColor: Colors.destructive },
  error:  { color: Colors.destructive, fontSize: 13, marginTop: 6, marginBottom: 8 },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    minHeight: 52,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: Colors.primaryFg, fontSize: 16, fontWeight: '700' },
  legal: { color: Colors.mutedFg, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
