import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import { NgIcon } from "@ng-icons/core";

import { CaliburnButtonComponent } from "./button.component";

import type { AfterViewInit, ElementRef } from "@angular/core";

/**
 * Angular port of upstream `TextField.tsx` (`.ExcTextField`).
 *
 * Host-bound: the host element IS upstream's `.ExcTextField` wrapper, so a
 * consumer's own class (upstream's `className`, e.g. the search menu's
 * `CLASSES.SEARCH_MENU_INPUT_WRAPPER`) lands on the same node as upstream's.
 *
 * The controlled (`value`) form only — no upstream caliburn consumer uses the
 * uncontrolled `defaultValue` variant. `selectOnRender` runs once on the
 * first view init, standing in for upstream's `useLayoutEffect` (the flag is
 * static at every call site).
 */
@Component({
  selector: "caliburn-text-field",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, CaliburnButtonComponent],
  host: {
    class: "ExcTextField",
    "[class.ExcTextField--fullWidth]": "fullWidth()",
    "[class.ExcTextField--hasIcon]": "!!icon()",
    "(click)": "focus()",
  },
  templateUrl: "./text-field.component.html",
})
export class CaliburnTextFieldComponent implements AfterViewInit {
  readonly value = input.required<string>();
  readonly label = input<string>();
  readonly placeholder = input<string>();
  readonly icon = input<string>();
  readonly type = input<"text" | "search">();
  readonly readonly = input(false);
  readonly fullWidth = input(false);
  readonly selectOnRender = input(false);
  readonly isRedacted = input(false);

  readonly valueChange = output<string>();
  readonly keyDown = output<KeyboardEvent>();

  protected readonly isTemporarilyUnredacted = signal(false);
  protected readonly isRedactedNow = computed(
    () =>
      !!this.value() && this.isRedacted() && !this.isTemporarilyUnredacted(),
  );

  private readonly inputRef =
    viewChild.required<ElementRef<HTMLInputElement>>("input");

  get inputElement(): HTMLInputElement {
    return this.inputRef().nativeElement;
  }

  ngAfterViewInit() {
    if (this.selectOnRender()) {
      // focusing first is needed because vitest/jsdom
      this.inputElement.focus();
      this.inputElement.select();
    }
  }

  focus() {
    this.inputElement.focus();
  }
}
