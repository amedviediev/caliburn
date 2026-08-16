import { vi } from "vitest";

import {
  Component,
  provideZonelessChangeDetection,
  signal,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { provideCaliburnIcons } from "../src/components/icons";

import { CaliburnButtonComponent } from "../src/components/button.component";
import { CaliburnButtonSeparatorComponent } from "../src/components/button-separator.component";
import { CaliburnDialogComponent } from "../src/components/dialog.component";
import {
  CaliburnDropdownMenuItemBadgeComponent,
  CaliburnDropdownMenuItemComponent,
} from "../src/components/dropdown-menu/dropdown-menu-item.component";
import { CaliburnDropdownMenuContentComponent } from "../src/components/dropdown-menu/dropdown-menu-content.component";
import { CaliburnDropdownMenuGroupComponent } from "../src/components/dropdown-menu/dropdown-menu-group.component";
import { CaliburnDropdownMenuItemCustomComponent } from "../src/components/dropdown-menu/dropdown-menu-item-custom.component";
import { CaliburnDropdownMenuSeparatorComponent } from "../src/components/dropdown-menu/dropdown-menu-separator.component";
import { CaliburnDropdownMenuTriggerComponent } from "../src/components/dropdown-menu/dropdown-menu-trigger.component";
import { CaliburnDropdownMenuComponent } from "../src/components/dropdown-menu/dropdown-menu.component";
import { CaliburnFilledButtonComponent } from "../src/components/filled-button.component";
import { CaliburnFixedSideContainerComponent } from "../src/components/fixed-side-container.component";
import { CaliburnIconButtonComponent } from "../src/components/icon-button.component";
import { CaliburnIslandComponent } from "../src/components/island.component";
import { CaliburnModalComponent } from "../src/components/modal.component";
import { CaliburnRadioGroupComponent } from "../src/components/radio-group.component";
import { CaliburnSectionComponent } from "../src/components/section.component";
import {
  CaliburnStackColComponent,
  CaliburnStackRowComponent,
} from "../src/components/stack.component";
import { CaliburnTooltipComponent } from "../src/components/tooltip.component";
import { CaliburnWelcomeScreenMenuItemLiveCollaborationTriggerComponent } from "../src/components/welcome-screen/menu-item-live-collaboration-trigger.component";
import { CaliburnWelcomeScreenMenuItemLinkComponent } from "../src/components/welcome-screen/menu-item-link.component";

function createComponent<T>(type: new (...args: any[]) => T) {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideCaliburnIcons()],
  });
  return TestBed.createComponent(type);
}

/**
 * `caliburn-modal` relocates itself into the body-level
 * `.excalidraw-modal-container` portal (`createPortalContainer`), so modal DOM
 * no longer sits under the fixture's own element.
 */
const inPortal = <T extends Element = HTMLElement>(selector: string): T =>
  document.querySelector<T>(`.excalidraw-modal-container ${selector}`)!;

