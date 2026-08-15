/**
 * Angular port of upstream `dropdownMenu/common.ts`'s pure helper. The
 * React-context piece (`DropdownMenuContentPropsContext`,
 * `useHandleDropdownMenuItemSelect`) is replaced by `CaliburnDropdownMenuItemComponent`
 * injecting `CaliburnDropdownMenuContentComponent` directly (no cycle, so no
 * `forwardRef` needed — see `dropdown-menu-item.component.ts`).
 */
export const getDropdownMenuItemClassName = (
  className = "",
  selected = false,
  hovered = false,
) => {
  return `dropdown-menu-item dropdown-menu-item-base ${className} ${
    selected ? "dropdown-menu-item--selected" : ""
  } ${hovered ? "dropdown-menu-item--hovered" : ""}`.trim();
};
