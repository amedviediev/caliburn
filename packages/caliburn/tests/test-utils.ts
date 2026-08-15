import "pepjs";
import {
  queries,
  waitFor,
  fireEvent,
  getQueriesForElement,
  prettyDOM,
} from "@testing-library/dom";
import ansi from "ansicolor";

import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ORIG_ID, arrayToMap } from "@excalidraw/common";

import { getSelectedElements } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { AllPossibleKeys } from "@excalidraw/common/utility-types";

import type { History } from "@excalidraw/excalidraw/history";

import { CaliburnEditorComponent } from "../src/editor.component";
import { h } from "../src/test-hook";

import { Pointer, UI } from "./helpers/ui";
import * as toolQueries from "./queries/toolQueries";

import type React from "react";
import type { ComponentFixture } from "@angular/core/testing";

const customQueries = {
  ...queries,
  ...toolQueries,
};

type BoundQueries = {
  [K in keyof typeof customQueries]: typeof customQueries[K] extends (
    container: HTMLElement,
    ...args: infer A
  ) => infer R
    ? (...args: A) => R
    : never;
};

export type RenderResult = BoundQueries & {
  container: HTMLElement;
  baseElement: HTMLElement;
  debug: (el?: HTMLElement) => void;
  unmount: () => void;
  rerender: (ui: React.ReactElement) => void;
};

// defaults restored for props a rerender no longer passes
const INPUT_DEFAULTS: Record<string, unknown> = {
  handleKeyboardGlobally: false,
  autoFocus: false,
  viewModeEnabled: undefined,
  activeTool: null,
  onExcalidrawAPI: null,
  imageOptions: null,
  initialData: null,
  initialState: null,
};

/**
 * Runs a state-mutating callback and flushes Angular change detection,
 * standing in for React Testing Library's `act`.
 */
export const act = <T>(cb: () => T): T => {
  const result = cb();
  if (result instanceof Promise) {
    return result.then((value) => {
      GlobalTestState.fixture?.detectChanges();
      return value;
    }) as T;
  }
  GlobalTestState.fixture?.detectChanges();
  return result;
};

/**
 * Test bodies sometimes wrap <Excalidraw> in extra host markup — resolve the
 * editor element's props wherever it sits in the JSX tree.
 */
const findEditorProps = (ui: unknown): Record<string, unknown> | null => {
  if (ui == null || typeof ui !== "object") {
    return null;
  }
  const element = ui as {
    type?: unknown;
    props?: Record<string, unknown> & { children?: unknown };
  };
  if (typeof element.type === "function") {
    return element.props ?? null;
  }
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findEditorProps(child);
    if (found) {
      return found;
    }
  }
  return null;
};

export const unmountComponent = () => {
  if (GlobalTestState.fixture) {
    GlobalTestState.fixture.destroy();
    GlobalTestState.fixture = null!;
  }
  TestBed.resetTestingModule();
};

