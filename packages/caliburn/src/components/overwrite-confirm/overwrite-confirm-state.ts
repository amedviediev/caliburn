import type { WritableSignal } from "@angular/core";

/**
 * Angular port of upstream `OverwriteConfirm/OverwriteConfirmState.ts`.
 *
 * Upstream keeps this in a module-level jotai atom and describes the body as
 * a `React.ReactNode`; caliburn keeps it in a per-editor signal (as it does
 * for `activeConfirmDialog`) and carries the translation key instead — the
 * dialog resolves it through the same `<bold>` / `<br></br>` markers
 * upstream's `<Trans>` does.
 */
export type OverwriteConfirmState =
  | {
      active: true;
      title: string;
      descriptionKey: string;
      actionLabel: string;
      color: "danger" | "warning";

      onClose: () => void;
      onConfirm: () => void;
      onReject: () => void;
    }
  | { active: false };

/** the slice of the editor this module needs — spelled structurally so the
 * dialog state can be opened without importing the editor component */
export interface OverwriteConfirmHost {
  overwriteConfirm: WritableSignal<OverwriteConfirmState>;
}

export const openConfirmModal = (
  host: OverwriteConfirmHost,
  {
    title,
    descriptionKey,
    actionLabel,
    color,
  }: {
    title: string;
    descriptionKey: string;
    actionLabel: string;
    color: "danger" | "warning";
  },
) =>
  new Promise<boolean>((resolve) => {
    host.overwriteConfirm.set({
      active: true,
      onConfirm: () => resolve(true),
      onClose: () => resolve(false),
      onReject: () => resolve(false),
      title,
      descriptionKey,
      actionLabel,
      color,
    });
  });
