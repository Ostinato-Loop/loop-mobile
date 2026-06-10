import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Avatar } from '@/components/Avatar';
import { apiGet } from '@/lib/api-client';
import { ENDPOINTS } from '@/constants/api';

type Conversation = {
  id: string;
  other_user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ conversations: Conversation[] }>(ENDPOINTS.messages.conversations)
      .then(d => setConvs(d.conversations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Messages</Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : convs.length === 0 ? (
        <View style={styles.empty}>
          <MessageCircle size={48} color={Colors.mutedFg} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySub}>Follow people and start conversations from rooms.</Text>
        </View>
      ) : (
        <FlatList
          data={convs}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.convRow} activeOpacity={0.8}>
              <Avatar
                userId={item.other_user.id}
                name={item.other_user.display_name}
                avatarUrl={item.other_user.avatar_url}
                size={48}
              />
              <View style={styles.convBody}>
                <View style={styles.convTop}>
                  <Text style={styles.convName} numberOfLines={1}>
                    {item.other_user.display_name ?? item.other_user.username}
                  </Text>
                  <Text style={styles.convTime}>{timeAgo(item.last_message_at)}</Text>
                </View>
                <Text style={styles.convLast} numberOfLines={1}>
                  {item.last_message ?? 'No messages yet'}
                </Text>
              </View>
              {item.unread_count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.background },
  title: { color: Colors.foreground, fontSize: 24, fontWeight: '800', paddingHorizontal: 16, marginBottom: 12 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { color: Colors.foreground, fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySub:   { color: Colors.mutedFg, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  convBody: { flex: 1, marginLeft: 12 },
  convTop:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  convName: { color: Colors.foreground, fontSize: 15, fontWeight: '600', flex: 1 },
  convTime: { color: Colors.mutedFg, fontSize: 12 },
  convLast: { color: Colors.mutedFg, fontSize: 13 },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: Colors.primaryFg, fontSize: 11, fontWeight: '700' },
});
