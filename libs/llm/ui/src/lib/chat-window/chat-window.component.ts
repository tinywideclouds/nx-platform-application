import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Temporal } from '@js-temporal/polyfill';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';

import {
  ScrollspaceViewportComponent,
  ScrollspaceInputComponent,
  ScrollspaceMarkdownBubbleComponent,
  MarkdownTokensPipe,
} from '@nx-platform-application/scrollspace-ui';

import { LlmMessage } from '@nx-platform-application/llm-types';
import { ScrollspaceInputDraft } from '@nx-platform-application/scrollspace-types';

import { LlmScrollSource } from '@nx-platform-application/llm-features-chat';
import { LlmChatActions } from '@nx-platform-application/llm-domain-conversation';
import { LlmProposalService } from '@nx-platform-application/llm-domain-proposals';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';

import { ChatWorkspacePresenter } from './chat-window.presenter'; // NEW
import { LlmFocusedGroupBannerComponent } from '../chat-group-banner/chat-group-banner.component'; // NEW

import { LlmContentPipe } from '../pipes/llm-content.pipe';
import { LlmChatHeaderComponent } from '../chat-header/chat-header.component';
import { LlmProposalBubbleComponent } from '../proposal-bubble/proposal-bubble.component';
import { LlmFileLinkBubbleComponent } from '../file-link-bubble/file-link-bubble.component';
import { LlmTypingIndicatorComponent } from '../typing-indicator/typing-indicator.component';
import { LlmQuickContextDrawerComponent } from '../quick-context-drawer/quick-context-drawer.component';

@Component({
  selector: 'llm-chat-window',
  standalone: true,
  providers: [ChatWorkspacePresenter], // Ties presenter strictly to this component!
  imports: [
    CommonModule,
    ScrollspaceViewportComponent,
    ScrollspaceInputComponent,
    ScrollspaceMarkdownBubbleComponent,
    MatIcon,
    MatMenuModule,
    MatButtonModule,
    MarkdownTokensPipe,
    LlmChatHeaderComponent,
    LlmFocusedGroupBannerComponent,
    LlmContentPipe,
    LlmProposalBubbleComponent,
    LlmFileLinkBubbleComponent,
    LlmTypingIndicatorComponent,
    LlmQuickContextDrawerComponent,
  ],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
})
export class LlmChatWindowComponent {
  protected source = inject(LlmScrollSource);
  protected actions = inject(LlmChatActions);
  protected presenter = inject(ChatWorkspacePresenter);

  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private proposalService = inject(LlmProposalService);
  private cacheService = inject(CompiledCacheService);

  copiedMessageId = signal<string | null>(null);

  chatLockState = computed(() => {
    const session = this.presenter.session();
    if (!session) return { locked: false, reason: '' };

    if (this.cacheService.isCompiling()) {
      return {
        locked: true,
        reason: '⚙️ Compiling context cache... please wait.',
      };
    }

    return { locked: false, reason: '' };
  });

  chatAlertState = computed(() => {
    const session = this.presenter.session();
    if (!session || !this.presenter.activeModelId())
      return { alert: false, reason: '' };

    if (this.cacheService.isCompiling()) {
      return {
        alert: true,
        reason: '⚙️ Compiling context cache... please wait.',
      };
    }

    const isUsingOverride = !!this.presenter.temporaryModelOverride();

    if (session.compiledContext) {
      const activeCache = this.cacheService
        .activeCaches()
        .find(
          (c) =>
            c.model === this.presenter.activeModelId() &&
            c.id
              .toString()
              .includes(session.compiledContext!.resourceUrn.entityId),
        );

      if (activeCache) {
        const now = Temporal.Now.instant();
        const expiry = Temporal.Instant.from(activeCache.expiresAt);

        if (Temporal.Instant.compare(now, expiry) >= 0) {
          return {
            alert: true,
            reason:
              '⏰ Context cache expired. Responses will be slower. Please renew in Settings.',
          };
        }
      } else if (!isUsingOverride && session.strategy?.useCacheIfAvailable) {
        return {
          alert: true,
          reason: '❄️ Context cache is COLD. Response will be slow.',
        };
      }
    }

    return { alert: false, reason: '' };
  });

  collapsedBlocks = computed(() => {
    const focusUrn = this.presenter.focusedGroupUrn();
    const items = this.source.items();
    const blocks: Record<string, { count: number; isFirst: boolean }> = {};

    if (!focusUrn) return blocks;

    let currentBlockCount = 0;
    let firstIdInBlock: string | null = null;

    for (const item of items) {
      const msg = item.data;
      const isValidMsg = msg && typeof msg !== 'string';

      if (isValidMsg && !this.presenter.isMessageInFocus(msg)) {
        if (currentBlockCount === 0) {
          firstIdInBlock = msg.id.toString();
        }
        currentBlockCount++;
        blocks[msg.id.toString()] = { count: 0, isFirst: false };
      } else {
        if (currentBlockCount > 0 && firstIdInBlock) {
          blocks[firstIdInBlock] = { count: currentBlockCount, isFirst: true };
          currentBlockCount = 0;
          firstIdInBlock = null;
        }
      }
    }

    if (currentBlockCount > 0 && firstIdInBlock) {
      blocks[firstIdInBlock] = { count: currentBlockCount, isFirst: true };
    }

    return blocks;
  });

  displayItems = computed(() => {
    const focusUrn = this.presenter.focusedGroupUrn();
    const items = this.source.items();
    const blocks = this.collapsedBlocks();

    if (!focusUrn) return items;

    return items.filter((item) => {
      const msg = item.data;
      if (!msg || typeof msg === 'string') return true;
      if (this.presenter.isMessageInFocus(msg)) return true;

      const blockMeta = blocks[msg.id.toString()];
      return blockMeta && blockMeta.isFirst;
    });
  });

  onOpenDetails() {
    this.router.navigate([], {
      queryParams: { view: 'details' },
      queryParamsHandling: 'merge',
    });
  }

  onSend(draft: ScrollspaceInputDraft) {
    this.presenter.handleSend(draft.text);
  }

  onStop() {
    this.actions.cancelGeneration();
    const snackbarRef = this.snackBar.open(
      'You canceled the response.',
      'Save',
      { duration: 5000 },
    );
    snackbarRef.afterDismissed().subscribe((info) => {
      if (info.dismissedByAction) {
        this.actions.resolveCancellation('save');
      } else {
        this.actions.resolveCancellation('delete');
      }
    });
  }

  async onAcceptProposal(proposalId: string) {
    const session = this.presenter.session();
    if (!session) return;
    await this.proposalService.acceptProposal(proposalId);
  }

  async onRejectProposal(proposalId: string, messageId: string) {
    const session = this.presenter.session();
    if (!session) return;
    await this.proposalService.rejectProposal(proposalId);
    await this.actions.toggleExcludeSelected([messageId], true);
  }

  async copyMessage(text: string, messageId: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedMessageId.set(messageId);
      setTimeout(() => {
        if (this.copiedMessageId() === messageId) {
          this.copiedMessageId.set(null);
        }
      }, 2000);
    } catch (err) {
      console.error('Failed to copy message', err);
    }
  }

  onOpenWorkspace(proposalId?: string) {
    const session = this.presenter.session();
    if (!session) return;

    const queryParams: Record<string, string> = { view: 'workspace' };
    if (proposalId) {
      queryParams['proposal'] = proposalId;
    }

    this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
