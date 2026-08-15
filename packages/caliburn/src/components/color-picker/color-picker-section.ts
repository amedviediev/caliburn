import { Injectable, signal } from "@angular/core";

import type { ActiveColorPickerSectionAtomType } from "@excalidraw/excalidraw/components/ColorPicker/colorPickerUtils";

/**
 * Stands in for upstream's module-level `activeColorPickerSectionAtom`
 * (`ColorPicker/colorPickerUtils.ts`) — the section (custom colors / base
 * colors / shades / hex input) the picker's keyboard focus currently sits in.
 *
 * Provided per `caliburn-color-picker` rather than globally: only one picker
 * popup is open at a time, and upstream clears the atom whenever a popup
 * closes, so the two are observationally equivalent.
 */
@Injectable()
export class CaliburnColorPickerSection {
  readonly active = signal<ActiveColorPickerSectionAtomType>(null);

  /** upstream passes this to `colorPickerKeyNavHandler` as a React state
   * setter, so it has to accept the updater form as well as a bare value */
  readonly set = (
    update:
      | ActiveColorPickerSectionAtomType
      | ((
          prev: ActiveColorPickerSectionAtomType,
        ) => ActiveColorPickerSectionAtomType),
  ) => {
    this.active.set(
      typeof update === "function" ? update(this.active()) : update,
    );
  };
}
