import { throttleRAF } from "@excalidraw/common";

export const withBatchedUpdates = <
  TFunction extends ((event: any) => void) | (() => void),
>(
  func: Parameters<TFunction>["length"] extends 0 | 1 ? TFunction : never,
) =>
  ((...args: Parameters<TFunction>) => {
    (func as (...parameters: Parameters<TFunction>) => void)(...args);
  }) as TFunction;

export const withBatchedUpdatesThrottled = <
  TFunction extends ((event: any) => void) | (() => void),
>(
  func: Parameters<TFunction>["length"] extends 0 | 1 ? TFunction : never,
) => {
  const invoke = func as (...parameters: Parameters<TFunction>) => void;
  return throttleRAF<Parameters<TFunction>>((...args) => invoke(...args));
};

/** Angular has no React-version constraint on render throttling. */
export const isRenderThrottlingEnabled = () =>
  (
    window as Window & {
      EXCALIDRAW_THROTTLE_RENDER?: boolean;
    }
  ).EXCALIDRAW_THROTTLE_RENDER === true;
