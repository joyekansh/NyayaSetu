import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup rendered components after each test
afterEach(() => {
  cleanup();
});

// Stub URL.createObjectURL / revokeObjectURL (not in jsdom)
if (typeof globalThis.URL.createObjectURL === 'undefined') {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  globalThis.URL.revokeObjectURL = vi.fn();
}
