import { fireEvent, queryByTestId } from "@testing-library/react";

import { ARROW_TYPE, arrayToMap } from "@excalidraw/common";

import { LinearElementEditor } from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawArrowElement,
  ExcalidrawLineElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import {
  act,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
} from "./test-utils";

/**
 * Caliburn-authored: the panel half of Task 57's port. The `perform` half of
 * `actionAlign` / `actionDistribute` is upstream's own (`align.test.tsx`,
 * `distribute.test.tsx`, both ported alongside); what upstream never tests is
 * the styles panel actually rendering these groups and its buttons dispatching
 * — which is exactly the surface caliburn re-implements in Angular. Every
 * assertion below is read off upstream's `Actions.tsx` (group order and
 * predicates), `actionAlign.tsx`/`actionDistribute.tsx` (button titles,
 * `hidden`/`visible`), `actionProperties.tsx` (the arrow groups) and
 * `shapeActionPredicates.ts`.
 */

const container = () => document.querySelector(".excalidraw")!;

const query = (selector: string) => container().querySelector(selector);

const queryAll = (selector: string) =>
  Array.from(container().querySelectorAll(selector));

const button = (ariaLabel: string) =>
  query(`button[aria-label="${ariaLabel}"]`) as HTMLElement | null;

const createRectangle = (x: number, y: number) =>
  API.createElement({ type: "rectangle", x, y, width: 100, height: 100 });

const select = (elements: NonDeletedExcalidrawElement[]) => {
  act(() => {
    API.setElements(elements);
    API.setSelectedElements(elements);
  });
};

describe("styles panel: align and distribute", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("renders no align group for a single selection", () => {
    select([createRectangle(0, 0)]);

    expect(query("caliburn-align-fieldset")).toBe(null);
    expect(button("Align left")).toBe(null);
  });

  it("renders the align group, without distribute, for two elements", () => {
    select([createRectangle(0, 0), createRectangle(110, 110)]);

    expect(query("caliburn-align-fieldset")).not.toBe(null);
    for (const label of [
      "Align left",
      "Center horizontally",
      "Align right",
      "Align top",
      "Center vertically",
      "Align bottom",
    ]) {
      expect(button(label)).not.toBe(null);
    }
    expect(button("Distribute horizontally")).toBe(null);
    expect(button("Distribute vertically")).toBe(null);
  });

  it("aligns the selection when Align left is clicked", () => {
    const first = createRectangle(0, 0);
    const second = createRectangle(110, 110);
    select([first, second]);

    expect(API.getSelectedElements().map((element) => element.x)).toEqual([
      0, 110,
    ]);

    fireEvent.click(button("Align left")!);

    expect(API.getSelectedElements().map((element) => element.x)).toEqual([
      0, 0,
    ]);
    // the perpendicular axis is untouched
    expect(API.getSelectedElements().map((element) => element.y)).toEqual([
      0, 110,
    ]);
  });

  it("aligns the selection when Align bottom is clicked", () => {
    select([createRectangle(0, 0), createRectangle(110, 110)]);

    fireEvent.click(button("Align bottom")!);

    expect(API.getSelectedElements().map((element) => element.y)).toEqual([
      110, 110,
    ]);
  });

  it("carries upstream's shortcut in the button titles", () => {
    select([createRectangle(0, 0), createRectangle(110, 110)]);

    // `getShortcutKey` renders CtrlOrCmd per platform, so only the
    // label-plus-em-dash shape is pinned here
    expect(button("Align left")!.getAttribute("title")).toMatch(
      /^Align left — /,
    );
    // the two centering actions have no shortcut upstream
    expect(button("Center horizontally")!.getAttribute("title")).toBe(
      "Center horizontally",
    );
  });

  it("mirrors the horizontal row for RTL", () => {
    select([createRectangle(0, 0), createRectangle(110, 110)]);

    const labels = () =>
      queryAll("caliburn-align-fieldset .buttonList > button").map((element) =>
        element.getAttribute("aria-label"),
      );

    expect(labels()).toEqual([
      "Align left",
      "Center horizontally",
      "Align right",
    ]);

    document.documentElement.setAttribute("dir", "rtl");
    try {
      act(() => API.setAppState({}));
      expect(labels()).toEqual([
        "Align right",
        "Center horizontally",
        "Align left",
      ]);
    } finally {
      document.documentElement.removeAttribute("dir");
    }
  });

  it("hides the align group while a frame is part of the selection", () => {
    const rectangle = createRectangle(0, 0);
    const frame = API.createElement({ type: "frame", x: 200, y: 200 });
    select([rectangle, frame]);

    expect(query("caliburn-align-fieldset")).toBe(null);
  });

  it("shows and runs distribute once three elements are selected", () => {
    select([
      createRectangle(0, 0),
      createRectangle(110, 110),
      createRectangle(400, 400),
    ]);

    const distribute = button("Distribute horizontally");
    expect(distribute).not.toBe(null);
    expect(distribute!.hasAttribute("hidden")).toBe(false);

    fireEvent.click(distribute!);

    const [first, second, third] = API.getSelectedElements();
    // equal gaps between the three boxes
    expect(second.x - (first.x + first.width)).toBe(
      third.x - (second.x + second.width),
    );
  });
});

