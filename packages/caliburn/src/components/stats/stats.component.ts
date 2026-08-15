import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { NgIcon } from "@ng-icons/core";

import throttle from "lodash.throttle";

import { STATS_PANELS } from "@excalidraw/common";
import {
  elementsAreInSameGroup,
  frameAndChildrenSelectedTogether,
  getCommonBounds,
} from "@excalidraw/element";

import { t } from "@excalidraw/excalidraw/i18n";
import { isGridModeEnabled } from "@excalidraw/excalidraw/snapping";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { TranslationKeys } from "@excalidraw/excalidraw/i18n";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnIslandComponent } from "../island.component";

import { CaliburnStatsAngleComponent } from "./angle.component";
import { CaliburnStatsCanvasGridComponent } from "./canvas-grid.component";
import { CaliburnStatsCollapsibleComponent } from "./collapsible.component";
import { CaliburnStatsDimensionComponent } from "./dimension.component";
import { CaliburnStatsFontSizeComponent } from "./font-size.component";
import { CaliburnStatsMultiAngleComponent } from "./multi-angle.component";
import { CaliburnStatsMultiDimensionComponent } from "./multi-dimension.component";
import { CaliburnStatsMultiFontSizeComponent } from "./multi-font-size.component";
import { CaliburnStatsMultiPositionComponent } from "./multi-position.component";
import { CaliburnStatsPositionComponent } from "./position.component";
import { getAtomicUnits } from "./utils";

import type { CaliburnEditorComponent } from "../../editor.component";

import type { OnDestroy } from "@angular/core";

const STATS_TIMEOUT = 50;

/**
 * Angular port of upstream `Stats/index.tsx` — the floating "Canvas & Shape
 * properties" island.
 *
 * The crop-mode rows (`labels.unCroppedDimension`, `labels.imageCropping`)
 * are not rendered: caliburn has no crop editor, so `croppingElementId` is
 * always null. Upstream's `renderCustomStats` prop has no caliburn
 * equivalent either.
 */
@Component({
  selector: "caliburn-stats",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnIslandComponent,
    CaliburnStatsAngleComponent,
    CaliburnStatsCanvasGridComponent,
    CaliburnStatsCollapsibleComponent,
    CaliburnStatsDimensionComponent,
    CaliburnStatsFontSizeComponent,
    CaliburnStatsMultiAngleComponent,
    CaliburnStatsMultiDimensionComponent,
    CaliburnStatsMultiFontSizeComponent,
    CaliburnStatsMultiPositionComponent,
    CaliburnStatsPositionComponent,
    NgIcon,
  ],
  templateUrl: "./stats.component.html",
})
export class CaliburnStatsComponent implements OnDestroy {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly labels = {
    title: t("stats.title"),
    generalStats: t("stats.generalStats"),
    elementProperties: t("stats.elementProperties"),
    scene: t("stats.scene"),
    shapes: t("stats.shapes"),
    width: t("stats.width"),
    height: t("stats.height"),
    group: t("element.group"),
  };

  private readonly sceneDimensionValue = signal({ width: 0, height: 0 });

  private readonly throttledSetSceneDimension = throttle(
    (elements: readonly NonDeletedExcalidrawElement[]) => {
      const boundingBox = getCommonBounds(elements);
      this.sceneDimensionValue.set({
        width: Math.round(boundingBox[2]) - Math.round(boundingBox[0]),
        height: Math.round(boundingBox[3]) - Math.round(boundingBox[1]),
      });
    },
    STATS_TIMEOUT,
  );

  ngOnDestroy() {
    this.throttledSetSceneDimension.cancel();
  }

  private state() {
    this.editor.changeGeneration();
    return this.editor.state;
  }

  private readonly elements = computed(() => {
    this.state();
    return this.editor.scene.getNonDeletedElements();
  });

  private readonly selectedElements = computed(() => {
    this.state();
    return this.editor.scene.getSelectedElements({
      selectedElementIds: this.editor.state.selectedElementIds,
      includeBoundTextElement: false,
    });
  });

  protected readonly sceneDimension = this.sceneDimensionValue.asReadonly();

  private readonly trackSceneDimension = effect(() => {
    const elements = this.elements();
    untracked(() => this.throttledSetSceneDimension(elements));
  });

  protected readonly elementCount = computed(() => this.elements().length);

  protected readonly gridModeEnabled = computed(() => {
    this.state();
    return isGridModeEnabled(this.editor as any);
  });

  protected readonly singleElement = computed(() => {
    const selected = this.selectedElements();
    return selected.length === 1 ? selected[0] : null;
  });

  protected readonly multipleElements = computed(() => {
    const selected = this.selectedElements();
    return selected.length > 1 ? selected : null;
  });

  protected readonly elementTypeLabel = computed(() => {
    const element = this.singleElement();
    return element
      ? t(`element.${element.type}` as unknown as TranslationKeys)
      : "";
  });

  protected readonly elementsAreInSameGroup = computed(() => {
    const elements = this.multipleElements();
    return !!elements && elementsAreInSameGroup(elements);
  });

  protected readonly atomicUnits = computed(() =>
    getAtomicUnits(this.selectedElements(), this.state()),
  );

  protected readonly showElementStats = computed(
    () =>
      !frameAndChildrenSelectedTogether(this.selectedElements()) &&
      this.selectedElements().length > 0,
  );

  protected readonly generalStatsOpen = computed(
    () => !!(this.state().stats.panels & STATS_PANELS.generalStats),
  );

  protected readonly elementPropertiesOpen = computed(
    () => !!(this.state().stats.panels & STATS_PANELS.elementProperties),
  );

  protected toggleGeneralStats() {
    this.editor.batchCommits(() =>
      this.editor.setState((state) => ({
        stats: {
          open: true,
          panels: state.stats.panels ^ STATS_PANELS.generalStats,
        },
      })),
    );
  }

  protected toggleElementProperties() {
    this.editor.batchCommits(() =>
      this.editor.setState((state) => ({
        stats: {
          open: true,
          panels: state.stats.panels ^ STATS_PANELS.elementProperties,
        },
      })),
    );
  }

  protected close() {
    this.editor.actionManager.executeAction(
      this.editor.actionManager.actions.stats,
    );
  }
}
