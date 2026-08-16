import { DestroyRef, effect, forwardRef, inject } from "@angular/core";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `hooks/useCreatePortalContainer.ts`: a `<div>`
 * appended to `document.body`, classed `excalidraw <className>` with
 * `theme--dark` and `excalidraw--mobile` kept in sync with the editor, and
 * removed again when its caller is destroyed. The `excalidraw` class is what
 * carries the CSS-variable scope (`css/theme.scss`) and the component styles
 * (`.excalidraw .Modal`, …) to a container that sits outside the editor's own
 * root element.
 *
 * Must be called from an injection context (a component field initializer or
 * constructor) — that is what supplies the editor and the teardown hook, the
 * way React's hook rules supply the context and the effect cleanup. The
 * editor is optional so the primitives that portal stay mountable on their
 * own; without one the container is simply light-themed and non-mobile.
 *
 * Upstream's `parentSelector` option is not ported: its only consumer is
 * `EyeDropper.tsx`, and caliburn's eye dropper already renders itself inside
 * `.excalidraw-eye-dropper-container` carrying those same classes
 * (`eye-dropper.component.html`), so nothing here would pass one.
 */
export const createPortalContainer = (className: string): HTMLDivElement => {
  const editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
    { optional: true },
  );

  const div = document.createElement("div");

  const applyClasses = () => {
    div.className = "";
    div.classList.add("excalidraw", ...className.split(/\s+/).filter(Boolean));
    // `editorInterface` is a plain object on the editor rather than a signal,
    // so this reads whatever it holds when the effect re-runs; the theme is
    // the reactive half and the only one that changes at runtime today
    div.classList.toggle(
      "excalidraw--mobile",
      editor?.editorInterface.formFactor === "phone",
    );
    div.classList.toggle("theme--dark", editor?.isDarkTheme() === true);
  };

  // eagerly, so the container is never appended unclassed (upstream's layout
  // effect runs before paint for the same reason), then kept in sync
  applyClasses();
  effect(applyClasses);

  document.body.appendChild(div);

  inject(DestroyRef).onDestroy(() => div.remove());

  return div;
};
