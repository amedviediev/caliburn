import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  output,
} from "@angular/core";

import { NgIcon } from "@ng-icons/core";

import clsx from "clsx";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import type { CaliburnEditorComponent } from "../../editor.component";

/**
 * Angular port of upstream `Sidebar/SidebarTrigger.tsx`.
 *
 * Attribute-selector component (`button[caliburn-sidebar-trigger]`): the host
 * IS upstream's `<button class="sidebar-trigger__label-element">` wrapper.
 * Upstream's `className`/`style` props land on the inner `.sidebar-trigger`
 * div, as they do upstream.
 *
 * Upstream's `children` (the trigger's text label) is a `label` string input
 * here — no editor call site passes children, and Angular cannot tell whether
 * projected content is empty in order to omit the wrapper div.
 */
@Component({
  selector: "button[caliburn-sidebar-trigger]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  host: {
    type: "button",
    class: "sidebar-trigger__label-element",
    "aria-keyshortcuts": "0",
    "[attr.title]": "title() ?? null",
    "[attr.aria-label]": "title() ?? null",
    "[attr.aria-pressed]": "isOpen()",
    "(click)": "onClick()",
  },
  templateUrl: "./sidebar-trigger.component.html",
})
export class CaliburnSidebarTriggerComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly name = input.required<string>();
  readonly tab = input<string>();
  readonly icon = input<string>();
  readonly title = input<string>();
  readonly label = input<string>();
  readonly triggerClass = input<string>();

  readonly toggle = output<boolean>();

  protected readonly innerClass = computed(() =>
    clsx("sidebar-trigger", this.triggerClass()),
  );

  isOpen() {
    this.editor.changeGeneration();
    return this.editor.state.openSidebar?.name === this.name();
  }

  onClick() {
    document.querySelector(".layer-ui__wrapper")?.classList.remove("animate");
    const nextOpen = !this.isOpen();
    this.editor.batchCommits(() =>
      this.editor.setState({
        openSidebar: nextOpen ? { name: this.name(), tab: this.tab() } : null,
        openMenu: null,
        openPopup: null,
      }),
    );
    this.toggle.emit(nextOpen);
  }
}
