/**
 * RoomScreen — live audio room
 *
 * State ownership:
 *   useRoomRealtime  → room metadata + participant list + chat (Supabase Realtime)
 *   useLiveKitRoom   → audio connection + mic state + per-participant levels
 *   useHandRaise     → WebSocket hand-raise queue (RALD realtime)
 *
 * Roles:
 *   host       → mic toggle, PTT toggle, sees hand-raise queue, can end room
 *   speaker    → mic toggle, leave stage
 *   listener   → raise hand OR push-to-talk (if host enabled PTT)
 */
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, Pressable, Animated as RNAnimated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  ArrowLeft, Mic, MicOff, PhoneOff, Hand,
  MessageSquare, Users, Send, Share2, ChevronDown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { SpeakerTile } from '@/components/SpeakerTile';
import { AudioIndicator } from '@/components/AudioIndicator';
import { HandRaiseQueue } from '@/components/HandRaiseQueue';
import { PTTToggle } from '@/components/PTTToggle';
import { ConnectionStatusBar } from '@/components/ConnectionStatusBar';
import { useRoomRealtime } from '@/hooks/useRoomRealtime';
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom';
import { useHandRaise } from '@/hooks/useHandRaise';
import { useAuth } from '@/hooks/useAuth';
import { apiPost } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';
import type { RootStackParamList } from '@/navigation';
import { saveRecentRoom } from '@/hooks/useRecentRooms';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'Room'>;
type Route = RouteProp<RootStackParamList, 'Room'>;

