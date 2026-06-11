/**
 * deep-link.ts
 *
 * Converts a raw OneSignal notification additionalData payload into a
 * typed DeepLinkAction that the navigator can act on, regardless of
 * whether the app was in the foreground, background, or cold-launched.
 *
 * Every notification our server sends must include at minimum:
 *   { type: NotificationType, ...type-specific fields }
 *
 * Supported notification types → action mapping:
 *
 *   room_live            → Navigate('Room', { roomId })
 *   room_ended           → (no-op — room is already closed)
 *   hand_raise_approved  → Navigate('Room', { roomId })  (speaker was promoted)
 *   hand_raise_request   → Navigate('Room', { roomId })  (host: someone raised hand)
 *   new_follower         → Navigate('Profile', { userId })
 *   friend_request       → Navigate('Notifications')
 *   connection_accepted  → Navigate('Notifications')
 *   direct_message       → Navigate('Thread', { conversationId })
 */

export type DeepLinkAction =
  | { screen: 'Room';          params: { roomId: string } }
  | { screen: 'Notifications'; params: undefined }
  | { screen: 'Thread';        params: { conversationId: string } }
  | { screen: 'Profile';       params: { userId: string } }
  | { screen: 'noop' }

type RawPayload = Record<string, unknown> | null | undefined;

/**
 * Parse the raw `additionalData` from a OneSignal notification into a
 * DeepLinkAction.  Returns `{ screen: 'noop' }` for unknown payloads
 * so callers always get a well-typed value without null checks.
 */
export function parseNotificationPayload(data: RawPayload): DeepLinkAction {
  if (!data || typeof data !== 'object') return { screen: 'noop' };

  const type = data.type as string | undefined;

  switch (type) {
    case 'room_live':
    case 'hand_raise_approved':
    case 'hand_raise_request': {
      // Backend sends camelCase roomId; guard against legacy snake_case room_id too
      const roomId = asString(data.roomId ?? data.room_id);
      if (!roomId) return { screen: 'noop' };
      return { screen: 'Room', params: { roomId } };
    }

    case 'new_follower': {
      const userId = asString(data.user_id);
      if (!userId) return { screen: 'Notifications' as const, params: undefined };
      return { screen: 'Profile', params: { userId } };
    }

    case 'friend_request':
    case 'connection_accepted':
    case 'room_ended':
      return { screen: 'Notifications', params: undefined };

    case 'direct_message': {
      const conversationId = asString(data.conversation_id);
      if (!conversationId) return { screen: 'Notifications', params: undefined };
      return { screen: 'Thread', params: { conversationId } };
    }

    default:
      return { screen: 'noop' };
  }
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
