/**
 * RoomScreen — full live audio room with LiveKit + hand-raise
 *
 * Roles:
 *   host       → always on stage, controls room, sees hand-raise queue
 *   speaker    → on stage, mic toggle, can leave stage
 *   listener   → off stage, can raise hand, real-time chat
 *
 * Push-to-talk: listener can hold the PTT button for quick interjection
 * (host/room must enable the feature; the mic goes unmuted only while held).
 */
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, Pressable, Modal, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  ArrowLeft, Mic, MicOff, PhoneOff, Hand,
  MessageSquare, Users, Send, Crown, Share2,
  Radio, UserMinus, ChevronDown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors, avatarGradient, initials } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { SpeakerTile } from '@/components/SpeakerTile';
import { AudioIndicator } from '@/components/AudioIndicator';
import { HandRaiseQueue } from '@/components/HandRaiseQueue';
import { useLiveKitRoom, type LKParticipant } from '@/hooks/useLiveKitRoom';
import { useHandRaise } from '@/hooks/useHandRaise';
import { useAuth } from '@/hooks/useAuth';
import { apiGet, apiPost } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';
import type { RootStackParamList } from '@/navigation';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'Room'>;
type Route = RouteProp<RootStackParamList, 'Room'>;

// ── Local types ───────────────────────────────────────────────────────
type RoomDetail = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  is_live: boolean;
  audience_count: number;
  host_id: string;
  ptt_enabled: boolean;
  host?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
};

type DBParticipant = {
  user_id: string;
  role: 'host' | 'moderator' | 'speaker' | 'listener';
  profiles?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  } | null;
};

type ChatMsg = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string | null; display_name: string | null } | null;
};

const REACTIONS = ['🔥', '👏', '❤️', '🎯', '😂', '💯'];

