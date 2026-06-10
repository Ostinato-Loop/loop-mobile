/**
 * useEarnings
 *
 * Fetches the three earnings datasets in parallel:
 *   summary    — balance, total earned, this-month, cash value
 *   roomBreakdown — per-room earnings list
 *   withdrawals   — payout history
 *
 * All three refresh together on pull-to-refresh.
 * The hook is a no-op until `enabled` flips true (lazy load for
 * users who haven't opened the earnings tab yet).
 */
import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { ENDPOINTS, type PayoutCurrency } from '@/constants/api';

// ── Data types ────────────────────────────────────────────────────────────────

export type EarningsSummary = {
  coins_balance:      number;
  coins_total_earned: number;
  coins_this_month:   number;
  /** Exchange rate: how many local-currency units per 1 coin */
  coin_rate:          number;
  preferred_currency: PayoutCurrency;
  withdrawal_pending: boolean;
  min_withdrawal:     number;  // in coins
};

export type RoomEarning = {
  room_id:          string;
  room_title:       string;
  category:         string;
  coins_earned:     number;
  audience_peak:    number;
  duration_minutes: number;
  date:             string; // ISO
};

export type Withdrawal = {
  id:           string;
  amount_coins: number;
  amount_cash:  number;
  currency:     PayoutCurrency;
  status:       'pending' | 'processing' | 'completed' | 'failed';
  created_at:   string;
  completed_at: string | null;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

type State = {
  summary:      EarningsSummary | null;
  rooms:        RoomEarning[];
  withdrawals:  Withdrawal[];
  loading:      boolean;
  refreshing:   boolean;
  error:        string | null;
};

export function useEarnings(enabled = true) {
  const [state, setState] = useState<State>({
    summary: null, rooms: [], withdrawals: [],
    loading: true, refreshing: false, error: null,
  });

  const load = useCallback(async (isRefresh = false) => {
    if (!enabled) return;
    setState(prev => ({
      ...prev,
      loading: !isRefresh,
      refreshing: isRefresh,
      error: null,
    }));
    try {
      const [sumData, roomData, wdData] = await Promise.all([
        apiGet<{ summary: EarningsSummary }>(ENDPOINTS.earnings.summary),
        apiGet<{ rooms: RoomEarning[] }>(ENDPOINTS.earnings.rooms),
        apiGet<{ withdrawals: Withdrawal[] }>(ENDPOINTS.earnings.withdrawals),
      ]);
      setState({
        summary:     sumData.summary,
        rooms:       roomData.rooms ?? [],
        withdrawals: wdData.withdrawals ?? [],
        loading:     false,
        refreshing:  false,
        error:       null,
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false, refreshing: false,
        error: err.message ?? 'Could not load earnings',
      }));
    }
  }, [enabled]);

  useEffect(() => { if (enabled) load(); }, [load, enabled]);

  /** Submit a withdrawal request */
  const withdraw = useCallback(async (
    coins: number,
    currency: PayoutCurrency,
    phoneNumber: string,
  ) => {
    const res = await apiPost<{ withdrawal: Withdrawal }>(
      ENDPOINTS.earnings.withdraw,
      { amount_coins: coins, currency, phone_number: phoneNumber }
    );
    // Optimistically prepend to history and update balance
    setState(prev => ({
      ...prev,
      withdrawals: [res.withdrawal, ...prev.withdrawals],
      summary: prev.summary
        ? {
            ...prev.summary,
            coins_balance: prev.summary.coins_balance - coins,
            withdrawal_pending: true,
          }
        : prev.summary,
    }));
    return res.withdrawal;
  }, []);

  return { ...state, refresh: () => load(true), withdraw };
}
