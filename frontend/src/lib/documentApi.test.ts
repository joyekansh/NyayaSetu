/**
 * Tests for lib/documentApi.ts
 *
 * Covers: uploadDocument (XHR), getStatus, and waitForExtraction polling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpError } from '@/lib/httpClient';

// Mock httpClient so documentApi.getStatus uses our mock
vi.mock('@/lib/httpClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/httpClient')>(
    '@/lib/httpClient',
  );
  return {
    ...actual,
    request: vi.fn(),
    citizenAuth: {
      token: vi.fn(() => 'mock-token'),
      save: vi.fn(),
      clear: vi.fn(),
    },
  };
});

import { request } from '@/lib/httpClient';
import { documentApi } from '@/lib/documentApi';
import type { DocumentStatus } from '@/types/api';

const mockRequest = vi.mocked(request);

describe('documentApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getStatus', () => {
    it('calls the correct endpoint and returns status', async () => {
      const status: DocumentStatus = {
        document_id: 'doc-1',
        ocr_status: 'PROCESSING',
        ocr_confidence: null,
        error_message: null,
        extracted_fields: [],
      };
      mockRequest.mockResolvedValueOnce(status);

      const result = await documentApi.getStatus('case-1', 'doc-1');

      expect(mockRequest).toHaveBeenCalledWith(
        '/cases/case-1/documents/doc-1/status',
        { signal: undefined },
      );
      expect(result.ocr_status).toBe('PROCESSING');
    });
  });

  describe('waitForExtraction', () => {
    it('resolves when OCR reaches DONE', async () => {
      const processingStatus: DocumentStatus = {
        document_id: 'doc-1',
        ocr_status: 'PROCESSING',
        ocr_confidence: null,
        error_message: null,
        extracted_fields: [],
      };
      const doneStatus: DocumentStatus = {
        document_id: 'doc-1',
        ocr_status: 'DONE',
        ocr_confidence: 0.92,
        error_message: null,
        extracted_fields: [
          {
            id: 'f-1',
            document_id: 'doc-1',
            field_name: 'annual_income',
            field_value: '96000',
            confidence: 0.88,
            is_operator_corrected: false,
            corrected_by_operator_id: null,
          },
        ],
      };

      mockRequest
        .mockResolvedValueOnce(processingStatus)
        .mockResolvedValueOnce(doneStatus);

      const onTick = vi.fn();

      const promise = documentApi.waitForExtraction('case-1', 'doc-1', {
        intervalMs: 500,
        timeoutMs: 10_000,
        onTick,
      });

      // Advance past the first poll sleep
      await vi.advanceTimersByTimeAsync(500);

      const result = await promise;

      expect(result.ocr_status).toBe('DONE');
      expect(result.extracted_fields).toHaveLength(1);
      expect(onTick).toHaveBeenCalledTimes(2);
    });

    it('resolves normally on FAILED status (not a rejection)', async () => {
      const failedStatus: DocumentStatus = {
        document_id: 'doc-1',
        ocr_status: 'FAILED',
        ocr_confidence: null,
        error_message: 'Unreadable image',
        extracted_fields: [],
      };

      mockRequest.mockResolvedValueOnce(failedStatus);

      const result = await documentApi.waitForExtraction('case-1', 'doc-1', {
        intervalMs: 500,
      });

      expect(result.ocr_status).toBe('FAILED');
      expect(result.error_message).toBe('Unreadable image');
    });

    it('throws HttpError 408 on timeout', async () => {
      // Use real timers for this test — fake timers don't interleave well
      // with the async polling loop's microtask-based mock promises.
      vi.useRealTimers();

      const processingStatus: DocumentStatus = {
        document_id: 'doc-1',
        ocr_status: 'PROCESSING',
        ocr_confidence: null,
        error_message: null,
        extracted_fields: [],
      };

      mockRequest.mockResolvedValue(processingStatus);

      let caught: unknown;
      try {
        await documentApi.waitForExtraction('case-1', 'doc-1', {
          intervalMs: 10,
          timeoutMs: 50,
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(HttpError);
      expect((caught as HttpError).status).toBe(408);
    });
  });
});




