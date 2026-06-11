export const API_BASE = 'https://loop-api.rald.cloud';
export const AUTH_URL = 'https://auth.rald.cloud';
export const SUPABASE_URL = 'https://onxdcikfttdmnhofsuwo.supabase.co';

export const ENDPOINTS = {
  auth: {
    sendOtp:        `${API_BASE}/api/auth/send-otp`,
    verifyOtp:      `${API_BASE}/api/auth/verify-otp`,
    registerOtp:    `${AUTH_URL}/auth/register-from-otp`,
    silent:         `${API_BASE}/api/auth/silent`,
    signout:        `${API_BASE}/api/auth/signout`,
  },
  rooms: {
    list:     `${API_BASE}/api/rooms`,
    regional: `${API_BASE}/api/rooms/regional`,
    get:    (id: string) => `${API_BASE}/api/rooms/${id}`,
    join:   (id: string) => `${API_BASE}/api/rooms/${id}/join`,
    leave:  (id: string) => `${API_BASE}/api/rooms/${id}/leave`,
    end:    (id: string) => `${API_BASE}/api/rooms/${id}/end`,
    create:   `${API_BASE}/api/rooms`,
    livekit:(id: string) => `${API_BASE}/api/rooms/${id}/livekit-token`,
  },
  notifications: {
    list:           `${API_BASE}/api/notifications`,
    read:           `${API_BASE}/api/notifications/read`,
    readAll:        `${API_BASE}/api/notifications/read-all`,
    roomLive:       `${API_BASE}/api/push/notify-room-live`,
    roomEnded:      `${API_BASE}/api/notify/room-ended`,
  },
  push: {
    subscribe:      `${API_BASE}/api/push/subscribe`,
    identify:       `${API_BASE}/api/push/identify`,
  },
  follows: {
    counts:         `${API_BASE}/api/follows/me/counts`,
    follow:  (id: string) => `${API_BASE}/api/follows/${id}`,
    unfollow:(id: string) => `${API_BASE}/api/follows/${id}`,
    suggestions:    `${API_BASE}/api/follows/suggestions`,
  },
  profile: {
    me:             `${API_BASE}/api/profile/me`,
    update:         `${API_BASE}/api/profile/me`,
    get:  (id: string) => `${API_BASE}/api/profile/${id}`,
  },
  messages: {
    conversations:  `${API_BASE}/api/messages/conversations`,
    thread: (id: string) => `${API_BASE}/api/messages/thread/${id}`,
    send:           `${API_BASE}/api/messages`,
  },
  feedback: {
    submit:         `${API_BASE}/api/feedback`,
  },
  earnings: {
    summary:        `${API_BASE}/api/earnings/summary`,
    rooms:          `${API_BASE}/api/earnings/rooms`,
    withdrawals:    `${API_BASE}/api/earnings/withdrawals`,
    withdraw:       `${API_BASE}/api/earnings/withdraw`,
  },
} as const;

/** Currency codes the payout API supports */
export const PAYOUT_CURRENCIES = [
  { code: 'NGN', label: '🇳🇬  Naira (NGN)',    method: 'Opay / MTN MoMo' },
  { code: 'KES', label: '🇰🇪  Shilling (KES)', method: 'M-Pesa' },
  { code: 'GHS', label: '🇬🇭  Cedis (GHS)',    method: 'MTN MoMo' },
  { code: 'ZAR', label: '🇿🇦  Rand (ZAR)',     method: 'Bank transfer' },
  { code: 'USD', label: '🇺🇸  USD',            method: 'Bank / Paystack' },
] as const;

export type PayoutCurrency = typeof PAYOUT_CURRENCIES[number]['code'];
