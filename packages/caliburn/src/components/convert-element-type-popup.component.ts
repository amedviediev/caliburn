import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  inject,
  untracked,
} from "@angular/core";

import { CLASSES, sceneCoordsToViewportCoords } from "@excalidraw/common";
import {
  getCommonBoundingBox,
  getElementAbsoluteCoords,
  getLinearElementSubType,
} from "@excalidraw/element";
import { pointFrom, pointRotateRads } from "@excalidraw/math";

import { trackEvent } from "@excalidraw/excalidraw/analytics";

import type {
  ConvertibleGenericTypes,
  ConvertibleLinearTypes,
} from "@excalidraw/element/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import {
  cacheBoundTextFontSizesForConversion,
  cacheLinearElementsForConversion,
  clearConversionCaches,
  convertElementTypes,
  filterGenericConvetibleElements,
  filterLinearConvertibleElements,
  getConversionTypeFromElements,
} from "./convert-element-type";
import { CaliburnIconButtonComponent } from "./icon-button.component";

import type { ConversionType } from "./convert-element-type";

import type { CaliburnEditorComponent } from "../editor.component";

const GAP_HORIZONTAL = 8;
const GAP_VERTICAL = 10;

/** the ng-icon registry name of each convertible type's icon */
const SHAPE_ICONS: Record<string, string> = {
  line: "lineIcon",
  sharpArrow: "sharpArrowIcon",
  curvedArrow: "roundArrowIcon",
  elbowArrow: "elbowArrowIcon",
  rectangle: "rectangleIcon",
  diamond: "diamondIcon",
  ellipse: "ellipseIcon",
};

type Shape = {
  key: string;
  type: string;
  icon: string;
  isSelected: boolean;
};

/**
 * Angular port of upstream `ConvertElementTypePopup.tsx` — the shape-switch
 * panel that Tab opens below the selection, offering the types the selected
 * elements can be converted to. Upstream's outer component (which closes the
 * panel when the selection empties or changes category) and its inner
 * `Panel` are one component here, since the panel is the only thing the
 * outer one renders.
 *
 * Upstream keeps the conversion half in this same file; here it lives in
 * `convert-element-type.ts` (see the note on the cache accessors there).
 *
 * Attribute-selector component (`div[caliburn-convert-element-type-popup]`):
 * the host IS the `.ConvertElementTypePopup` div upstream renders, so the
 * icon buttons stay its direct children and the vendored SCSS lays them out
 * unchanged.
 */