const render = async (
  ui: React.ReactElement,
  _options?: Record<string, unknown>,
): Promise<RenderResult> => {
  // when tests reuse Pointer instances let's reset the last
  // pointer poisitions so there's no leak between tests
  Pointer.resetAll();

  unmountComponent();

  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(CaliburnEditorComponent);
  GlobalTestState.fixture = fixture;

  const props: Record<string, unknown> = findEditorProps(ui) ?? {};
  for (const [key, value] of Object.entries(props)) {
    if (key === "children") {
      continue;
    }
    try {
      fixture.componentRef.setInput(key, value);
    } catch {
      // ported tests pass props the stub editor doesn't declare yet;
      // they become inputs as their slices land
    }
  }

  fixture.detectChanges();
  await fixture.whenStable();

  const container = fixture.nativeElement as HTMLElement;

  let lastProps = props;

  const rerender = (nextUi: React.ReactElement) => {
    const nextProps: Record<string, unknown> = findEditorProps(nextUi) ?? {};
    for (const key of Object.keys(lastProps)) {
      if (key === "children" || key in nextProps) {
        continue;
      }
      try {
        fixture.componentRef.setInput(key, INPUT_DEFAULTS[key] ?? null);
      } catch {
        // undeclared prop
      }
    }
    for (const [key, value] of Object.entries(nextProps)) {
      if (key === "children") {
        continue;
      }
      try {
        fixture.componentRef.setInput(key, value);
      } catch {
        // undeclared prop
      }
    }
    lastProps = nextProps;
    fixture.detectChanges();
  };

  const renderResult: RenderResult = {
    container,
    baseElement: document.body,
    ...(getQueriesForElement(container, customQueries) as BoundQueries),
    debug: (el = container) => console.info(prettyDOM(el)),
    unmount: unmountComponent,
    rerender,
  };

  GlobalTestState.renderResult = renderResult;

  Object.defineProperty(GlobalTestState, "canvas", {
    configurable: true,
    get() {
      return container.querySelector("canvas.static")!;
    },
  });

  Object.defineProperty(GlobalTestState, "interactiveCanvas", {
    configurable: true,
    get() {
      return container.querySelector("canvas.interactive")!;
    },
  });

  await waitFor(() => {
    const canvas = container.querySelector("canvas.static");
    if (!canvas) {
      throw new Error("not initialized yet");
    }

    const interactiveCanvas = container.querySelector("canvas.interactive");
    if (!interactiveCanvas) {
      throw new Error("not initialized yet");
    }

    if (h.state.isLoading) {
      throw new Error("still loading");
    }
  });

  return renderResult;
};

// re-export everything
export * from "@testing-library/dom";

// override render method
export { render };

/**
 * For state-sharing across test helpers.
 * NOTE: there shouldn't be concurrency issues as each test is running in its
 *  own process and thus gets its own instance of this module when running
 *  tests in parallel.
 */
export class GlobalTestState {
  /**
   * automatically updated on each call to render()
   */
  static renderResult: RenderResult = null!;
  /**
   * the Angular fixture of the currently rendered editor
   */
  static fixture: ComponentFixture<CaliburnEditorComponent> = null!;
  /**
   * retrieves static canvas for currently rendered app instance
   */
  static get canvas(): HTMLCanvasElement {
    return null!;
  }
  /**
   * retrieves interactive canvas for currently rendered app instance
   */
  static get interactiveCanvas(): HTMLCanvasElement {
    return null!;
  }
}

const originalGetBoundingClientRect =
  global.window.HTMLDivElement.prototype.getBoundingClientRect;

export const mockBoundingClientRect = (
  {
    top = 0,
    left = 0,
    bottom = 0,
    right = 0,
    width = 1920,
    height = 1080,
    x = 0,
    y = 0,
    toJSON = () => {},
  } = {
    top: 10,
    left: 20,
    bottom: 10,
    right: 10,
    width: 200,
    x: 10,
    y: 20,
    height: 100,
  },
) => {
  // override getBoundingClientRect as by default it will always return all values as 0 even if customized in html
  global.window.HTMLDivElement.prototype.getBoundingClientRect = () => ({
    top,
    left,
    bottom,
    right,
    width,
    height,
    x,
    y,
    toJSON,
  });
};

export const withExcalidrawDimensions = async (
  dimensions: { width: number; height: number },
  cb: () => void,
) => {
  mockBoundingClientRect(dimensions);
  act(() => {
    h.app.refreshEditorInterface();
    h.app.refresh();
  });

  await cb();

  restoreOriginalGetBoundingClientRect();
  act(() => {
    h.app.refreshEditorInterface();
    h.app.refresh();
  });
};

export const restoreOriginalGetBoundingClientRect = () => {
  global.window.HTMLDivElement.prototype.getBoundingClientRect =
    originalGetBoundingClientRect;
};

