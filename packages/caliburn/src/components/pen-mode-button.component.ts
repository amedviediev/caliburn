import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
} from "@angular/core";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import clsx from "clsx";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { translated } from "../i18n";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `PenModeButton.tsx` — the pen-mode toggle, which
 * upstream renders as an `IconButton type="toggle"` carrying
 * `ToolIcon__penMode` (plus `is-mobile` in the two floating placements).
 *
 * Attribute-selector component (`button[caliburn-pen-mode-button]`): the host
 * IS upstream's `<button>`, because `ToolIcon__penMode` is styled through a
 * direct-child combinator off the top-left column
 * (`.App-menu_top__left > .ToolIcon__penMode`, `LayerUI.scss`) — a wrapper
 * element would break it. That also rules out composing it out of
 * `caliburn-icon-button`, itself an attribute-selector component on `button`
 * (Angular allows one component per element), so the toggle variant's host
 * classes and markup are written out here.
 *
 * Upstream's `penDetected` prop — the component returns `null` without it —
 * is read off the editor state by the three call sites instead, as the `@if`
 * that decides whether to render this button at all.
 */
@Component({
  selector: "button[caliburn-pen-mode-button]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  host: {
    type: "button",
    "[class]": "hostClass()",
    "[attr.title]": "label()",
    "[attr.aria-label]": "label()",
    "[attr.aria-pressed]": "checked()",
    // upstream's `IconButton` always writes this; the pen mode button passes
    // no `disabled`, so it is constant here
    "aria-disabled": "false",
    "(click)": "toggle()",
  },
  templateUrl: "./pen-mode-button.component.html",
})
export class CaliburnPenModeButtonComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly isMobile = input(false);

  protected readonly label = translated(() => t("toolBar.penMode"));

  protected checked() {
    this.editor.changeGeneration();
    return this.editor.state.penMode;
  }

  protected readonly hostClass = computed(() =>
    clsx(
      "ToolIcon",
      "ToolIcon_type_toggle",
      "ToolIcon_size_medium",
      clsx("ToolIcon__penMode", { "is-mobile": this.isMobile() }),
      { "ToolIcon--checked": this.checked() },
    ),
  );

  protected toggle() {
    this.editor.batchCommits(() => this.editor.togglePenMode(null));
  }
}
