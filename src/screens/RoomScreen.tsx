import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  ArrowLeft, Mic, MicOff, PhoneOff, Hand,
  MessageSquare, Users, Send, BadgeCheck, Crown, Share2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors, avatarGradient, initials } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { apiGet, apiPost } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';
import type { RootStackParamList } from '@/navigation';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'Room'>;
type Route = RouteProp<RootStackParamList, 'Room'>;

type RoomDetail = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  is_live: boolean;
  audience_count: number;
  host_id: string;
  host?: { username: string | null; display_name: string | null; avatar_url: string | null };
};

type Participant = {
  user_id: string;
  role: 'host' | 'moderator' | 'speaker' | 'listener';
  profiles?: { username: string | null; display_name: string | null; avatar_url: string | null; is_verified: boolean } | null;
};

type ChatMsg = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string | null; display_name: string | null } | null;
};

const REACTIONS = ['🔥', '👏', '❤️', '🎯', '😂', '💯'];

export default function RoomScreen() {
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { roomId } = route.params;

  const [room,         setRoom]        = useState<RoomDetail | null>(null);
  const [participants, setParticipants]= useState<Participant[]>([]);
  const [messages,     setMessages]    = useState<ChatMsg[]>([]);
  const [draft,        setDraft]       = useState('');
  const [muted,        setMuted]       = useState(true);
  const [handRaised,   setHandRaised]  = useState(false);
  const [showChat,     setShowChat]    = useState(false);
  const [loading,      setLoading]     = useState(true);
  const [joining,      setJoining]     = useState(false);
  const [joined,       setJoined]      = useState(false);

  const chatRef = useRef<FlatList>(null);

  // Load room data
  useEffect(() => {
    (async () => {
      try {
        const [roomData, msgData, partData] = await Promise.all([
          apiGet<{ room: RoomDetail }>(ENDPOINTS.rooms.get(roomId)),
          apiGet<{ messages: ChatMsg[] }>(`${ENDPOINTS.rooms.get(roomId)}/messages`).catch(() => ({ messages: [] })),
          apiGet<{ participants: Participant[] }>(`${ENDPOINTS.rooms.get(roomId)}/participants`).catch(() => ({ participants: [] })),
        ]);
        setRoom(roomData.room);
        setMessages(msgData.messages ?? []);
        setParticipants(partData.participants ?? []);
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId]);

  const joinRoom = useCallback(async () => {
    setJoining(true);
    try {
      await apiPost(ENDPOINTS.rooms.join(roomId), {});
      setJoined(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { /* already joined or error */ } finally {
      setJoining(false);
    }
  }, [roomId]);

  const leaveRoom = useCallback(async () => {
    try { await apiPost(ENDPOINTS.rooms.leave(roomId), {}); } catch { /* best-effort */ }
    nav.goBack();
  }, [roomId, nav]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const optimistic: ChatMsg = {
      id: Date.now().toString(),
      user_id: 'me',
      content: text,
      created_at: new Date().toISOString(),
      profiles: { username: 'You', display_name: 'You' },
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      await apiPost(`${ENDPOINTS.rooms.get(roomId)}/messages`, { content: text });
    } catch { /* message lost, user can retry */ }
  }, [draft, roomId]);

  const sendReaction = useCallback(async (emoji: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await apiPost(`${ENDPOINTS.rooms.get(roomId)}/reactions`, { emoji }); } catch { /* best-effort */ }
  }, [roomId]);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>Room not found</Text>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hosts    = participants.filter(p => p.role === 'host');
  const speakers = participants.filter(p => p.role === 'speaker' || p.role === 'moderator');
  const listeners= participants.filter(p => p.role === 'listener');

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={leaveRoom} style={styles.backIcon} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.roomCategory}>{room.category}</Text>
          {room.is_live && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.shareBtn} hitSlop={12}>
          <Share2 size={20} color={Colors.mutedFg} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Text style={styles.roomTitle}>{room.title}</Text>
        {room.description ? <Text style={styles.roomDesc}>{room.description}</Text> : null}

        {/* Audience count */}
        <View style={styles.audienceRow}>
          <Users size={14} color={Colors.mutedFg} />
          <Text style={styles.audienceText}>{room.audience_count} listening</Text>
        </View>

        {/* Hosts */}
        {hosts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Crown size={14} color={Colors.accent} />
              <Text style={styles.sectionTitle}>Host</Text>
            </View>
            <View style={styles.participantsGrid}>
              {hosts.map(p => (
                <View key={p.user_id} style={styles.participant}>
                  <Avatar userId={p.user_id} name={p.profiles?.display_name} avatarUrl={p.profiles?.avatar_url} size={52} />
                  <Text style={styles.participantName} numberOfLines={1}>
                    {p.profiles?.display_name ?? p.profiles?.username ?? 'Host'}
                  </Text>
                  <Text style={styles.roleBadge}>Host</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Speakers */}
        {speakers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Mic size={14} color={Colors.primary} />
              <Text style={styles.sectionTitle}>On stage ({speakers.length})</Text>
            </View>
            <View style={styles.participantsGrid}>
              {speakers.map(p => (
                <View key={p.user_id} style={styles.participant}>
                  <Avatar userId={p.user_id} name={p.profiles?.display_name} avatarUrl={p.profiles?.avatar_url} size={48} />
                  <Text style={styles.participantName} numberOfLines={1}>
                    {p.profiles?.display_name ?? p.profiles?.username ?? '…'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Listeners */}
        {listeners.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Listening ({listeners.length})</Text>
            <View style={styles.participantsGrid}>
              {listeners.slice(0, 12).map(p => (
                <View key={p.user_id} style={styles.participant}>
                  <Avatar userId={p.user_id} name={p.profiles?.display_name} avatarUrl={p.profiles?.avatar_url} size={40} />
                  <Text style={styles.participantNameSm} numberOfLines={1}>
                    {p.profiles?.display_name ?? p.profiles?.username ?? '…'}
                  </Text>
                </View>
              ))}
              {listeners.length > 12 && (
                <Text style={styles.moreListeners}>+{listeners.length - 12} more</Text>
              )}
            </View>
          </View>
        )}

        {/* Recent chat messages */}
        {messages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chat</Text>
            {messages.slice(-8).map(m => (
              <View key={m.id} style={styles.chatMsg}>
                <Text style={styles.chatUser}>{m.profiles?.display_name ?? m.profiles?.username ?? '…'}</Text>
                <Text style={styles.chatContent}>{m.content}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Reaction row */}
      <View style={styles.reactionRow}>
        {REACTIONS.map(e => (
          <TouchableOpacity key={e} onPress={() => sendReaction(e)} style={styles.reactionBtn}>
            <Text style={styles.reactionEmoji}>{e}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom controls */}
      <View style={styles.controls}>
        {!joined ? (
          <TouchableOpacity
            style={styles.joinBtn}
            onPress={joinRoom}
            disabled={joining}
            activeOpacity={0.85}
          >
            {joining
              ? <ActivityIndicator color={Colors.primaryFg} />
              : <Text style={styles.joinBtnText}>Join room</Text>
            }
          </TouchableOpacity>
        ) : (
          <View style={styles.liveControls}>
            <TouchableOpacity
              style={[styles.controlBtn, handRaised && styles.controlBtnActive]}
              onPress={() => setHandRaised(h => !h)}
            >
              <Hand size={22} color={handRaised ? Colors.primaryFg : Colors.foreground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.muteBtn, !muted && styles.muteBtnActive]}
              onPress={() => setMuted(m => !m)}
            >
              {muted
                ? <MicOff size={24} color={Colors.mutedFg} />
                : <Mic size={24} color={Colors.primaryFg} />
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => setShowChat(c => !c)}
            >
              <MessageSquare size={22} color={Colors.foreground} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.leaveBtn} onPress={leaveRoom}>
              <PhoneOff size={22} color={Colors.foreground} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Chat input (shown when chat open) */}
      {showChat && (
        <View style={styles.chatInput}>
          <TextInput
            style={styles.chatField}
            value={draft}
            onChangeText={setDraft}
            placeholder="Say something…"
            placeholderTextColor={Colors.mutedFg}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
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

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.background },
  center:  { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backIcon:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerMid: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  roomCategory: { color: Colors.mutedFg, fontSize: 14, textTransform: 'capitalize' },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.live + '22', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.live },
  liveText: { color: Colors.live, fontSize: 11, fontWeight: '700' },
  shareBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 8 },
  roomTitle: { color: Colors.foreground, fontSize: 22, fontWeight: '800', lineHeight: 28, marginBottom: 8 },
  roomDesc:  { color: Colors.mutedFg, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 20 },
  audienceText:{ color: Colors.mutedFg, fontSize: 13 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { color: Colors.mutedFg, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  participantsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  participant: { alignItems: 'center', width: 64 },
  participantName: { color: Colors.foreground, fontSize: 11, fontWeight: '500', marginTop: 5, textAlign: 'center' },
  participantNameSm:{ color: Colors.mutedFg, fontSize: 10, marginTop: 4, textAlign: 'center' },
  roleBadge: { color: Colors.accent, fontSize: 10, fontWeight: '700', marginTop: 2 },
  moreListeners: { color: Colors.mutedFg, fontSize: 12, alignSelf: 'center' },
  chatMsg: { marginBottom: 10 },
  chatUser: { color: Colors.primary, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  chatContent: { color: Colors.foreground, fontSize: 14, lineHeight: 18 },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  reactionBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  reactionEmoji: { fontSize: 22 },
  controls: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  joinBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  joinBtnText:   { color: Colors.primaryFg, fontSize: 16, fontWeight: '700' },
  liveControls:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  controlBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  controlBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  muteBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.surfaceElev,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  muteBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  leaveBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.destructive + '22',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.destructive + '44',
  },
  chatInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  chatField: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.foreground,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  errorText: { color: Colors.mutedFg, fontSize: 16, marginBottom: 16 },
  backBtn: {
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtnText: { color: Colors.foreground, fontWeight: '600' },
});