@Component({
  selector: "div[caliburn-convert-element-type-popup]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIconButtonComponent],
  host: {
    tabindex: "-1",
    "[class]": "popupClass",
    "[style.position]": "'absolute'",
    "[style.top.px]": "top()",
    "[style.left.px]": "left()",
    "[style.zIndex]": "2",
  },
  templateUrl: "./convert-element-type-popup.component.html",
})
export class CaliburnConvertElementTypePopupComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  private readonly hostRef = inject<ElementRef<HTMLDivElement>>(ElementRef);

  protected readonly popupClass = CLASSES.CONVERT_ELEMENT_TYPE_POPUP;

  private elementsCategory: ConversionType = null;

  private readonly selectedElements = computed(() => {
    this.host.changeGeneration();
    return this.host.scene.getSelectedElements(this.host.state);
  });

  private readonly conversionType = computed(() =>
    getConversionTypeFromElements(this.selectedElements()),
  );

  private readonly genericElements = computed(() =>
    this.conversionType() === "generic"
      ? filterGenericConvetibleElements(this.selectedElements())
      : [],
  );

  private readonly linearElements = computed(() =>
    this.conversionType() === "linear"
      ? filterLinearConvertibleElements(this.selectedElements())
      : [],
  );

  private readonly sameType = computed(() => {
    const conversionType = this.conversionType();
    const genericElements = this.genericElements();
    const linearElements = this.linearElements();

    return conversionType === "generic"
      ? genericElements.every(
          (element) => element.type === genericElements[0].type,
        )
      : conversionType === "linear"
      ? linearElements.every(
          (element) =>
            getLinearElementSubType(element) ===
            getLinearElementSubType(linearElements[0]),
        )
      : false;
  });

  private readonly positionElements = computed(() =>
    [...this.genericElements(), ...this.linearElements()].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  );

  /**
   * Upstream reruns the positioning effect on every render but bails unless
   * this key changed (`positionRef`); a computed whose only dependency is
   * the key does the same, since an unchanged string leaves its readers
   * alone.
   */
  private readonly positionKey = computed(() => {
    this.host.changeGeneration();
    const elements = this.positionElements();

    return `
      ${this.host.state.scrollX}${this.host.state.scrollY}${
      this.host.state.offsetTop
    }${this.host.state.offsetLeft}${this.host.state.zoom.value}${elements
      .map((el) => el.id)
      .join(",")}`;
  });

  private readonly panelPosition = computed(() => {
    this.positionKey();

    const elements = untracked(() => this.positionElements());

    let bottomLeft;

    if (elements.length === 1) {
      const [x1, , , y2, cx, cy] = getElementAbsoluteCoords(
        elements[0],
        this.host.scene.getNonDeletedElementsMap(),
      );
      bottomLeft = pointRotateRads(
        pointFrom(x1, y2),
        pointFrom(cx, cy),
        elements[0].angle,
      );
    } else {
      const { minX, maxY } = getCommonBoundingBox(elements);
      bottomLeft = pointFrom(minX, maxY);
    }

    return sceneCoordsToViewportCoords(
      { sceneX: bottomLeft[0], sceneY: bottomLeft[1] },
      this.host.state,
    );
  });

  protected readonly top = computed(() => {
    this.host.changeGeneration();
    return (
      this.panelPosition().y +
      (GAP_VERTICAL + 8) * this.host.state.zoom.value -
      this.host.state.offsetTop
    );
  });

  protected readonly left = computed(() => {
    this.host.changeGeneration();
    return this.panelPosition().x - this.host.state.offsetLeft - GAP_HORIZONTAL;
  });

  protected readonly shapes = computed<readonly Shape[]>(() => {
    const conversionType = this.conversionType();
    const elements = this.selectedElements();
    const sameType = this.sameType();
    const genericElements = this.genericElements();
    const linearElements = this.linearElements();

    const SHAPES: string[] =
      conversionType === "linear"
        ? ["line", "sharpArrow", "curvedArrow", "elbowArrow"]
        : conversionType === "generic"
        ? ["rectangle", "diamond", "ellipse"]
        : [];

    return SHAPES.map((type) => ({
      key: `${elements[0].id}${elements[0].version}_${type}`,
      type,
      icon: SHAPE_ICONS[type],
      isSelected:
        sameType &&
        ((conversionType === "generic" && genericElements[0].type === type) ||
          (conversionType === "linear" &&
            getLinearElementSubType(linearElements[0]) === type)),
    }));
  });

  constructor() {
    // close shape switch panel if selecting different "types" of elements
    effect(() => {
      const selectedElements = this.selectedElements();

      if (selectedElements.length === 0) {
        this.host.convertElementTypePopup.set(null);
        return;
      }

      const conversionType = getConversionTypeFromElements(selectedElements);

      if (conversionType && !this.elementsCategory) {
        this.elementsCategory = conversionType;
      } else if (
        (this.elementsCategory && !conversionType) ||
        (this.elementsCategory && conversionType !== this.elementsCategory)
      ) {
        this.host.convertElementTypePopup.set(null);
        this.elementsCategory = null;
      }
    });

    effect(() => {
      cacheLinearElementsForConversion(this.linearElements());
    });

    effect(() => {
      cacheBoundTextFontSizesForConversion(
        this.genericElements(),
        this.host.scene.getNonDeletedElementsMap(),
      );
    });
  }

  ngOnDestroy() {
    clearConversionCaches();
  }

  protected onSelect(shape: Shape) {
    // selecting the already-selected type is a no-op
    if (shape.isSelected) {
      return;
    }
    if (this.host.state.activeTool.type !== shape.type) {
      trackEvent("convertElementType", shape.type, "ui");
    }
    convertElementTypes(this.host, {
      conversionType: this.conversionType(),
      nextType: shape.type as ConvertibleGenericTypes | ConvertibleLinearTypes,
    });
    this.hostRef.nativeElement.focus();
  }
}
