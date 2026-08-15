import { Component, provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { NgIcon } from "@ng-icons/core";

import { caliburnIcons, provideCaliburnIcons } from "../src/components/icons";

@Component({
  selector: "caliburn-icons-host",
  imports: [NgIcon],
  template: `
    <ng-icon name="SelectionIcon" />
    <ng-icon name="TrashIcon" />
    <ng-icon name="GroupIconLight" />
  `,
})
class IconsHostComponent {}

describe("caliburn icons", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideCaliburnIcons()],
    });
  });

  it("renders registered ng-icon names as inline svg markup", async () => {
    const fixture = TestBed.createComponent(IconsHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    const svgs = root.querySelectorAll("ng-icon svg");
    expect(svgs.length).toBe(3);

    const html = root.innerHTML;
    expect(html).toContain("<svg");
    expect(html).toContain("M6 6l4.153 11.793");
    expect(html).toContain("M3.333 5.833h13.334");
    expect(html).toContain('fill="#fff"');
  });

  it("keeps upstream export names (first letter lowercased) and svg markup in the generated map", () => {
    expect(caliburnIcons.selectionIcon).toContain("<svg");
    expect(caliburnIcons.selectionIcon).toContain("M6 6l4.153 11.793");
    expect(caliburnIcons.groupIconLight).toContain('fill="#fff"');
    expect(caliburnIcons.groupIconDark).toContain('fill="#1e1e1e"');
  });
});