const REACTIONS = ['🔥', '👏', '❤️', '🎯', '😂', '💯'];

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function RoomScreen() {
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { roomId } = route.params;

  // ── Realtime room state ────────────────────────────────────────────
  const rt = useRoomRealtime(roomId);

  // ── LiveKit audio ──────────────────────────────────────────────────
  const [joined,  setJoined]  = useState(false);
  const [joining, setJoining] = useState(false);
  const lk = useLiveKitRoom(joined ? roomId : null);

  // ── Hand-raise ─────────────────────────────────────────────────────
  const myRole = rt.participants.find(p => p.user_id === user?.id)?.role ?? 'listener';
  const isHost = myRole === 'host';
  const canSpeak = myRole === 'host' || myRole === 'moderator' || myRole === 'speaker';
  const pttEnabled = (rt.room?.ptt_enabled ?? false) && myRole === 'listener';

  const hr = useHandRaise({ roomId, userId: user?.id, isHost });

  // ── UI state ────────────────────────────────────────────────────────
  const [showChat,      setShowChat]      = useState(false);
  const [showHandQueue, setShowHandQueue] = useState(false);
  const [draft,         setDraft]         = useState('');
  const chatRef  = useRef<FlatList>(null);
  const pttAnim  = useRef(new RNAnimated.Value(1)).current;

  // ── Join + connect LiveKit ─────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    setJoining(true);
    try {
      await apiPost(ENDPOINTS.rooms.join(roomId), {});
      setJoined(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await lk.connect();
    } catch {
      // may already be joined
      setJoined(true);
      await lk.connect();
    } finally {
      setJoining(false);
    }
  }, [roomId, lk]);

  // ── Leave ──────────────────────────────────────────────────────────
  const leaveRoom = useCallback(async () => {
    await lk.disconnect();
    try { await apiPost(ENDPOINTS.rooms.leave(roomId), {}); } catch { /* best-effort */ }
    nav.goBack();
  }, [lk, roomId, nav]);

  // ── Host: end room ─────────────────────────────────────────────────
  const endRoom = useCallback(async () => {
    await lk.disconnect();
    await rt.endRoom();
    nav.goBack();
  }, [lk, rt, nav]);

  // ── Send chat message ──────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const optimistic = {
      id: `opt-${Date.now()}`,
      user_id: user?.id ?? 'me',
      content: text,
      created_at: new Date().toISOString(),
      profiles: {
        username: profile?.username ?? null,
        display_name: profile?.display_name ?? 'You',
      },
    };
    rt.addOptimisticMessage(optimistic);
    setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 60);
    try {
      await apiPost(`${ENDPOINTS.rooms.get(roomId)}/messages`, { content: text });
    } catch { /* lost — acceptable for chat */ }
  }, [draft, roomId, user?.id, profile, rt]);

  // ── Reaction ───────────────────────────────────────────────────────
  const sendReaction = useCallback(async (emoji: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await apiPost(`${ENDPOINTS.rooms.get(roomId)}/reactions`, { emoji }); } catch {}
  }, [roomId]);

  // ── PTT gestures ──────────────────────────────────────────────────
  function pttPressIn() {
    lk.pttStart();
    RNAnimated.spring(pttAnim, { toValue: 0.88, useNativeDriver: true }).start();
  }
  function pttPressOut() {
    lk.pttEnd();
    RNAnimated.spring(pttAnim, { toValue: 1, useNativeDriver: true }).start();
  }

  // ── Merge DB + LiveKit participant data ────────────────────────────
  const onStage = rt.participants
    .filter(p => p.role === 'host' || p.role === 'speaker' || p.role === 'moderator')
    .map(db => ({
      db,
      lkPart: lk.participants.find(l => l.identity === db.user_id),
    }));

  const listeners     = rt.participants.filter(p => p.role === 'listener');
  const listenerCount = listeners.length;

  // ── Auto-open hand queue when new requests arrive ─────────────────
  React.useEffect(() => {
    if (isHost && hr.queue.length > 0) setShowHandQueue(true);
  }, [isHost, hr.queue.length]);

  // ── Save to recent rooms on entry (RETENTION-001) ──────────────────
  // Fires once when room metadata first loads — persists to AsyncStorage
  // so FeedScreen can show "Continue Listening" on the user's next visit.
  useEffect(() => {
    if (!rt.room) return;
    saveRecentRoom({
      id:             rt.room.id,
      title:          rt.room.title,
      host_id:        rt.room.host_id,
      category:       rt.room.category,
      is_live:        rt.room.is_live,
      audience_count: rt.room.audience_count,
      host:           rt.room.host,
    });
  // Only save once per room (id is stable for the session)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt.room?.id]);

  // ── Loading / error ────────────────────────────────────────────────
  if (rt.status === 'loading') {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading room…</Text>
      </View>
    );
  }

  if (rt.status === 'error' || !rt.room) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>{rt.error ?? 'Room not found or no longer live'}</Text>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.ghostBtn}>
          <Text style={styles.ghostBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const room = rt.room;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={leaveRoom} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.foreground} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.categoryLabel}>{room.category}</Text>
          {room.is_live && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          {/* Hand-raise queue badge (host only) */}
          {isHost && hr.queue.length > 0 && (
            <TouchableOpacity
              style={styles.queueBtn}
              onPress={() => setShowHandQueue(v => !v)}
            >
              <Hand size={18} color={Colors.primary} />
              <View style={styles.queueBadge}>
                <Text style={styles.queueBadgeText}>{hr.queue.length}</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} hitSlop={12}>
            <Share2 size={20} color={Colors.mutedFg} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Connection status bar ── */}
      {joined && lk.connState !== 'connected' && (
        <ConnectionStatusBar state={lk.connState} />
      )}

      {/* ── Hand-raise queue panel (host) ── */}
      {isHost && showHandQueue && (
        <HandRaiseQueue
          queue={hr.queue}
          onApprove={uid => {
            hr.approveHand(uid);
            if (hr.queue.length <= 1) setShowHandQueue(false);
          }}
          onDeny={uid => {
            hr.denyHand(uid);
            if (hr.queue.length <= 1) setShowHandQueue(false);
          }}
          onClose={() => setShowHandQueue(false)}
        />
      )}

      {/* ── Scrollable body ── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.roomTitle}>{room.title}</Text>
        {room.description ? (
          <Text style={styles.roomDesc}>{room.description}</Text>
        ) : null}

        {/* Audience + connection status */}
        <View style={styles.audienceRow}>
          <Users size={14} color={Colors.mutedFg} />
          <Text style={styles.audienceText}>{room.audience_count} listening</Text>
          {lk.isConnected && (
            <View style={styles.connPill}>
              <View style={styles.connDot} />
              <Text style={styles.connText}>Audio live</Text>
            </View>
          )}
          {room.ptt_enabled && (
            <View style={styles.pttPill}>
              <Mic size={11} color={Colors.accent} />
              <Text style={styles.pttPillText}>PTT</Text>
            </View>
          )}
        </View>

        {/* ── Stage: hosts + speakers ── */}
        {onStage.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>On stage</Text>
            <View style={styles.stageGrid}>
              {onStage.map(({ db, lkPart }) => (
                <SpeakerTile
                  key={db.user_id}
                  participant={lkPart ?? {
                    identity:   db.user_id,
                    sid:        db.user_id,
                    name:       db.profiles?.display_name ?? db.profiles?.username ?? undefined,
                    isMuted:    true,
                    isSpeaking: false,
                    isLocal:    db.user_id === user?.id,
                    audioLevel: 0,
                  }}
                  role={db.role as 'host' | 'moderator' | 'speaker'}
                  avatarUrl={db.profiles?.avatar_url}
                  isVerified={db.profiles?.is_verified}
                  isHostViewer={isHost}
                  onLongPress={() => hr.removeSpeaker(db.user_id)}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Audience ── */}
        {listenerCount > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Audience ({listenerCount})</Text>
            <View style={styles.listenerGrid}>
              {listeners.slice(0, 20).map(p => (
                <Avatar
                  key={p.user_id}
                  userId={p.user_id}
                  name={p.profiles?.display_name}
                  avatarUrl={p.profiles?.avatar_url}
                  size={36}
                />
              ))}
              {listenerCount > 20 && (
                <View style={styles.moreAudience}>
                  <Text style={styles.moreText}>+{listenerCount - 20}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Chat messages ── */}
        {rt.messages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Chat</Text>
            <FlatList
              ref={chatRef}
              data={rt.messages.slice(-16)}
              keyExtractor={m => m.id}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const mine = item.user_id === user?.id;
                return (
                  <View style={[styles.bubble, mine && styles.bubbleMine]}>
                    {!mine && (
                      <Text style={styles.bubbleSender}>
                        {item.profiles?.display_name ?? item.profiles?.username ?? '…'}
                      </Text>
                    )}
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                      {item.content}
                    </Text>
                    <Text style={styles.bubbleTime}>{timeAgo(item.created_at)}</Text>
                  </View>
                );
              }}
            />
          </View>
        )}
      </ScrollView>

      {/* ── Reaction bar ── */}
      <View style={styles.reactionBar}>
        {REACTIONS.map(e => (
          <TouchableOpacity key={e} onPress={() => sendReaction(e)} style={styles.reactionBtn}>
            <Text style={styles.reactionEmoji}>{e}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Bottom controls ── */}
      {!joined ? (
        <View style={styles.joinRow}>
          <TouchableOpacity
            style={[styles.joinBtn, joining && styles.joinBtnBusy]}
            onPress={joinRoom}
            disabled={joining}
            activeOpacity={0.85}
          >
            {joining
              ? <ActivityIndicator color={Colors.primaryFg} />
              : <Text style={styles.joinBtnText}>🎙️  Join room</Text>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.controlBar}>

          {/* Left: chat toggle */}
          <TouchableOpacity
            style={[styles.controlBtn, showChat && styles.controlBtnOn]}
            onPress={() => setShowChat(c => !c)}
          >
            <MessageSquare size={21} color={showChat ? Colors.primaryFg : Colors.foreground} />
          </TouchableOpacity>

          {/* Centre: primary action based on role */}
          {canSpeak ? (
            /* Speakers/host: mic toggle */
            <TouchableOpacity
              style={[styles.micBtn, !lk.isMuted && styles.micBtnLive]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                lk.toggleMic();
              }}
              activeOpacity={0.85}
            >
              {lk.isMuted ? (
                <MicOff size={26} color={Colors.mutedFg} />
              ) : (
                <View style={styles.micLiveInner}>
                  <Mic size={26} color={Colors.primaryFg} />
                  <AudioIndicator
                    level={lk.localLevel}
                    isSpeaking={lk.isSpeaking}
                    isMuted={false}
                    size="sm"
                    color={Colors.primaryFg}
                  />
                </View>
              )}
            </TouchableOpacity>
          ) : pttEnabled ? (
            /* Listeners with PTT: hold to speak */
            <RNAnimated.View style={{ transform: [{ scale: pttAnim }] }}>
              <Pressable
                style={styles.pttBtn}
                onPressIn={pttPressIn}
                onPressOut={pttPressOut}
              >
                <Mic size={26} color={Colors.primaryFg} />
                <Text style={styles.pttBtnLabel}>Hold</Text>
              </Pressable>
            </RNAnimated.View>
          ) : (
            /* Listeners without PTT: raise/lower hand */
            <TouchableOpacity
              style={[styles.handBtn, hr.raised && styles.handBtnRaised]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                hr.toggleHand();
              }}
              activeOpacity={0.85}
            >
              <Hand size={26} color={hr.raised ? Colors.primaryFg : Colors.foreground} />
              {hr.raised && <Text style={styles.handBtnLabel}>Lower</Text>}
            </TouchableOpacity>
          )}

          {/* Right side: PTT toggle (host) + leave/end */}
          <View style={styles.rightControls}>
            {isHost && (
              <PTTToggle
                enabled={room.ptt_enabled}
                onToggle={rt.togglePtt}
              />
            )}
            {isHost ? (
              <TouchableOpacity style={styles.endBtn} onPress={endRoom}>
                <PhoneOff size={18} color={Colors.destructive} />
                <Text style={styles.endBtnText}>End</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.leaveBtn} onPress={leaveRoom}>
                <ChevronDown size={22} color={Colors.mutedFg} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Chat input ── */}
      {showChat && (
        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Say something…"
            placeholderTextColor={Colors.mutedFg}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnOff]}
            onPress={sendMessage}
            disabled={!draft.trim()}
          >
            <Send size={18} color={Colors.primaryFg} />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.background },
  center:      { alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: Colors.mutedFg, fontSize: 14 },
  errorText:   { color: Colors.mutedFg, fontSize: 16, textAlign: 'center', paddingHorizontal: 32 },
  ghostBtn:    { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  ghostBtnText:{ color: Colors.foreground, fontSize: 15, fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  categoryLabel:{ color: Colors.mutedFg, fontSize: 13, textTransform: 'capitalize' },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.live + '20', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.live },
  liveText: { color: Colors.live, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  queueBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  queueBadge: {
    position: 'absolute', top: 6, right: 4,
    backgroundColor: Colors.live, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  queueBadgeText: { color: Colors.foreground, fontSize: 10, fontWeight: '700' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  body:        { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 4 },
  roomTitle:   { color: Colors.foreground, fontSize: 22, fontWeight: '800', lineHeight: 28, marginBottom: 6 },
  roomDesc:    { color: Colors.mutedFg, fontSize: 14, lineHeight: 20, marginBottom: 10 },

  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  audienceText:{ color: Colors.mutedFg, fontSize: 13 },
  connPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary + '18', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  connDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  connText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },
  pttPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent + '18', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  pttPillText: { color: Colors.accent, fontSize: 11, fontWeight: '600' },

  section:      { marginBottom: 20 },
  sectionLabel: { color: Colors.mutedFg, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, marginBottom: 12 },
  stageGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  listenerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moreAudience: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  moreText: { color: Colors.mutedFg, fontSize: 10 },

  bubble: {
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 6, alignSelf: 'flex-start', maxWidth: '85%',
  },
  bubbleMine:     { alignSelf: 'flex-end', backgroundColor: Colors.primary + '18', borderColor: Colors.primary + '30' },
  bubbleSender:   { color: Colors.primary, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  bubbleText:     { color: Colors.foreground, fontSize: 14, lineHeight: 18 },
  bubbleTextMine: { color: Colors.foreground },
  bubbleTime:     { color: Colors.mutedFg, fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },

  reactionBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 8, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  reactionBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  reactionEmoji: { fontSize: 22 },

  joinRow:    { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  joinBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center', minHeight: 52,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  joinBtnBusy: { opacity: 0.7, shadowOpacity: 0 },
  joinBtnText: { color: Colors.primaryFg, fontSize: 16, fontWeight: '800' },

  controlBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    gap: 10,
  },
  controlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  controlBtnOn:   { backgroundColor: Colors.primary, borderColor: Colors.primary },

  micBtn: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: Colors.surfaceElev,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnLive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 16, elevation: 12,
  },
  micLiveInner: { alignItems: 'center', gap: 2 },

  pttBtn: {
    width: 80, height: 66, borderRadius: 20,
    backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', gap: 3,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  pttBtnLabel: { color: Colors.primaryFg, fontSize: 10, fontWeight: '700' },

  handBtn: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: Colors.surfaceElev,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  handBtnRaised: { backgroundColor: Colors.primary + '22', borderColor: Colors.primary },
  handBtnLabel:  { color: Colors.primary, fontSize: 10, fontWeight: '700' },

  rightControls: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' },

  leaveBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22,
    backgroundColor: Colors.destructive + '18',
    borderWidth: 1, borderColor: Colors.destructive + '44',
    minHeight: 44,
  },
  endBtnText: { color: Colors.destructive, fontSize: 13, fontWeight: '700' },

  chatInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  chatInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 12,
    color: Colors.foreground, fontSize: 16,
    borderWidth: 1, borderColor: Colors.border, minHeight: 48,
  },
  sendBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
});
