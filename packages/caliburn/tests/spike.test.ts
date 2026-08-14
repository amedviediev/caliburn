import { provideZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { CaliburnEditorComponent } from "../src/editor.component";

describe("angular toolchain spike", () => {
  it("compiles and renders a component under vitest", async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(CaliburnEditorComponent);
    fixture.componentRef.setInput("handleKeyboardGlobally", true);
    fixture.detectChanges();
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector("canvas.interactive")).not.toBeNull();
    expect(root.querySelector("canvas.static")).not.toBeNull();
    expect(fixture.componentInstance.handleKeyboardGlobally()).toBe(true);
  });
});
