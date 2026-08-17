import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  signal,
  viewChild,
} from "@angular/core";

import {
  MOBILE_ACTION_BUTTON_BG,
  supportsResizeObserver,
} from "@excalidraw/common";
import { isArrowElement } from "@excalidraw/element";

import { t } from "@excalidraw/excalidraw/i18n";

import { NgIcon } from "@ng-icons/core";

import type { AppState } from "@excalidraw/excalidraw/types";

import { actionDeleteSelected } from "../actions/actionDeleteSelected";
import { actionDuplicateSelection } from "../actions/actionDuplicateSelection";
import { actionGroup, actionUngroup } from "../actions/actionGroup";
import { getFormValue } from "../actions/actionProperties";

import { CaliburnColorPickerComponent } from "../components/color-picker/color-picker.component";
import { CaliburnPropertiesPopoverComponent } from "../components/color-picker/properties-popover.component";
import { CaliburnIslandComponent } from "../components/island.component";

import { translated } from "../i18n";

import { CaliburnAlignFieldsetComponent } from "./align-fieldset.component";
import { CaliburnArrowTypeFieldsetComponent } from "./arrow-type-fieldset.component";
import { CaliburnArrowheadFieldsetComponent } from "./arrowhead-fieldset.component";
import { CaliburnCropEditorButtonComponent } from "./crop-editor-button.component";
import { CaliburnHyperlinkButtonComponent } from "./hyperlink-button.component";
import { CaliburnLinearEditorButtonComponent } from "./linear-editor-button.component";
import { CaliburnShapeActionsComponent } from "./shape-actions.component";
import { CaliburnTogglePolygonButtonComponent } from "./toggle-polygon-button.component";

import type { OnDestroy } from "@angular/core";

type CompactPopup = Extract<
  AppState["openPopup"],
  | "compactStrokeStyles"
  | "compactArrowProperties"
  | "compactTextProperties"
  | "compactOtherProperties"
>;

/** upstream's per-item width and gap in `MobileShapeActions` */
const WIDTH = 32;
const GAP = 6;
// 7 actions + 2 for undo/redo
const MIN_ACTIONS = 9;
const MIN_WIDTH = MIN_ACTIONS * WIDTH + (MIN_ACTIONS - 1) * GAP;
const ADDITIONAL_WIDTH = WIDTH + GAP;

/**
 * Angular port of upstream `Actions.tsx`'s `CompactShapeActions` and
 * `MobileShapeActions` — the two collapsed, popover-driven styles-panel
 * layouts (tablet / compact desktop, and phone). Upstream keeps them as two
 * components in one file; they differ only in the wrapper, the extra
 * undo/redo column and the overflow measurement that promotes duplicate and
 * delete out of the "other actions" popover, so they are one component with a
 * `variant` here.
 *
 * It extends the full panel component, which already carries every control's
 * value, option table and dispatcher — the same relationship upstream's three
 * layouts have to the shared `renderAction` registry. The groups both layouts
 * share (the arrow popover's `changeArrowProperties` pair, the align /
 * distribute fieldset, the crop / link / line-editor entries) are their own
 * components, one per upstream `PanelComponent`.
 */
