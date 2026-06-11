/**
 * RootNavigator — African-First tab structure
 * AFRICAN-UX-001 (2026-06-11)
 *
 * Tab bar (5 items, spec-exact):
 *   Rooms  |  Start  |  Chat  |  Alerts  |  You
 *   Feed      Create   Messages  Notifs    Profile
 *
 * Discover demoted to a stack screen — accessible from the search
 * icon in FeedScreen. Removed as a persistent tab per spec:
 * "Remove all unnecessary navigation."
 *
 * DEEPLINK-001 (2026-06-10): Notifications deep link now resolves to
 * the Alerts tab via nested linking config.
 *
 * LILCKY STUDIO LIMITED
 */
import React from 'react';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Home, Plus, MessageCircle, Bell, User } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationDeepLink } from '@/hooks/useNotificationDeepLink';

import FeedScreen          from '@/screens/FeedScreen';
import DiscoverScreen      from '@/screens/DiscoverScreen';
import CreateRoomScreen    from '@/screens/CreateRoomScreen';
import MessagesScreen      from '@/screens/MessagesScreen';
import ProfileScreen       from '@/screens/ProfileScreen';
import RoomScreen          from '@/screens/RoomScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import SettingsScreen      from '@/screens/SettingsScreen';
import LoginScreen         from '@/screens/LoginScreen';
import OtpScreen           from '@/screens/OtpScreen';
import OnboardingScreen    from '@/screens/OnboardingScreen';
import EarningsScreen      from '@/screens/EarningsScreen';
import UserProfileScreen   from '@/screens/UserProfileScreen';

export type RootStackParamList = {
  Main:        undefined;
  Room:        { roomId: string };
  Discover:    undefined;
  Settings:    undefined;
  Earnings:    undefined;
  Login:       undefined;
  Otp:         { phone: string };
  Onboarding:  undefined;
  Thread:      { conversationId: string };
  UserProfile: { userId: string };
};

export type TabParamList = {
  Feed:          undefined;
  Create:        undefined;
  Messages:      undefined;
  Notifications: undefined;
  Profile:       undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

const ICON_SIZE = 24;

function TabNavigator() {
  const { unread } = useNotifications();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:             false,
        tabBarStyle:             styles.tabBar,
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.mutedFg,
        tabBarShowLabel:         true,
        tabBarLabelStyle:        styles.tabLabel,
      }}
    >
      {/* 1 — Rooms */}
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Rooms',
          tabBarIcon: ({ color }) => <Home size={ICON_SIZE} color={color} />,
        }}
      />

      {/* 2 — Start a Room (centre FAB) */}
      <Tab.Screen
        name="Create"
        component={CreateRoomScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: () => (
            <View style={styles.fabIcon}>
              <Plus size={22} color={Colors.primaryFg} />
            </View>
          ),
        }}
      />

      {/* 3 — Chat */}
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <MessageCircle size={ICON_SIZE} color={color} />,
        }}
      />

      {/* 4 — Alerts with live unread badge */}
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color }) => (
            <View style={styles.bellWrap}>
              <Bell size={ICON_SIZE} color={color} />
              {unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unread > 9 ? '9+' : String(unread)}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      {/* 5 — Profile */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'You',
          tabBarIcon: ({ color }) => <User size={ICON_SIZE} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, profile, loading } = useAuth();

  const navRef = useNavigationContainerRef<RootStackParamList>();
  const { onNavigatorReady } = useNotificationDeepLink(navRef);

  // DEEPLINK-001 (2026-06-10) / AFRICAN-UX-001 (2026-06-11)
  // Notifications deep link resolves to the Alerts tab via nested config.
  const linking = {
    prefixes: ['loop://', 'https://loop.rald.cloud'],
    config: {
      screens: {
        Main: {
          screens: {
            Notifications: 'notifications',
          },
        },
        Room:        { path: 'rooms/:roomId' },
        Discover:    'discover',
        Settings:    'settings',
        Thread:      { path: 'thread/:conversationId' },
        UserProfile: { path: 'profile/:userId' },
        Earnings:    'earnings',
      },
    },
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navRef}
      linking={linking}
      onReady={onNavigatorReady}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!user ? (
          <>
            <Stack.Screen name="Login"   component={LoginScreen} />
            <Stack.Screen name="Otp"     component={OtpScreen} />
          </>
        ) : !profile?.onboarded ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main"     component={TabNavigator} />
            <Stack.Screen name="Room"     component={RoomScreen}
              options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
            <Stack.Screen name="Discover" component={DiscoverScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Earnings" component={EarningsScreen} />
            <Stack.Screen name="Thread"      component={MessagesScreen} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex:            1,
    backgroundColor: Colors.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor:  Colors.border,
    borderTopWidth:  1,
    paddingTop:      4,
    height:          64,
  },
  tabLabel: {
    fontSize:     11,
    marginBottom: 4,
  },
  fabIcon: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    12,
    shadowColor:     Colors.primary,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.4,
    shadowRadius:    12,
    elevation:       8,
  },
  bellWrap: {
    width:          ICON_SIZE + 8,
    height:         ICON_SIZE + 8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  badge: {
    position:          'absolute',
    top:               -2,
    right:             -4,
    backgroundColor:   Colors.live,
    borderRadius:      8,
    minWidth:          16,
    height:            16,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color:      Colors.foreground,
    fontSize:   10,
    fontWeight: '700',
  },
});
