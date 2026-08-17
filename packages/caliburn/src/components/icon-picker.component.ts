import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import { EVENT, KEYS, isArrowKey } from "@excalidraw/common";

import { getLanguage, t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { translated } from "../i18n";

import { flipAtBoundary, shiftIntoBoundary } from "./popover-collision";
import { CaliburnStatsCollapsibleComponent } from "./stats/collapsible.component";

import type { CaliburnEditorComponent } from "../editor.component";
import type { OnDestroy, OnInit } from "@angular/core";

/** an option's `icon` is the ng-icon registry name of upstream's JSX icon */
export interface IconPickerOption {
  value: unknown;
  text: string;
  icon: string;
  keyBinding: string | null;
}

export interface IconPickerSection {
  name: string;
  options: readonly IconPickerOption[];
}

const PICKER_COLUMNS = 4;
const DEFAULT_SECTION_NAME = "default";

/** upstream's Radix `side="bottom"` / `align="start"` offsets */
const SIDE_OFFSET = 12;
const ALIGN_OFFSET = 12;

/** upstream keeps this in a module-level jotai atom, so every picker on the
 * page shares one "more options" state */
const showMoreOptions = signal(false);

const flattenOptions = (sections: readonly IconPickerSection[]) =>
  sections.flatMap((section) => section.options);

const findOption = (
  sections: readonly IconPickerSection[],
  predicate: (option: IconPickerOption) => boolean,
) => {
  for (const section of sections) {
    const option = section.options.find(predicate);
    if (option) {
      return option;
    }
  }

  return null;
};

const hasOption = (
  sections: readonly IconPickerSection[],
  predicate: (option: IconPickerOption) => boolean,
) => sections.some((section) => section.options.some(predicate));

const getNavigationRows = (sections: readonly IconPickerSection[]) =>
  sections.flatMap((section) =>
    Array.from(
      { length: Math.ceil(section.options.length / PICKER_COLUMNS) },
      (_, index) =>
        section.options.slice(
          index * PICKER_COLUMNS,
          index * PICKER_COLUMNS + PICKER_COLUMNS,
        ),
    ),
  );

/**
 * Angular port of upstream `IconPicker.tsx` — the trigger button plus the
 * `.picker` popup the arrowhead pickers open. Radix's `Popover` (portal,
 * placement, dismissal) is replaced by a `position: fixed` popup measured off
 * the trigger plus explicit outside-pointerdown dismissal, the substitution
 * `properties-popover.component.ts` makes too; Radix's
 * `collisionBoundary={container}` becomes the shared flip/shift in
 * `popover-collision.ts`, run against the popup's own box once it renders.
 * Option values are `unknown` where upstream's component is generic: its one
 * caliburn call site is the arrowhead pair, and Angular templates gain
 * nothing from the type variable.
 */
@Component({
  selector: "caliburn-icon-picker",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnStatsCollapsibleComponent, NgIcon, NgTemplateOutlet],
  templateUrl: "./icon-picker.component.html",
})
export class CaliburnIconPickerComponent implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly label = input.required<string>();
  readonly value = input.required<unknown>();
  readonly visibleSections = input.required<readonly IconPickerSection[]>();
  readonly hiddenSections = input<readonly IconPickerSection[]>([]);

  readonly valueChange = output<unknown>();

  protected readonly isActive = signal(false);
  protected readonly showMore = showMoreOptions;

  protected readonly moreOptionsLabel = translated(() =>
    t("labels.more_options"),
  );

  protected readonly selectedOption = computed(
    () =>
      findOption(
        this.visibleSections(),
        (option) => option.value === this.value(),
      ) ??
      findOption(
        this.hiddenSections(),
        (option) => option.value === this.value(),
      ),
  );

  private readonly triggerRect = signal<DOMRect | null>(null);
  private readonly picker = viewChild<ElementRef<HTMLElement>>("picker");
  private readonly pickerRect = signal<DOMRect | null>(null);
  private readonly boundaryRect = signal<DOMRect | null>(null);

  protected readonly top = computed(() => {
    const rect = this.triggerRect();
    const boundary = this.boundaryRect();
    const preferred = (rect?.bottom ?? 0) + SIDE_OFFSET;
    if (!rect || !boundary) {
      return preferred;
    }
    const height = this.pickerRect()?.height ?? 0;
    return flipAtBoundary(preferred, rect.top - SIDE_OFFSET - height, height, {
      start: boundary.top,
      end: boundary.bottom,
    });
  });

  protected readonly left = computed(() => {
    const rect = this.triggerRect();
    const boundary = this.boundaryRect();
    const preferred = (rect?.left ?? 0) + ALIGN_OFFSET;
    if (!rect || !boundary) {
      return preferred;
    }
    return shiftIntoBoundary(preferred, this.pickerRect()?.width ?? 0, {
      start: boundary.left,
      end: boundary.right,
    });
  });

  /** the popup's own box is what the flip needs, so place it at the preferred
   * spot first and re-place it once it has rendered — and again whenever the
   * hidden sections change its height */
  private readonly placeOnOpen = effect(() => {
    if (!this.isActive()) {
      this.pickerRect.set(null);
      this.boundaryRect.set(null);
      return;
    }
    this.showMore();
    afterNextRender(() => this.measure(), { injector: this.injector });
  });

  private measure() {
    const picker = this.picker()?.nativeElement;
    const container = this.editor.containerRef()?.nativeElement;
    if (!picker || !container) {
      return;
    }
    this.pickerRect.set(picker.getBoundingClientRect());
    this.boundaryRect.set(container.getBoundingClientRect());
  }

  /** upstream reveals the hidden sections whenever the current value lives in
   * one of them */
  private readonly revealSelected = effect(() => {
    if (hasOption(this.hiddenSections(), (o) => o.value === this.value())) {
      showMoreOptions.set(true);
    }
  });

  private readonly allSections = computed(() => [
    ...this.visibleSections(),
    ...this.hiddenSections(),
  ]);

  private readonly allOptions = computed(() =>
    flattenOptions(this.allSections()),
  );

  private readonly navigationRows = computed(() =>
    getNavigationRows([
      ...this.visibleSections(),
      ...(this.showMore() ? this.hiddenSections() : []),
    ]),
  );

  private readonly onDocPointerDown = (event: Event) => {
    if (!this.isActive()) {
      return;
    }
    const target = event.target as Node | null;
    if (!target || !document.documentElement.contains(target)) {
      return;
    }
    if (this.host.nativeElement.contains(target)) {
      return;
    }
    this.close();
  };

  ngOnInit() {
    document.addEventListener(EVENT.POINTER_DOWN, this.onDocPointerDown, true);
  }

  ngOnDestroy() {
    document.removeEventListener(
      EVENT.POINTER_DOWN,
      this.onDocPointerDown,
      true,
    );
  }

  protected isSectionLabelled(section: IconPickerSection) {
    return section.name !== DEFAULT_SECTION_NAME;
  }

  protected optionTitle(option: IconPickerOption) {
    return option.keyBinding
      ? `${option.text} — ${option.keyBinding.toUpperCase()}`
      : option.text;
  }

  protected toggle(event: MouseEvent) {
    const trigger = event.currentTarget as HTMLElement;
    this.triggerRect.set(trigger.getBoundingClientRect());
    this.isActive.update((active) => !active);
  }

  protected toggleMoreOptions() {
    showMoreOptions.update((value) => !value);
  }

  protected close() {
    this.isActive.set(false);
  }

  protected select(value: unknown) {
    this.valueChange.emit(value);
  }

  /** upstream focuses the option button holding the current value (through a
   * `ref` callback and a 0ms timeout, "to render focus properly"), which is
   * what its `onKeyDown` on the popup then reads from */
  private readonly focusSelectedOption = effect(() => {
    const isActive = this.isActive();
    // re-runs whenever the value or the revealed sections change, as
    // upstream's per-option ref callback does
    this.value();
    this.showMore();
    if (!isActive) {
      return;
    }
    setTimeout(() => {
      this.host.nativeElement
        .querySelector<HTMLElement>(".picker-option.active")
        ?.focus();
    }, 0);
  });

  protected onKeyDown(event: KeyboardEvent) {
    const allOptions = this.allOptions();
    const value = this.value();
    const pressedOption = allOptions.find(
      (option) => option.keyBinding === event.key.toLowerCase(),
    );

    if (!(event.metaKey || event.altKey || event.ctrlKey) && pressedOption) {
      // Keybinding navigation
      this.select(pressedOption.value);

      event.preventDefault();
    } else if (event.key === KEYS.TAB) {
      const index = allOptions.findIndex((option) => option.value === value);
      const nextIndex = event.shiftKey
        ? (allOptions.length + index - 1) % allOptions.length
        : (index + 1) % allOptions.length;
      this.select(allOptions[nextIndex].value);
    } else if (isArrowKey(event.key)) {
      // Arrow navigation
      const isRTL = getLanguage().rtl;
      const navigationRows = this.navigationRows();
      const index = allOptions.findIndex((option) => option.value === value);
      if (index !== -1) {
        const length = allOptions.length;
        let nextIndex = index;

        switch (event.key) {
          // Select the next option
          case isRTL ? KEYS.ARROW_LEFT : KEYS.ARROW_RIGHT:
            nextIndex = (index + 1) % length;
            break;
          // Select the previous option
          case isRTL ? KEYS.ARROW_RIGHT : KEYS.ARROW_LEFT:
            nextIndex = (length + index - 1) % length;
            break;
          // Go the next row
          case KEYS.ARROW_DOWN: {
            const currentRowIndex = navigationRows.findIndex((row) =>
              row.some((option) => option.value === value),
            );
            const currentRow = navigationRows[currentRowIndex];

            if (currentRowIndex !== -1 && currentRow) {
              const column = currentRow.findIndex(
                (option) => option.value === value,
              );
              const nextRow =
                navigationRows[(currentRowIndex + 1) % navigationRows.length];
              const nextOption =
                nextRow[Math.min(column, nextRow.length - 1)] ??
                allOptions[index];

              this.select(nextOption.value);
              event.preventDefault();
              event.stopImmediatePropagation();
              event.stopPropagation();
              return;
            }
            break;
          }
          // Go the previous row
          case KEYS.ARROW_UP: {
            const currentRowIndex = navigationRows.findIndex((row) =>
              row.some((option) => option.value === value),
            );
            const currentRow = navigationRows[currentRowIndex];

            if (currentRowIndex !== -1 && currentRow) {
              const column = currentRow.findIndex(
                (option) => option.value === value,
              );
              const previousRow =
                navigationRows[
                  (navigationRows.length + currentRowIndex - 1) %
                    navigationRows.length
                ];
              const previousOption =
                previousRow[Math.min(column, previousRow.length - 1)] ??
                allOptions[index];

              this.select(previousOption.value);
              event.preventDefault();
              event.stopImmediatePropagation();
              event.stopPropagation();
              return;
            }
            break;
          }
        }

        this.select(allOptions[nextIndex].value);
      }
      event.preventDefault();
    } else if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
      // Close on escape or enter
      event.preventDefault();
      this.close();
    }
    event.stopImmediatePropagation();
    event.stopPropagation();
  }
}
