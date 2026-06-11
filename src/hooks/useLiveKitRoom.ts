/**
 * useLiveKitRoom
 * Full LiveKit audio room hook. Handles token fetch, connection lifecycle,
 * mic toggle, push-to-talk, and participant state.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  ParticipantEvent,
  Track,
  Participant,
  RemoteParticipant,
  LocalParticipant,
  ConnectionState,
  RoomOptions,
  AudioCaptureOptions,
  createLocalAudioTrack,
} from '@livekit/react-native';
import { apiGet, apiPost } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';

export type LKParticipant = {
  identity: string;
  sid: string;
  name: string | undefined;
  isMuted: boolean;
  isSpeaking: boolean;
  isLocal: boolean;
  audioLevel: number;
};

export type LKConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

const AUDIO_OPTS: AudioCaptureOptions = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const ROOM_OPTS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  audioCaptureDefaults: AUDIO_OPTS,
};

export function useLiveKitRoom(roomId: string | null) {
  const roomRef              = useRef<Room | null>(null);
  const tickRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalRef       = useRef(false);
  const reconnectTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const [connState,    setConnState]    = useState<LKConnectionState>('disconnected');
  const [participants, setParticipants] = useState<LKParticipant[]>([]);
  const [isMuted,      setIsMuted]      = useState(true);
  const [isSpeaking,   setIsSpeaking]   = useState(false);
  const [localLevel,   setLocalLevel]   = useState(0);
  const [error,        setError]        = useState<string | null>(null);

  // ── Build snapshot of participants ──────────────────────────────────
  const syncParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const list: LKParticipant[] = [];

    const mapPart = (p: Participant, isLocal: boolean): LKParticipant => {
      const audioPublication = p.getTrackPublication(Track.Source.Microphone);
      return {
        identity:   p.identity,
        sid:        p.sid,
        name:       p.name,
        isMuted:    audioPublication?.isMuted ?? true,
        isSpeaking: p.isSpeaking,
        isLocal,
        audioLevel: p.audioLevel ?? 0,
      };
    };

    // Local first
    if (room.localParticipant) {
      list.push(mapPart(room.localParticipant, true));
    }
    room.remoteParticipants.forEach(p => {
      list.push(mapPart(p, false));
    });

    setParticipants(list);
  }, []);

  // ── Connect ─────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!roomId) return;
    if (roomRef.current) return; // already connected

    intentionalRef.current = false;
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    setConnState('connecting');
    setError(null);

    try {
      // 1. Fetch LiveKit token from our API
      const { token, livekit_url } = await apiGet<{ token: string; livekit_url: string }>(
        ENDPOINTS.rooms.livekit(roomId)
      );

      // 2. Create LiveKit Room instance
      const room = new Room(ROOM_OPTS);
      roomRef.current = room;

      // 3. Wire events
      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        const map: Record<ConnectionState, LKConnectionState> = {
          [ConnectionState.Connected]:    'connected',
          [ConnectionState.Connecting]:   'connecting',
          [ConnectionState.Disconnected]: 'disconnected',
          [ConnectionState.Reconnecting]: 'reconnecting',
        };
        setConnState(map[state] ?? 'disconnected');
      });

      room.on(RoomEvent.ParticipantConnected, () => syncParticipants());
      room.on(RoomEvent.ParticipantDisconnected, () => syncParticipants());
      room.on(RoomEvent.TrackMuted, () => syncParticipants());
      room.on(RoomEvent.TrackUnmuted, () => syncParticipants());
      room.on(RoomEvent.TrackPublished, () => syncParticipants());
      room.on(RoomEvent.TrackUnpublished, () => syncParticipants());
      room.on(RoomEvent.TrackSubscribed, () => syncParticipants());

      room.on(RoomEvent.ActiveSpeakersChanged, () => {
        syncParticipants();
        const local = room.localParticipant;
        setIsSpeaking(local?.isSpeaking ?? false);
        setLocalLevel(local?.audioLevel ?? 0);
      });

      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        setConnState('disconnected');
        setParticipants([]);
        setIsMuted(true);
        setIsSpeaking(false);
        if (tickRef.current) clearInterval(tickRef.current);

        // Phase 4: Mobile Recovery — auto-reconnect on unexpected disconnect
        if (!intentionalRef.current && reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1500 * 2 ** reconnectAttemptsRef.current, 30_000);
          reconnectAttemptsRef.current += 1;
          setConnState('reconnecting');
          reconnectTimerRef.current = setTimeout(() => {
            if (!intentionalRef.current) connect();
          }, delay);
        }
      });

      // 4. Connect — join as subscriber (listener) by default, muted
      await room.connect(livekit_url, token, {
        autoSubscribe: true,
      });

      // 5. Enable mic (muted) so we can toggle quickly
      await room.localParticipant.setMicrophoneEnabled(false);

      reconnectAttemptsRef.current = 0; // reset on successful connect
      syncParticipants();
    } catch (err: any) {
      setError(err.message ?? 'LiveKit connection failed');
      setConnState('error');
      roomRef.current = null;
    }
  }, [roomId, syncParticipants]);

  // ── Disconnect ──────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    intentionalRef.current = true;
    reconnectAttemptsRef.current = 0;
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    const room = roomRef.current;
    if (!room) return;
    await room.disconnect();
    roomRef.current = null;
    setConnState('disconnected');
    setParticipants([]);
  }, []);

  // ── Toggle mic ──────────────────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || connState !== 'connected') return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    try {
      await room.localParticipant.setMicrophoneEnabled(!newMuted);
      syncParticipants();
    } catch {
      setIsMuted(!newMuted); // revert on failure
    }
  }, [isMuted, connState, syncParticipants]);

  // ── Push-to-talk: hold to speak ─────────────────────────────────────
  const pttStart = useCallback(async () => {
    const room = roomRef.current;
    if (!room || connState !== 'connected') return;
    setIsMuted(false);
    await room.localParticipant.setMicrophoneEnabled(true);
    syncParticipants();
  }, [connState, syncParticipants]);

  const pttEnd = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    setIsMuted(true);
    await room.localParticipant.setMicrophoneEnabled(false);
    syncParticipants();
  }, [syncParticipants]);

  // ── Cleanup on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  return {
    connect,
    disconnect,
    toggleMic,
    pttStart,
    pttEnd,
    connState,
    participants,
    isMuted,
    isSpeaking,
    localLevel,
    error,
    isConnected: connState === 'connected',
  };
}
