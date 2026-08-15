import type { ToolbarToolType } from "@excalidraw/excalidraw/components/Tools";

/**
 * The ng-icon registry name of each tool's icon. Upstream's `TOOLS` table
 * (`components/Tools.tsx`) carries the icon as a React node, which Angular
 * can't render — everything else on that table (letter/numeric shortcuts,
 * `fillable`, `toggle`) is reused from upstream directly. Names follow the
 * generated registry's convention: the upstream export name with its first
 * character lowercased (see `icons.generated.ts`).
 */
export const TOOL_ICONS: Record<ToolbarToolType, string> = {
  hand: "handIcon",
  selection: "selectionIcon",
  rectangle: "rectangleIcon",
  diamond: "diamondIcon",
  ellipse: "ellipseIcon",
  arrow: "arrowIcon",
  line: "lineIcon",
  freedraw: "freedrawIcon",
  text: "textIcon",
  image: "imageIcon",
  eraser: "eraserIcon",
  frame: "frameToolIcon",
  autoshape: "drawShapeToolIcon",
  embeddable: "embedIcon",
  laser: "laserPointerToolIcon",
  bucketfill: "bucketFillIcon",
  lasso: "lassoIcon",
};
