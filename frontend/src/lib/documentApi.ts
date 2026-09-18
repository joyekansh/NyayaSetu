/**
 * lib/documentApi.ts — document upload and OCR status polling.
 * OWNER: Akash.
 *
 * Upload is multipart and returns immediately; extraction runs on the Celery
 * worker. The UI must poll, not block (NFR: OCR under ~8s, async).
 */

import { HttpError, citizenAuth, request } from './httpClient';
import type { DocType, DocumentRecord, DocumentStatus } from '@/types/api';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '/api/v1';

export interface UploadOptions {
  caseId: string;
  file: Blob;
  docType: DocType;
  filename?: string;
  /** 0–1, for a real progress bar during a slow kiosk upload. */
  onProgress?: (fraction: number) => void;
}

/**
 * XHR rather than fetch, purely because fetch gives no upload progress events
 * and a rural 3G kiosk upload needs one.
 */
export function uploadDocument(options: UploadOptions): Promise<DocumentRecord> {
  const { caseId, file, docType, filename = 'capture.jpg', onProgress } = options;

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file, filename);
    form.append('doc_type', docType);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}/cases/${caseId}/documents`);

    const token = citizenAuth.token();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }

    xhr.onload = () => {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(xhr.responseText);
      } catch {
        /* leave null */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as DocumentRecord);
      } else {
        reject(
          new HttpError(
            xhr.status,
            (parsed as { detail?: string } | null)?.detail ??
              'Upload failed. Try capturing the document again.',
            null,
          ),
        );
      }
    };

    xhr.onerror = () =>
      reject(new HttpError(0, 'Upload failed. Check your connection.', null));

    xhr.send(form);
  });
}

export const documentApi = {
  upload: uploadDocument,

  getStatus: (caseId: string, documentId: string, signal?: AbortSignal) =>
    request<DocumentStatus>(`/cases/${caseId}/documents/${documentId}/status`, {
      signal,
    }),

  /**
   * Polls until OCR reaches a terminal state. Resolves with the final status;
   * rejects only on a transport/auth error or timeout — a FAILED OCR result
   * resolves normally so the UI can offer a retry.
   */
  async waitForExtraction(
    caseId: string,
    documentId: string,
    opts: {
      intervalMs?: number;
      timeoutMs?: number;
      onTick?: (status: DocumentStatus) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<DocumentStatus> {
    const { intervalMs = 1500, timeoutMs = 60_000, onTick, signal } = opts;
    const deadline = Date.now() + timeoutMs;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const status = await documentApi.getStatus(caseId, documentId, signal);
      onTick?.(status);

      if (status.ocr_status === 'DONE' || status.ocr_status === 'FAILED') {
        return status;
      }
      if (Date.now() > deadline) {
        throw new HttpError(
          408,
          'Extraction is taking longer than expected. The case is saved — an operator can review it directly.',
          null,
        );
      }
      await sleep(intervalMs, signal);
    }
  },
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
