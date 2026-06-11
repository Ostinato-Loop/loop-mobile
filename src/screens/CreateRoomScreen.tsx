/**
 * CreateRoomScreen  — "Go Live" wizard
 *
 * Four sections stacked in a ScrollView:
 *   1. Title + description
 *   2. Category chips
 *   3. Tag picker  (suggested chips + free-text input, max 5 tags)
 *   4. Settings row  (language picker + visibility toggle)
 *
 * On submit:
 *   • POST /api/rooms  → room.id
 *   • GoLiveCountdown overlay plays  (3-2-1 → LIVE)
 *   • Navigate to RoomScreen as host
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { X, Plus, Globe, Lock, ChevronDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { apiPost } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';
import { GoLiveCountdown } from '@/components/GoLiveCountdown';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from '@/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Static data ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'community',  label: '🏘️  Community' },
  { value: 'news',       label: '📡  News' },
  { value: 'commentary', label: '🎙️  Commentary' },
  { value: 'radio',      label: '📻  Radio' },
  { value: 'dj-session', label: '🎧  DJ Session' },
  { value: 'education',  label: '📚  Education' },
  { value: 'business',   label: '💼  Business' },
];

const SUGGESTED_TAGS: Record<string, string[]> = {
  community:  ['Lagos', 'Nairobi', 'Accra', 'diaspora', 'Africa'],
  news:       ['politics', 'breaking', 'economy', 'sports'],
  commentary: ['opinion', 'debate', 'analysis', 'sports'],
  radio:      ['afrobeats', 'highlife', 'amapiano', 'gospel', 'hip-hop'],
  'dj-session': ['afrobeats', 'amapiano', 'dancehall', 'freestyle'],
  education:  ['career', 'tech', 'finance', 'startup', 'health'],
  business:   ['startup', 'investing', 'SME', 'fintech', 'agri'],
};

const MAX_TAGS = 5;

// African-first language list
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateRoomScreen() {
  const nav    = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Form state
  const [title,      setTitle]      = useState('');
  const [desc,       setDesc]       = useState('');
  const [category,   setCategory]   = useState('community');
  const [tags,       setTags]       = useState<string[]>([]);
  const [tagInput,   setTagInput]   = useState('');
  const [language,   setLanguage]   = useState('en');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [isPublic,   setIsPublic]   = useState(true);

  // Submission state
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState('');
  const [showCountdown, setShowCountdown] = useState(false);
  const pendingRoomId = useRef<string | null>(null);

  const valid = title.trim().length >= 3;

  // Suggested tags for the selected category (deduped against already-added)
  const suggestions = useMemo(
    () => (SUGGESTED_TAGS[category] ?? []).filter(t => !tags.includes(t)),
    [category, tags]
  );

  // ── Tag management ──────────────────────────────────────────────────
  const addTag = useCallback((raw: string) => {
    const tag = raw.trim().replace(/^#+/, '').toLowerCase();
    if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return;
    setTags(prev => [...prev, tag]);
    setTagInput('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [tags]);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────
  async function handleGoLive() {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiPost<{ room: { id: string } }>(ENDPOINTS.rooms.create, {
        title:       title.trim(),
        description: desc.trim() || null,
        category,
        tags:        tags.length > 0 ? tags : undefined,
        language,
        visibility:  isPublic ? 'public' : 'followers',
      });
      const roomId = res.room.id;
      pendingRoomId.current = roomId;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // PUSH-LIVE-001: notify followers this room is live (fire-and-forget)
      // Runs in background — never delays the countdown or navigation.
      if (user?.id) {
        apiPost(ENDPOINTS.push.roomLive, {
          hostId:    user.id,
          roomId,
          roomTitle: title.trim(),
          category,
        }).catch(() => { /* non-fatal — push failure must not block go-live */ });
      }

      setShowCountdown(true);
    } catch (e: any) {
      setError(e.message ?? 'Could not create room. Try again.');
      setBusy(false);
    }
  }

  function handleCountdownComplete() {
    const id = pendingRoomId.current;
    if (!id) return;
    setShowCountdown(false);
    setBusy(false);
    nav.navigate('Room', { roomId: id });
  }

  const selectedLang = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <Text style={styles.heading}>Start a room</Text>
          <Text style={styles.sub}>Go live for your community in seconds.</Text>

          {/* ── Title ── */}
          <View style={styles.field}>
            <Text style={styles.label}>Room title *</Text>
            <TextInput
              style={[styles.input, !valid && title.length > 0 && styles.inputError]}
              value={title}
              onChangeText={v => { setTitle(v); setError(''); }}
              placeholder="What are you talking about?"
              placeholderTextColor={Colors.mutedFg}
              maxLength={80}
              returnKeyType="next"
            />
            <Text style={styles.charCount}>{title.trim().length}/80</Text>
          </View>

          {/* ── Description ── */}
          <View style={styles.field}>
            <Text style={styles.label}>Description  <Text style={styles.optional}>(optional)</Text></Text>
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

          {/* ── Category ── */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipGrid}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.chip, category === c.value && styles.chipActive]}
                  onPress={() => { setCategory(c.value); setTags([]); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Tags ── */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Tags</Text>
              <Text style={styles.optional}>{tags.length}/{MAX_TAGS}</Text>
            </View>

            {/* Selected tags */}
            {tags.length > 0 && (
              <View style={styles.tagRow}>
                {tags.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={styles.tagChip}
                    onPress={() => removeTag(t)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.tagChipText}>#{t}</Text>
                    <X size={11} color={Colors.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Free-text input */}
            {tags.length < MAX_TAGS && (
              <View style={styles.tagInputRow}>
                <TextInput
                  style={styles.tagInput}
                  value={tagInput}
                  onChangeText={v => setTagInput(v.replace(/\s/g, ''))}
                  placeholder="Type a tag…"
                  placeholderTextColor={Colors.mutedFg}
                  maxLength={24}
                  returnKeyType="done"
                  onSubmitEditing={() => addTag(tagInput)}
                  autoCapitalize="none"
                />
                {tagInput.trim().length > 0 && (
                  <TouchableOpacity
                    style={styles.tagAddBtn}
                    onPress={() => addTag(tagInput)}
                  >
                    <Plus size={16} color={Colors.primaryFg} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Suggested tags */}
            {suggestions.length > 0 && tags.length < MAX_TAGS && (
              <View style={styles.suggestRow}>
                <Text style={styles.suggestLabel}>Suggested: </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.suggestChips}>
                    {suggestions.map(s => (
                      <TouchableOpacity
                        key={s}
                        style={styles.suggestChip}
                        onPress={() => addTag(s)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.suggestChipText}>+#{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>

          {/* ── Settings row: Language + Visibility ── */}
          <View style={styles.settingsRow}>
            {/* Language picker */}
            <TouchableOpacity
              style={styles.settingCard}
              onPress={() => setShowLangPicker(v => !v)}
              activeOpacity={0.8}
            >
              <Globe size={16} color={Colors.mutedFg} />
              <Text style={styles.settingLabel}>{selectedLang.label}</Text>
              <ChevronDown
                size={14}
                color={Colors.mutedFg}
                style={showLangPicker ? styles.chevronUp : undefined}
              />
            </TouchableOpacity>

            {/* Visibility toggle */}
            <View style={styles.settingCard}>
              {isPublic
                ? <Globe size={16} color={Colors.primary} />
                : <Lock  size={16} color={Colors.mutedFg} />}
              <Text style={[styles.settingLabel, isPublic && { color: Colors.primary }]}>
                {isPublic ? 'Public' : 'Followers'}
              </Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: Colors.primary + '55', false: Colors.border }}
                thumbColor={isPublic ? Colors.primary : Colors.mutedFg}
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            </View>
          </View>

          {/* Language picker dropdown */}
          {showLangPicker && (
            <View style={styles.langDropdown}>
              {LANGUAGES.map(l => (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.langOption, language === l.code && styles.langOptionActive]}
                  onPress={() => { setLanguage(l.code); setShowLangPicker(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.langOptionText, language === l.code && styles.langOptionTextActive]}>
                    {l.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Error */}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Go Live button */}
          <TouchableOpacity
            style={[styles.goLiveBtn, (!valid || busy) && styles.goLiveBtnDisabled]}
            onPress={handleGoLive}
            disabled={!valid || busy}
            activeOpacity={0.85}
          >
            {busy && !showCountdown
              ? <ActivityIndicator color={Colors.primaryFg} />
              : (
                <>
                  <View style={styles.liveDot} />
                  <Text style={styles.goLiveBtnText}>Go Live</Text>
                </>
              )
            }
          </TouchableOpacity>

          <View style={{ height: insets.bottom + 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Countdown overlay — rendered last so it sits on top */}
      {showCountdown && (
        <GoLiveCountdown
          roomTitle={title.trim()}
          onComplete={handleCountdownComplete}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.background },
  scroll:  { paddingHorizontal: 20, paddingBottom: 24 },
  heading: { color: Colors.foreground, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  sub:     { color: Colors.mutedFg, fontSize: 14, marginBottom: 28 },

  field:    { marginBottom: 22 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label:    { color: Colors.mutedFg, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  optional: { color: Colors.mutedFg, fontSize: 12, fontWeight: '400' },

  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.foreground,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textarea:   { height: 88, paddingTop: 14 },
  inputError: { borderColor: Colors.destructive },
  charCount:  { color: Colors.mutedFg, fontSize: 11, textAlign: 'right', marginTop: 4 },

  // Category
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    minHeight: 48, alignItems: 'center', justifyContent: 'center',
  },
  chipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:       { color: Colors.mutedFg, fontSize: 14 },
  chipTextActive: { color: Colors.primaryFg, fontWeight: '700' },

  // Tags
  tagRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary + '1A',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  tagChipText:   { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  tagInputRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tagInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.foreground, fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  tagAddBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  suggestRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  suggestLabel:  { color: Colors.mutedFg, fontSize: 12, marginRight: 4 },
  suggestChips:  { flexDirection: 'row', gap: 8 },
  suggestChip: {
    backgroundColor: Colors.muted, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.border,
  },
  suggestChipText: { color: Colors.mutedFg, fontSize: 12 },

  // Settings row
  settingsRow: { flexDirection: 'row', gap: 12, marginBottom: 22 },
  settingCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 12, minHeight: 48,
  },
  settingLabel: { flex: 1, color: Colors.mutedFg, fontSize: 13, fontWeight: '500' },
  chevronUp:    { transform: [{ rotate: '180deg' }] },

  // Language dropdown
  langDropdown: {
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 22, overflow: 'hidden',
  },
  langOption: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  langOptionActive:     { backgroundColor: Colors.primary + '18' },
  langOptionText:       { color: Colors.mutedFg, fontSize: 15 },
  langOptionTextActive: { color: Colors.primary, fontWeight: '700' },

  error: { color: Colors.destructive, fontSize: 14, marginBottom: 14 },

  // Go Live button
  goLiveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.live,
    borderRadius: 18, paddingVertical: 18,
    minHeight: 60,
    shadowColor: Colors.live,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  goLiveBtnDisabled: { opacity: 0.35, shadowOpacity: 0 },
  liveDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.foreground,
  },
  goLiveBtnText: {
    color: Colors.foreground, fontSize: 18, fontWeight: '900', letterSpacing: 0.5,
  },
});
