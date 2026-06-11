/**
 * RoomSummaryScreen — Post-room AI replay summary
 *
 * REPLAY-001 (2026-06-11): Opened from notification tap (room_summary deep-link)
 * or from a room card after the room has ended.
 *
 * African-First UX principles applied:
 *   - Large, readable text  (data cost was already spent getting here)
 *   - No unnecessary controls — read and close
 *   - Polite "still processing" state instead of an error when not ready
 *   - Haptic feedback on close so the interaction feels physical
 *
 * LILCKY STUDIO LIMITED
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { X, BookOpen, Clock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { ENDPOINTS } from '@/constants/api';
import { apiFetch } from '@/lib/api-client';
import type { RootStackParamList } from '@/navigation';

type Route = RouteProp<RootStackParamList, 'RoomSummary'>;

type SummaryData = {
  roomId: string;
  title: string;
  summary: string | null;
  ready: boolean;
};

// Estimate read time: average 200 words/min, 5 chars/word
function readTimeMin(text: string): number {
  const words = Math.round(text.length / 5);
  return Math.max(1, Math.round(words / 200));
}

export default function RoomSummaryScreen() {
  const nav    = useNavigation();
  const route  = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { roomId } = route.params;

  const [data,    setData]    = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(ENDPOINTS.rooms.summary(roomId), { method: 'GET', skipAuth: true });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json() as SummaryData;
      setData(json);
    } catch (e: any) {
      setError(e.message ?? 'Could not load replay');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  const handleClose = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    nav.goBack();
  }, [nav]);

  const readMin = data?.summary ? readTimeMin(data.summary) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <BookOpen size={20} color={Colors.primary} />
          <Text style={styles.headerTitle}>Replay</Text>
        </View>
        <Pressable
          onPress={handleClose}
          style={styles.closeBtn}
          accessibilityLabel="Close replay"
          hitSlop={12}
        >
          <X size={22} color={Colors.mutedFg} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.hint}>Loading replay…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Room title */}
          <Text style={styles.roomTitle}>{data?.title ?? 'Room'}</Text>

          {readMin !== null && (
            <View style={styles.metaRow}>
              <Clock size={13} color={Colors.mutedFg} />
              <Text style={styles.metaText}>{readMin} min read</Text>
            </View>
          )}

          <View style={styles.divider} />

          {data?.ready && data.summary ? (
            <Text style={styles.summaryText}>{data.summary}</Text>
          ) : (
            <View style={styles.pendingWrap}>
              <Text style={styles.pendingEmoji}>⏳</Text>
              <Text style={styles.pendingTitle}>Summary is on the way</Text>
              <Text style={styles.pendingBody}>
                The AI is still preparing the replay for this room.
                Check back in a moment.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  headerTitle: {
    fontSize:   17,
    fontWeight: '700',
    color:      Colors.foreground,
  },
  closeBtn: {
    padding: 4,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        32,
    gap:            16,
  },
  hint: {
    color:    Colors.mutedFg,
    fontSize: 14,
  },
  errorText: {
    color:      Colors.live,
    fontSize:   15,
    textAlign:  'center',
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical:   10,
    backgroundColor:   Colors.surface,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  retryText: {
    color:      Colors.foreground,
    fontSize:   14,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  roomTitle: {
    fontSize:   24,
    fontWeight: '700',
    color:      Colors.foreground,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    marginTop:     8,
  },
  metaText: {
    fontSize: 13,
    color:    Colors.mutedFg,
  },
  divider: {
    height:          1,
    backgroundColor: Colors.border,
    marginVertical:  20,
  },
  summaryText: {
    fontSize:   16,
    color:      Colors.foreground,
    lineHeight: 26,
  },
  pendingWrap: {
    alignItems: 'center',
    paddingTop: 24,
    gap:        12,
  },
  pendingEmoji: {
    fontSize: 40,
  },
  pendingTitle: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.foreground,
    textAlign:  'center',
  },
  pendingBody: {
    fontSize:   15,
    color:      Colors.mutedFg,
    textAlign:  'center',
    lineHeight: 22,
  },
});
