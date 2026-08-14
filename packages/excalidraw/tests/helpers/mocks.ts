import { vi } from "vitest";

import type { throttleRAF as throttleRAFType } from "@excalidraw/common";

type ThrottledFn<T extends unknown[]> = ((...args: T) => void) & {
  flush: () => void;
  cancel: () => void;
};

export const mockThrottleRAF: typeof throttleRAFType = <T extends unknown[]>(
  fn: (...args: T) => void,
) => {
  const ret = ((...args: T) => {
    fn(...args);
  }) as ThrottledFn<T>;

  ret.flush = () => {};
  ret.cancel = () => {};

  return ret;
};

// Mock for HTMLImageElement (use with `vi.unstubAllGlobals()`)
// as jsdom.resources: "usable" throws an error on image load
export const mockHTMLImageElement = (
  naturalWidth: number,
  naturalHeight: number,
) => {
  vi.stubGlobal(
    "Image",
    class extends Image {
      constructor() {
        super();

        Object.defineProperty(this, "naturalWidth", {
          value: naturalWidth,
        });
        Object.defineProperty(this, "naturalHeight", {
          value: naturalHeight,
        });

        queueMicrotask(() => {
          this.onload?.({} as Event);
        });
      }
    },
  );
};

// Mocks for multiple HTMLImageElements (dimensions are assigned in the order of image initialization)
export const mockMultipleHTMLImageElements = (
  sizes: (readonly [number, number])[],
) => {
  const _sizes = [...sizes];

  vi.stubGlobal(
    "Image",
    class extends Image {
      constructor() {
        super();

        const size = _sizes.shift();
        if (!size) {
          throw new Error("Insufficient sizes");
        }

        Object.defineProperty(this, "naturalWidth", {
          value: size[0],
        });
        Object.defineProperty(this, "naturalHeight", {
          value: size[1],
        });

        queueMicrotask(() => {
          this.onload?.({} as Event);
        });
      }
    },
  );
};
