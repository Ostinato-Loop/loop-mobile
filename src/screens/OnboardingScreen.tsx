/**
 * Loop Mobile — Onboarding Screen
 *
 * IDENTITY-MOBILE-001 (2026-06-11): Username-first onboarding.
 *   Matches the web onboarding flow (onboarding.tsx IDENTITY-001).
 *   Step 1 — @username: Pick your handle. Live availability check via API.
 *   Step 2 — Display name: What others see (defaults to @username if skipped).
 *   Done — Profile saved, onboarded = true.
 *
 * LILCKY STUDIO LIMITED
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowRight, AtSign, User } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { LoopLogo } from '@/components/LoopLogo';
import { useAuth } from '@/hooks/useAuth';
import { API_BASE } from '@/constants/api';
import { apiFetch } from '@/lib/api-client';

type Step = 'username' | 'displayname';
type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function OnboardingScreen() {
  const { updateProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep]               = useState<Step>('username');
  const [username, setUsername]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [availability, setAvailability] = useState<Availability>('idle');
  const [busy, setBusy]               = useState(false);
  const [error, setError]             = useState('');

  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Live username availability check ──────────────────────────────── */
  const onUsernameChange = useCallback((raw: string) => {
    const lower = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(lower);
    setError('');

    if (checkTimer.current) clearTimeout(checkTimer.current);

    if (!lower) { setAvailability('idle'); return; }
    if (!USERNAME_RE.test(lower)) { setAvailability('invalid'); return; }

    setAvailability('checking');
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/auth/username/check/${encodeURIComponent(lower)}`,
          { headers: { 'Content-Type': 'application/json' } },
        );
        const json = await res.json() as { available?: boolean; taken?: boolean };
        const taken = json.taken === true || json.available === false;
        setAvailability(taken ? 'taken' : 'available');
      } catch {
        setAvailability('idle');
      }
    }, 400);
  }, []);

  /* ── Step 1: Claim username ─────────────────────────────────────────── */
  const claimUsername = async () => {
    if (availability !== 'available' || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/auth/username/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? 'Username unavailable');
      }
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep('displayname');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not claim username');
      setAvailability('taken');
    } finally {
      setBusy(false);
    }
  };

  /* ── Step 2: Save display name + complete onboarding ───────────────── */
  const completeOnboarding = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const finalName = displayName.trim() || `@${username}`;
      await updateProfile({
        display_name: finalName,
        onboarded: true,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  /* ── Availability hint ──────────────────────────────────────────────── */
  const availHint = (): { text: string; color: string } | null => {
    if (availability === 'checking') return { text: 'Checking…', color: Colors.mutedFg };
    if (availability === 'available') return { text: `@${username} is available ✓`, color: Colors.primary };
    if (availability === 'taken') return { text: `@${username} is already taken`, color: Colors.destructive };
    if (availability === 'invalid') return { text: 'Use 3–20 letters, numbers, or underscores', color: Colors.destructive };
    return null;
  };

  const hint = availHint();
  const usernameReady = availability === 'available' && !busy;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <LoopLogo size={36} />
        </View>

        {/* ── Step indicator ── */}
        <View style={styles.steps}>
          <View style={styles.stepDotActive} />
          <View style={step === 'displayname' ? styles.stepDotActive : styles.stepDot} />
        </View>

        {/* ── Step 1: Username ── */}
        {step === 'username' && (
          <>
            <Text style={styles.title}>Claim your{'\n'}@username</Text>
            <Text style={styles.sub}>
              Your username is your permanent Loop identity. Choose wisely — it's how people find and follow you.
            </Text>

            <View style={styles.inputWrap}>
              <View style={[
                styles.inputRow,
                availability === 'taken' || availability === 'invalid' ? styles.inputRowError : null,
                availability === 'available' ? styles.inputRowSuccess : null,
              ]}>
                <View style={styles.atBadge}>
                  <AtSign size={18} color={Colors.mutedFg} />
                </View>
                <TextInput
                  style={styles.inputInner}
                  value={username}
                  onChangeText={onUsernameChange}
                  placeholder="yourhandle"
                  placeholderTextColor={Colors.mutedFg}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  maxLength={20}
                  returnKeyType="done"
                  onSubmitEditing={claimUsername}
                />
              </View>
              {hint ? (
                <Text style={[styles.hint, { color: hint.color }]}>{hint.text}</Text>
              ) : (
                <Text style={styles.hint}>{username.length}/20</Text>
              )}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, !usernameReady && styles.btnDisabled]}
              onPress={claimUsername}
              disabled={!usernameReady}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color={Colors.primaryFg} />
              ) : (
                <View style={styles.btnInner}>
                  <Text style={styles.btnText}>Claim @{username || 'username'}</Text>
                  <ArrowRight size={20} color={Colors.primaryFg} />
                </View>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 2: Display name ── */}
        {step === 'displayname' && (
          <>
            <Text style={styles.title}>What should we{'\n'}call you?</Text>
            <Text style={styles.sub}>
              Your display name is what others see in rooms. Leave blank to use @{username}.
              You can change it any time.
            </Text>

            <View style={styles.inputWrap}>
              <View style={styles.inputRow}>
                <View style={styles.atBadge}>
                  <User size={18} color={Colors.mutedFg} />
                </View>
                <TextInput
                  style={styles.inputInner}
                  value={displayName}
                  onChangeText={v => { setDisplayName(v); setError(''); }}
                  placeholder={`@${username}`}
                  placeholderTextColor={Colors.mutedFg}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={completeOnboarding}
                />
              </View>
              <Text style={styles.hint}>{displayName.trim().length}/40</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, busy && styles.btnDisabled]}
              onPress={completeOnboarding}
              disabled={busy}
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
              By continuing you agree to Loop's Community Standards and Privacy Policy.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40 },
  brand:  { marginBottom: 24 },

  steps: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  stepDot: {
    width: 20, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    width: 20, height: 4, borderRadius: 2,
    backgroundColor: Colors.primary,
  },

  title: {
    color: Colors.foreground,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    marginBottom: 12,
  },
  sub: { color: Colors.mutedFg, fontSize: 15, lineHeight: 22, marginBottom: 28 },

  inputWrap: { marginBottom: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.input,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  inputRowError:   { borderColor: Colors.destructive },
  inputRowSuccess: { borderColor: Colors.primary },
  atBadge: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  inputInner: {
    flex: 1,
    color: Colors.foreground,
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },

  hint:  { color: Colors.mutedFg, fontSize: 12, marginTop: 6 },
  error: { color: Colors.destructive, fontSize: 14, marginTop: 8 },

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
  btnInner:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText:     { color: Colors.primaryFg, fontSize: 17, fontWeight: '700' },
  legal:       { color: Colors.mutedFg, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
