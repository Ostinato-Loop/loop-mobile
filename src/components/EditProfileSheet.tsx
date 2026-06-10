/**
 * EditProfileSheet
 *
 * Slide-up bottom sheet for editing the authenticated user's profile.
 * Uses a standard Modal + Animated.View so there's no extra library dep.
 *
 * Fields:
 *   display_name, username, bio (multiline), language (picker)
 *
 * On save: calls useAuth().updateProfile() (PATCH /api/profile/me),
 * optimistically closes the sheet, shows a brief success state.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ChevronDown, Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth, type LoopProfile } from '@/hooks/useAuth';

// African-first languages (same list as CreateRoomScreen)
const LANGUAGES = [
  { code: 'en',  label: '🇬🇧  English' },
  { code: 'fr',  label: '🇫🇷  Français' },
  { code: 'sw',  label: '🌍  Swahili' },
  { code: 'yo',  label: '🇳🇬  Yorùbá' },
  { code: 'ha',  label: '🇳🇬  Hausa' },
  { code: 'ig',  label: '🇳🇬  Igbo' },
  { code: 'pcm', label: '🇳🇬  Pidgin' },
  { code: 'am',  label: '🇪🇹  Amharic' },
  { code: 'ar',  label: '🌍  Arabic' },
  { code: 'zu',  label: '🇿🇦  Zulu' },
  { code: 'pt',  label: '🇦🇴  Português' },
];

type Props = {
  visible:  boolean;
  onClose:  () => void;
  profile:  LoopProfile;
};

export function EditProfileSheet({ visible, onClose, profile }: Props) {
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuth();

  // Form state seeded from current profile
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [username,    setUsername]    = useState(profile.username ?? '');
  const [bio,         setBio]         = useState(profile.bio ?? '');
  const [language,    setLanguage]    = useState('en');
  const [showLang,    setShowLang]    = useState(false);

  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  // Re-seed when profile changes (e.g. after a successful save)
  useEffect(() => {
    setDisplayName(profile.display_name ?? '');
    setUsername(profile.username ?? '');
    setBio(profile.bio ?? '');
  }, [profile]);

  // Slide-up animation
  const slideAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      friction: 18,
      tension: 140,
    }).start();
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [600, 0],
  });
  const backdropOpacity = slideAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 1],
  });

  const selectedLang = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

  const handleSave = useCallback(async () => {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim() || null,
        username:     username.trim()    || null,
        bio:          bio.trim()         || null,
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } catch (e: any) {
      setError(e.message ?? 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }, [displayName, username, bio, language, saving, updateProfile, onClose]);

  const hasChanges =
    displayName.trim() !== (profile.display_name ?? '') ||
    username.trim()    !== (profile.username    ?? '') ||
    bio.trim()         !== (profile.bio         ?? '');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 24, transform: [{ translateY }] },
        ]}
        pointerEvents="box-none"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Handle + header */}
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Edit profile</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={20} color={Colors.mutedFg} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.fields}
          >
            {/* Display name */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Display name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={Colors.mutedFg}
                maxLength={40}
                returnKeyType="next"
              />
            </View>

            {/* Username */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Username</Text>
              <View style={styles.usernameWrap}>
                <Text style={styles.at}>@</Text>
                <TextInput
                  style={[styles.input, styles.usernameInput]}
                  value={username}
                  onChangeText={v => setUsername(v.replace(/[^a-z0-9_]/gi, ''))}
                  placeholder="username"
                  placeholderTextColor={Colors.mutedFg}
                  maxLength={30}
                  returnKeyType="next"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Bio */}
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Bio</Text>
                <Text style={styles.charCount}>{bio.length}/160</Text>
              </View>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people about yourself…"
                placeholderTextColor={Colors.mutedFg}
                maxLength={160}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Language */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Primary language</Text>
              <TouchableOpacity
                style={styles.langPicker}
                onPress={() => setShowLang(v => !v)}
                activeOpacity={0.8}
              >
                <Text style={styles.langPickerText}>{selectedLang.label}</Text>
                <ChevronDown
                  size={16}
                  color={Colors.mutedFg}
                  style={showLang ? styles.chevronUp : undefined}
                />
              </TouchableOpacity>
              {showLang && (
                <View style={styles.langDropdown}>
                  {LANGUAGES.map(l => (
                    <TouchableOpacity
                      key={l.code}
                      style={[styles.langOption, language === l.code && styles.langOptionActive]}
                      onPress={() => { setLanguage(l.code); setShowLang(false); }}
                    >
                      <Text style={[styles.langOptionText, language === l.code && styles.langOptionTextActive]}>
                        {l.label}
                      </Text>
                      {language === l.code && <Check size={14} color={Colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, (!hasChanges || saving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!hasChanges || saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={Colors.primaryFg} />
              ) : saved ? (
                <>
                  <Check size={18} color={Colors.primaryFg} />
                  <Text style={styles.saveBtnText}>Saved!</Text>
                </>
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: Colors.border,
    maxHeight: '90%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle: { color: Colors.foreground, fontSize: 17, fontWeight: '700' },
  closeBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  fields:     { padding: 20, gap: 20, paddingBottom: 8 },
  field:      {},
  fieldLabel: { color: Colors.mutedFg, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  charCount:  { color: Colors.mutedFg, fontSize: 11 },
  input: {
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.foreground, fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  bioInput:    { height: 88, paddingTop: 13 },
  usernameWrap:{ flexDirection: 'row', alignItems: 'center' },
  at:          { color: Colors.mutedFg, fontSize: 15, marginRight: 6 },
  usernameInput: { flex: 1 },
  langPicker: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  langPickerText: { flex: 1, color: Colors.foreground, fontSize: 15 },
  chevronUp:      { transform: [{ rotate: '180deg' }] },
  langDropdown: {
    marginTop: 6, backgroundColor: Colors.background,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  langOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  langOptionActive:     { backgroundColor: Colors.primary + '18' },
  langOptionText:       { flex: 1, color: Colors.mutedFg, fontSize: 14 },
  langOptionTextActive: { color: Colors.primary, fontWeight: '700' },
  error: { color: Colors.destructive, fontSize: 13, marginBottom: 4 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, minHeight: 54,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnDisabled: { opacity: 0.35, shadowOpacity: 0 },
  saveBtnText:     { color: Colors.primaryFg, fontSize: 16, fontWeight: '800' },
});
