/**
 * lib/httpClient.ts — minimal fetch helper for the citizen-facing pages only.
 * OWNER: Akash.
 *
 * Per roles.md, `apiClient.ts` and `caseApi.ts` are Joy's (operator console:
 * queue/case/decision/referral calls, plus the shared JWT/refresh plumbing for
 * that side of the app). This file is intentionally smaller and named
 * differently so the two never collide on a merge.
 *
 * Citizen auth is OTP-only and short-lived (FR-1), so there's no refresh-token
 * dance here — just enough to attach a token if one exists and surface errors
 * the same shape Joy's ApiError uses, so components can be swapped later
 * without a rewrite if the two clients are ever merged post-hackathon.
 */

import type { ApiErrorBody } from '@/types/api';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '/api/v1';

const CITIZEN_TOKEN_KEY = 'nyayasetu.citizen_access';

const isBrowser = () => typeof window !== 'undefined';

export const citizenAuth = {
  token(): string | null {
    return isBrowser() ? window.localStorage.getItem(CITIZEN_TOKEN_KEY) : null;
  },
  save(token: string): void {
    if (isBrowser()) window.localStorage.setItem(CITIZEN_TOKEN_KEY, token);
  },
  clear(): void {
    if (isBrowser()) window.localStorage.removeItem(CITIZEN_TOKEN_KEY);
  },
};

export class HttpError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(status: number, message: string, body: ApiErrorBody | null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }

  /**
   * True when the backend refused because triage/gate.py is holding this case
   * for human review. Expected outcome for a Critical/High case, not a bug —
   * see (citizen)/dossier and (citizen)/status for how this is surfaced.
   */
  get isGated(): boolean {
    return this.status === 403 && /gate/i.test(this.message);
  }
}

export function readDetail(body: ApiErrorBody | null, fallback: string): string {
  if (!body) return fallback;
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail) && body.detail.length > 0) {
    return body.detail.map((d) => d.msg).join('; ');
  }
  return fallback;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  form?: FormData;
  authenticated?: boolean;
  signal?: AbortSignal;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, form, authenticated = true, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authenticated) {
    const token = citizenAuth.token();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new HttpError(0, 'Cannot reach the server. Check your connection.', null);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed = text ? safeJson(text) : null;

  if (!response.ok) {
    throw new HttpError(
      response.status,
      readDetail(parsed as ApiErrorBody | null, response.statusText),
      parsed as ApiErrorBody | null,
    );
  }

  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
