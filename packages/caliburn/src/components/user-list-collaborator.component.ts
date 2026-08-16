import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
} from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { NgIcon } from "@ng-icons/core";

import { getClientColor } from "@excalidraw/excalidraw/clients";
import { t } from "@excalidraw/excalidraw/i18n";

import type { Collaborator, SocketId } from "@excalidraw/excalidraw/types";

import { actionGoToCollaborator } from "../actions/actionNavigate";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { translated } from "../i18n";

import { CaliburnAvatarComponent } from "./avatar.component";
import { provideCaliburnIcons } from "./icons";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `actionNavigate.tsx`'s `actionGoToCollaborator`
 * `PanelComponent` — one collaborator in the UserList, either as a bare
 * avatar (the top-right row) or as a named dropdown row. Caliburn's action
 * manager has no `renderAction`, so the markup is a component that executes
 * the action itself where upstream calls `updateData`.
 *
 * Attribute-selector component: the host IS upstream's row `<div>`, which
 * `UserList.scss` reaches through direct-child selectors (`.UserList > *`,
 * `.UserList__collaborators > .is-current-user`) that an extra wrapper
 * element would break.
 */
@Component({
  selector: "div[caliburn-user-list-collaborator]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnAvatarComponent, NgIcon, NgTemplateOutlet],
  providers: [provideCaliburnIcons()],
  host: {
    class: "UserList__collaborator",
    "[class.dropdown-menu-item]": "withName()",
    "[class.dropdown-menu-item-base]": "withName()",
    "[class.UserList__collaborator--avatar-only]": "!withName()",
    "[class.is-followed]": "isBeingFollowed()",
    "[class.is-current-user]": "collaborator().isCurrentUser === true",
    "[class.is-speaking]": "!!collaborator().isSpeaking",
    "[class.is-in-call]": "!!collaborator().isInCall",
    "[class.is-muted]": "!!collaborator().isMuted",
    "[style.--avatar-size]": "withName() ? '1.5rem' : null",
    "(click)": "onRowClick()",
  },
  templateUrl: "./user-list-collaborator.component.html",
})
export class CaliburnUserListCollaboratorComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly socketId = input.required<SocketId>();
  readonly collaborator = input.required<Collaborator>();
  readonly withName = input(false);
  readonly isBeingFollowed = input(false);

  protected readonly youLabel = translated(() => t("labels.you"));
  protected readonly isSpeakingTitle = translated(() =>
    t("userList.hint.isSpeaking"),
  );
  protected readonly micMutedTitle = translated(() =>
    t("userList.hint.micMuted"),
  );
  protected readonly inCallTitle = translated(() => t("userList.hint.inCall"));
  protected readonly followStatusTitle = translated(() =>
    t("userList.hint.followStatus"),
  );

  protected readonly background = computed(() =>
    getClientColor(this.socketId(), this.collaborator()),
  );

  /** the status classes upstream also mirrors onto the avatar */
  protected readonly statusClassNames = computed(() =>
    [
      this.isBeingFollowed() ? "is-followed" : "",
      this.collaborator().isCurrentUser === true ? "is-current-user" : "",
      this.collaborator().isSpeaking ? "is-speaking" : "",
      this.collaborator().isInCall ? "is-in-call" : "",
      this.collaborator().isMuted ? "is-muted" : "",
    ]
      .filter(Boolean)
      .join(" "),
  );

  protected onRowClick() {
    // upstream binds the row's onClick only in the named form, and only for
    // other users; the avatar-only form clicks through the avatar instead
    if (this.withName() && !this.collaborator().isCurrentUser) {
      this.goToCollaborator();
    }
  }

  protected goToCollaborator = () => {
    this.editor.actionManager.executeAction(
      actionGoToCollaborator,
      "ui",
      this.collaborator(),
    );
  };
}
