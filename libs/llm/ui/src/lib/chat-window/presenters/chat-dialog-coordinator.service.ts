import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { LlmSession } from '@nx-platform-application/llm-types';
import { ContextAssembly } from '@nx-platform-application/llm-domain-context';

import {
  LlmPreflightDialogComponent,
  PreflightDialogResult,
} from '../../preflight-dialog/preflight-dialog.component';
import {
  GroupContextDialogComponent,
  GroupContextDialogResult,
} from '../../group-context-dialog/group-context-dialog.component';
import {
  BranchContextDialogComponent,
  BranchContextDialogResult,
} from '../../branch-context-dialog/branch-context-dialog.component';
import { LlmEditMessageDialogComponent } from '../../edit-message-dialog/edit-message-dialog.component';

@Injectable({ providedIn: 'root' })
export class ChatDialogCoordinatorService {
  private dialog = inject(MatDialog);

  async openPreflight(
    assembly: ContextAssembly,
    session: LlmSession,
  ): Promise<PreflightDialogResult> {
    const dialogRef = this.dialog.open<
      LlmPreflightDialogComponent,
      any,
      PreflightDialogResult
    >(LlmPreflightDialogComponent, {
      width: '900px',
      height: '85vh',
      data: { assembly, session },
      disableClose: true,
    });

    const result = await dialogRef.afterClosed().toPromise();
    // Provide a safe fallback if the dialog is somehow forcibly closed
    return result || { send: false, disableFuture: false };
  }

  async openBranchContext(): Promise<BranchContextDialogResult | undefined> {
    const dialogRef = this.dialog.open<
      BranchContextDialogComponent,
      any,
      BranchContextDialogResult
    >(BranchContextDialogComponent, { width: '450px' });

    return dialogRef.afterClosed().toPromise();
  }

  async openGroupContext(
    existingGroups: { urn: string; name: string }[],
  ): Promise<GroupContextDialogResult | undefined> {
    const dialogRef = this.dialog.open<
      GroupContextDialogComponent,
      { existingGroups: { urn: string; name: string }[] },
      GroupContextDialogResult
    >(GroupContextDialogComponent, {
      width: '400px',
      data: { existingGroups },
    });

    return dialogRef.afterClosed().toPromise();
  }

  async openEditMessage(
    content: string,
    role: string,
  ): Promise<string | undefined> {
    const dialogRef = this.dialog.open(LlmEditMessageDialogComponent, {
      width: '600px',
      data: { content, role },
    });

    return dialogRef.afterClosed().toPromise();
  }
}
