import '@testing-library/jest-dom'

// jsdom lacks window.matchMedia; provide a stub so theme-aware components render in tests.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
    writable: true,
    configurable: true,
  })
}

// jsdom lacks ResizeObserver; provide a no-op stub so graph components can mount.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-ignore test stub
  globalThis.ResizeObserver = RO
}
