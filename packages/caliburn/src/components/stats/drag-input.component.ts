import {
  ChangeDetectionStrategy,
  Component,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { NgIcon } from "@ng-icons/core";

import { EVENT, KEYS, cloneJSON } from "@excalidraw/common";
import { CaptureUpdateAction, deepCopyElement } from "@excalidraw/element";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";

import { SMALLEST_DELTA } from "./utils";

import type {
  ElementsMap,
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { Scene } from "@excalidraw/element";
import type { AppState } from "@excalidraw/excalidraw/types";

import type { StatsInputProperty } from "./utils";
import type { CaliburnEditorComponent } from "../../editor.component";

import type { ElementRef, OnDestroy } from "@angular/core";

export type DragInputCallbackType<
  P extends StatsInputProperty,
  E = NonDeletedExcalidrawElement,
> = (props: {
  accumulatedChange: number;
  instantChange: number;
  originalElements: readonly E[];
  originalElementsMap: ElementsMap;
  shouldKeepAspectRatio: boolean;
  shouldChangeByStepSize: boolean;
  scene: Scene;
  nextValue?: number;
  property: P;
  originalAppState: AppState;
  setInputValue: (value: number) => void;
  app: CaliburnEditorComponent;
  setAppState: CaliburnEditorComponent["setState"];
}) => void;

export type DragFinishedCallbackType<E = ExcalidrawElement> = (props: {
  app: CaliburnEditorComponent;
  setAppState: CaliburnEditorComponent["setState"];
  originalElements: readonly E[] | null;
  originalAppState: AppState;
}) => void;

/**
 * Angular port of upstream `Stats/DragInput.tsx` — the label + number field
 * pair every stats property is edited through: type a value (committed on
 * Enter or blur), or drag the label horizontally to scrub it.
 *
 * Renders nothing at all when not editable, as upstream's early `return
 * null` does — the property's container must be absent from the DOM, not
 * merely disabled. `scene` / `appState` / `app` / `setAppState` come from
 * the injected editor rather than from props.
 */
@Component({
  selector: "caliburn-stats-drag-input",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  templateUrl: "./drag-input.component.html",
})
export class CaliburnStatsDragInputComponent implements OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly label = input.required<string>();
  readonly icon = input<string>();
  readonly value = input.required<number | "Mixed">();
  readonly elements = input.required<readonly ExcalidrawElement[]>();
  readonly editable = input(true);
  readonly shouldKeepAspectRatio = input(false);
  readonly dragInputCallback =
    input.required<DragInputCallbackType<any, any>>();
  readonly property = input.required<StatsInputProperty>();
  /** how many px you need to drag to get 1 unit change */
  readonly sensitivity = input(1);
  readonly dragFinishedCallback = input<DragFinishedCallbackType>();

  /** `editor.setState` is a prototype method — bind it for the callbacks */
  private readonly setAppState: CaliburnEditorComponent["setState"] = (
    ...args
  ) => this.editor.setState(...args);

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>("input");
  private readonly labelRef = viewChild<ElementRef<HTMLDivElement>>("labelEl");

  protected readonly inputValue = signal("");

  private originalAppState: AppState = null!;
  private originalElements: readonly ExcalidrawElement[] = [];
  private updatePending = false;

  private onPointerMove: ((event: PointerEvent) => void) | null = null;
  private onPointerUp: (() => void) | null = null;

  constructor() {
    this.originalAppState = cloneJSON(this.editor.state);

    effect(() => {
      this.inputValue.set(this.value().toString());
    });
  }

  ngOnDestroy() {
    // make sure that clicking on canvas (which unmounts the component)
    // updates current input value (blur isn't triggered)
    const nextValue = this.inputRef()?.nativeElement.value;
    if (nextValue) {
      this.handleInputValue(
        nextValue,
        this.originalElements,
        this.originalAppState,
      );
    }

    // generally not needed, but in case `pointerup` doesn't fire and
    // we don't remove the listeners that way, we should at least remove
    // on unmount
    if (this.onPointerMove) {
      window.removeEventListener(EVENT.POINTER_MOVE, this.onPointerMove, false);
    }
    if (this.onPointerUp) {
      window.removeEventListener(EVENT.POINTER_UP, this.onPointerUp, false);
    }
  }

  protected onInput(event: Event) {
    this.updatePending = true;
    this.inputValue.set((event.target as HTMLInputElement).value);
  }

  protected onFocus() {
    this.inputRef()?.nativeElement.select();
    this.originalElements = this.elements();
    this.originalAppState = cloneJSON(this.editor.state);
  }

  protected onBlur(event: Event) {
    if (!this.inputValue()) {
      this.inputValue.set(this.value().toString());
    } else if (this.editable()) {
      this.handleInputValue(
        (event.target as HTMLInputElement).value,
        this.originalElements,
        this.originalAppState,
      );
    }
  }

  protected onKeyDown(event: KeyboardEvent) {
    if (this.editable() && event.key === KEYS.ENTER) {
      this.handleInputValue(
        (event.target as HTMLInputElement).value,
        this.elements(),
        this.editor.state,
      );
      this.editor.focusContainer();
    }
  }

  private handleInputValue(
    updatedValue: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
  ) {
    if (!this.updatePending) {
      return;
    }
    this.updatePending = false;

    const parsed = Number(updatedValue);
    if (isNaN(parsed)) {
      this.inputValue.set(this.value().toString());
      return;
    }

    const rounded = Number(parsed.toFixed(2));
    const original = Number(this.value());

    // only update when
    // 1. original was "Mixed" and we have a new value
    // 2. original was not "Mixed" and the difference between a new value and previous value is greater
    //    than the smallest delta allowed, which is 0.01
    // reason: idempotent to avoid unnecessary
    if (isNaN(original) || Math.abs(rounded - original) >= SMALLEST_DELTA) {
      this.editor.batchCommits(() => {
        this.dragInputCallback()({
          accumulatedChange: 0,
          instantChange: 0,
          originalElements: elements,
          originalElementsMap: this.editor.scene.getNonDeletedElementsMap(),
          shouldKeepAspectRatio: this.shouldKeepAspectRatio(),
          shouldChangeByStepSize: false,
          scene: this.editor.scene,
          nextValue: rounded,
          property: this.property(),
          originalAppState: appState,
          setInputValue: (value) => this.inputValue.set(String(value)),
          app: this.editor,
          setAppState: this.setAppState,
        });
        this.editor.syncActionResult({
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      });
    }
  }

  protected onLabelPointerEnter() {
    const label = this.labelRef()?.nativeElement;
    if (label) {
      label.style.cursor = "ew-resize";
    }
  }

  protected onLabelPointerDown() {
    const input = this.inputRef()?.nativeElement;
    if (!input || !this.editable()) {
      return;
    }

    document.body.classList.add("excalidraw-cursor-resize");

    let lastPointer: { x: number; y: number } | null = null;

    let originalElementsMap: ElementsMap | null = this.editor.scene
      .getNonDeletedElements()
      .reduce((acc: ElementsMap, element) => {
        acc.set(element.id, deepCopyElement(element));
        return acc;
      }, new Map());

    let originalElements: readonly ExcalidrawElement[] | null = this.elements()
      .map((element) => originalElementsMap!.get(element.id)!)
      .filter(Boolean);

    const originalAppState: AppState = cloneJSON(this.editor.state);

    let accumulatedChange = 0;
    let stepChange = 0;

    const onPointerMove = (event: PointerEvent) => {
      if (
        lastPointer &&
        originalElementsMap !== null &&
        originalElements !== null
      ) {
        const instantChange = event.clientX - lastPointer.x;

        if (instantChange !== 0) {
          stepChange += instantChange;

          if (Math.abs(stepChange) >= this.sensitivity()) {
            stepChange =
              Math.sign(stepChange) *
              Math.floor(Math.abs(stepChange) / this.sensitivity());

            accumulatedChange += stepChange;

            this.editor.batchCommits(() => {
              this.dragInputCallback()({
                accumulatedChange,
                instantChange: stepChange,
                originalElements: originalElements!,
                originalElementsMap: originalElementsMap!,
                shouldKeepAspectRatio: this.shouldKeepAspectRatio(),
                shouldChangeByStepSize: event.shiftKey,
                property: this.property(),
                scene: this.editor.scene,
                originalAppState,
                setInputValue: (value) => this.inputValue.set(String(value)),
                app: this.editor,
                setAppState: this.setAppState,
              });
            });

            stepChange = 0;
          }
        }
      }

      lastPointer = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = () => {
      window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove, false);

      this.editor.batchCommits(() => {
        this.editor.syncActionResult({
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        // Notify implementors
        this.dragFinishedCallback()?.({
          app: this.editor,
          setAppState: this.setAppState,
          originalElements,
          originalAppState,
        });
      });

      lastPointer = null;
      accumulatedChange = 0;
      stepChange = 0;
      originalElements = null;
      originalElementsMap = null;

      document.body.classList.remove("excalidraw-cursor-resize");

      window.removeEventListener(EVENT.POINTER_UP, onPointerUp, false);
    };

    this.onPointerMove = onPointerMove;
    this.onPointerUp = onPointerUp;

    window.addEventListener(EVENT.POINTER_MOVE, onPointerMove, false);
    window.addEventListener(EVENT.POINTER_UP, onPointerUp, false);
  }
}
