import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";

import { KEYS } from "@excalidraw/common";

import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  CaliburnDialogComponent,
  CaliburnEditorComponent,
  CaliburnFilledButtonComponent,
  CaliburnTextFieldComponent,
} from "../../../packages/caliburn/src/index";
import { activeRoomLink, shareDialogState } from "../app-state";
import { CollabService } from "../collab/collab.service";

import { CaliburnAppQRCodeComponent } from "./qrcode.component";

import type { OnDestroy } from "@angular/core";

const COPY_STATUS_TIMEOUT = 2000;

const getShareIconName = () => {
  const navigator = window.navigator as any;
  const isAppleBrowser = /Apple/.test(navigator.vendor);
  const isWindowsBrowser = navigator.appVersion.indexOf("Win") !== -1;

  if (isAppleBrowser) {
    return "shareIOS";
  } else if (isWindowsBrowser) {
    return "shareWindows";
  }

  return "share";
};

/**
 * Angular port of upstream `excalidraw-app/share/ShareDialog.tsx` — its
 * `ShareDialog`, `ShareDialogInner`, `ShareDialogPicker` and
 * `ActiveRoomDialog` in one component, since the three inner ones are branches
 * of the same dialog rather than reusable pieces.
 *
 * `useCopyStatus` is the `copyStatus` signal below, and the effect that closes
 * the dialog whenever an editor dialog opens is upstream's own.
 */
@Component({
  selector: "caliburn-app-share-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnAppQRCodeComponent,
    CaliburnDialogComponent,
    CaliburnFilledButtonComponent,
    CaliburnTextFieldComponent,
  ],
  host: {
    style: "display: contents;",
  },
  templateUrl: "./share-dialog.component.html",
})
export class CaliburnAppShareDialogComponent implements OnDestroy {
  private readonly editor = inject(CaliburnEditorComponent);
  private readonly collab = inject(CollabService);

  /** upstream's `collabAPI` prop — `null` while collaboration is disabled */
  readonly collabEnabled = input(false);
  readonly onExportToBackend = input.required<() => Promise<void>>();

  protected readonly state = shareDialogState;
  protected readonly activeRoomLink = activeRoomLink;
  protected readonly isShareSupported = "share" in navigator;
  protected readonly shareIconName = getShareIconName();
  protected readonly copyStatus = signal<"success" | null>(null);
  protected readonly username = signal(this.collab.getUsername());

  protected readonly labels = {
    liveCollaboration: t("labels.liveCollaboration").replace(/\./g, ""),
    copyLink: t("buttons.copyLink"),
    descPrivacy: t("roomDialog.desc_privacy"),
    descExitSession: t("roomDialog.desc_exitSession"),
    descIntro: t("roomDialog.desc_intro"),
    startSession: t("roomDialog.button_startSession"),
    stopSession: t("roomDialog.button_stopSession"),
    linkTitle: t("exportDialog.link_title"),
    linkDetails: t("exportDialog.link_details"),
    linkButton: t("exportDialog.link_button"),
    or: t("shareDialog.or"),
  };

  private copyStatusTimeout = 0;

  /** upstream closes the share dialog whenever an editor dialog opens */
  private readonly closeOnEditorDialog = effect(() => {
    this.editor.changeGeneration();
    if (this.editor.state.openDialog) {
      shareDialogState.set({ isOpen: false });
    }
  });

  protected readonly isActiveRoom = computed(
    () => this.collabEnabled() && !!this.activeRoomLink(),
  );

  ngOnDestroy() {
    window.clearTimeout(this.copyStatusTimeout);
  }

  protected handleClose() {
    shareDialogState.set({ isOpen: false });
  }

  protected setUsername(username: string) {
    this.username.set(username);
    this.collab.setUsername(username);
  }

  protected onUsernameKeyDown(event: KeyboardEvent) {
    if (event.key === KEYS.ENTER) {
      this.handleClose();
    }
  }

  protected readonly copyRoomLink = async () => {
    const roomLink = this.activeRoomLink();
    if (!roomLink) {
      return;
    }
    try {
      await copyTextToSystemClipboard(roomLink);
    } catch (error: any) {
      this.collab.setErrorDialog(t("errors.copyToSystemClipboardFailed"));
    }

    this.copyStatus.set("success");
    window.clearTimeout(this.copyStatusTimeout);
    this.copyStatusTimeout = window.setTimeout(() => {
      this.copyStatus.set(null);
    }, COPY_STATUS_TIMEOUT);
  };

  protected readonly shareRoomLink = async () => {
    const roomLink = this.activeRoomLink();
    if (!roomLink) {
      return;
    }
    try {
      // upstream's copy names "Excalidraw" as the session's host
      const shareTitle = t("roomDialog.shareTitle").replace(
        /Excalidraw/g,
        "Caliburn",
      );
      await navigator.share({
        title: shareTitle,
        text: shareTitle,
        url: roomLink,
      });
    } catch (error: any) {
      // Just ignore.
    }
  };

  protected readonly startCollaboration = () => {
    this.collab.startCollaboration(null);
  };

  protected readonly stopCollaboration = () => {
    this.collab.stopCollaboration();
    if (!this.collab.isCollaborating()) {
      this.handleClose();
    }
  };

  protected readonly exportToBackend = async () => {
    await this.onExportToBackend()();
    this.handleClose();
  };
}
