import {
  FONT_FAMILY,
  ROUNDNESS,
  STROKE_WIDTH_KEYS,
  arrayToMap,
  getFontFamilyString,
  getLineHeight,
  getStrokeWidthByKey,
  invariant,
  isTransparent,
} from "@excalidraw/common";
import {
  CaptureUpdateAction,
  canBecomePolygon,
  getBoundTextElement,
  hasStrokeColor,
  isElbowArrow,
  isLineElement,
  isTextElement,
  isUsingAdaptiveRadius,
  newElementWith,
  redrawTextBoundingBox,
  toggleLinePolygonState,
} from "@excalidraw/element";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { Fonts } from "@excalidraw/excalidraw/fonts";
import { getSelectedElements } from "@excalidraw/excalidraw/scene";

import type { StrokeWidthKey } from "@excalidraw/common";
import type {
  CaptureUpdateActionType,
  ElementUpdate,
} from "@excalidraw/element";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawTextElement,
  FontFamilyValues,
  NonDeletedExcalidrawElement,
  TextAlign,
  VerticalAlign,
} from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { changeFontSize, changeProperty } from "./actionFontSize";
import { register } from "./register";

export const actionChangeStrokeColor = register<
  Pick<AppState, "currentItemStrokeColor">
>({
  name: "changeStrokeColor",
  label: "labels.stroke",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      ...(value?.currentItemStrokeColor && {
        elements: changeProperty(
          elements,
          appState,
          (el) => {
            return hasStrokeColor(el.type)
              ? newElementWith(el, {
                  strokeColor: value.currentItemStrokeColor,
                })
              : el;
          },
          true,
        ),
      }),
      appState: {
        ...appState,
        ...value,
      },
      captureUpdate: value?.currentItemStrokeColor
        ? CaptureUpdateAction.IMMEDIATELY
        : CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionChangeBackgroundColor = register<
  Pick<AppState, "currentItemBackgroundColor" | "viewBackgroundColor">
>({
  name: "changeBackgroundColor",
  label: "labels.changeBackground",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    if (!value?.currentItemBackgroundColor) {
      return {
        appState: {
          ...appState,
          ...value,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    let nextElements;

    const selectedElements = app.scene.getSelectedElements(appState);
    const shouldEnablePolygon =
      !isTransparent(value.currentItemBackgroundColor) &&
      selectedElements.every(
        (el) => isLineElement(el) && canBecomePolygon(el.points),
      );

    if (shouldEnablePolygon) {
      const selectedElementsMap = arrayToMap(selectedElements);
      nextElements = elements.map((el) => {
        if (selectedElementsMap.has(el.id) && isLineElement(el)) {
          return newElementWith(el, {
            backgroundColor: value.currentItemBackgroundColor,
            ...toggleLinePolygonState(el, true),
          });
        }
        return el;
      });
    } else {
      nextElements = changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          backgroundColor: value.currentItemBackgroundColor,
        }),
      );
    }

    return {
      elements: nextElements,
      appState: {
        ...appState,
        ...value,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionChangeFillStyle = register<ExcalidrawElement["fillStyle"]>({
  name: "changeFillStyle",
  label: "labels.fill",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    trackEvent(
      "element",
      "changeFillStyle",
      `${value} (${
        app.editorInterface.formFactor === "phone" ? "mobile" : "desktop"
      })`,
    );
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          fillStyle: value,
        }),
      ),
      appState: { ...appState, currentItemFillStyle: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

const getStrokeWidthKeyForElement = (
  element: ExcalidrawElement,
): StrokeWidthKey | null => {
  return (
    STROKE_WIDTH_KEYS.find(
      (key) => getStrokeWidthByKey(element.type, key) === element.strokeWidth,
    ) ?? null
  );
};

const getStrokeWidthForElement = (
  element: ExcalidrawElement,
  strokeWidthKey: StrokeWidthKey,
): ExcalidrawElement["strokeWidth"] => {
  return getStrokeWidthByKey(element.type, strokeWidthKey);
};

export { getStrokeWidthKeyForElement };

export const actionChangeStrokeWidth = register<StrokeWidthKey>({
  name: "changeStrokeWidth",
  label: "labels.strokeWidth",
  trackEvent: false,
  perform: (elements, appState, value) => {
    invariant(value, "actionChangeStrokeWidth: value must be defined");

    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeWidth: getStrokeWidthForElement(el, value),
        }),
      ),
      appState: { ...appState, currentItemStrokeWidthKey: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionChangeSloppiness = register<ExcalidrawElement["roughness"]>({
  name: "changeSloppiness",
  label: "labels.sloppiness",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          roughness: value,
        }),
      ),
      appState: { ...appState, currentItemRoughness: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionChangeStrokeStyle = register<
  ExcalidrawElement["strokeStyle"]
>({
  name: "changeStrokeStyle",
  label: "labels.strokeStyle",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeStyle: value,
        }),
      ),
      appState: { ...appState, currentItemStrokeStyle: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionChangeOpacity = register<ExcalidrawElement["opacity"]>({
  name: "changeOpacity",
  label: "labels.opacity",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(
        elements,
        appState,
        (el) =>
          newElementWith(el, {
            opacity: value,
          }),
        true,
      ),
      appState: { ...appState, currentItemOpacity: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionChangeFontSize = register<ExcalidrawTextElement["fontSize"]>(
  {
    name: "changeFontSize",
    label: "labels.fontSize",
    trackEvent: false,
    perform: (elements, appState, value, app) => {
      return changeFontSize(
        elements,
        appState,
        app,
        () => {
          invariant(value, "actionChangeFontSize: Expected a font size value");
          return value;
        },
        value,
      );
    },
  },
);

type ChangeFontFamilyData = Partial<
  Pick<
    AppState,
    "openPopup" | "currentItemFontFamily" | "currentHoveredFontFamily"
  >
> & {
  /** cache of selected & editing elements populated on opened popup */
  cachedElements?: ElementsMap;
  /** flag to reset all elements to their cached versions  */
  resetAll?: true;
  /** flag to reset all containers to their cached versions */
  resetContainers?: true;
};

export const actionChangeFontFamily = register<{
  currentItemFontFamily: any;
  currentHoveredFontFamily: any;
}>({
  name: "changeFontFamily",
  label: "labels.fontFamily",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    const { cachedElements, resetAll, resetContainers, ...nextAppState } =
      value as ChangeFontFamilyData;

    if (resetAll) {
      const nextElements = changeProperty(
        elements,
        appState,
        (element) => {
          const cachedElement = cachedElements?.get(element.id);
          if (cachedElement) {
            const newElement = newElementWith(element, {
              ...cachedElement,
            } as ElementUpdate<NonDeletedExcalidrawElement>);

            return newElement;
          }

          return element;
        },
        true,
      );

      return {
        elements: nextElements,
        appState: {
          ...appState,
          ...nextAppState,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      };
    }

    invariant(value, "actionChangeFontFamily: value must be defined");

    const { currentItemFontFamily, currentHoveredFontFamily } = value;

    let nextCaptureUpdateAction: CaptureUpdateActionType =
      CaptureUpdateAction.EVENTUALLY;
    let nextFontFamily: FontFamilyValues | undefined;
    let skipOnHoverRender = false;

    if (currentItemFontFamily) {
      nextFontFamily = currentItemFontFamily;
      nextCaptureUpdateAction = CaptureUpdateAction.IMMEDIATELY;
    } else if (currentHoveredFontFamily) {
      nextFontFamily = currentHoveredFontFamily;
      nextCaptureUpdateAction = CaptureUpdateAction.EVENTUALLY;

      const selectedTextElements = getSelectedElements(elements, appState, {
        includeBoundTextElement: true,
      }).filter((element) => isTextElement(element));

      // skip on hover re-render for more than 200 text elements or for text element with more than 5000 chars combined
      if (selectedTextElements.length > 200) {
        skipOnHoverRender = true;
      } else {
        let i = 0;
        let textLengthAccumulator = 0;

        while (
          i < selectedTextElements.length &&
          textLengthAccumulator < 5000
        ) {
          const textElement = selectedTextElements[i] as ExcalidrawTextElement;
          textLengthAccumulator += textElement?.originalText.length || 0;
          i++;
        }

        if (textLengthAccumulator > 5000) {
          skipOnHoverRender = true;
        }
      }
    }

    const result = {
      appState: {
        ...appState,
        ...nextAppState,
      },
      captureUpdate: nextCaptureUpdateAction,
    };

    if (nextFontFamily && !skipOnHoverRender) {
      const elementContainerMapping = new Map<
        ExcalidrawTextElement,
        ExcalidrawElement | null
      >();
      let uniqueChars = new Set<string>();
      let skipFontFaceCheck = false;

      const fontsCache = Array.from(Fonts.loadedFontsCache.values());
      const fontFamily = Object.entries(FONT_FAMILY).find(
        ([_, value]) => value === nextFontFamily,
      )?.[0];

      // skip `document.font.check` check on hover, if at least one font family has loaded as it's super slow (could result in slightly different bbox, which is fine)
      if (
        currentHoveredFontFamily &&
        fontFamily &&
        fontsCache.some((sig) => sig.startsWith(fontFamily))
      ) {
        skipFontFaceCheck = true;
      }

      // following causes re-render so make sure we changed the family
      // otherwise it could cause unexpected issues, such as preventing opening the popover when in wysiwyg
      Object.assign(result, {
        elements: changeProperty(
          elements,
          appState,
          (oldElement) => {
            if (
              isTextElement(oldElement) &&
              (oldElement.fontFamily !== nextFontFamily ||
                currentItemFontFamily) // force update on selection
            ) {
              const newElement: ExcalidrawTextElement = newElementWith(
                oldElement,
                {
                  fontFamily: nextFontFamily,
                  lineHeight: getLineHeight(nextFontFamily!),
                },
              );

              const cachedContainer =
                cachedElements?.get(oldElement.containerId || "") || {};

              const container = app.scene.getContainerElement(oldElement);

              if (resetContainers && container && cachedContainer) {
                // reset the container back to it's cached version
                app.scene.mutateElement(container, { ...cachedContainer });
              }

              if (!skipFontFaceCheck) {
                uniqueChars = new Set([
                  ...uniqueChars,
                  ...Array.from(newElement.originalText),
                ]);
              }

              elementContainerMapping.set(newElement, container);

              return newElement;
            }

            return oldElement;
          },
          true,
        ),
      });

      // size is irrelevant, but necessary
      const fontString = `10px ${getFontFamilyString({
        fontFamily: nextFontFamily,
      })}`;
      const chars = Array.from(uniqueChars.values()).join();

      if (skipFontFaceCheck || window.document.fonts.check(fontString, chars)) {
        // we either skip the check (have at least one font face loaded) or do the check and find out all the font faces have loaded
        for (const [element, container] of elementContainerMapping) {
          // trigger synchronous redraw
          redrawTextBoundingBox(element, container, app.scene);
        }
      } else {
        // otherwise try to load all font faces for the given chars and redraw elements once our font faces loaded
        window.document.fonts.load(fontString, chars).then((fontFaces) => {
          for (const [element, container] of elementContainerMapping) {
            // use latest element state to ensure we don't have closure over an old instance in order to avoid possible race conditions (i.e. font faces load out-of-order while rapidly switching fonts)
            const latestElement = app.scene.getElement(element.id);
            const latestContainer = container
              ? app.scene.getElement(container.id)
              : null;

            if (latestElement) {
              // trigger async redraw
              redrawTextBoundingBox(
                latestElement as ExcalidrawTextElement,
                latestContainer,
                app.scene,
              );
            }
          }

          // trigger update once we've mutated all the elements, which also updates our cache
          app.fonts.onLoaded(fontFaces);
        });
      }
    }

    return result;
  },
});

export const actionChangeTextAlign = register<TextAlign>({
  name: "changeTextAlign",
  label: "Change text alignment",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return {
      elements: changeProperty(
        elements,
        appState,
        (oldElement) => {
          if (isTextElement(oldElement)) {
            const newElement: ExcalidrawTextElement = newElementWith(
              oldElement,
              { textAlign: value },
            );
            redrawTextBoundingBox(
              newElement,
              app.scene.getContainerElement(oldElement),
              app.scene,
            );
            return newElement;
          }

          return oldElement;
        },
        true,
      ),
      appState: {
        ...appState,
        currentItemTextAlign: value,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionChangeVerticalAlign = register<VerticalAlign>({
  name: "changeVerticalAlign",
  label: "Change vertical alignment",
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    return {
      elements: changeProperty(
        elements,
        appState,
        (oldElement) => {
          if (isTextElement(oldElement)) {
            const newElement: ExcalidrawTextElement = newElementWith(
              oldElement,
              { verticalAlign: value },
            );

            redrawTextBoundingBox(
              newElement,
              app.scene.getContainerElement(oldElement),
              app.scene,
            );
            return newElement;
          }

          return oldElement;
        },
        true,
      ),
      appState: {
        ...appState,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionChangeRoundness = register<"sharp" | "round">({
  name: "changeRoundness",
  label: "Change edge roundness",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) => {
        if (isElbowArrow(el)) {
          return el;
        }

        return newElementWith(el, {
          roundness:
            value === "round"
              ? {
                  type: isUsingAdaptiveRadius(el.type)
                    ? ROUNDNESS.ADAPTIVE_RADIUS
                    : ROUNDNESS.PROPORTIONAL_RADIUS,
                }
              : null,
        });
      }),
      appState: {
        ...appState,
        currentItemRoundness: value,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
