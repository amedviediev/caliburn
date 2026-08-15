import "vitest-canvas-mock";
import "@testing-library/jest-dom";
import "fake-indexeddb/auto";

import { vi } from "vitest";

import { TestBed } from "@angular/core/testing";
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from "@angular/platform-browser/testing";

import polyfill from "@excalidraw/excalidraw/polyfill";

import { mockThrottleRAF } from "../../packages/caliburn/tests/helpers/mocks";
import {
  PolyfillLocalStorage,
  testPolyfills,
} from "../../packages/caliburn/tests/helpers/polyfills";

// The editor's own test setup (`packages/caliburn/tests/setup.ts`), reused
// as-is — the app renders the same editor into the same jsdom.
TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

Object.assign(globalThis, testPolyfills);
PolyfillLocalStorage();

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();

  return {
    ...module,
    throttleRAF: mockThrottleRAF,
  };
});

// mock for pep.js not working with setPointerCapture()
HTMLElement.prototype.setPointerCapture = vi.fn();

polyfill();

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, "FontFace", {
  enumerable: true,
  value: class {
    private family: string;
    private source: string;
    private descriptors: any;
    private status: string;
    private unicodeRange: string;

    constructor(family: string, source: string, descriptors: any) {
      this.family = family;
      this.source = source;
      this.descriptors = descriptors;
      this.status = "unloaded";
      this.unicodeRange = "U+0000-00FF";
    }

    load() {
      this.status = "loaded";
    }
  },
});

Object.defineProperty(document, "fonts", {
  value: {
    load: vi.fn().mockResolvedValue([]),
    check: vi.fn().mockResolvedValue(true),
    has: vi.fn().mockResolvedValue(true),
    add: vi.fn(),
  },
});

Object.defineProperty(window, "EXCALIDRAW_ASSET_PATH", {
  value: `file://${__dirname}/`,
});
