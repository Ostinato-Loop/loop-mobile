/**
 * EarningsScreen
 *
 * Creator monetisation hub. Sections:
 *
 *  1. Balance card — Loop Coins balance + local-currency value
 *     + "Cash Out" button (opens withdrawal sheet)
 *  2. Stats strip — Total earned · This month · Rooms that earned
 *  3. Per-room breakdown — FlatList rows with coins + audience peak
 *  4. Withdrawal history — past payouts with status chips
 *
 * Withdrawal sheet (bottom-sheet Modal):
 *   • Amount input (in coins, up to available balance)
 *   • Currency selector (NGN / KES / GHS / ZAR / USD)
 *   • Phone-money number input (M-Pesa / Opay / MoMo)
 *   • Submit → POST /api/earnings/withdraw
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, RefreshControl, ActivityIndicator,
  Modal, TextInput, ScrollView, Animated,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft, Coins, TrendingUp, Clock, CheckCircle2,
  AlertCircle, Loader, ChevronDown, Check, Banknote,
  Mic, Users,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useEarnings, type Withdrawal, type RoomEarning } from '@/hooks/useEarnings';
import { PAYOUT_CURRENCIES, type PayoutCurrency } from '@/constants/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const COIN_SYMBOL = '⬡';

function formatCoins(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCash(coins: number, rate: number, currency: string) {
  const value = (coins * rate).toFixed(2);
  return `${currency} ${Number(value).toLocaleString()}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const STATUS_CONFIG: Record<Withdrawal['status'], { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: Colors.accent    ?? '#FF7A00' },
  processing: { label: 'Processing', color: Colors.primary },
  completed:  { label: 'Paid',       color: '#22C55E' },
  failed:     { label: 'Failed',     color: Colors.destructive },
};

const CATEGORY_EMOJI: Record<string, string> = {
  community: '🏘️', news: '📡', commentary: '🎙️',
  radio: '📻', 'dj-session': '🎧', education: '📚',
  business: '💼', general: '🎵',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function WithdrawalStatusChip({ status }: { status: Withdrawal['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.statusChip, { borderColor: cfg.color + '44', backgroundColor: cfg.color + '18' }]}>
      <Text style={[styles.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function RoomEarningRow({ item }: { item: RoomEarning }) {
  const emoji = CATEGORY_EMOJI[item.category] ?? '🎵';
  return (
    <View style={styles.roomRow}>
      <View style={styles.roomEmoji}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
      </View>
      <View style={styles.roomInfo}>
        <Text style={styles.roomTitle} numberOfLines={1}>{item.room_title}</Text>
        <View style={styles.roomMeta}>
          <Clock size={11} color={Colors.mutedFg} />
          <Text style={styles.metaText}>{formatDuration(item.duration_minutes)}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Users size={11} color={Colors.mutedFg} />
          <Text style={styles.metaText}>{item.audience_peak} peak</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{formatDate(item.date)}</Text>
        </View>
      </View>
      <View style={styles.coinsBadge}>
        <Text style={styles.coinsSymbol}>{COIN_SYMBOL}</Text>
        <Text style={styles.coinsEarned}>+{formatCoins(item.coins_earned)}</Text>
      </View>
    </View>
  );
}

function WithdrawalRow({ item }: { item: Withdrawal }) {
  const curr = PAYOUT_CURRENCIES.find(c => c.code === item.currency);
  return (
    <View style={styles.wdRow}>
      <View style={styles.wdIconWrap}>
        <Banknote size={18} color={Colors.mutedFg} />
      </View>
      <View style={styles.wdInfo}>
        <Text style={styles.wdAmount}>
          {item.currency} {item.amount_cash.toLocaleString()}
        </Text>
        <Text style={styles.wdMeta}>
          {COIN_SYMBOL} {formatCoins(item.amount_coins)} · {curr?.method ?? item.currency} · {formatDate(item.created_at)}
        </Text>
      </View>
      <WithdrawalStatusChip status={item.status} />
    </View>
  );
}

// ── Cash-out bottom sheet ─────────────────────────────────────────────────────

type CashOutSheetProps = {
  visible:    boolean;
  maxCoins:   number;
  minCoins:   number;
  coinRate:   number;
  currency:   PayoutCurrency;
  onClose:    () => void;
  onSubmit:   (coins: number, currency: PayoutCurrency, phone: string) => Promise<void>;
};

function CashOutSheet({
  visible, maxCoins, minCoins, coinRate, currency: defaultCurrency,
  onClose, onSubmit,
}: CashOutSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      friction: 18, tension: 140,
    }).start();
  }, [visible]);

  const [amount,   setAmount]   = useState(String(maxCoins));
  const [currency, setCurrency] = useState<PayoutCurrency>(defaultCurrency);
  const [phone,    setPhone]    = useState('');
  const [showCurr, setShowCurr] = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');

  const coins     = parseInt(amount) || 0;
  const cashValue = (coins * coinRate).toFixed(2);
  const selCurr   = PAYOUT_CURRENCIES.find(c => c.code === currency)!;
  const canSubmit = coins >= minCoins && coins <= maxCoins && phone.trim().length >= 7 && !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError('');
    setBusy(true);
    try {
      await onSubmit(coins, currency, phone.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Withdrawal failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] });
  const bgOpacity  = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 24, transform: [{ translateY }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Cash Out</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={[styles.metaText, { fontSize: 15 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {/* Coin amount */}
            <Text style={styles.fieldLabel}>Amount (coins)</Text>
            <View style={styles.amountRow}>
              <Text style={styles.coinSymbolLarge}>{COIN_SYMBOL}</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={v => setAmount(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={10}
              />
              <TouchableOpacity onPress={() => setAmount(String(maxCoins))} style={styles.maxBtn}>
                <Text style={styles.maxBtnText}>MAX</Text>
              </TouchableOpacity>
            </View>
            {coins > 0 && (
              <Text style={styles.cashEquiv}>
                ≈ {currency} {Number(cashValue).toLocaleString()}
              </Text>
            )}
            {coins < minCoins && coins > 0 && (
              <Text style={styles.fieldError}>Minimum withdrawal is {COIN_SYMBOL} {minCoins.toLocaleString()}</Text>
            )}

            {/* Currency */}
            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Pay to</Text>
            <TouchableOpacity
              style={styles.currencyPicker}
              onPress={() => setShowCurr(v => !v)}
              activeOpacity={0.8}
            >
              <Text style={styles.currencyPickerText}>{selCurr.label}</Text>
              <Text style={styles.currencyMethod}>{selCurr.method}</Text>
              <ChevronDown size={15} color={Colors.mutedFg}
                style={showCurr ? { transform: [{ rotate: '180deg' }] } : undefined} />
            </TouchableOpacity>
            {showCurr && (
              <View style={styles.currencyDropdown}>
                {PAYOUT_CURRENCIES.map(c => (
                  <TouchableOpacity
                    key={c.code}
                    style={[styles.currencyOption, currency === c.code && styles.currencyOptionActive]}
                    onPress={() => { setCurrency(c.code); setShowCurr(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.currencyOptionLabel, currency === c.code && { color: Colors.primary }]}>
                        {c.label}
                      </Text>
                      <Text style={styles.currencyOptionMethod}>{c.method}</Text>
                    </View>
                    {currency === c.code && <Check size={14} color={Colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Phone */}
            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Phone number</Text>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+234 801 000 0000"
              placeholderTextColor={Colors.mutedFg}
              keyboardType="phone-pad"
              maxLength={20}
            />

            {error ? <Text style={styles.fieldError}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator color={Colors.primaryFg} />
                : <Text style={styles.submitBtnText}>
                    Request {currency} {Number(cashValue).toLocaleString()}
                  </Text>
              }
            </TouchableOpacity>
            <Text style={styles.disclaimer}>
              Withdrawals are processed within 1–3 business days.
              Minimum {COIN_SYMBOL} {minCoins.toLocaleString()} required.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function EarningsScreen() {
  const nav    = useNavigation();
  const insets = useSafeAreaInsets();

  const { summary, rooms, withdrawals, loading, refreshing, error, refresh, withdraw } =
    useEarnings(true);

  const [showCashOut, setShowCashOut] = useState(false);

  const handleWithdraw = useCallback(async (
    coins: number, currency: PayoutCurrency, phone: string,
  ) => {
    await withdraw(coins, currency, phone);
    setShowCashOut(false);
  }, [withdraw]);

  // ── Skeletons while loading ────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading earnings…</Text>
      </View>
    );
  }

  if (error && !summary) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <AlertCircle size={40} color={Colors.destructive} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s   = summary!;
  const rate = s.coin_rate;
  const curr = s.preferred_currency;

  // ── Sections for SectionList ───────────────────────────────────────
  type Section =
    | { key: 'header' }
    | { key: 'rooms' }
    | { key: 'withdrawals' };

  const ListHeader = (
    <>
      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Earnings</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── Balance card ── */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceLabelRow}>
          <Coins size={16} color={Colors.primary} />
          <Text style={styles.balanceLabel}>Available balance</Text>
        </View>

        <Text style={styles.balanceCoins}>
          {COIN_SYMBOL} {formatCoins(s.coins_balance)}
        </Text>
        <Text style={styles.balanceCash}>
          ≈ {formatCash(s.coins_balance, rate, curr)}
        </Text>

        {s.withdrawal_pending && (
          <View style={styles.pendingBanner}>
            <Loader size={13} color={Colors.accent ?? '#FF7A00'} />
            <Text style={styles.pendingText}>Withdrawal processing…</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.cashOutBtn,
            (s.coins_balance < s.min_withdrawal || s.withdrawal_pending) && styles.cashOutBtnDisabled,
          ]}
          onPress={() => setShowCashOut(true)}
          disabled={s.coins_balance < s.min_withdrawal || s.withdrawal_pending}
          activeOpacity={0.85}
        >
          <Banknote size={17} color={Colors.primaryFg} />
          <Text style={styles.cashOutBtnText}>Cash Out</Text>
        </TouchableOpacity>

        {s.coins_balance < s.min_withdrawal && (
          <Text style={styles.minNote}>
            Need {COIN_SYMBOL} {s.min_withdrawal.toLocaleString()} to withdraw
            · {formatCash(s.min_withdrawal, rate, curr)} min
          </Text>
        )}
      </View>

      {/* ── Stats strip ── */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{COIN_SYMBOL} {formatCoins(s.coins_total_earned)}</Text>
          <Text style={styles.statLabel}>Total earned</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNum}>{COIN_SYMBOL} {formatCoins(s.coins_this_month)}</Text>
          <Text style={styles.statLabel}>This month</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statNum}>{rooms.length}</Text>
          <Text style={styles.statLabel}>Earning rooms</Text>
        </View>
      </View>

      {/* ── Per-room section header ── */}
      {rooms.length > 0 && (
        <View style={styles.sectionHeader}>
          <Mic size={13} color={Colors.mutedFg} />
          <Text style={styles.sectionTitle}>By room</Text>
        </View>
      )}
    </>
  );

  const ListFooter = withdrawals.length > 0 ? (
    <>
      <View style={[styles.sectionHeader, { marginTop: 10 }]}>
        <TrendingUp size={13} color={Colors.mutedFg} />
        <Text style={styles.sectionTitle}>Withdrawals</Text>
      </View>
      {withdrawals.map(w => <WithdrawalRow key={w.id} item={w} />)}
      <View style={{ height: 40 }} />
    </>
  ) : <View style={{ height: 40 }} />;

  return (
    <View style={styles.root}>
      <FlatList
        data={rooms}
        keyExtractor={r => r.room_id}
        renderItem={({ item }) => <RoomEarningRow item={item} />}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh}
            tintColor={Colors.primary} colors={[Colors.primary]} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyRooms}>
              <Coins size={36} color={Colors.mutedFg} />
              <Text style={styles.emptyTitle}>No earnings yet</Text>
              <Text style={styles.emptyBody}>
                Go live and engage your audience — coins are awarded based on room duration and listeners.
              </Text>
            </View>
          ) : null
        }
        removeClippedSubviews
      />

      {summary && (
        <CashOutSheet
          visible={showCashOut}
          maxCoins={summary.coins_balance}
          minCoins={summary.min_withdrawal}
          coinRate={summary.coin_rate}
          currency={summary.preferred_currency}
          onClose={() => setShowCashOut(false)}
          onSubmit={handleWithdraw}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.background },
  center:   { alignItems: 'center', justifyContent: 'center', flex: 1 },
  list:     { paddingBottom: 24 },

  loadingText: { color: Colors.mutedFg, marginTop: 12, fontSize: 14 },
  errorText:   { color: Colors.destructive, marginTop: 12, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:    { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.surface, borderRadius: 12 },
  retryBtnText:{ color: Colors.foreground, fontWeight: '600' },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12,
  },
  backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBarTitle:  { flex: 1, textAlign: 'center', color: Colors.foreground, fontSize: 18, fontWeight: '800' },

  // Balance card
  balanceCard: {
    alignItems: 'center',
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
    padding: 24,
  },
  balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  balanceLabel:    { color: Colors.mutedFg, fontSize: 13, fontWeight: '600' },
  balanceCoins: {
    color: Colors.primary, fontSize: 44, fontWeight: '900',
    letterSpacing: -1, lineHeight: 50,
  },
  balanceCash:     { color: Colors.mutedFg, fontSize: 16, marginTop: 4, marginBottom: 16 },
  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: (Colors.accent ?? '#FF7A00') + '18',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    marginBottom: 14,
  },
  pendingText: { color: Colors.accent ?? '#FF7A00', fontSize: 13, fontWeight: '600' },
  cashOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32, minHeight: 50,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  cashOutBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  cashOutBtnText:     { color: Colors.primaryFg, fontSize: 16, fontWeight: '800' },
  minNote: { color: Colors.mutedFg, fontSize: 12, marginTop: 10, textAlign: 'center' },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 16,
  },
  stat:        { flex: 1, alignItems: 'center' },
  statNum:     { color: Colors.foreground, fontSize: 16, fontWeight: '800' },
  statLabel:   { color: Colors.mutedFg, fontSize: 11, marginTop: 3 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, marginBottom: 2,
  },
  sectionTitle: { color: Colors.mutedFg, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  // Room rows
  roomRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  roomEmoji: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  roomInfo:    { flex: 1 },
  roomTitle:   { color: Colors.foreground, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  roomMeta:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText:    { color: Colors.mutedFg, fontSize: 11 },
  metaDot:     { color: Colors.mutedFg, fontSize: 11 },
  coinsBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  coinsSymbol: { color: Colors.primary, fontSize: 14 },
  coinsEarned: { color: Colors.primary, fontSize: 14, fontWeight: '700' },

  // Withdrawal rows
  wdRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  wdIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  wdInfo:      { flex: 1 },
  wdAmount:    { color: Colors.foreground, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  wdMeta:      { color: Colors.mutedFg, fontSize: 11 },
  statusChip:  { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusChipText: { fontSize: 11, fontWeight: '700' },

  // Empty
  emptyRooms:  { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 40 },
  emptyTitle:  { color: Colors.foreground, fontSize: 16, fontWeight: '700', marginTop: 14 },
  emptyBody:   { color: Colors.mutedFg, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },

  // Cash-out sheet
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: Colors.border,
    maxHeight: '92%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle:  { color: Colors.foreground, fontSize: 17, fontWeight: '700' },
  sheetBody:   { padding: 20, paddingBottom: 8 },

  fieldLabel:  { color: Colors.mutedFg, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  fieldError:  { color: Colors.destructive, fontSize: 12, marginTop: 5 },

  amountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  coinSymbolLarge: { color: Colors.primary, fontSize: 20 },
  amountInput:  { flex: 1, color: Colors.foreground, fontSize: 24, fontWeight: '700', paddingVertical: 10 },
  maxBtn: {
    backgroundColor: Colors.primary + '20', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  maxBtnText:  { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  cashEquiv:   { color: Colors.mutedFg, fontSize: 13, marginTop: 6 },

  currencyPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  currencyPickerText:   { flex: 1, color: Colors.foreground, fontSize: 15 },
  currencyMethod:       { color: Colors.mutedFg, fontSize: 12 },
  currencyDropdown: {
    marginTop: 6, backgroundColor: Colors.background,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  currencyOption: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  currencyOptionActive:  { backgroundColor: Colors.primary + '14' },
  currencyOptionLabel:   { color: Colors.mutedFg, fontSize: 14, fontWeight: '500' },
  currencyOptionMethod:  { color: Colors.mutedFg, fontSize: 11, marginTop: 2 },

  phoneInput: {
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.foreground, fontSize: 16,
    paddingHorizontal: 14, paddingVertical: 13,
  },

  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 20, minHeight: 54,
    justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.35, shadowOpacity: 0 },
  submitBtnText:     { color: Colors.primaryFg, fontSize: 16, fontWeight: '800' },
  disclaimer: { color: Colors.mutedFg, fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16 },
});
