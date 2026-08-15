import "pepjs";
import {
  getQueriesForElement,
  prettyDOM,
  queries,
  waitFor,
} from "@testing-library/dom";

import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { h } from "../../packages/caliburn/src/index";
import { Pointer } from "../../packages/caliburn/tests/helpers/ui";
import * as toolQueries from "../../packages/caliburn/tests/queries/toolQueries";
import { GlobalTestState as EditorTestState } from "../../packages/caliburn/tests/test-utils";
import { CaliburnAppComponent } from "../src/app.component";

import type { ComponentFixture } from "@angular/core/testing";

/**
 * The app's rendering harness — `packages/caliburn/tests/test-utils.ts`'s,
 * except that it mounts the app shell (upstream's `<ExcalidrawApp />`) rather
 * than the bare editor, so ported app tests keep their bodies.
 */
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
};

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

export const unmountComponent = () => {
  if (GlobalTestState.fixture) {
    GlobalTestState.fixture.destroy();
    GlobalTestState.fixture = null!;
  }
  TestBed.resetTestingModule();
};

export const render = async (): Promise<RenderResult> => {
  // when tests reuse Pointer instances let's reset the last
  // pointer poisitions so there's no leak between tests
  Pointer.resetAll();

  unmountComponent();

  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(CaliburnAppComponent);
  GlobalTestState.fixture = fixture;

  fixture.detectChanges();
  await fixture.whenStable();

  const container = fixture.nativeElement as HTMLElement;

  const renderResult: RenderResult = {
    container,
    baseElement: document.body,
    ...(getQueriesForElement(container, customQueries) as BoundQueries),
    debug: (el = container) => console.info(prettyDOM(el)),
    unmount: unmountComponent,
  };

  GlobalTestState.renderResult = renderResult;

  // the editor's own helpers (`UI`, `Pointer`, `act`) drive whatever the
  // editor harness last rendered — point them at the app's fixture
  EditorTestState.renderResult = renderResult as never;
  EditorTestState.fixture = fixture as never;

  Object.defineProperty(EditorTestState, "canvas", {
    configurable: true,
    get() {
      return container.querySelector("canvas.static")!;
    },
  });

  Object.defineProperty(EditorTestState, "interactiveCanvas", {
    configurable: true,
    get() {
      return container.querySelector("canvas.interactive")!;
    },
  });

  await waitFor(() => {
    if (!container.querySelector("canvas.static")) {
      throw new Error("not initialized yet");
    }
    if (!h.app) {
      throw new Error("editor not mounted yet");
    }
    if (h.state.isLoading) {
      throw new Error("still loading");
    }
  });

  return renderResult;
};

export * from "@testing-library/dom";

export class GlobalTestState {
  static renderResult: RenderResult = null!;
  static fixture: ComponentFixture<CaliburnAppComponent> = null!;
}