export const assertSelectedElements = (
  ...elements: (
    | (ExcalidrawElement["id"] | ExcalidrawElement)[]
    | ExcalidrawElement["id"]
    | ExcalidrawElement
  )[]
) => {
  const selectedElementIds = getSelectedElements(
    h.app.getSceneElements(),
    h.state,
  ).map((el) => el.id);
  const ids = elements
    .flat()
    .map((item) => (typeof item === "string" ? item : item.id));
  expect(selectedElementIds.length).toBe(ids.length);
  expect(selectedElementIds).toEqual(expect.arrayContaining(ids));
};

export const toggleMenu = (container: HTMLElement) => {
  // open menu
  fireEvent.click(container.querySelector(".dropdown-menu-button")!);
};

export const togglePopover = (label: string) => {
  // Needed for radix-ui/react-popover as tests fail due to resize observer not being present
  (global as any).ResizeObserver = class ResizeObserver {
    constructor(cb: any) {
      (this as any).cb = cb;
    }

    observe() {}

    unobserve() {}
    disconnect() {}
  };

  UI.clickLabeledElement(label);
};

expect.extend({
  toBeNonNaNNumber(received) {
    const pass = typeof received === "number" && !isNaN(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a non-NaN number`,
        pass: true,
      };
    }
    return {
      message: () => `expected ${received} to be a non-NaN number`,
      pass: false,
    };
  },
});

/**
 * Serializer for IEE754 float pointing numbers to avoid random failures due to tiny precision differences
 */
expect.addSnapshotSerializer({
  serialize(val, config, indentation, depth, refs, printer) {
    return printer(val.toFixed(5), config, indentation, depth, refs);
  },
  test(val) {
    return (
      typeof val === "number" &&
      Number.isFinite(val) &&
      !Number.isNaN(val) &&
      !Number.isInteger(val)
    );
  },
});

export const getCloneByOrigId = <T extends boolean = false>(
  origId: ExcalidrawElement["id"],
  returnNullIfNotExists: T = false as T,
): T extends true ? ExcalidrawElement | null : ExcalidrawElement => {
  const clonedElement = h.elements?.find(
    (el) => (el as any)[ORIG_ID] === origId,
  );
  if (clonedElement) {
    return clonedElement;
  }
  if (returnNullIfNotExists !== true) {
    throw new Error(`cloned element not found for origId: ${origId}`);
  }
  return null as T extends true ? ExcalidrawElement | null : ExcalidrawElement;
};

/**
 * Assertion helper that strips the actual elements of extra attributes
 * so that diffs are easier to read in case of failure.
 *
 * Asserts element order as well, and selected element ids
 * (when `selected: true` set for given element).
 *
 * If testing cloned elements, you can use { `[ORIG_ID]: origElement.id }
 * If you need to refer to cloned element properties, you can use
 * `getCloneByOrigId()`, e.g.: `{ frameId: getCloneByOrigId(origFrame.id)?.id }`
 */
export const assertElements = <T extends AllPossibleKeys<ExcalidrawElement>>(
  actualElements: readonly ExcalidrawElement[],
  /** array order matters */
  expectedElements: (Partial<Record<T, any>> & {
    /** meta, will be stripped for element attribute checks */
    selected?: true;
  } & (
      | {
          id: ExcalidrawElement["id"];
        }
      | { [ORIG_ID]?: string }
    ))[],
) => {
  const expectedElementsWithIds: (typeof expectedElements[number] & {
    id: ExcalidrawElement["id"];
  })[] = expectedElements.map((el) => {
    if ("id" in el) {
      return el;
    }
    const actualElement = actualElements.find(
      (act) => (act as any)[ORIG_ID] === el[ORIG_ID],
    );
    if (actualElement) {
      return { ...el, id: actualElement.id };
    }
    return {
      ...el,
      id: "UNKNOWN_ID",
    };
  });

  const map_expectedElements = arrayToMap(expectedElementsWithIds);

  const selectedElementIds = expectedElementsWithIds.reduce(
    (acc: Record<ExcalidrawElement["id"], true>, el) => {
      if (el.selected) {
        acc[el.id] = true;
      }
      return acc;
    },
    {},
  );

  const mappedActualElements = actualElements.map((el) => {
    const expectedElement = map_expectedElements.get(el.id);
    if (expectedElement) {
      const pickedAttrs: Record<string, any> = {};

      for (const key of Object.keys(expectedElement)) {
        if (key === "selected") {
          delete expectedElement.selected;
          continue;
        }
        pickedAttrs[key] = (el as any)[key];
      }

      if (ORIG_ID in expectedElement) {
        // @ts-ignore
        pickedAttrs[ORIG_ID] = (el as any)[ORIG_ID];
      }

      return pickedAttrs;
    }
    return el;
  });

  try {
    // testing order separately for even easier diffs
    expect(actualElements.map((x) => x.id)).toEqual(
      expectedElementsWithIds.map((x) => x.id),
    );
  } catch (err: any) {
    let errStr = "\n\nmismatched element order\n\n";

    errStr += `actual:   ${ansi.lightGray(
      `[${err.actual
        .map((id: string, index: number) => {
          const act = actualElements[index];

          return `${
            id === err.expected[index] ? ansi.green(id) : ansi.red(id)
          } (${act.type.slice(0, 4)}${
            ORIG_ID in act ? ` ↳ ${(act as any)[ORIG_ID]}` : ""
          })`;
        })
        .join(", ")}]`,
    )}\n${ansi.lightGray(
      `expected: [${err.expected
        .map((exp: string, index: number) => {
          const expEl = actualElements.find((el) => el.id === exp);
          const origEl =
            expEl &&
            actualElements.find((el) => el.id === (expEl as any)[ORIG_ID]);
          return expEl
            ? `${
                exp === err.actual[index]
                  ? ansi.green(expEl.id)
                  : ansi.red(expEl.id)
              } (${expEl.type.slice(0, 4)}${origEl ? ` ↳ ${origEl.id}` : ""})`
            : exp;
        })
        .join(", ")}]\n`,
    )}`;

    throw trimErrorStack(new Error(errStr), 1);
  }

  expect(mappedActualElements).toEqual(
    expect.arrayContaining(expectedElementsWithIds),
  );

  expect(h.state.selectedElementIds).toEqual(selectedElementIds);
};

const stripProps = (
  deltas: Record<string, { deleted: any; inserted: any }>,
  props: string[],
) =>
  Object.entries(deltas).reduce((acc, curr) => {
    const { inserted, deleted, ...rest } = curr[1];

    for (const prop of props) {
      delete inserted[prop];
      delete deleted[prop];
    }

    acc[curr[0]] = {
      inserted,
      deleted,
      ...rest,
    };

    return acc;
  }, {} as Record<string, any>);

export const checkpointHistory = (history: History, name: string) => {
  expect(
    history.undoStack.map((x) => ({
      ...x,
      elements: {
        ...x.elements,
        added: stripProps(x.elements.added, ["seed", "versionNonce"]),
        removed: stripProps(x.elements.removed, ["seed", "versionNonce"]),
        updated: stripProps(x.elements.updated, ["seed", "versionNonce"]),
      },
    })),
  ).toMatchSnapshot(`[${name}] undo stack`);

  expect(
    history.redoStack.map((x) => ({
      ...x,
      elements: {
        ...x.elements,
        added: stripProps(x.elements.added, ["seed", "versionNonce"]),
        removed: stripProps(x.elements.removed, ["seed", "versionNonce"]),
        updated: stripProps(x.elements.updated, ["seed", "versionNonce"]),
      },
    })),
  ).toMatchSnapshot(`[${name}] redo stack`);
};

/**
 * removes one or more leading stack trace lines (leading to files) from the
 * error stack trace
 */
export const trimErrorStack = (error: Error, range = 1) => {
  const stack = error.stack?.split("\n");
  if (stack) {
    stack.splice(1, range);
    error.stack = stack.join("\n");
  }
  return error;
};

export const stripIgnoredNodesFromErrorMessage = (error: Error) => {
  error.message = error.message.replace(/\s+Ignored nodes:[\s\S]+/, "");
  return error;
};
