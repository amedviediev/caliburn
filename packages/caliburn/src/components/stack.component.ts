import { ChangeDetectionStrategy, Component, input } from "@angular/core";

type StackAlign = "start" | "center" | "end" | "baseline";
type StackJustify = "center" | "space-around" | "space-between";

/**
 * Angular port of upstream `Stack.tsx`'s `Stack.Row`. Host-bound (no
 * wrapper element) so the rendered DOM is exactly `.Stack.Stack_horizontal`.
 */
@Component({
  selector: "caliburn-stack-row",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "Stack Stack_horizontal",
    "[style.--gap]": "gap()",
    "[style.align-items]": "align()",
    "[style.justify-content]": "justifyContent()",
  },
  template: `<ng-content />`,
})
export class CaliburnStackRowComponent {
  readonly gap = input<number>();
  readonly align = input<StackAlign>();
  readonly justifyContent = input<StackJustify>();
}

/**
 * Angular port of upstream `Stack.tsx`'s `Stack.Col`. Host-bound (no
 * wrapper element) so the rendered DOM is exactly `.Stack.Stack_vertical`.
 */
@Component({
  selector: "caliburn-stack-col",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "Stack Stack_vertical",
    "[style.--gap]": "gap()",
    "[style.justify-items]": "align()",
    "[style.justify-content]": "justifyContent()",
  },
  template: `<ng-content />`,
})
export class CaliburnStackColComponent {
  readonly gap = input<number>();
  readonly align = input<StackAlign>();
  readonly justifyContent = input<StackJustify>();
}
