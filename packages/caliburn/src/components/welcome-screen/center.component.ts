import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * Angular port of upstream `welcome-screen/WelcomeScreen.Center.tsx`'s
 * `Center`. Host-bound (no wrapper element) so the rendered DOM is exactly
 * `.welcome-screen-center` — a `display: flex; flex-direction: column; gap:
 * 2rem` box whose projected `Logo`/`Heading`/`Menu` must be its direct
 * children for that gap to apply. The tunnel upstream renders this through
 * has no Angular equivalent (see `layer-ui.component.ts`); this component is
 * placed directly at the mount point instead.
 *
 * Upstream falls back to its own default children (`Logo`/`Heading`/`Menu`
 * with `MenuItemLoadScene`/`MenuItemHelp`) when used with none — caliburn has
 * a single call site for now (`layer-ui.component.html`), which composes that
 * default content explicitly rather than detecting "no projected content" (no
 * clean Angular equivalent of `children || <default/>`, see `Section`'s
 * render-function-form gap for the same reasoning).
 */
@Component({
  selector: "caliburn-welcome-screen-center",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "welcome-screen-center",
  },
  templateUrl: "./center.component.html",
})
export class CaliburnWelcomeScreenCenterComponent {}
