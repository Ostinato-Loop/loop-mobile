import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from '@/navigation';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'Otp'>;
type Route = RouteProp<RootStackParamList, 'Otp'>;

export default function OtpScreen() {
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { phone } = route.params;
  const { verifyOtp, signInWithOtp } = useAuth();
  const insets = useSafeAreaInsets();

  const [otp,   setOtp]   = useState('');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(30);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const id = setInterval(() => {
      setResendCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  async function handleVerify() {
    if (otp.length < 6) return;
    setBusy(true);
    setError('');
    try {
      const { isNewUser } = await verifyOtp(phone, otp);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? 'Invalid code');
      setOtp('');
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resendCountdown > 0) return;
    try {
      await signInWithOtp(phone);
      setResendCountdown(30);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }

  function handleOtpChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    setError('');
    if (digits.length === 6) {
      setTimeout(() => handleVerify(), 50);
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
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Enter your code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.phone}>{phone}</Text>
        </Text>

        <TextInput
          ref={inputRef}
          style={[styles.input, error ? styles.inputError : null]}
          value={otp}
          onChangeText={handleOtpChange}
          placeholder="000000"
          placeholderTextColor={Colors.mutedFg}
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          returnKeyType="done"
          onSubmitEditing={handleVerify}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (otp.length < 6 || busy) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={otp.length < 6 || busy}
          activeOpacity={0.85}
        >
          {busy
            ? <ActivityIndicator color={Colors.primaryFg} />
            : <Text style={styles.btnText}>Verify</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={resendCountdown > 0} style={styles.resend}>
          <Text style={[styles.resendText, resendCountdown > 0 && styles.resendDisabled]}>
            {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  back:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body:   { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title:  { color: Colors.foreground, fontSize: 28, fontWeight: '800', marginBottom: 10 },
  subtitle: { color: Colors.mutedFg, fontSize: 15, lineHeight: 22, marginBottom: 32 },
  phone:  { color: Colors.foreground, fontWeight: '600' },
  input: {
    backgroundColor: Colors.input,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.foreground,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  inputError: { borderColor: Colors.destructive },
  error: { color: Colors.destructive, fontSize: 14, textAlign: 'center', marginBottom: 12 },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: Colors.primaryFg, fontSize: 16, fontWeight: '700' },
  resend:      { marginTop: 20, alignItems: 'center' },
  resendText:  { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  resendDisabled: { color: Colors.mutedFg },
});
