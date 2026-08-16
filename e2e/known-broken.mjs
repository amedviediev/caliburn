/**
 * The defect inventory this harness was built to hold.
 *
 * Every id here is a check in `e2e/smoke.mjs` that fails against the app as it
 * stands today. Listing it keeps `yarn e2e` green while the failure — and the
 * observed reason — stays printed in the run's report. Each fix task DELETES
 * its entries from this map, which flips those checks to strict, so the gate
 * ratchets forward and can never silently regress.
 *
 * To prove a check really catches its defect, run it strict on demand:
 *   E2E_STRICT=palette.solid-background yarn e2e
 *   E2E_STRICT=all yarn e2e
 */
export const KNOWN_BROKEN = {
  "help.close-via-button":
    "Dialog only renders `.Dialog__close` when `fullscreen` (phone); upstream " +
    "Dialog.tsx always renders it (back arrow on phone, X otherwise), so on " +
    "desktop the help dialog has no close affordance at all",
  "help.close-via-backdrop":
    "`.Modal__background` is painted under the interactive canvas, so the " +
    "click that should dismiss the dialog lands on the canvas instead",
  "help.close-via-escape-after-click":
    "Modal handles Escape from a `(keydown)` host binding, so it only works " +
    "while focus is inside the dialog; the first click a user makes lands on " +
    "the canvas (see help.owns-its-pixels), moves focus to `.excalidraw`, and " +
    "the dialog becomes uncloseable",
  "help.owns-its-pixels":
    "dialogs render as bare children of `caliburn-layer-ui` instead of into " +
    "upstream's `.excalidraw.excalidraw-modal-container` portal " +
    "(position:absolute; z-index: var(--zIndex-modal)=1000), so `.Modal` sits " +
    "at z-index auto inside `.excalidraw` and the interactive canvas " +
    "(--zIndex-interactiveCanvas: 2) paints and hit-tests above it",
  "palette.solid-background":
    "same mis-stacking: the palette island's own background-color is opaque " +
    "but `.layer-ui__wrapper` (z-index 4) paints the welcome screen/toolbars " +
    "straight through it, which is what reads as 'transparent'",
  "palette.item-clickable":
    "the palette is below the interactive canvas, so clicking a command hits " +
    "the canvas",
  "dialog.image-export-toggle-clickable":
    "clicking the 'with background' switch in the image-export dialog lands " +
    "on the interactive canvas; appState.exportBackground never flips",
  "dialog.confirm-buttons-clickable":
    "the clear-canvas confirm dialog's Cancel/Confirm buttons are under the " +
    "interactive canvas and cannot be clicked",
  "sidebar.width-matches-upstream":
    "`--right-sidebar-width` (upstream App.tsx sets it to 302px on the " +
    ".excalidraw container) is never set by the caliburn editor, so " +
    "`.sidebar { width: calc(var(--right-sidebar-width) - ...) }` is invalid " +
    "and the sidebar shrink-wraps its content",
  "sidebar.docked-keeps-ui-layer":
    "with the sidebar docked, `.layer-ui__wrapper` gets `width: calc(100% - " +
    "var(--right-sidebar-width))`; the missing variable makes the calc " +
    "invalid and the whole UI layer collapses to width 0",
  "links.socials-point-at-this-app":
    "the main menu's socials region is still upstream's verbatim — GitHub, X " +
    "and Discord all link to excalidraw's own properties " +
    "(menu-socials.component.html), which the app must not ship as its own " +
    "branding (Task 39)",
  "pan.space-hold-drag":
    "`isHoldingSpace` is never read anywhere in packages/caliburn — the " +
    "space-hold pan gesture was not ported",
};