describe("styles panel: arrow properties", () => {
  const createArrow = (overrides: Record<string, unknown> = {}) =>
    API.createElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 100,
      height: 0,
      points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
      ...overrides,
    });

  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("renders the arrow type group for an arrow selection", () => {
    select([createArrow()]);

    expect(query("caliburn-arrow-type-fieldset")).not.toBe(null);
    expect(queryByTestId(document.body, "sharp-arrow")).not.toBe(null);
    expect(queryByTestId(document.body, "round-arrow")).not.toBe(null);
    expect(queryByTestId(document.body, "elbow-arrow")).not.toBe(null);
    expect(queryByTestId(document.body, "sharp-arrow")).toBeChecked();
  });

  it("switches the selected arrow to elbowed from the panel", () => {
    select([createArrow()]);

    fireEvent.click(queryByTestId(document.body, "elbow-arrow")!);

    const arrow = API.getSelectedElements()[0] as ExcalidrawArrowElement;
    expect(arrow.elbowed).toBe(true);
    expect(h.state.currentItemArrowType).toBe(ARROW_TYPE.elbow);
  });

  it("renders both arrowhead pickers for an arrow selection", () => {
    select([createArrow()]);

    expect(query("caliburn-arrowhead-fieldset")).not.toBe(null);
    expect(button("arrowhead_start")).not.toBe(null);
    expect(button("arrowhead_end")).not.toBe(null);
    expect(query(".picker")).toBe(null);
  });

  it("sets the end arrowhead from the picker", () => {
    select([createArrow({ endArrowhead: "arrow" })]);

    act(() => fireEvent.click(button("arrowhead_end")!));

    const picker = query('.picker[aria-label="arrowhead_end"]')!;
    expect(picker).not.toBe(null);

    act(() =>
      fireEvent.click(picker.querySelector('button[aria-label="Triangle"]')!),
    );

    const arrow = API.getSelectedElements()[0] as ExcalidrawArrowElement;
    expect(arrow.endArrowhead).toBe("triangle");
    expect(h.state.currentItemEndArrowhead).toBe("triangle");
  });

  it("keeps the cardinality section behind More options", () => {
    select([createArrow()]);

    act(() => fireEvent.click(button("arrowhead_end")!));
    const picker = () => query('.picker[aria-label="arrowhead_end"]')!;

    expect(picker().textContent).toContain("More options");
    expect(picker().textContent).not.toContain("Cardinality");

    act(() => fireEvent.click(picker().querySelector(".picker-collapsible")!));

    expect(picker().textContent).toContain("Cardinality");
    expect(
      picker().querySelector('button[aria-label="Cardinality (one or many)"]'),
    ).not.toBe(null);
  });
});

