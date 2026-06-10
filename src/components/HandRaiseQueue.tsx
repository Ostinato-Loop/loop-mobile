/**
 * HandRaiseQueue — bottom sheet panel shown to the host only.
 * Lists pending hand-raisers with approve / deny actions.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Hand, Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors, avatarGradient, initials } from '@/constants/colors';
import type { HandRaiser } from '@/hooks/useHandRaise';

type Props = {
  queue: HandRaiser[];
  onApprove: (userId: string) => void;
  onDeny:    (userId: string) => void;
  onClose:   () => void;
};

export function HandRaiseQueue({ queue, onApprove, onDeny, onClose }: Props) {
  if (queue.length === 0) {
    return (
      <View style={styles.empty}>
        <Hand size={28} color={Colors.mutedFg} />
        <Text style={styles.emptyText}>No pending requests</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Hand size={18} color={Colors.primary} />
          <Text style={styles.headerTitle}>Hands raised ({queue.length})</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <X size={20} color={Colors.mutedFg} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {queue.map(h => {
          const grad = avatarGradient(h.user_id);
          const ini  = initials(h.display_name);
          return (
            <View key={h.user_id} style={styles.row}>
              <LinearGradient colors={grad} style={styles.avatar}>
                <Text style={styles.avatarText}>{ini}</Text>
              </LinearGradient>
              <Text style={styles.name} numberOfLines={1}>
                {h.display_name ?? 'Listener'}
              </Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.denyBtn]}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onDeny(h.user_id);
                  }}
                >
                  <X size={16} color={Colors.destructive} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.approveBtn]}
                  onPress={async () => {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    onApprove(h.user_id);
                  }}
                >
                  <Check size={16} color={Colors.primaryFg} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingBottom: 24,
    maxHeight: 320,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:{ color: Colors.foreground, fontSize: 15, fontWeight: '700' },
  list:       { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10, flexShrink: 0,
  },
  avatarText: { color: Colors.foreground, fontSize: 13, fontWeight: '700' },
  name:       { flex: 1, color: Colors.foreground, fontSize: 14, fontWeight: '500' },
  actions:    { flexDirection: 'row', gap: 8 },
  btn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  approveBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  denyBtn: {
    backgroundColor: Colors.destructive + '15',
    borderColor: Colors.destructive + '44',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyText: { color: Colors.mutedFg, fontSize: 14 },
});
