import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

// for open-color see https://github.com/yeun/open-color/blob/master/open-color.scss
const COLOR_MAP = {
  primary: {
    base: "var(--color-primary)",
    darker: "var(--color-primary-darker)",
    darkest: "var(--color-primary-darkest)",
  },
  lime: {
    base: "#74b816", // open-color lime[7]
    darker: "#66a80f", // open-color lime[8]
    darkest: "#5c940d", // open-color lime[9]
  },
  pink: {
    base: "#d6336c", // open-color pink[7]
    darker: "#c2255c", // open-color pink[8]
    darkest: "#a61e4d", // open-color pink[9]
  },
};

export type CardColor = keyof typeof COLOR_MAP;

/**
 * Angular port of upstream `Card.tsx`. Host-bound (no wrapper element) so the
 * rendered DOM root is exactly `.Card`.
 */
@Component({
  selector: "caliburn-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "Card",
    "[style]": "hostStyle()",
  },
  templateUrl: "./card.component.html",
})
export class CaliburnCardComponent {
  readonly color = input.required<CardColor>();

  readonly hostStyle = computed(() => {
    const colors = COLOR_MAP[this.color()];
    return `--card-color: ${colors.base}; --card-color-darker: ${colors.darker}; --card-color-darkest: ${colors.darkest};`;
  });
}
