import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

import { capitalizeString } from "@excalidraw/common";

import { trackEvent } from "@excalidraw/excalidraw/analytics";

import type { ToolbarToolType } from "@excalidraw/excalidraw/components/Tools";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnIconButtonComponent } from "./icon-button.component";

import type { CaliburnEditorComponent } from "../editor.component";
import type { OnDestroy, OnInit } from "@angular/core";

export type CaliburnToolOption = {
  type: ToolbarToolType;
  /** the ng-icon registry name of upstream's React `icon` node */
  icon: string;
  title: string;
  fillable?: boolean;
};

/** upstream's Radix placement for this popover: the default `side="bottom"` /
 * `align="center"`, with `sideOffset={16}` and the editor container as the
 * collision boundary */
const SIDE_OFFSET = 16;
/**
 * Radix measures the rendered content to decide whether `side="bottom"` still
 * fits inside the collision boundary. Every popover here holds one row of
 * `2.25rem` icon buttons inside `0.5rem` of padding, so that height is a
 * constant — used to make the same flip decision without a second layout pass.
 */
const APPROX_HEIGHT = 52;

/**
 * Angular port of upstream `ToolPopover.tsx` — the grouped tool trigger used
 * by the compact (tablet) and mobile toolbars: the trigger activates the
 * group's remembered option and opens a popover holding the whole group.
 *
 * Radix's `Popover` (placement, dismissal) is replaced by a `position: fixed`
 * div measured off the trigger plus explicit outside-pointerdown / Escape
 * dismissal, the same substitution `properties-popover.component.ts` and
 * `dropdown-menu-content.component.ts` make. As upstream, the content is not
 * portalled: it renders next to its trigger.
 */
@Component({
  selector: "caliburn-tool-popover",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIconButtonComponent],
  templateUrl: "./tool-popover.component.html",
})
export class CaliburnToolPopoverComponent implements OnInit, OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input.required<readonly CaliburnToolOption[]>();
  readonly defaultOption = input.required<ToolbarToolType>();
  readonly displayedOption = input.required<CaliburnToolOption>();
  readonly testId = input.required<string>();

  /** upstream's `onToolChange`, raised both by the trigger (with
   * `defaultOption`) and by picking an option */
  readonly toolChange = output<ToolbarToolType>();

  private readonly popupOpen = signal(false);
  private readonly triggerRect = signal<DOMRect | null>(null);

  protected currentType() {
    this.editor.changeGeneration();
    return this.editor.state.activeTool.type;
  }

  protected open() {
    return this.popupOpen();
  }

  /**
   * Upstream closes the popup as soon as the active tool leaves the group, and
   * does so by *writing* the state (`setIsPopupOpen(false)` mid-render) rather
   * than by deriving it — so coming back to a tool of the group later does not
   * reopen the popup. The effect is that write; a derived `open` would be the
   * behaviour upstream deliberately doesn't have.
   */
  private readonly closeWhenToolLeavesGroup = effect(() => {
    const currentType = this.currentType();
    if (
      this.popupOpen() &&
      !this.options().some((option) => option.type === currentType)
    ) {
      this.popupOpen.set(false);
    }
  });

  protected isActive() {
    return this.displayedOption().type === this.currentType();
  }

  protected triggerTitle() {
    return capitalizeString(this.displayedOption().title);
  }

  protected optionTitle(option: CaliburnToolOption) {
    return capitalizeString(option.type);
  }

  protected isToolButtonDisabled(type: string) {
    const forcedTool = this.editor.activeTool();
    return forcedTool != null && forcedTool.type !== type;
  }

  protected triggerDisabled() {
    return this.options().every((option) =>
      this.isToolButtonDisabled(option.type),
    );
  }

  private readonly flipped = computed(() => {
    const rect = this.triggerRect();
    const container = this.editor.containerRef()?.nativeElement;
    if (!rect || !container) {
      return false;
    }
    return (
      rect.bottom + SIDE_OFFSET + APPROX_HEIGHT >
      container.getBoundingClientRect().bottom
    );
  });

  protected readonly contentTop = computed(() => {
    const rect = this.triggerRect();
    return rect && !this.flipped() ? rect.bottom + SIDE_OFFSET : null;
  });

  protected readonly contentBottom = computed(() => {
    const rect = this.triggerRect();
    return rect && this.flipped()
      ? Math.max(window.innerHeight - rect.top + SIDE_OFFSET, 0)
      : null;
  });

  protected readonly contentLeft = computed(() => {
    const rect = this.triggerRect();
    return rect ? rect.left + rect.width / 2 : 0;
  });

  protected onTriggerSelect() {
    const trigger = this.host.nativeElement.querySelector("button");
    this.triggerRect.set(trigger?.getBoundingClientRect() ?? null);
    this.popupOpen.update((open) => !open);
    this.toolChange.emit(this.defaultOption());
  }

  protected onOptionSelect(option: CaliburnToolOption) {
    if (this.editor.state.activeTool.type !== option.type) {
      trackEvent("toolbar", option.type, "ui");
      this.editor.setActiveTool({ type: option.type });
      this.toolChange.emit(option.type);
    }
  }

  /** upstream closes the popover as soon as the canvas takes a pointer down —
   * its only dismissal, since `<Popover.Root open>` is controlled and passes
   * no `onOpenChange`, leaving Radix's own dismissal inert */
  private unsubscribePointerDown: (() => void) | null = null;

  ngOnInit() {
    this.unsubscribePointerDown = this.editor.onPointerDownEmitter.on(() => {
      this.popupOpen.set(false);
    });
  }

  ngOnDestroy() {
    this.unsubscribePointerDown?.();
  }
}
