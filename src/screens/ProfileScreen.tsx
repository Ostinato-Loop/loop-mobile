import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Settings, Bell, BadgeCheck, MapPin,
  LogOut, ChevronRight, Globe2, Shield,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/hooks/useAuth';
import type { RootStackParamList } from '@/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const nav    = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }

  async function handleSignOut() {
    await signOut();
  }

  const name = profile?.display_name ?? profile?.username ?? user?.phone ?? 'You';

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh}
          tintColor={Colors.primary} colors={[Colors.primary]} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity onPress={() => nav.navigate('Settings')} style={styles.settingsBtn} hitSlop={12}>
          <Settings size={22} color={Colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Identity card */}
      <View style={styles.card}>
        {profile && (
          <Avatar
            userId={profile.id}
            name={profile.display_name}
            avatarUrl={profile.avatar_url}
            size={72}
          />
        )}
        <View style={styles.nameRow}>
          <Text style={styles.displayName}>{name}</Text>
          {profile?.is_verified && (
            <BadgeCheck size={18} color={Colors.primary} style={{ marginLeft: 6 }} />
          )}
        </View>
        {profile?.username && (
          <Text style={styles.username}>@{profile.username}</Text>
        )}
        {profile?.bio && (
          <Text style={styles.bio}>{profile.bio}</Text>
        )}
        {(profile?.state_id || profile?.country_id) && (
          <View style={styles.locationRow}>
            <MapPin size={13} color={Colors.mutedFg} />
            <Text style={styles.locationText}>
              {profile.state_id ?? profile.country_id}
            </Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{profile?.followers_count ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{profile?.following_count ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>
      </View>

      {/* Menu items */}
      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => nav.navigate('Notifications')}>
          <Bell size={20} color={Colors.foreground} />
          <Text style={styles.menuLabel}>Notifications</Text>
          <ChevronRight size={18} color={Colors.mutedFg} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Globe2 size={20} color={Colors.foreground} />
          <Text style={styles.menuLabel}>Language & Region</Text>
          <ChevronRight size={18} color={Colors.mutedFg} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Shield size={20} color={Colors.foreground} />
          <Text style={styles.menuLabel}>Privacy & Safety</Text>
          <ChevronRight size={18} color={Colors.mutedFg} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <LogOut size={18} color={Colors.destructive} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Loop v1.0.0 · Powered by RALD</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title:       { color: Colors.foreground, fontSize: 22, fontWeight: '800' },
  settingsBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  displayName: { color: Colors.foreground, fontSize: 22, fontWeight: '800' },
  username: { color: Colors.mutedFg, fontSize: 14, marginTop: 4 },
  bio: { color: Colors.foreground, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  locationText:{ color: Colors.mutedFg, fontSize: 13 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    width: '100%',
    justifyContent: 'center',
  },
  stat:        { alignItems: 'center', flex: 1 },
  statNum:     { color: Colors.foreground, fontSize: 22, fontWeight: '800' },
  statLabel:   { color: Colors.mutedFg, fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  menu: {
    marginHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
    minHeight: 56,
  },
  menuLabel: { flex: 1, color: Colors.foreground, fontSize: 15 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 16,
    backgroundColor: Colors.destructive + '15',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.destructive + '33',
    minHeight: 52,
  },
  signOutText: { color: Colors.destructive, fontSize: 15, fontWeight: '600' },
  version: { color: Colors.mutedFg, fontSize: 12, textAlign: 'center', marginTop: 24 },
});
