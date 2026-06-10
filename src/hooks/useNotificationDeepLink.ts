/**
 * useNotificationDeepLink
 *
 * Handles OneSignal notification taps in all three app states:
 *
 *   1. Foreground  — app is open; navigate immediately.
 *   2. Background  — app is suspended; OS resumes it, notification click
 *                    fires before navigator is ready → queue the action.
 *   3. Cold launch — app was killed; getInitialNotification() returns the
 *                    tapped notification; navigate once navigator is ready.
 *
 * Usage (call once, inside RootNavigator):
 *
 *   const navRef = useNavigationContainerRef<RootStackParamList>();
 *   useNotificationDeepLink(navRef);
 *   return <NavigationContainer ref={navRef}>…</NavigationContainer>;
 *
 * The hook is a no-op when OneSignal is not available (web / Expo Go
 * without native build) so it never crashes in the simulator.
 */
import { useEffect, useRef } from 'react';
import type { NavigationContainerRef } from '@react-navigation/native';
import { parseNotificationPayload } from '@/lib/deep-link';
import type { RootStackParamList } from '@/navigation';

type NavRef = NavigationContainerRef<RootStackParamList> | null;

// Lazy-require OneSignal so the module error is contained if native
// module isn't linked (Expo Go managed workflow).
function getOneSignal() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OneSignal } = require('react-native-onesignal');
    return OneSignal as {
      Notifications: {
        addEventListener(
          event: 'click',
          handler: (event: { notification: { additionalData?: Record<string, unknown> } }) => void
        ): void;
        removeEventListener(event: 'click', handler: unknown): void;
        getInitialNotification(): Promise<
          { notification: { additionalData?: Record<string, unknown> } } | null
        >;
      };
    };
  } catch {
    return null;
  }
}

export function useNotificationDeepLink(navRef: NavRef) {
  // Store a pending action if navigator isn't ready yet (background / cold)
  const pendingRef = useRef<ReturnType<typeof parseNotificationPayload> | null>(null);

  // Once navigator is ready, drain the pending action queue
  function drainPending(ref: NavRef) {
    const action = pendingRef.current;
    if (!action || !ref?.isReady()) return;
    pendingRef.current = null;
    dispatch(ref, action);
  }

  useEffect(() => {
    const OS = getOneSignal();
    if (!OS) return;

    // ── Cold-launch: app was closed when notification was tapped ──────
    OS.Notifications.getInitialNotification().then(event => {
      if (!event) return;
      const action = parseNotificationPayload(event.notification.additionalData);
      if (action.screen === 'noop') return;

      if (navRef?.isReady()) {
        dispatch(navRef, action);
      } else {
        pendingRef.current = action;
      }
    });

    // ── Foreground / Background: app resumed or active ────────────────
    const handler = (event: { notification: { additionalData?: Record<string, unknown> } }) => {
      const action = parseNotificationPayload(event.notification.additionalData);
      if (action.screen === 'noop') return;

      if (navRef?.isReady()) {
        dispatch(navRef, action);
      } else {
        pendingRef.current = action;
      }
    };

    OS.Notifications.addEventListener('click', handler);
    return () => OS.Notifications.removeEventListener('click', handler);
  }, []);

  // Expose drain so NavigationContainer's onReady can call it
  return { onNavigatorReady: () => drainPending(navRef) };
}

// ── Navigation dispatch ───────────────────────────────────────────────────────

function dispatch(
  nav: NonNullable<NavRef>,
  action: ReturnType<typeof parseNotificationPayload>
) {
  switch (action.screen) {
    case 'Room':
      // Navigate to room — works from any tab, no duplicate stack entries
      nav.navigate('Room', action.params);
      break;

    case 'Notifications':
      nav.navigate('Notifications');
      break;

    case 'Thread':
      // Messages tab → specific thread (navigate to Messages tab first)
      nav.navigate('Main');
      // Small delay to let the tab render before pushing Thread on top
      setTimeout(() => {
        nav.navigate('Thread', action.params);
      }, 120);
      break;

    case 'Profile':
      nav.navigate('UserProfile', action.params);
      break;

    case 'noop':
      break;
  }
}