@Component({
  selector: "caliburn-compact-shape-actions",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnAlignFieldsetComponent,
    CaliburnArrowTypeFieldsetComponent,
    CaliburnArrowheadFieldsetComponent,
    CaliburnColorPickerComponent,
    CaliburnCropEditorButtonComponent,
    CaliburnHyperlinkButtonComponent,
    CaliburnIslandComponent,
    CaliburnLinearEditorButtonComponent,
    CaliburnPropertiesPopoverComponent,
    CaliburnTogglePolygonButtonComponent,
    NgIcon,
    NgTemplateOutlet,
  ],
  templateUrl: "./compact-shape-actions.component.html",
})
export class CaliburnCompactShapeActionsComponent
  extends CaliburnShapeActionsComponent
  implements OnDestroy
{
  readonly variant = input<"compact" | "mobile">("compact");

  protected readonly isMobile = computed(() => this.variant() === "mobile");

  protected readonly duplicateAction = actionDuplicateSelection;
  protected readonly deleteAction = actionDeleteSelected;

  protected readonly compactLabels = translated(() => ({
    duplicateSelection: t("labels.duplicateSelection"),
    delete: t("labels.delete"),
    arrowtypes: t("labels.arrowtypes"),
    undo: t("buttons.undo"),
    redo: t("buttons.redo"),
  }));

  /** `#island` sits on `<caliburn-island>`, a component — a valueless template
   * reference resolves to the component instance there, so the element has to
   * be asked for explicitly (`library-menu-items.component.ts` does the same
   * on `<caliburn-stack-col>`) */
  private readonly islandRef = viewChild<unknown, ElementRef<HTMLElement>>(
    "island",
    { read: ElementRef },
  );

  /** the mobile island's measured width, upstream's `ACTIONS_WIDTH` */
  private readonly actionsWidth = signal(0);
  private resizeObserver: ResizeObserver | null = null;

  protected readonly showDeleteOutside = computed(
    () => this.actionsWidth() >= MIN_WIDTH + ADDITIONAL_WIDTH,
  );

  protected readonly showDuplicateOutside = computed(
    () => this.actionsWidth() >= MIN_WIDTH + 2 * ADDITIONAL_WIDTH,
  );

  protected readonly gap = GAP;
  protected readonly rowHeight = WIDTH * 1.35;

  /** upstream re-reads the island's width off its ref on every render; the
   * `supportsResizeObserver` guard is the editor's own, and keeps this inert
   * under jsdom, where the measurement is 0 either way */
  private readonly measureIsland = effect(() => {
    const island = this.islandRef()?.nativeElement;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (!island) {
      this.actionsWidth.set(0);
      return;
    }
    this.actionsWidth.set(island.getBoundingClientRect().width);
    if (!supportsResizeObserver) {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.actionsWidth.set(island.getBoundingClientRect().width);
    });
    this.resizeObserver.observe(island);
  });

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private readonly triggerRects = signal<
    Partial<Record<CompactPopup, DOMRect>>
  >({});

  protected openPopup() {
    this.editor().changeGeneration();
    return this.editor().state.openPopup;
  }

  protected isPopupOpen(name: CompactPopup) {
    return this.openPopup() === name;
  }

  protected triggerRect(name: CompactPopup) {
    return this.triggerRects()[name] ?? null;
  }

  protected togglePopup(name: CompactPopup, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const trigger = event.currentTarget as HTMLElement;
    this.triggerRects.update((rects) => ({
      ...rects,
      [name]: trigger.getBoundingClientRect(),
    }));
    const next = this.isPopupOpen(name) ? null : name;
    this.editor().batchCommits(() =>
      this.editor().setState({ openPopup: next }),
    );
  }

  protected closePopup() {
    this.editor().batchCommits(() =>
      this.editor().setState({ openPopup: null }),
    );
  }

  /** upstream's compact "other actions" fieldset opens with group/ungroup,
   * then the per-element entries, and only then the duplicate/delete pair it
   * may already have promoted outside the popover */
  protected readonly compactActionOptions = translated(() => [
    { action: actionGroup, text: t("labels.group") },
    { action: actionUngroup, text: t("labels.ungroup") },
  ]);

  /** upstream's compact arrow-properties trigger shows the current arrow
   * type's own icon */
  protected arrowTypeIcon() {
    const editor = this.editor();
    editor.changeGeneration();

    const arrowType = getFormValue<"sharp" | "round" | "elbow" | null>(
      this.targetElements(),
      editor,
      (element) => {
        if (isArrowElement(element)) {
          return element.elbowed
            ? "elbow"
            : element.roundness
            ? "round"
            : "sharp";
        }
        return null;
      },
      (element) => isArrowElement(element),
      (hasSelection) =>
        hasSelection ? null : editor.state.currentItemArrowType,
    );

    if (arrowType === "elbow") {
      return "elbowArrowIcon";
    }
    if (arrowType === "round") {
      return "roundArrowIcon";
    }
    return "sharpArrowIcon";
  }

  /**
   * Upstream renders the freedraw pressure setting as a standalone button
   * cycling the variability mode (`renderAction("changeFreedrawMode", {
   * cycle: true })`); the combined popup keeps the full radio group as well.
   */
  protected freedrawModeIcon() {
    const value = this.freedrawModeValue();
    return (
      this.freedrawModeOptions().find((option) => option.value === value)
        ?.icon ?? "strokeVariabilityConstantIcon"
    );
  }

  protected cycleFreedrawMode() {
    this.execute(
      this.freedrawModeAction,
      this.freedrawModeValue() === "constant" ? "variable" : "constant",
    );
  }

  /** upstream's `MOBILE_ACTION_BUTTON_BG`, which the mobile undo/redo buttons
   * always carry (`actionHistory.tsx`) — the island they sit on is
   * transparent, so they paint their own background */
  protected mobileActionBackground() {
    return this.isMobile() ? MOBILE_ACTION_BUTTON_BG.background : null;
  }

  /** the same background on duplicate/delete, which upstream drops while the
   * popover that also holds them is open */
  protected promotedActionBackground() {
    return this.isMobile() && this.openPopup() !== "compactOtherProperties"
      ? MOBILE_ACTION_BUTTON_BG.background
      : null;
  }

  protected undo() {
    this.editor().actionManager.executeAction(this.editor().undoAction, "ui");
  }

  protected redo() {
    this.editor().actionManager.executeAction(this.editor().redoAction, "ui");
  }

  protected isUndoStackEmpty() {
    this.editor().changeGeneration();
    return this.editor().history.isUndoStackEmpty;
  }

  protected isRedoStackEmpty() {
    this.editor().changeGeneration();
    return this.editor().history.isRedoStackEmpty;
  }
}
