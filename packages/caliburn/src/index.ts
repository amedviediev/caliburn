export { CaliburnEditorComponent } from "./editor.component";
export type { CaliburnImperativeAPI } from "./editor.component";
export { createTestHook, h } from "./test-hook";
export type { TestHandle } from "./test-hook";

// host-composition surfaces: everything a host app needs to fill the
// editor's slots (see `editor.component.ts`) or its projected children
export { CaliburnFooterCenterComponent } from "./components/footer-center.component";
export { CaliburnLiveCollaborationTriggerComponent } from "./components/live-collaboration-trigger.component";
export { CaliburnDialogComponent } from "./components/dialog.component";
export { CaliburnErrorDialogComponent } from "./components/error-dialog.component";
export { CaliburnFilledButtonComponent } from "./components/filled-button.component";
export { CaliburnShareableLinkDialogComponent } from "./components/shareable-link-dialog.component";
export { CaliburnSpinnerComponent } from "./components/spinner.component";
export { CaliburnTextFieldComponent } from "./components/text-field.component";
export { CaliburnTooltipComponent } from "./components/tooltip.component";
export { CaliburnDropdownMenuItemCustomComponent } from "./components/dropdown-menu/dropdown-menu-item-custom.component";
export { CaliburnDropdownMenuItemLinkComponent } from "./components/dropdown-menu/dropdown-menu-item-link.component";
export { CaliburnDropdownMenuItemComponent } from "./components/dropdown-menu/dropdown-menu-item.component";
export { CaliburnDropdownMenuGroupComponent } from "./components/dropdown-menu/dropdown-menu-group.component";
export { CaliburnDropdownMenuSeparatorComponent } from "./components/dropdown-menu/dropdown-menu-separator.component";
export { CaliburnMainMenuComponent } from "./components/main-menu/main-menu.component";
export {
  CaliburnMenuChangeCanvasBackgroundComponent,
  CaliburnMenuClearCanvasComponent,
  CaliburnMenuCommandPaletteComponent,
  CaliburnMenuExportComponent,
  CaliburnMenuHelpComponent,
  CaliburnMenuLiveCollaborationTriggerComponent,
  CaliburnMenuLoadSceneComponent,
  CaliburnMenuSaveAsImageComponent,
  CaliburnMenuSaveToActiveFileComponent,
  CaliburnMenuSearchComponent,
  CaliburnMenuSocialsComponent,
  CaliburnMenuToggleThemeComponent,
} from "./components/main-menu/default-items.component";
export { CaliburnDefaultSidebarComponent } from "./components/sidebar/default-sidebar.component";
export { CaliburnSidebarComponent } from "./components/sidebar/sidebar.component";
export { CaliburnSidebarHeaderComponent } from "./components/sidebar/sidebar-header.component";
export { CaliburnSidebarTabComponent } from "./components/sidebar/sidebar-tab.component";
export { CaliburnSidebarTabTriggerComponent } from "./components/sidebar/sidebar-tab-trigger.component";
export { CaliburnSidebarTabTriggersComponent } from "./components/sidebar/sidebar-tab-triggers.component";
export { CaliburnSidebarTabsComponent } from "./components/sidebar/sidebar-tabs.component";
export { CaliburnSidebarTriggerComponent } from "./components/sidebar/sidebar-trigger.component";
export { CaliburnWelcomeScreenCenterComponent } from "./components/welcome-screen/center.component";
export { CaliburnWelcomeScreenHeadingComponent } from "./components/welcome-screen/heading.component";
export { CaliburnWelcomeScreenHelpHintComponent } from "./components/welcome-screen/help-hint.component";
export { CaliburnWelcomeScreenLogoComponent } from "./components/welcome-screen/logo.component";
export { CaliburnWelcomeScreenMenuHintComponent } from "./components/welcome-screen/menu-hint.component";
export { CaliburnWelcomeScreenMenuItemHelpComponent } from "./components/welcome-screen/menu-item-help.component";
export { CaliburnWelcomeScreenMenuItemLinkComponent } from "./components/welcome-screen/menu-item-link.component";
export { CaliburnWelcomeScreenMenuItemLiveCollaborationTriggerComponent } from "./components/welcome-screen/menu-item-live-collaboration-trigger.component";
export { CaliburnWelcomeScreenMenuItemLoadSceneComponent } from "./components/welcome-screen/menu-item-load-scene.component";
export { CaliburnWelcomeScreenMenuComponent } from "./components/welcome-screen/menu.component";
export { CaliburnWelcomeScreenToolbarHintComponent } from "./components/welcome-screen/toolbar-hint.component";
export { openConfirmModal } from "./components/overwrite-confirm/overwrite-confirm-state";
export { provideCaliburnIcons } from "./components/icons";
export { DEFAULT_CATEGORIES } from "./components/command-palette/categories";
export type { CommandPaletteItem } from "./components/command-palette/types";

export interface ExcalidrawCompatProps {
  handleKeyboardGlobally?: boolean;
  onExcalidrawAPI?: (api: any) => void;
  [key: string]: unknown;
}

/**
 * JSX-compat shim: upstream tests render `<Excalidraw ...props />`. The
 * harness never invokes this function — `render()` reads the props off the
 * created element and maps them onto the Angular component's inputs, so
 * ported test bodies keep their render call unchanged.
 */
export const Excalidraw = (_props: ExcalidrawCompatProps): null => null;
