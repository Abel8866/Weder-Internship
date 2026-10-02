import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

globalThis.fetch = vi.fn();

Object.defineProperty(navigator, 'onLine', {
  configurable: true,
  get: () => true
});
