import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from "@angular/core";

import { appStateValue } from "../../src/app-state-value";
import { CaliburnEditorComponent } from "../../src/editor.component";

/**
 * Consumer for the `appStateValue()` suite: it subscribes in its field
 * initializers (the injection context the helper needs) and counts how often
 * a downstream `computed` has to re-evaluate — the Angular counterpart of the
 * React render count the vendored hook test asserts on.
 *
 * Lives in a `.ts` module rather than in the test file because only `.ts`
 * goes through the Angular compiler in this project.
 */
@Component({
  selector: "caliburn-test-app-state-value-consumer",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
export class CaliburnAppStateValueConsumerComponent {
  readonly viewMode = appStateValue("viewModeEnabled");
  readonly modes = appStateValue(["zenModeEnabled", "gridModeEnabled"]);
  readonly zoom = appStateValue((state) => state.zoom.value);

  evaluations = 0;
  readonly derivedViewMode = computed(() => {
    this.evaluations++;
    return this.viewMode();
  });

  /** the same counter over the array form, whose value is the whole appState
   * — a fresh object on every commit, so a subscription that woke on more
   * than the listed props would show up here even though signal equality
   * hides it on the single-prop form above */
  modeEvaluations = 0;
  readonly derivedModes = computed(() => {
    this.modeEvaluations++;
    return this.modes();
  });
}

/** the editor with the consumer projected into it, so the consumer's injector
 * reaches the editor the way a host app's projected content does */
@Component({
  selector: "caliburn-test-app-state-value-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnEditorComponent, CaliburnAppStateValueConsumerComponent],
  template: `<caliburn-editor>
    @if (showConsumer()) {
      <caliburn-test-app-state-value-consumer />
    }
  </caliburn-editor>`,
})
export class CaliburnAppStateValueHostComponent {
  readonly showConsumer = input(true);
  readonly consumer = viewChild(CaliburnAppStateValueConsumerComponent);
}
