import { getToken, setToken } from './storage';
import { ENDPOINTS, API_BASE } from '@/constants/api';

const TIMEOUT_MS = 12_000;

type FetchOptions = RequestInit & { skipAuth?: boolean };

async function withTimeout(promise: Promise<Response>): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch((promise as any).url ?? '', { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function apiFetch(
  url: string,
  options: FetchOptions = {},
  retry = 1,
): Promise<Response> {
  const { skipAuth, ...fetchOpts } = options;
  const token = skipAuth ? null : await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string> | undefined ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      ...fetchOpts,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timerId);
    if (err?.name === 'AbortError') throw new Error('Request timed out. Check your connection.');
    if (retry > 0) {
      await new Promise(r => setTimeout(r, 300));
      return apiFetch(url, options, retry - 1);
    }
    throw new Error('Network error. Please check your connection.');
  } finally {
    clearTimeout(timerId);
  }

  if (res.status === 401 && !skipAuth && retry > 0) {
    const refreshed = await silentRefresh();
    if (refreshed) return apiFetch(url, options, 0);
  }

  return res;
}

async function silentRefresh(): Promise<boolean> {
  try {
    const token = await getToken();
    if (!token) return false;
    const res = await fetch(ENDPOINTS.auth.silent, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return false;
    const data = await res.json() as { valid?: boolean; access_token?: string };
    if (data.valid && data.access_token) {
      await setToken(data.access_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await apiFetch(url, { method: 'GET' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await apiFetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
