import { arrayToMap, throttleRAF } from "@excalidraw/common";
import {
  getGlobalFixedPointForBindableElement,
  isArrowElement,
  isBindableElement,
} from "@excalidraw/element";
import {
  bootstrapCanvas,
  getNormalizedCanvasDimensions,
} from "@excalidraw/excalidraw/renderer/helpers";
import { isLineSegment } from "@excalidraw/math";
import { isCurve } from "@excalidraw/math/curve";

import type {
  DebugElement,
  DebugPolygon,
} from "@excalidraw/element/visualdebug";
import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  FixedPointBinding,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";
import type { Curve, GlobalPoint, LineSegment } from "@excalidraw/math";

import { STORAGE_KEYS } from "../app_constants";

const renderLine = (
  context: CanvasRenderingContext2D,
  zoom: number,
  segment: LineSegment<GlobalPoint>,
  color: string,
) => {
  context.save();
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(segment[0][0] * zoom, segment[0][1] * zoom);
  context.lineTo(segment[1][0] * zoom, segment[1][1] * zoom);
  context.stroke();
  context.restore();
};

const renderCubicBezier = (
  context: CanvasRenderingContext2D,
  zoom: number,
  [start, control1, control2, end]: Curve<GlobalPoint>,
  color: string,
) => {
  context.save();
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(start[0] * zoom, start[1] * zoom);
  context.bezierCurveTo(
    control1[0] * zoom,
    control1[1] * zoom,
    control2[0] * zoom,
    control2[1] * zoom,
    end[0] * zoom,
    end[1] * zoom,
  );
  context.stroke();
  context.restore();
};

const renderPolygon = (
  context: CanvasRenderingContext2D,
  zoom: number,
  polygon: DebugPolygon,
  color: string,
) => {
  const { points, fill, close } = polygon;

  if (points.length < 2) {
    return;
  }

  context.save();
  context.beginPath();
  context.moveTo(points[0][0] * zoom, points[0][1] * zoom);
  for (let i = 1; i < points.length; i += 1) {
    context.lineTo(points[i][0] * zoom, points[i][1] * zoom);
  }
  if (close !== false) {
    context.closePath();
  }

  if (fill) {
    context.save();
    context.globalAlpha = 0.15;
    context.fillStyle = color;
    context.fill();
    context.restore();
  }

  context.strokeStyle = color;
  context.stroke();
  context.restore();
};

const isDebugPolygon = (data: DebugElement["data"]): data is DebugPolygon =>
  (data as DebugPolygon).type === "polygon";

const renderOrigin = (context: CanvasRenderingContext2D, zoom: number) => {
  context.strokeStyle = "#888";
  context.save();
  context.beginPath();
  context.moveTo(-10 * zoom, -10 * zoom);
  context.lineTo(10 * zoom, 10 * zoom);
  context.moveTo(10 * zoom, -10 * zoom);
  context.lineTo(-10 * zoom, 10 * zoom);
  context.stroke();
  context.save();
};

const _renderBinding = (
  context: CanvasRenderingContext2D,
  binding: FixedPointBinding,
  elementsMap: ElementsMap,
  zoom: number,
  width: number,
  height: number,
  color: string,
) => {
  if (!binding.fixedPoint) {
    console.warn("Binding must have a fixedPoint");
    return;
  }

  const bindable = elementsMap.get(
    binding.elementId,
  ) as ExcalidrawBindableElement;
  const [x, y] = getGlobalFixedPointForBindableElement(
    binding.fixedPoint,
    bindable,
    elementsMap,
  );

  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x * zoom, y * zoom);
  context.bezierCurveTo(
    x * zoom - width,
    y * zoom - height,
    x * zoom - width,
    y * zoom + height,
    x * zoom,
    y * zoom,
  );
  context.stroke();
  context.restore();
};

const _renderBindableBinding = (
  binding: FixedPointBinding,
  context: CanvasRenderingContext2D,
  elementsMap: ElementsMap,
  zoom: number,
  width: number,
  height: number,
  color: string,
) => {
  const bindable = elementsMap.get(
    binding.elementId,
  ) as ExcalidrawBindableElement;
  if (!binding.fixedPoint) {
    console.warn("Binding must have a fixedPoint");
    return;
  }

  const [x, y] = getGlobalFixedPointForBindableElement(
    binding.fixedPoint,
    bindable,
    elementsMap,
  );

  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x * zoom, y * zoom);
  context.bezierCurveTo(
    x * zoom + width,
    y * zoom + height,
    x * zoom + width,
    y * zoom - height,
    x * zoom,
    y * zoom,
  );
  context.stroke();
  context.restore();
};

