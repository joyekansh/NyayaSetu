/**
 * Tests for lib/httpClient.ts
 *
 * Covers: HttpError class, citizenAuth token management,
 * request() fetch wrapper, and the gate detection helper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpError, citizenAuth, request } from '@/lib/httpClient';

/* ------------------------------------------------------------------ */
/* HttpError                                                           */
/* ------------------------------------------------------------------ */

describe('HttpError', () => {
  it('stores status, message, and body', () => {
    const body = { detail: 'Not found' };
    const err = new HttpError(404, 'Not found', body);

    expect(err.status).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.body).toBe(body);
    expect(err.name).toBe('HttpError');
    expect(err).toBeInstanceOf(Error);
  });

  it('isGated returns true for a 403 gate response', () => {
    const err = new HttpError(403, 'Case held by urgency gate', null);
    expect(err.isGated).toBe(true);
  });

  it('isGated returns false for non-403 status', () => {
    const err = new HttpError(401, 'Unauthorized gate', null);
    expect(err.isGated).toBe(false);
  });

  it('isGated returns false when message does not mention gate', () => {
    const err = new HttpError(403, 'Forbidden', null);
    expect(err.isGated).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* citizenAuth                                                         */
/* ------------------------------------------------------------------ */

describe('citizenAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no token is stored', () => {
    expect(citizenAuth.token()).toBeNull();
  });

  it('save() persists a token that token() can read', () => {
    citizenAuth.save('test-jwt-abc');
    expect(citizenAuth.token()).toBe('test-jwt-abc');
  });

  it('clear() removes the stored token', () => {
    citizenAuth.save('test-jwt-abc');
    citizenAuth.clear();
    expect(citizenAuth.token()).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* request()                                                           */
/* ------------------------------------------------------------------ */

describe('request()', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('makes a GET request and parses JSON', async () => {
    const data = { id: '123', status: 'RECEIVED' };
    mockFetch.mockResolvedValueOnce(jsonResponse(200, data));

    const result = await request<typeof data>('/cases/123');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/cases/123');
    expect(init.method).toBe('GET');
    expect(result).toEqual(data);
  });

  it('attaches Authorization header when a citizen token exists', async () => {
    citizenAuth.save('my-jwt');
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {}));

    await request('/cases');

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer my-jwt');
  });

  it('skips Authorization header when authenticated is false', async () => {
    citizenAuth.save('my-jwt');
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {}));

    await request('/auth/otp/request', { authenticated: false });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('sends JSON body on POST', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, { id: 'new' }));

    await request('/cases', {
      method: 'POST',
      body: { district: 'Vellore' },
    });

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ district: 'Vellore' }));
  });

  it('throws HttpError on 4xx/5xx with detail string', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(422, { detail: 'Consent required' }),
    );

    await expect(request('/cases')).rejects.toThrow(HttpError);
    try {
      await request('/cases');
    } catch (err) {
      // Second call also mocked
      mockFetch.mockResolvedValueOnce(
        jsonResponse(422, { detail: 'Consent required' }),
      );
    }
  });

  it('throws HttpError on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(request('/health')).rejects.toThrow(HttpError);
    await expect(request('/health').catch((e) => e)).resolves.toMatchObject({
      status: 0,
    });
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await request<void>('/cases/123/fields', { method: 'PATCH' });
    expect(result).toBeUndefined();
  });
});
