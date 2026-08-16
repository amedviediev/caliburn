import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewContainerRef,
  effect,
  forwardRef,
  inject,
  input,
  inputBinding,
  output,
  outputBinding,
  signal,
  viewChild,
} from "@angular/core";

import { KEYS } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../../editor.component";
import { CaliburnSpinnerComponent } from "../spinner.component";

import type { ComponentRef, ElementRef, Type } from "@angular/core";

import type { CaliburnEditorComponent } from "../../editor.component";

import type { CaliburnCodeMirrorEditorComponent } from "./code-mirror-editor.component";

const SPINNER_DELAY_MS = 300;

/**
 * Angular port of upstream `TTDDialog/TTDDialogInput.tsx`: the mermaid tab's
 * text input, which lazily loads the CodeMirror editor and falls back to a
 * plain `<textarea>` if that chunk fails to load.
 *
 * The three-state contract is upstream's, verbatim in behaviour — `loading`
 * renders nothing for the first {@link SPINNER_DELAY_MS}, then a spinner;
 * `ready` renders the editor; `fallback` renders the textarea, focuses it and
 * binds `CtrlOrCmd+Enter` to submit. The dynamic `import()` keeps
 * `@codemirror/*` + `@lezer/highlight` out of the main bundle exactly as
 * upstream's does.
 *
 * Deviations, all forced by the port boundary:
 *
 * - upstream's lazy value is a React component type rendered as
 *   `<CodeMirrorEditor …/>`; Angular has no equivalent of "render a component
 *   value", so the loaded class is instantiated through `ViewContainerRef.
 *   createComponent` with `inputBinding`/`outputBinding` — the bindings are
 *   reactive getters, so the props stay live the way JSX's would.
 * - upstream reads the theme from `useUIAppState()`; caliburn reads the same
 *   `appState.theme` off the injected editor, the established equivalent.
 * - the fallback's `CtrlOrCmd+Enter` handler is a template `(keydown)`
 *   binding rather than an imperatively-added listener; the guard is
 *   upstream's.
 */
@Component({
  selector: "caliburn-ttd-dialog-input",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnSpinnerComponent],
  templateUrl: "./ttd-dialog-input.component.html",
})
export class CaliburnTTDDialogInputComponent {
  readonly value = input("");
  readonly placeholder = input<string>();
  readonly errorLine = input<number | null>(null);

  readonly valueChange = output<string>();
  readonly keyboardSubmit = output<void>();

  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  protected readonly editorState = signal<"loading" | "ready" | "fallback">(
    "loading",
  );
  protected readonly showSpinner = signal(false);

  private readonly editorComponent =
    signal<Type<CaliburnCodeMirrorEditorComponent> | null>(null);
  private readonly editorHost = viewChild("editorHost", {
    read: ViewContainerRef,
  });
  private readonly textarea =
    viewChild<ElementRef<HTMLTextAreaElement>>("textarea");
  private editorRef: ComponentRef<CaliburnCodeMirrorEditorComponent> | null =
    null;

  constructor() {
    const spinnerTimer = window.setTimeout(() => {
      this.showSpinner.set(true);
    }, SPINNER_DELAY_MS);
    // upstream's mount effect clears the same timer from its cleanup
    inject(DestroyRef).onDestroy(() => window.clearTimeout(spinnerTimer));

    import("./code-mirror-editor.component")
      .then((mod) => {
        this.editorComponent.set(mod.CaliburnCodeMirrorEditorComponent);
      })
      .catch(() => {
        this.editorState.set("fallback");
      })
      .finally(() => {
        window.clearTimeout(spinnerTimer);
      });

    effect(() => this.mountEditor());

    // keyboard shortcut + focus for textarea fallback
    effect(() => {
      if (this.editorState() !== "fallback") {
        return;
      }
      this.textarea()?.nativeElement.focus();
    });
  }

  protected theme(): Theme {
    this.editor.changeGeneration();
    return this.editor.state.theme;
  }

  protected onTextChange(value: string) {
    this.valueChange.emit(value);
  }

  protected onKeyDown(event: KeyboardEvent) {
    if (event[KEYS.CTRL_OR_CMD] && event.key === KEYS.ENTER) {
      event.preventDefault();
      this.keyboardSubmit.emit();
    }
  }

  private mountEditor() {
    const component = this.editorComponent();
    const host = this.editorHost();

    if (!component || !host || this.editorRef) {
      return;
    }

    this.editorRef = host.createComponent(component, {
      bindings: [
        inputBinding("value", () => this.value()),
        inputBinding("placeholder", () => this.placeholder()),
        inputBinding("theme", () => this.theme()),
        inputBinding("errorLine", () => this.errorLine()),
        outputBinding<string>("valueChange", (next) =>
          this.valueChange.emit(next),
        ),
        outputBinding<void>("keyboardSubmit", () => this.keyboardSubmit.emit()),
      ],
    });
    this.editorState.set("ready");
  }
}