describe("styles panel: per-element actions", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("renders the link toggle for a single selection and opens the editor", () => {
    select([createRectangle(0, 0)]);

    const link = button("Add link");
    expect(link).not.toBe(null);
    expect(link!.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(link!);
    expect(h.state.showHyperlinkPopup).toBe("editor");
  });

  it("renders the crop button for an image and opens the crop editor", () => {
    const image = API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fileId: "fileId" as any,
    });
    select([image]);

    const crop = button("Crop image");
    expect(crop).not.toBe(null);

    fireEvent.click(crop!);
    expect(h.state.croppingElementId).toBe(image.id);
  });

  it("renders the polygon toggle in the edges group, only for a polygon", () => {
    const square = [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(100, 0),
      pointFrom<LocalPoint>(100, 100),
      pointFrom<LocalPoint>(0, 100),
      pointFrom<LocalPoint>(0, 0),
    ];

    const openLine = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: square,
    });
    select([openLine]);
    expect(button("Break polygon")).toBe(null);

    const polygon = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: square,
      polygon: true,
      backgroundColor: "#ffc9c9",
    });
    select([polygon]);

    const toggle = button("Break polygon");
    expect(toggle).not.toBe(null);
    // upstream renders it inside the edges group, after the two radios
    expect(
      toggle!.closest("fieldset")?.querySelector("legend")?.textContent,
    ).toBe("Edges");
    expect(toggle!.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(toggle!);

    const broken = API.getSelectedElements()[0] as ExcalidrawLineElement;
    expect(broken.polygon).toBe(false);
    expect(broken.backgroundColor).toBe("transparent");
  });

  it("renders the line-editor button for a line and enters the editor", () => {
    const line = API.createElement({
      type: "line",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [
        pointFrom<LocalPoint>(0, 0),
        pointFrom<LocalPoint>(50, 50),
        pointFrom<LocalPoint>(100, 100),
      ],
    });
    // `toggleLinearEditor` reads the `selectedLinearElement` the editor
    // installs while a single linear element is selected
    act(() => {
      API.setElements([line]);
      API.setSelectedElements([line]);
      API.setAppState({
        selectedLinearElement: new LinearElementEditor(
          line,
          arrayToMap([line]),
        ),
      });
    });

    const lineEditor = button("Edit line");
    expect(lineEditor).not.toBe(null);

    act(() => fireEvent.click(lineEditor!));
    expect(h.state.selectedLinearElement?.isEditing).toBe(true);
  });

  it("renders neither crop nor line editor for a plain rectangle", () => {
    select([createRectangle(0, 0)]);

    expect(button("Crop image")).toBe(null);
    expect(query("caliburn-linear-editor-button button")).toBe(null);
  });
});

describe("compact styles panel: the shared groups", () => {
  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  /** the tablet viewport that puts the panel in its compact mode */
  const renderCompact = async () => {
    await render(<Excalidraw />);
    mockBoundingClientRect({ width: 900, height: 900 });
    act(() => h.app.refreshEditorInterface());
  };

  it("opens the arrow popover with both arrow groups", async () => {
    await renderCompact();
    select([
      API.createElement({
        type: "arrow",
        x: 0,
        y: 0,
        width: 100,
        height: 0,
        points: [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(100, 0)],
      }),
    ]);

    expect(query(".compact-shape-actions")).not.toBe(null);
    const trigger = query(
      '.compact-shape-actions button[title="Arrow type"]',
    ) as HTMLElement;
    expect(trigger).not.toBe(null);

    fireEvent.click(trigger);

    expect(h.state.openPopup).toBe("compactArrowProperties");
    expect(query("caliburn-arrowhead-fieldset")).not.toBe(null);
    expect(query("caliburn-arrow-type-fieldset")).not.toBe(null);
  });

  it("renders the line editor as its own compact item", async () => {
    await renderCompact();
    select([
      API.createElement({
        type: "line",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        points: [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(50, 50),
          pointFrom<LocalPoint>(100, 100),
        ],
      }),
    ]);

    const item = query(
      ".compact-shape-actions .compact-action-item caliburn-linear-editor-button",
    );
    expect(item).not.toBe(null);
  });

  it("carries layers, align and the per-element entries in the other-actions popover", async () => {
    await renderCompact();
    select([createRectangle(0, 0), createRectangle(110, 110)]);

    fireEvent.click(
      query('.compact-shape-actions button[title="Actions"]') as HTMLElement,
    );
    expect(h.state.openPopup).toBe("compactOtherProperties");

    const popover = query("[caliburn-properties-popover]")!;
    expect(popover.querySelector("caliburn-align-fieldset")).not.toBe(null);

    // upstream's compact order: group, ungroup, then the per-element entries
    const actionLabels = Array.from(popover.querySelectorAll("fieldset"))
      .filter(
        (fieldset) =>
          fieldset.querySelector("legend")?.textContent === "Actions",
      )
      .flatMap((fieldset) =>
        Array.from(fieldset.querySelectorAll("button")).map((element) =>
          element.getAttribute("aria-label"),
        ),
      );
    expect(actionLabels).toEqual(["Group selection", "Ungroup selection"]);
  });

  it("renders the link entry for a single compact selection", async () => {
    await renderCompact();
    select([createRectangle(0, 0)]);

    fireEvent.click(
      query('.compact-shape-actions button[title="Actions"]') as HTMLElement,
    );

    const popover = query("[caliburn-properties-popover]")!;
    expect(popover.querySelector('button[aria-label="Add link"]')).not.toBe(
      null,
    );
  });
});
