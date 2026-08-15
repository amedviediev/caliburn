/**
 * Angular port of upstream `dropdownMenu/common.ts`'s pure helper. The
 * React-context piece (`DropdownMenuContentPropsContext`,
 * `useHandleDropdownMenuItemSelect`) is replaced by `CaliburnDropdownMenuItemComponent`
 * injecting `CaliburnDropdownMenuContentComponent` directly (no cycle, so no
 * `forwardRef` needed — see `dropdown-menu-item.component.ts`).
 */
/**
 * Bubbling DOM event an item raises when it is selected, picked up by the
 * enclosing `caliburn-dropdown-menu-content`. Upstream shares the content's
 * `onSelect` through React context, which follows the JSX tree — Angular's
 * element injector follows the *declaration* tree instead, so an item that
 * reaches the content through content projection (every
 * `main-menu/DefaultItems` item) could not inject it. The rendered DOM does
 * nest the item inside the content either way, so the event always arrives.
 */
export const DROPDOWN_MENU_ITEM_SELECT_EVENT =
  "caliburn-dropdown-menu-item-select";

export const getDropdownMenuItemClassName = (
  className = "",
  selected = false,
  hovered = false,
) => {
  return `dropdown-menu-item dropdown-menu-item-base ${className} ${
    selected ? "dropdown-menu-item--selected" : ""
  } ${hovered ? "dropdown-menu-item--hovered" : ""}`.trim();
};
