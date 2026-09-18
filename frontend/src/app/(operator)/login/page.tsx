"use client";

/**
 * app/(operator)/login/page.tsx
 *
 * Operator auth screen. On success, stores the JWT and redirects into the
 * role-filtered queue (F1). Reads ?next= so a 401 redirect from apiClient
 * returns the operator to where they were.
 */

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, setStoredToken } from "@/lib/apiClient";
import type { LoginResponse } from "@/types/api";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let response: LoginResponse;
      if (USE_MOCKS) {
        response = {
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          role: "PARALEGAL",
          display_name: username || "Demo Paralegal",
        };
      } else {
        response = await apiFetch<LoginResponse>("/auth/login", {
          method: "POST",
          body: { username, password },
          skipAuth: true,
        });
      }
      setStoredToken(response.access_token);
      const next = searchParams.get("next") ?? "/queue";
      router.push(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not sign in. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          NyayaSetu — Operator Login
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Paralegal, Panel Lawyer, or DLSA Admin access.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
