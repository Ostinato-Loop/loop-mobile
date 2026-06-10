# Loop Mobile

**African-first social audio** — iOS & Android native app

Built with Expo SDK 53 + React Navigation. Connects to the Loop/RALD cloud backend.

---

## Apps

| Platform | Build | Distribute |
|----------|-------|-----------|
| iOS      | `eas build --platform ios` | App Store via `eas submit --platform ios` |
| Android  | `eas build --platform android` | Play Store via `eas submit --platform android` |

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Expo SDK 53 (new architecture) |
| Navigation | React Navigation v7 (Stack + Bottom Tabs) |
| Auth | RALD Auth — phone OTP → JWT stored in SecureStore |
| Realtime audio | LiveKit React Native SDK |
| Data | Supabase JS + Loop Cloudflare Worker API |
| Push | OneSignal React Native |
| Build | EAS Build |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
EXPO_PUBLIC_SUPABASE_ANON_KEY=   # Supabase project anon key
EXPO_PUBLIC_ONESIGNAL_APP_ID=    # OneSignal app ID
EXPO_PUBLIC_LIVEKIT_URL=         # LiveKit server URL
```

---

## API

All API calls go to `https://loop-api.rald.cloud` (Cloudflare Worker).
Auth tokens are stored in `expo-secure-store` (hardware-backed on supported devices).

---

## Screens

| Screen | Description |
|--------|-------------|
| Login | Phone number entry → RALD OTP |
| OTP | 6-digit code verification |
| Onboarding | Name setup → enter Loop |
| Feed | Live rooms, category filter, who to follow |
| Discover | Search rooms/people, tabs: All/Live/People/Trending |
| Room | Live audio room — join, speak, chat, react |
| Create Room | Go live: title, category, description |
| Messages | Direct message conversations |
| Notifications | Room live, new follower, DMs |
| Profile | Stats, settings, sign out |
| Settings | Edit display name, handle, bio |

---

## Build Configuration

See `eas.json` for:
- **development**: internal builds (iOS simulator + Android APK)
- **preview**: internal TestFlight/Firebase distribution
- **production**: App Store + Play Store releases

---

## Architecture Notes

- Auth: OTP flow via `auth.rald.cloud` → JWT stored in `expo-secure-store`
- Tokens are refreshed automatically via `/api/auth/silent`
- LiveKit audio rooms require the `@livekit/react-native` + WebRTC native modules
- Push notifications: OneSignal with `expo-notifications` for local handling

---

*Loop is built on RALD — the African developer platform.*
*Owned by LILCKY STUDIO LIMITED*
