import "@testing-library/jest-dom";

// Mock ResizeObserver (not available in jsdom)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock localStorage for Zustand persist middleware
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Mock window.location for URL testing
Object.defineProperty(window, "location", {
  value: {
    href: "http://localhost:3000/",
    origin: "http://localhost:3000",
    pathname: "/",
    search: "",
    hash: "",
    host: "localhost:3000",
    hostname: "localhost",
    port: "3000",
    protocol: "http:",
  },
  writable: true,
  configurable: true,
});

// Mock history.replaceState
Object.defineProperty(window.history, "replaceState", {
  value: (state: unknown, title: string, url?: string | URL | null) => {
    if (url && typeof url === "string") {
      const urlObj = new URL(url, window.location.origin);
      Object.defineProperty(window, "location", {
        value: {
          ...window.location,
          search: urlObj.search,
          href: url,
        },
        writable: true,
        configurable: true,
      });
    }
  },
  writable: true,
  configurable: true,
});