const renderBindings = (
  context: CanvasRenderingContext2D,
  elements: readonly OrderedExcalidrawElement[],
  zoom: number,
) => {
  const elementsMap = arrayToMap(elements);
  const dim = 16;
  elements.forEach((element) => {
    if (element.isDeleted) {
      return;
    }

    if (isArrowElement(element)) {
      if (element.startBinding) {
        if (
          !elementsMap
            .get(element.startBinding.elementId)
            ?.boundElements?.find((e) => e.id === element.id)
        ) {
          return;
        }

        _renderBinding(
          context,
          element.startBinding,
          elementsMap,
          zoom,
          dim,
          dim,
          element.startBinding?.mode === "orbit" ? "red" : "black",
        );
      }

      if (element.endBinding) {
        if (
          !elementsMap
            .get(element.endBinding.elementId)
            ?.boundElements?.find((e) => e.id === element.id)
        ) {
          return;
        }
        _renderBinding(
          context,
          element.endBinding,
          elementsMap,
          zoom,
          dim,
          dim,
          element.endBinding?.mode === "orbit" ? "red" : "black",
        );
      }
    }

    if (isBindableElement(element) && element.boundElements?.length) {
      element.boundElements.forEach((boundElement) => {
        if (boundElement.type !== "arrow") {
          return;
        }

        const arrow = elementsMap.get(
          boundElement.id,
        ) as ExcalidrawArrowElement;

        if (arrow && arrow.startBinding?.elementId === element.id) {
          _renderBindableBinding(
            arrow.startBinding,
            context,
            elementsMap,
            zoom,
            dim,
            dim,
            "green",
          );
        }
        if (arrow && arrow.endBinding?.elementId === element.id) {
          _renderBindableBinding(
            arrow.endBinding,
            context,
            elementsMap,
            zoom,
            dim,
            dim,
            "green",
          );
        }
      });
    }
  });
};

const render = (
  frame: DebugElement[],
  context: CanvasRenderingContext2D,
  appState: AppState,
) => {
  frame.forEach((el: DebugElement) => {
    switch (true) {
      case isLineSegment(el.data):
        renderLine(
          context,
          appState.zoom.value,
          el.data as LineSegment<GlobalPoint>,
          el.color,
        );
        break;
      case isCurve(el.data):
        renderCubicBezier(
          context,
          appState.zoom.value,
          el.data as Curve<GlobalPoint>,
          el.color,
        );
        break;
      case isDebugPolygon(el.data):
        renderPolygon(context, appState.zoom.value, el.data, el.color);
        break;
      default:
        throw new Error(`Unknown element type ${JSON.stringify(el)}`);
    }
  });
};

const _debugRenderer = (
  canvas: HTMLCanvasElement,
  appState: AppState,
  elements: readonly OrderedExcalidrawElement[],
  scale: number,
) => {
  const [normalizedWidth, normalizedHeight] = getNormalizedCanvasDimensions(
    canvas,
    scale,
  );

  const context = bootstrapCanvas({
    canvas,
    scale,
    normalizedWidth,
    normalizedHeight,
    viewBackgroundColor: "transparent",
  });

  // Apply zoom
  context.save();
  context.translate(
    appState.scrollX * appState.zoom.value,
    appState.scrollY * appState.zoom.value,
  );

  renderOrigin(context, appState.zoom.value);
  renderBindings(context, elements, appState.zoom.value);

  if (
    window.visualDebug?.currentFrame &&
    window.visualDebug?.data &&
    window.visualDebug.data.length > 0
  ) {
    // Render only one frame
    const [idx] = debugFrameData();

    render(window.visualDebug.data[idx], context, appState);
  } else {
    // Render all debug frames
    window.visualDebug?.data.forEach((frame) => {
      render(frame, context, appState);
    });
  }

  if (window.visualDebug) {
    window.visualDebug!.data =
      window.visualDebug?.data.map((frame) =>
        frame.filter((el) => el.permanent),
      ) ?? [];
  }
};

const debugFrameData = (): [number, number] => {
  const currentFrame = window.visualDebug?.currentFrame ?? 0;
  const frameCount = window.visualDebug?.data.length ?? 0;

  if (frameCount > 0) {
    return [currentFrame % frameCount, window.visualDebug?.currentFrame ?? 0];
  }

  return [0, 0];
};

export const saveDebugState = (debug: { enabled: boolean }) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_DEBUG,
      JSON.stringify(debug),
    );
  } catch (error: any) {
    console.error(error);
  }
};

export const debugRenderer = throttleRAF(
  (
    canvas: HTMLCanvasElement,
    appState: AppState,
    elements: readonly OrderedExcalidrawElement[],
    scale: number,
  ) => {
    _debugRenderer(canvas, appState, elements, scale);
  },
);

export const loadSavedDebugState = () => {
  let debug;
  try {
    const savedDebugState = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_DEBUG,
    );
    if (savedDebugState) {
      debug = JSON.parse(savedDebugState) as { enabled: boolean };
    }
  } catch (error: any) {
    console.error(error);
  }

  return debug ?? { enabled: false };
};

export const isVisualDebuggerEnabled = () =>
  Array.isArray(window.visualDebug?.data);