// ── Helper: format time-ago ───────────────────────────────────────────
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

  // ── Server-side room state ───────────────────────────────────────────
  const [room,    setRoom]    = useState<RoomDetail | null>(null);
  const [dbParts, setDbParts] = useState<DBParticipant[]>([]);
  const [messages,setMessages]= useState<ChatMsg[]>([]);
  const [draft,   setDraft]   = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined,  setJoined]  = useState(false);
  const [showChat,setShowChat]= useState(false);
  const [showHandQueue, setShowHandQueue] = useState(false);
  const [myRole,  setMyRole]  = useState<DBParticipant['role']>('listener');

  const chatRef = useRef<FlatList>(null);
  const pttAnim = useRef(new Animated.Value(1)).current;

  // ── LiveKit audio ────────────────────────────────────────────────────
  const lk = useLiveKitRoom(joined ? roomId : null);

  // ── Hand-raise (realtime WebSocket) ─────────────────────────────────
  const isHost = myRole === 'host';
  const hr = useHandRaise({ roomId, userId: user?.id, isHost });

  // ── Load room data ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [roomRes, partRes, msgRes] = await Promise.all([
          apiGet<{ room: RoomDetail }>(ENDPOINTS.rooms.get(roomId)),
          apiGet<{ participants: DBParticipant[] }>(`${ENDPOINTS.rooms.get(roomId)}/participants`).catch(() => ({ participants: [] })),
          apiGet<{ messages: ChatMsg[] }>(`${ENDPOINTS.rooms.get(roomId)}/messages`).catch(() => ({ messages: [] })),
        ]);
        setRoom(roomRes.room);
        setDbParts(partRes.participants ?? []);
        setMessages(msgRes.messages ?? []);

        // Determine my role
        if (user?.id) {
          const me = partRes.participants?.find(p => p.user_id === user.id);
          if (me) setMyRole(me.role);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId, user?.id]);

  // ── Auto-show hand-raise queue when new requests come in (host) ──────
  useEffect(() => {
    if (isHost && hr.queue.length > 0) setShowHandQueue(true);
  }, [isHost, hr.queue.length]);

  // ── Join room ────────────────────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    setJoining(true);
    try {
      const res = await apiPost<{ role: DBParticipant['role'] }>(
        ENDPOINTS.rooms.join(roomId), {}
      );
      setMyRole(res.role ?? 'listener');
      setJoined(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await lk.connect();
    } catch (e: any) {
      // If already joined just connect
      setJoined(true);
      await lk.connect();
    } finally {
      setJoining(false);
    }
  }, [roomId, lk]);

  // ── Leave room ───────────────────────────────────────────────────────
  const leaveRoom = useCallback(async () => {
    await lk.disconnect();
    try { await apiPost(ENDPOINTS.rooms.leave(roomId), {}); } catch { /* best-effort */ }
    nav.goBack();
  }, [lk, roomId, nav]);

  // ── Host: end room entirely ──────────────────────────────────────────
  const endRoom = useCallback(async () => {
    await lk.disconnect();
    try { await apiPost(ENDPOINTS.rooms.end(roomId), {}); } catch {}
    nav.goBack();
  }, [lk, roomId, nav]);

  // ── Send chat message ─────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const optimistic: ChatMsg = {
      id: `opt-${Date.now()}`,
      user_id: user?.id ?? 'me',
      content: text,
      created_at: new Date().toISOString(),
      profiles: {
        username: profile?.username ?? null,
        display_name: profile?.display_name ?? 'You',
      },
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 60);
    try {
      await apiPost(`${ENDPOINTS.rooms.get(roomId)}/messages`, { content: text });
    } catch { /* lost message — acceptable */ }
  }, [draft, roomId, user?.id, profile]);

  // ── Reaction ──────────────────────────────────────────────────────────
  const sendReaction = useCallback(async (emoji: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await apiPost(`${ENDPOINTS.rooms.get(roomId)}/reactions`, { emoji }); } catch {}
  }, [roomId]);

  // ── PTT press animation ───────────────────────────────────────────────
  function pttPressIn() {
    lk.pttStart();
    Animated.spring(pttAnim, { toValue: 0.88, useNativeDriver: true }).start();
  }
  function pttPressOut() {
    lk.pttEnd();
    Animated.spring(pttAnim, { toValue: 1, useNativeDriver: true }).start();
  }

  // ── Merge DB participants with LiveKit audio state ────────────────────
  const onStageParts: Array<{ db: DBParticipant; lk?: LKParticipant }> = dbParts
    .filter(p => p.role === 'host' || p.role === 'speaker' || p.role === 'moderator')
    .map(db => ({
      db,
      lk: lk.participants.find(l => l.identity === db.user_id),
    }));

  const listenerCount = dbParts.filter(p => p.role === 'listener').length;

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading room…</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>Room not found or no longer live</Text>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.ghostBtn}>
          <Text style={styles.ghostBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canSpeak  = myRole === 'host' || myRole === 'moderator' || myRole === 'speaker';
  const pttEnabled= room.ptt_enabled && myRole === 'listener';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
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
          {lk.connState === 'reconnecting' && (
            <View style={[styles.livePill, { backgroundColor: Colors.accent + '22' }]}>
              <Text style={[styles.liveText, { color: Colors.accent }]}>RECONNECTING</Text>
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

      {/* ── Hand-raise queue panel (host) ── */}
      {isHost && showHandQueue && (
        <HandRaiseQueue
          queue={hr.queue}
          onApprove={uid => { hr.approveHand(uid); if (hr.queue.length <= 1) setShowHandQueue(false); }}
          onDeny={uid => { hr.denyHand(uid); if (hr.queue.length <= 1) setShowHandQueue(false); }}
          onClose={() => setShowHandQueue(false)}
        />
      )}

      {/* ── Main scroll ── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.roomTitle}>{room.title}</Text>
        {room.description ? (
          <Text style={styles.roomDesc}>{room.description}</Text>
        ) : null}

        {/* Audience row */}
        <View style={styles.audienceRow}>
          <Users size={14} color={Colors.mutedFg} />
          <Text style={styles.audienceText}>{room.audience_count} listening</Text>
          {lk.isConnected && (
            <View style={styles.connPill}>
              <View style={styles.connDot} />
              <Text style={styles.connText}>Audio connected</Text>
            </View>
          )}
        </View>

        {/* ── On-stage speakers ── */}
        {onStageParts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>On stage</Text>
            <View style={styles.stageGrid}>
              {onStageParts.map(({ db, lk: lkPart }) => (
                <SpeakerTile
                  key={db.user_id}
                  participant={lkPart ?? {
                    identity: db.user_id,
                    sid: db.user_id,
                    name: db.profiles?.display_name ?? db.profiles?.username ?? undefined,
                    isMuted: true,
                    isSpeaking: false,
                    isLocal: db.user_id === user?.id,
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

        {/* ── Listeners ── */}
        {listenerCount > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Audience ({listenerCount})
            </Text>
            <View style={styles.listenerGrid}>
              {dbParts
                .filter(p => p.role === 'listener')
                .slice(0, 16)
                .map(p => (
                  <Avatar
                    key={p.user_id}
                    userId={p.user_id}
                    name={p.profiles?.display_name}
                    avatarUrl={p.profiles?.avatar_url}
                    size={36}
                  />
                ))
              }
              {listenerCount > 16 && (
                <View style={styles.moreAudience}>
                  <Text style={styles.moreAudienceText}>+{listenerCount - 16}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Chat preview ── */}
        {messages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Chat</Text>
            <FlatList
              ref={chatRef}
              data={messages.slice(-12)}
              keyExtractor={m => m.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={[
                  styles.chatBubble,
                  item.user_id === user?.id && styles.chatBubbleMine,
                ]}>
                  {item.user_id !== user?.id && (
                    <Text style={styles.chatSender}>
                      {item.profiles?.display_name ?? item.profiles?.username ?? '…'}
                    </Text>
                  )}
                  <Text style={[
                    styles.chatContent,
                    item.user_id === user?.id && styles.chatContentMine,
                  ]}>
                    {item.content}
                  </Text>
                  <Text style={styles.chatTime}>{timeAgo(item.created_at)}</Text>
                </View>
              )}
            />
          </View>
        )}
      </ScrollView>

      {/* ── Reaction bar ── */}
      <View style={styles.reactionBar}>
        {REACTIONS.map(e => (
          <TouchableOpacity
            key={e}
            onPress={() => sendReaction(e)}
            style={styles.reactionBtn}
          >
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
          {/* Chat toggle */}
          <TouchableOpacity
            style={[styles.controlBtn, showChat && styles.controlBtnOn]}
            onPress={() => setShowChat(c => !c)}
          >
            <MessageSquare size={22} color={showChat ? Colors.primaryFg : Colors.foreground} />
          </TouchableOpacity>

          {/* Mic toggle (speakers) OR Hand raise (listeners) */}
          {canSpeak ? (
            <TouchableOpacity
              style={[styles.micBtn, !lk.isMuted && styles.micBtnLive]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                lk.toggleMic();
              }}
              activeOpacity={0.85}
            >
              {lk.isMuted
                ? <MicOff size={26} color={Colors.mutedFg} />
                : (
                  <View style={styles.micActive}>
                    <Mic size={26} color={Colors.primaryFg} />
                    <AudioIndicator
                      level={lk.localLevel}
                      isSpeaking={lk.isSpeaking}
                      isMuted={false}
                      size="sm"
                      color={Colors.primaryFg}
                    />
                  </View>
                )
              }
            </TouchableOpacity>
          ) : pttEnabled ? (
            /* Push-to-talk for listeners */
            <Animated.View style={{ transform: [{ scale: pttAnim }] }}>
              <Pressable
                style={[styles.pttBtn, hr.raised && styles.pttBtnActive]}
                onPressIn={pttPressIn}
                onPressOut={pttPressOut}
              >
                <Mic size={26} color={Colors.primaryFg} />
                <Text style={styles.pttLabel}>Hold</Text>
              </Pressable>
            </Animated.View>
          ) : (
            /* Raise hand */
            <TouchableOpacity
              style={[styles.handBtn, hr.raised && styles.handBtnRaised]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                hr.toggleHand();
              }}
              activeOpacity={0.85}
            >
              <Hand size={26} color={hr.raised ? Colors.primaryFg : Colors.foreground} />
              {hr.raised && <Text style={styles.handLabel}>Lower</Text>}
            </TouchableOpacity>
          )}

          {/* Leave / End room */}
          {isHost ? (
            <TouchableOpacity style={styles.endBtn} onPress={endRoom}>
              <PhoneOff size={22} color={Colors.destructive} />
              <Text style={styles.endBtnText}>End</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.leaveBtn} onPress={leaveRoom}>
              <ChevronDown size={22} color={Colors.mutedFg} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Chat input (toggled) ── */}
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
  root:   { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  queueBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  queueBadge: {
    position: 'absolute', top: 6, right: 4,
    backgroundColor: Colors.live, borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  queueBadgeText: { color: Colors.foreground, fontSize: 10, fontWeight: '700' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // Body
  body:        { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 4 },
  roomTitle:   { color: Colors.foreground, fontSize: 22, fontWeight: '800', lineHeight: 28, marginBottom: 6 },
  roomDesc:    { color: Colors.mutedFg, fontSize: 14, lineHeight: 20, marginBottom: 10 },

  // Audience row
  audienceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20,
  },
  audienceText: { color: Colors.mutedFg, fontSize: 13, flex: 1 },
  connPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary + '18', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  connDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  connText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },

  // Sections
  section:      { marginBottom: 20 },
  sectionLabel: { color: Colors.mutedFg, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, marginBottom: 12 },

  // Stage
  stageGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  // Listeners
  listenerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moreAudience: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  moreAudienceText: { color: Colors.mutedFg, fontSize: 11 },

  // Chat bubbles
  chatBubble: {
    backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 6, alignSelf: 'flex-start', maxWidth: '85%',
  },
  chatBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary + '18',
    borderColor: Colors.primary + '30',
  },
  chatSender:      { color: Colors.primary, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  chatContent:     { color: Colors.foreground, fontSize: 14, lineHeight: 18 },
  chatContentMine: { color: Colors.foreground },
  chatTime:        { color: Colors.mutedFg, fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },

  // Reactions
  reactionBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 8, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  reactionBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  reactionEmoji: { fontSize: 22 },

  // Join
  joinRow: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  joinBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center', minHeight: 52,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  joinBtnBusy: { opacity: 0.7, shadowOpacity: 0 },
  joinBtnText: { color: Colors.primaryFg, fontSize: 16, fontWeight: '800' },

  // Control bar
  controlBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
    paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  controlBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  controlBtnOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  // Mic button
  micBtn: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: Colors.surfaceElev,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnLive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  micActive: { alignItems: 'center', gap: 2 },

  // PTT button
  pttBtn: {
    width: 80, height: 66, borderRadius: 20,
    backgroundColor: Colors.surfaceElev,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  pttBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pttLabel: { color: Colors.mutedFg, fontSize: 10, fontWeight: '600' },

  // Hand raise button
  handBtn: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: Colors.surfaceElev,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  handBtnRaised: {
    backgroundColor: Colors.primary + '22',
    borderColor: Colors.primary,
  },
  handLabel: { color: Colors.primary, fontSize: 10, fontWeight: '700' },

  // Leave / End
  leaveBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 26,
    backgroundColor: Colors.destructive + '18',
    borderWidth: 1, borderColor: Colors.destructive + '44',
    minHeight: 52,
  },
  endBtnText: { color: Colors.destructive, fontSize: 14, fontWeight: '700' },

  // Chat input
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

  // Misc
  loadingText: { color: Colors.mutedFg, fontSize: 14, marginTop: 12 },
  errorText:   { color: Colors.mutedFg, fontSize: 16, textAlign: 'center', paddingHorizontal: 32 },
  ghostBtn: {
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  ghostBtnText: { color: Colors.foreground, fontSize: 15, fontWeight: '600' },
});
