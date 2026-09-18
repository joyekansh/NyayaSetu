/**
 * lib/apiClient.ts
 *
 * Single fetch wrapper for every operator-side API call (T5).
 * - Attaches the JWT from auth state
 * - Sets base URL from env
 * - Centralizes 401 -> redirect to login, 403 -> "not authorized for this
 *   case tier" (the branch that fires when an operator hits GET /matches on
 *   a gated case — see gate.py). This must surface as a clear message, not
 *   a generic error or a crash.
 *
 * Nothing in here is the real enforcement of anything (auth, reason-required
 * on override/reject, etc). All of that lives server-side. This file only
 * makes server decisions legible to the UI.
 */

import type { ApiErrorBody } from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const TOKEN_STORAGE_KEY = "nyayasetu_operator_access_token";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Thrown specifically for 403s on gated cases so callers can render a
 *  dedicated "not authorized for this case tier" state instead of a
 *  generic error boundary. */
export class GatedCaseError extends ApiError {
  constructor(message: string) {
    super(message, 403, "CASE_GATED");
    this.name = "GatedCaseError";
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  setStoredToken(null);
  const next = encodeURIComponent(
    window.location.pathname + window.location.search
  );
  window.location.href = `/login?next=${next}`;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip attaching Authorization — only needed for the login call itself. */
  skipAuth?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  if (!skipAuth) {
    const token = getStoredToken();
    if (token) {
      finalHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0,
      "NETWORK_ERROR"
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null;
    const message =
      errorBody?.detail ?? `Request failed with status ${response.status}`;

    if (response.status === 401) {
      redirectToLogin();
      throw new ApiError("Session expired. Redirecting to login.", 401);
    }

    if (response.status === 403) {
      // Specifically the gate.py branch: operator hit a case-tier-restricted
      // endpoint (e.g. /matches on a Critical/High case not yet reclassified).
      throw new GatedCaseError(
        errorBody?.code === "CASE_GATED" || path.includes("/matches")
          ? "This case is gated pending triage review. You're not authorized to view matches for this case tier yet."
          : message
      );
    }

    throw new ApiError(message, response.status, errorBody?.code);
  }

  return payload as T;
}