describe("caliburn-island", () => {
  @Component({
    selector: "island-host",
    imports: [CaliburnIslandComponent],
    template: `
      <caliburn-island
        class="dropdown-menu-container"
        [padding]="2"
        [viewportUi]="'side'"
        [viewportUiName]="'stylesPanel'"
      >
        <span>content</span>
      </caliburn-island>
    `,
  })
  class IslandHost {}

  it("renders .Island with merged class, padding var and viewport-ui attrs", async () => {
    const fixture = createComponent(IslandHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const el: HTMLElement =
      fixture.nativeElement.querySelector("caliburn-island");
    expect(el.classList.contains("Island")).toBe(true);
    expect(el.classList.contains("dropdown-menu-container")).toBe(true);
    expect(el.style.getPropertyValue("--padding")).toBe("2");
    expect(el.getAttribute("data-viewport-ui")).toBe("side");
    expect(el.getAttribute("data-viewport-ui-name")).toBe("stylesPanel");
    expect(el.querySelector("span")?.textContent).toBe("content");
  });
});

describe("caliburn-stack-row / caliburn-stack-col", () => {
  @Component({
    selector: "stack-host",
    imports: [CaliburnStackRowComponent, CaliburnStackColComponent],
    template: `
      <caliburn-stack-row [gap]="2" align="center">
        <span>row</span>
      </caliburn-stack-row>
      <caliburn-stack-col [gap]="1">
        <span>col</span>
      </caliburn-stack-col>
    `,
  })
  class StackHost {}

  it("renders Stack/Stack_horizontal and Stack/Stack_vertical with --gap", async () => {
    const fixture = createComponent(StackHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const row: HTMLElement =
      fixture.nativeElement.querySelector("caliburn-stack-row");
    const col: HTMLElement =
      fixture.nativeElement.querySelector("caliburn-stack-col");

    expect(row.classList.contains("Stack")).toBe(true);
    expect(row.classList.contains("Stack_horizontal")).toBe(true);
    expect(row.style.getPropertyValue("--gap")).toBe("2");
    expect(row.style.alignItems).toBe("center");

    expect(col.classList.contains("Stack")).toBe(true);
    expect(col.classList.contains("Stack_vertical")).toBe(true);
    expect(col.style.getPropertyValue("--gap")).toBe("1");
  });
});

describe("caliburn-fixed-side-container", () => {
  @Component({
    selector: "fsc-host",
    imports: [CaliburnFixedSideContainerComponent],
    template: `<caliburn-fixed-side-container side="top" />`,
  })
  class FscHost {}

  it("renders .FixedSideContainer.FixedSideContainer_side_top", async () => {
    const fixture = createComponent(FscHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const el: HTMLElement = fixture.nativeElement.querySelector(
      "caliburn-fixed-side-container",
    );
    expect(el.classList.contains("FixedSideContainer")).toBe(true);
    expect(el.classList.contains("FixedSideContainer_side_top")).toBe(true);
  });
});

describe("caliburn-section", () => {
  @Component({
    selector: "section-host",
    imports: [CaliburnSectionComponent],
    template: `
      <section
        caliburn-section
        heading="selectedShapeActions"
        class="selected-shape-actions"
      >
        <span>body</span>
      </section>
    `,
  })
  class SectionHost {}

  it("is a wrapper-less attribute-selector component: no <caliburn-section> tag", async () => {
    const fixture = createComponent(SectionHost);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector("caliburn-section")).toBeNull();
    expect(fixture.nativeElement.children[0].tagName).toBe("SECTION");
  });

  it("labels the <section> via aria-labelledby matching the hidden <h2>'s id", async () => {
    const fixture = createComponent(SectionHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const section = fixture.nativeElement.querySelector("section")!;
    const h2 = fixture.nativeElement.querySelector("h2")!;

    expect(section.classList.contains("selected-shape-actions")).toBe(true);
    expect(h2.classList.contains("visually-hidden")).toBe(true);
    expect(section.getAttribute("aria-labelledby")).toBe(h2.getAttribute("id"));
    expect(section.querySelector("span")?.textContent).toBe("body");
  });
});

describe("caliburn-icon-button", () => {
  @Component({
    selector: "toggle-host",
    imports: [CaliburnIconButtonComponent],
    template: `
      <button
        caliburn-icon-button
        [mode]="'toggle'"
        class="fillable"
        [icon]="'selectionIcon'"
        ariaLabel="Selection"
        keyBindingLabel="V"
        [checked]="checked()"
        [testId]="'toolbar-selection'"
        (select)="onSelect($event)"
      ></button>
    `,
  })
  class ToggleHost {
    readonly checked = signal(false);
    lastPointerType: string | null | undefined;
    onSelect(event: { pointerType: string | null }) {
      this.checked.set(!this.checked());
      this.lastPointerType = event.pointerType;
    }
  }

  it("is a wrapper-less attribute-selector component: the real <button> is the direct child, no <caliburn-icon-button> tag", async () => {
    const fixture = createComponent(ToggleHost);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector("caliburn-icon-button"),
    ).toBeNull();
    expect(fixture.nativeElement.children[0].tagName).toBe("BUTTON");
  });

  it("renders tool-button radio semantics: aria-pressed + ToolIcon--checked toggle on select", async () => {
    const fixture = createComponent(ToggleHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector("button");
    expect(button.classList.contains("ToolIcon")).toBe(true);
    expect(button.classList.contains("ToolIcon_type_toggle")).toBe(true);
    expect(button.classList.contains("fillable")).toBe(true);
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Selection");
    expect(button.getAttribute("data-testid")).toBe("toolbar-selection");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.classList.contains("ToolIcon--checked")).toBe(false);
    expect(button.querySelector(".ToolIcon__keybinding")?.textContent).toBe(
      "V",
    );

    const pointerDown = new Event("pointerdown");
    Object.assign(pointerDown, { pointerType: "mouse" });
    button.dispatchEvent(pointerDown);
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.classList.contains("ToolIcon--checked")).toBe(true);
    expect(fixture.componentInstance.lastPointerType).toBe("mouse");
  });

  @Component({
    selector: "button-host",
    imports: [CaliburnIconButtonComponent],
    template: `
      <button
        caliburn-icon-button
        [mode]="'button'"
        [icon]="'trashIcon'"
        ariaLabel="Delete"
        [testId]="'delete-btn'"
        [onClick]="clickHandler"
        [showAriaLabel]="true"
      ></button>
    `,
  })
  class ButtonHost {
    resolveClick!: () => void;
    clickHandler = () =>
      new Promise<void>((resolve) => {
        this.resolveClick = resolve;
      });
  }

  it("mode button/icon: async onClick disables the button and shows the label-row spinner until resolved", async () => {
    const fixture = createComponent(ButtonHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector("button");
    expect(button.classList.contains("ToolIcon_type_button")).toBe(true);
    expect(button.getAttribute("data-testid")).toBe("delete-btn");
    expect(button.querySelector("caliburn-spinner")).toBeNull();

    button.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(button.disabled).toBe(true);
    expect(
      button.querySelector(".ToolIcon__label caliburn-spinner svg"),
    ).not.toBeNull();

    fixture.componentInstance.resolveClick();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(button.disabled).toBe(false);
    expect(button.querySelector("caliburn-spinner")).toBeNull();
  });

  @Component({
    selector: "external-loading-host",
    imports: [CaliburnIconButtonComponent],
    template: `
      <button
        caliburn-icon-button
        [mode]="'icon'"
        [icon]="'trashIcon'"
        ariaLabel="Delete"
        [isLoading]="true"
      ></button>
    `,
  })
  class ExternalLoadingHost {}

  it("the external isLoading input shows the icon-row spinner (upstream: distinct from the internal async-click state)", async () => {
    const fixture = createComponent(ExternalLoadingHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector("button");
    expect(button.classList.contains("ToolIcon--plain")).toBe(true);
    expect(
      button.querySelector(".ToolIcon__icon caliburn-spinner svg"),
    ).not.toBeNull();
  });
});

describe("caliburn-button", () => {
  @Component({
    selector: "excalidraw-button-host",
    imports: [CaliburnButtonComponent],
    template: `
      <button
        caliburn-button
        [selected]="selected()"
        [testId]="'sidebar-dock'"
        [ariaLabel]="'Pin sidebar'"
        (select)="onSelect()"
      >
        Click me
      </button>
    `,
  })
  class ExcalidrawButtonHost {
    readonly selected = signal(false);
    selectCount = 0;
    onSelect() {
      this.selectCount++;
    }
  }

  it("is a wrapper-less attribute-selector component: no <caliburn-button> tag", async () => {
    const fixture = createComponent(ExcalidrawButtonHost);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector("caliburn-button")).toBeNull();
    expect(fixture.nativeElement.children[0].tagName).toBe("BUTTON");
  });

  it("renders .excalidraw-button, toggles .selected, fires (select) on click, passes through data-testid/aria-label", async () => {
    const fixture = createComponent(ExcalidrawButtonHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector("button");
    expect(button.classList.contains("excalidraw-button")).toBe(true);
    expect(button.classList.contains("selected")).toBe(false);
    expect(button.textContent?.trim()).toBe("Click me");
    // upstream Sidebar consumers depend on these landing on the real button
    // (SidebarHeader.tsx passes data-testid="sidebar-dock"/"sidebar-close"
    // + aria-label via {...rest} prop spreading)
    expect(button.getAttribute("data-testid")).toBe("sidebar-dock");
    expect(button.getAttribute("aria-label")).toBe("Pin sidebar");

    button.click();
    expect(fixture.componentInstance.selectCount).toBe(1);

    fixture.componentInstance.selected.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(button.classList.contains("selected")).toBe(true);
  });
});

describe("caliburn-filled-button", () => {
  @Component({
    selector: "filled-button-host",
    imports: [CaliburnFilledButtonComponent],
    template: `
      <button
        caliburn-filled-button
        label="Save"
        color="primary"
        [onClick]="clickHandler"
      >
        Save
      </button>
    `,
  })
  class FilledButtonHost {
    resolveClick!: () => void;
    clickHandler = () =>
      new Promise<void>((resolve) => {
        this.resolveClick = resolve;
      });
  }

  it("is a wrapper-less attribute-selector component: no <caliburn-filled-button> tag", async () => {
    const fixture = createComponent(FilledButtonHost);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector("caliburn-filled-button"),
    ).toBeNull();
    expect(fixture.nativeElement.children[0].tagName).toBe("BUTTON");
  });

  it("renders ExcButton classes and shows a spinner while onClick's promise is pending", async () => {
    const fixture = createComponent(FilledButtonHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector("button");
    expect(button.classList.contains("ExcButton")).toBe(true);
    expect(button.classList.contains("ExcButton--color-primary")).toBe(true);
    expect(button.classList.contains("ExcButton--variant-filled")).toBe(true);
    expect(button.classList.contains("ExcButton--status-null")).toBe(true);
    expect(button.getAttribute("aria-label")).toBe("Save");

    button.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(button.classList.contains("ExcButton--status-loading")).toBe(true);
    });
    expect(button.disabled).toBe(true);

    fixture.componentInstance.resolveClick();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(button.classList.contains("ExcButton--status-null")).toBe(true);
    expect(button.disabled).toBe(false);
  });
});

describe("caliburn-button-separator", () => {
  @Component({
    selector: "separator-host",
    imports: [CaliburnButtonSeparatorComponent],
    template: `<caliburn-button-separator />`,
  })
  class SeparatorHost {}

  it("renders a 1px divider", async () => {
    const fixture = createComponent(SeparatorHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const el: HTMLElement = fixture.nativeElement.querySelector(
      "caliburn-button-separator",
    );
    expect(el.style.width).toBe("1px");
    expect(el.style.height).toBe("1rem");
  });
});

describe("caliburn-radio-group", () => {
  @Component({
    selector: "radio-group-host",
    imports: [CaliburnRadioGroupComponent],
    template: `
      <caliburn-radio-group
        name="scale"
        [value]="value()"
        [choices]="choices"
        (valueChange)="value.set($event)"
      />
    `,
  })
  class RadioGroupHost {
    readonly value = signal(1);
    readonly choices = [
      { value: 1, label: "1x", ariaLabel: "scale 1x" },
      { value: 2, label: "2x", ariaLabel: "scale 2x" },
    ];
  }

  it("renders .RadioGroup__choice per choice, marks the active one, emits valueChange", async () => {
    const fixture = createComponent(RadioGroupHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const choices = fixture.nativeElement.querySelectorAll(
      ".RadioGroup__choice",
    );
    expect(choices.length).toBe(2);
    expect(choices[0].classList.contains("active")).toBe(true);
    expect(choices[1].classList.contains("active")).toBe(false);

    const secondRadio: HTMLInputElement = choices[1].querySelector("input");
    expect(secondRadio.getAttribute("aria-label")).toBe("scale 2x");
    secondRadio.checked = true;
    secondRadio.dispatchEvent(new Event("change"));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe(2);
    expect(choices[1].classList.contains("active")).toBe(true);
  });
});

describe("caliburn-modal", () => {
  @Component({
    selector: "modal-host",
    imports: [CaliburnModalComponent],
    template: `
      @if (open()) {
      <caliburn-modal
        class="Dialog"
        [maxWidth]="800"
        labelledBy="dialog-title"
        [closeOnClickOutside]="closeOnClickOutside()"
        (closeRequest)="open.set(false)"
      >
        <div class="Dialog__content">body</div>
      </caliburn-modal>
      }
    `,
  })
  class ModalHost {
    readonly open = signal(true);
    readonly closeOnClickOutside = signal(true);
  }

  it("renders role=dialog/aria-modal/aria-labelledby and the background/content DOM", async () => {
    const fixture = createComponent(ModalHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const modal = inPortal("caliburn-modal");
    expect(modal.classList.contains("Modal")).toBe(true);
    expect(modal.classList.contains("Dialog")).toBe(true);
    expect(modal.getAttribute("role")).toBe("dialog");
    expect(modal.getAttribute("aria-modal")).toBe("true");
    expect(modal.getAttribute("aria-labelledby")).toBe("dialog-title");
    const content = modal.querySelector<HTMLElement>(".Modal__content")!;
    expect(content.style.getPropertyValue("--max-width")).toBe("800px");
    expect(modal.querySelector(".Modal__background")).not.toBeNull();
    expect(content.textContent).toBe("body");
  });

  it("closes on Escape keydown", async () => {
    const fixture = createComponent(ModalHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const modal = inPortal("caliburn-modal");
    modal.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.open()).toBe(false);
  });

  it("closes on background click when closeOnClickOutside, not when disabled", async () => {
    const fixture = createComponent(ModalHost);
    fixture.componentInstance.closeOnClickOutside.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    let background = inPortal(".Modal__background");
    background.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(true);

    fixture.componentInstance.closeOnClickOutside.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    background = inPortal(".Modal__background");
    background.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  @Component({
    selector: "modal-default-inputs-host",
    imports: [CaliburnModalComponent],
    template: `
      @if (open()) {
      <caliburn-modal
        [maxWidth]="800"
        labelledBy="dialog-title"
        (closeRequest)="open.set(false)"
      >
        content
      </caliburn-modal>
      }
    `,
  })
  class ModalDefaultInputsHost {
    readonly open = signal(true);
  }

  it("closes on background click with no closeOnClickOutside binding at all (defaults true)", async () => {
    const fixture = createComponent(ModalDefaultInputsHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const background = inPortal(".Modal__background");
    background.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });
});

describe("caliburn-dialog", () => {
  @Component({
    selector: "dialog-host",
    imports: [CaliburnDialogComponent],
    template: `
      @if (open()) {
      <caliburn-dialog
        title="My Dialog"
        [fullscreen]="fullscreen()"
        (closeRequest)="open.set(false)"
      >
        <button type="button">first</button>
        <button type="button">second</button>
      </caliburn-dialog>
      }
    `,
  })
  class DialogHost {
    readonly open = signal(true);
    readonly fullscreen = signal(false);
  }

  it("renders Dialog__title matching aria-labelledby, escape/backdrop close via the composed modal", async () => {
    const fixture = createComponent(DialogHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const modal = inPortal("caliburn-modal");
    const title = inPortal(".Dialog__title");
    expect(modal.classList.contains("Dialog")).toBe(true);
    expect(title?.querySelector(".Dialog__titleContent")?.textContent).toBe(
      "My Dialog",
    );
    expect(inPortal(".Dialog__content")).not.toBeNull();
    expect(inPortal(".Dialog__close")).toBeNull();

    modal.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it("renders a Dialog__close button only when fullscreen", async () => {
    const fixture = createComponent(DialogHost);
    fixture.componentInstance.fullscreen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const modal = inPortal("caliburn-modal");
    expect(modal.classList.contains("Dialog--fullscreen")).toBe(true);
    const closeButton = inPortal<HTMLButtonElement>(".Dialog__close");
    expect(closeButton).not.toBeNull();

    closeButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it("autofocuses the second focusable element inside the island on init", async () => {
    vi.useFakeTimers();
    const fixture = createComponent(DialogHost);
    fixture.detectChanges();
    await fixture.whenStable();
    vi.runAllTimers();
    vi.useRealTimers();

    const buttons = document.querySelectorAll(
      ".excalidraw-modal-container caliburn-island button",
    );
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("closes on backdrop click with no closeOnClickOutside binding at all (defaults true, matching Modal's own default)", async () => {
    const fixture = createComponent(DialogHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const background = inPortal(".Modal__background");
    background.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  @Component({
    selector: "dialog-class-host",
    imports: [CaliburnDialogComponent],
    template: `
      <caliburn-dialog title="Confirm" class="ConfirmDialog">
        body
      </caliburn-dialog>
    `,
  })
  class DialogClassHost {}

  it("routes a class input onto the .Modal root (ConfirmDialog.tsx/HelpDialog.tsx depend on this)", async () => {
    const fixture = createComponent(DialogClassHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const modal = inPortal("caliburn-modal");
    expect(modal.classList.contains("Modal")).toBe(true);
    expect(modal.classList.contains("Dialog")).toBe(true);
    expect(modal.classList.contains("ConfirmDialog")).toBe(true);
  });
});

describe("caliburn-tooltip", () => {
  afterEach(() => {
    document.querySelector(".excalidraw-tooltip")?.remove();
  });

  @Component({
    selector: "tooltip-host",
    imports: [CaliburnTooltipComponent],
    template: `
      <caliburn-tooltip label="Selection tool">
        <button type="button">S</button>
      </caliburn-tooltip>
    `,
  })
  class TooltipHost {}

  it("shows the shared tooltip div with the label on pointerenter, hides it on pointerleave", async () => {
    const fixture = createComponent(TooltipHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const wrapper: HTMLElement = fixture.nativeElement.querySelector(
      ".excalidraw-tooltip-wrapper",
    );
    expect(wrapper).not.toBeNull();
    expect(document.querySelector(".excalidraw-tooltip")).toBeNull();

    wrapper.dispatchEvent(new Event("pointerenter"));
    const tooltip = document.querySelector(".excalidraw-tooltip")!;
    expect(tooltip.classList.contains("excalidraw-tooltip--visible")).toBe(
      true,
    );
    expect(tooltip.textContent).toBe("Selection tool");

    wrapper.dispatchEvent(new Event("pointerleave"));
    expect(tooltip.classList.contains("excalidraw-tooltip--visible")).toBe(
      false,
    );
  });
});

describe("caliburn-dropdown-menu family", () => {
  @Component({
    selector: "dropdown-menu-host",
    imports: [
      CaliburnDropdownMenuComponent,
      CaliburnDropdownMenuTriggerComponent,
      CaliburnDropdownMenuContentComponent,
      CaliburnDropdownMenuGroupComponent,
      CaliburnDropdownMenuItemComponent,
      CaliburnDropdownMenuItemBadgeComponent,
      CaliburnDropdownMenuItemCustomComponent,
      CaliburnDropdownMenuSeparatorComponent,
    ],
    template: `
      <caliburn-dropdown-menu [open]="open()">
        <button caliburn-dropdown-menu-trigger (toggle)="open.set(!open())">
          Extra tools
        </button>
        <caliburn-dropdown-menu-content
          class="App-toolbar__extra-tools-dropdown"
          (closeOutside)="open.set(false)"
          (itemSelected)="open.set(false)"
        >
          <caliburn-dropdown-menu-group title="Shapes">
            <button
              caliburn-dropdown-menu-item
              [testId]="'toolbar-frame'"
              [hasBadge]="true"
              (select)="onFrameSelect($event)"
            >
              Frame
              <caliburn-dropdown-menu-item-badge dropdown-menu-item-badge-slot>
                AI
              </caliburn-dropdown-menu-item-badge>
            </button>
            <button
              caliburn-dropdown-menu-item
              [testId]="'toolbar-theme'"
              (select)="onThemeSelect($event)"
            >
              Theme
            </button>
            <caliburn-dropdown-menu-separator />
            <caliburn-dropdown-menu-item-custom [selected]="true">
              Custom row
            </caliburn-dropdown-menu-item-custom>
          </caliburn-dropdown-menu-group>
        </caliburn-dropdown-menu-content>
      </caliburn-dropdown-menu>
      <div id="outside">outside</div>
    `,
  })
  class DropdownMenuHost {
    readonly open = signal(false);
    readonly selected = signal<string | null>(null);
    /** preventDefault()s, like upstream's theme toggle
     * (main-menu/DefaultItems.tsx) — must keep the menu open. */
    themeToggleCount = 0;

    onFrameSelect() {
      this.selected.set("frame");
    }

    onThemeSelect(event: Event) {
      event.preventDefault();
      this.themeToggleCount++;
    }
  }

  it("is a wrapper-less attribute-selector for trigger/item: no <caliburn-dropdown-menu-trigger>/<caliburn-dropdown-menu-item> tags", async () => {
    const fixture = createComponent(DropdownMenuHost);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector("caliburn-dropdown-menu-trigger"),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector("caliburn-dropdown-menu-item"),
    ).toBeNull();
    const trigger = fixture.nativeElement.querySelector(
      "[data-testid='dropdown-menu-button']",
    );
    expect(trigger.tagName).toBe("BUTTON");
    // direct child of the display:contents wrapper, i.e. of
    // caliburn-dropdown-menu itself — no intervening node
    expect(trigger.parentElement.tagName).toBe("CALIBURN-DROPDOWN-MENU");
    const item = fixture.nativeElement.querySelector(
      "[data-testid='toolbar-frame']",
    );
    expect(item.tagName).toBe("BUTTON");
    // direct child of the group (host-bound `.dropdown-menu-group`, itself
    // a direct child of the Island `.dropdown-menu-container`) — matching
    // DropdownMenu.scss's `.dropdown-menu-item-base { display: flex; }`
    // needing `.dropdown-menu-item` as a direct flex child of whichever
    // flex container it's actually nested in
    expect(item.parentElement.tagName).toBe("CALIBURN-DROPDOWN-MENU-GROUP");
    expect(item.parentElement.parentElement.tagName).toBe("CALIBURN-ISLAND");
  });

  it("toggles open via the trigger and renders the wrapper/button/content DOM contract", async () => {
    const fixture = createComponent(DropdownMenuHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const wrapper: HTMLElement = fixture.nativeElement.querySelector(
      "caliburn-dropdown-menu",
    );
    expect(wrapper.classList.contains("dropdown-menu-event-wrapper")).toBe(
      true,
    );

    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(
      "[data-testid='dropdown-menu-button']",
    );
    expect(trigger.classList.contains("dropdown-menu-button")).toBe(true);
    expect(
      fixture.nativeElement.querySelector("[data-testid='dropdown-menu']"),
    ).toBeNull();

    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const content: HTMLElement = fixture.nativeElement.querySelector(
      "[data-testid='dropdown-menu']",
    );
    expect(content).not.toBeNull();
    expect(content.classList.contains("dropdown-menu")).toBe(true);
    expect(
      content.classList.contains("App-toolbar__extra-tools-dropdown"),
    ).toBe(true);
    expect(
      content.querySelector(".dropdown-menu-container.Island"),
    ).not.toBeNull();
  });

  it("renders group/item/badge/separator/item-custom DOM classes", async () => {
    const fixture = createComponent(DropdownMenuHost);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const group: HTMLElement = fixture.nativeElement.querySelector(
      ".dropdown-menu-group",
    );
    expect(group.querySelector(".dropdown-menu-group-title")?.textContent).toBe(
      "Shapes",
    );

    const item: HTMLButtonElement = fixture.nativeElement.querySelector(
      "[data-testid='toolbar-frame']",
    );
    expect(item.classList.contains("dropdown-menu-item")).toBe(true);
    expect(item.classList.contains("dropdown-menu-item-base")).toBe(true);
    expect(
      item.querySelector(".dropdown-menu-item__text")?.textContent?.trim(),
    ).toBe("Frame");
    expect(item.querySelector(".dropdown-menu-item__badge")).not.toBeNull();
    expect(
      item.querySelector(".dropdown-menu-item__badge .DropDownMenuItemBadge"),
    ).not.toBeNull();

    expect(
      fixture.nativeElement.querySelector("caliburn-dropdown-menu-separator"),
    ).not.toBeNull();

    const custom: HTMLElement = fixture.nativeElement.querySelector(
      "caliburn-dropdown-menu-item-custom",
    );
    expect(custom.classList.contains("dropdown-menu-item-base")).toBe(true);
    expect(custom.classList.contains("dropdown-menu-item-custom")).toBe(true);
    expect(custom.classList.contains("dropdown-menu-item--selected")).toBe(
      true,
    );
  });

  it("closes on outside click but not on clicking the trigger, and on item select", async () => {
    const fixture = createComponent(DropdownMenuHost);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(
      "[data-testid='dropdown-menu-button']",
    );
    trigger.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(true);

    const outside: HTMLElement =
      fixture.nativeElement.querySelector("#outside");
    outside.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const item: HTMLButtonElement = fixture.nativeElement.querySelector(
      "[data-testid='toolbar-frame']",
    );
    item.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe("frame");
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it("closes on Escape while open, and does NOT swallow a global Escape while closed", async () => {
    const fixture = createComponent(DropdownMenuHost);
    fixture.detectChanges();
    await fixture.whenStable();

    // closed: this component instance exists (created once by the host,
    // regardless of `open`) — its document keydown listener must not
    // intercept/preventDefault an Escape meant for something else.
    const closedEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    document.dispatchEvent(closedEvent);
    expect(closedEvent.defaultPrevented).toBe(false);

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const openEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    document.dispatchEvent(openEvent);
    expect(openEvent.defaultPrevented).toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it("keeps the menu open when an item's select handler calls preventDefault()", async () => {
    const fixture = createComponent(DropdownMenuHost);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const themeItem: HTMLButtonElement = fixture.nativeElement.querySelector(
      "[data-testid='toolbar-theme']",
    );
    themeItem.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.themeToggleCount).toBe(1);
    expect(fixture.componentInstance.open()).toBe(true);
  });

  it("positions the content fixed, below and end-aligned to the trigger", async () => {
    const fixture = createComponent(DropdownMenuHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(
      "[data-testid='dropdown-menu-button']",
    );
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      top: 40,
      bottom: 60,
      left: 100,
      right: 150,
      width: 50,
      height: 20,
      x: 100,
      y: 40,
      toJSON() {},
    });
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1000);

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const content: HTMLElement = fixture.nativeElement.querySelector(
      "[data-testid='dropdown-menu']",
    );
    expect(content.style.position).toBe("fixed");
    // sideOffset(8) below the trigger's bottom edge
    expect(content.style.top).toBe("68px");
    // end-aligned: distance from the viewport's right edge to the
    // trigger's right edge
    expect(content.style.right).toBe("850px");
  });
});

describe("host-bound custom elements get an explicit display (packages/caliburn/src/styles.scss)", () => {
  // custom elements default to `display: inline` unless styled — inject the
  // exact rule `styles.scss` adds and assert the *computed* display, rather
  // than just trusting the rule exists.
  let styleEl: HTMLStyleElement;
  beforeAll(() => {
    styleEl = document.createElement("style");
    styleEl.textContent = `
      caliburn-island,
      .dropdown-menu-group,
      caliburn-button-separator,
      caliburn-dropdown-menu-separator {
        display: block;
      }
    `;
    document.head.appendChild(styleEl);
  });
  afterAll(() => {
    styleEl.remove();
  });

  @Component({
    selector: "display-host",
    imports: [
      CaliburnIslandComponent,
      CaliburnButtonSeparatorComponent,
      CaliburnDropdownMenuSeparatorComponent,
      CaliburnDropdownMenuGroupComponent,
    ],
    template: `
      <caliburn-island>x</caliburn-island>
      <caliburn-button-separator />
      <caliburn-dropdown-menu-separator />
      <caliburn-dropdown-menu-group>y</caliburn-dropdown-menu-group>
    `,
  })
  class DisplayHost {}

  it("caliburn-island / .dropdown-menu-group / caliburn-button-separator / caliburn-dropdown-menu-separator compute display: block", async () => {
    const fixture = createComponent(DisplayHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const island = fixture.nativeElement.querySelector("caliburn-island");
    const group = fixture.nativeElement.querySelector(
      "caliburn-dropdown-menu-group",
    );
    const buttonSeparator = fixture.nativeElement.querySelector(
      "caliburn-button-separator",
    );
    const menuSeparator = fixture.nativeElement.querySelector(
      "caliburn-dropdown-menu-separator",
    );

    expect(getComputedStyle(island).display).toBe("block");
    expect(getComputedStyle(group).display).toBe("block");
    expect(getComputedStyle(buttonSeparator).display).toBe("block");
    expect(getComputedStyle(menuSeparator).display).toBe("block");
  });
});

// `MenuItemLink`/`MenuItemLiveCollaborationTrigger` are ported per the
// upstream `welcome-screen/WelcomeScreen.Center.tsx` API surface but not
// composed into `<WelcomeScreen />`'s default content (`layer-ui.component`
// wires only `MenuItemLoadScene`/`MenuItemHelp`, covered end-to-end in
// `welcomeScreen.test.tsx`) — Task 23 consumes them for a host-app welcome
// screen. Exercised directly here so their templates/DOM contract are
// verified even while unconsumed.
describe("caliburn-welcome-screen unwired primitives", () => {
  @Component({
    selector: "welcome-screen-primitives-host",
    imports: [
      CaliburnWelcomeScreenMenuItemLinkComponent,
      CaliburnWelcomeScreenMenuItemLiveCollaborationTriggerComponent,
    ],
    template: `
      <a
        caliburn-welcome-screen-menu-item-link
        icon="githubIcon"
        href="https://github.com/amedviediev/caliburn"
        ariaLabel="GitHub"
      >
        GitHub
      </a>
      <caliburn-welcome-screen-menu-item-live-collaboration-trigger
        (select)="onSelect()"
      />
    `,
  })
  class WelcomeScreenPrimitivesHost {
    selectCount = 0;
    onSelect() {
      this.selectCount++;
    }
  }

  it("MenuItemLink is a wrapper-less attribute-selector anchor with the welcome-screen-menu-item DOM contract", async () => {
    const fixture = createComponent(WelcomeScreenPrimitivesHost);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector(
        "caliburn-welcome-screen-menu-item-link",
      ),
    ).toBeNull();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      "a[aria-label='GitHub']",
    );
    expect(link.classList.contains("welcome-screen-menu-item")).toBe(true);
    expect(link.getAttribute("href")).toBe(
      "https://github.com/amedviediev/caliburn",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(
      link.querySelector(".welcome-screen-menu-item__icon svg"),
    ).not.toBeNull();
    expect(
      link
        .querySelector(".welcome-screen-menu-item__text")
        ?.textContent?.trim(),
    ).toBe("GitHub");
  });

  it("MenuItemLiveCollaborationTrigger renders the usersIcon item and emits select on click", async () => {
    const fixture = createComponent(WelcomeScreenPrimitivesHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      "caliburn-welcome-screen-menu-item-live-collaboration-trigger button",
    );
    expect(button.classList.contains("welcome-screen-menu-item")).toBe(true);
    expect(
      button.querySelector(".welcome-screen-menu-item__icon svg"),
    ).not.toBeNull();
    expect(
      button.querySelector(".welcome-screen-menu-item__shortcut"),
    ).toBeNull();

    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectCount).toBe(1);
  });
});
