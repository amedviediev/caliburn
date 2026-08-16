import type { TemplateRef } from "@angular/core";

/**
 * Caliburn's shape of upstream's `ViewportStatusFrame` prop type
 * (`packages/excalidraw/types.ts`). Upstream types the badge's `label` and
 * `icon` as `React.ReactNode`; Angular has no node type to hand across a
 * prop, so both take either a plain string or a host `TemplateRef` — the
 * same substitution the editor's other host-composition slots make.
 */
export type CaliburnViewportStatusFrame = {
  /** the badge (bottom-center pill) */
  label?: {
    label: string | TemplateRef<unknown>;
    icon?: string | TemplateRef<unknown>;
    /** badge background; defaults to var(--color-primary-hover) */
    background?: string;
    /** badge text color; defaults to var(--color-primary-light) */
    color?: string;
    /** makes the badge label interactive */
    onClick?: () => void;
    /** renders a close button when set */
    onClose?: () => void;
  };
  /** viewport-edge border: CSS color, or `false` for none */
  border: false | string;
};
