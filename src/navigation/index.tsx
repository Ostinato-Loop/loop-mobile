import React from 'react';
import {
  NavigationContainer,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Home, Compass, Plus, MessageCircle, User } from 'lucide-react-native';
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

export type RootStackParamList = {
  Main:          undefined;
  Room:          { roomId: string };
  Notifications: undefined;
  Settings:      undefined;
  Login:         undefined;
  Otp:           { phone: string };
  Onboarding:    undefined;
  /** Deep-link target: tapping a DM notification */
  Thread:        { conversationId: string };
  /** Deep-link target: tapping a new-follower notification */
  UserProfile:   { userId: string };
};

export type TabParamList = {
  Feed:     undefined;
  Discover: undefined;
  Create:   undefined;
  Messages: undefined;
  Profile:  undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

const ICON_SIZE = 24;

function TabNavigator() {
  const { unread } = useNotifications();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.mutedFg,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: 'Feed',
          tabBarIcon: ({ color }) => <Home size={ICON_SIZE} color={color} />,
        }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color }) => <Compass size={ICON_SIZE} color={color} />,
        }}
      />
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
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <MessageCircle size={ICON_SIZE} color={color} />,
        }}
      />
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

  // Stable ref passed to NavigationContainer — never recreated between renders
  const navRef = useNavigationContainerRef<RootStackParamList>();

  // Wire up OneSignal deep-link handling for all app states
  const { onNavigatorReady } = useNotificationDeepLink(navRef);

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
      onReady={onNavigatorReady}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!user ? (
          <>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Otp"      component={OtpScreen} />
          </>
        ) : !profile?.onboarded ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main"          component={TabNavigator} />
            <Stack.Screen name="Room"          component={RoomScreen}
              options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Settings"      component={SettingsScreen} />
            {/* Deep-link targets registered so the navigator can resolve them */}
            <Stack.Screen name="Thread"      component={MessagesScreen} />
            <Stack.Screen name="UserProfile" component={ProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    paddingTop: 4,
    height: 64,
  },
  tabLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  fabIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
