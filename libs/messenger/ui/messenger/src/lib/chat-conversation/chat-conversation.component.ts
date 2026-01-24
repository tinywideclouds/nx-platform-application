// libs/messenger/feature-conversation/src/lib/chat-conversation.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  effect,
  computed,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { CommonModule, DatePipe } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Temporal } from '@js-temporal/polyfill';
import { URN } from '@nx-platform-application/platform-types';

import { AppState } from '@nx-platform-application/messenger-state-app';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import {
  messageTagBroadcast,
  ContentPayload,
  MessageTypeText,
  TEXT_MESSAGE_TYPE,
  IMAGE_MESSAGE_TYPE,
  GROUP_INVITE_TYPE,
} from '@nx-platform-application/messenger-domain-message-content';

// Import Types
import { DraftMessage } from '@nx-platform-application/messenger-types';

import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';
import {
  ChatMessageBubbleComponent,
  ChatMessageDividerComponent,
  ChatTypingIndicatorComponent,
  ChatInviteMessageComponent,
  InviteViewModel,
  ChatMessageInputComponent,
} from '@nx-platform-application/messenger-ui-chat';

import { ContactNamePipe } from '@nx-platform-application/contacts-ui';
import { MessageRendererComponent } from '../message-renderer/message-renderer.component';

@Component({
  selector: 'messenger-chat-conversation',
  standalone: true,
  imports: [
    CommonModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    AutoScrollDirective,
    ChatMessageBubbleComponent,
    ChatMessageDividerComponent,
    ChatTypingIndicatorComponent,
    MessageRendererComponent,
    ChatInviteMessageComponent,
    ChatMessageInputComponent,
    ContactNamePipe,
  ],
  providers: [DatePipe],
  templateUrl: './chat-conversation.component.html',
  styleUrl: './chat-conversation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatConversationComponent {
  private appState = inject(AppState);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  autoScroll = viewChild.required<AutoScrollDirective>('autoScroll');

  chatMessages = this.appState.messages;
  currentUserUrn = this.appState.currentUserUrn;
  selectedConversation = this.appState.selectedConversation;
  isLoading = this.appState.isLoadingHistory;
  firstUnreadId = this.appState.firstUnreadId;
  typingActivity = this.appState.typingActivity;
  readCursors = this.appState.readCursors;

  showNewMessageIndicator = signal(false);

  now = toSignal(interval(1000).pipe(map(() => Temporal.Now.instant())), {
    initialValue: Temporal.Now.instant(),
  });

  readonly TEXT_MESSAGE = TEXT_MESSAGE_TYPE;
  readonly IMAGE_MESSAGE = IMAGE_MESSAGE_TYPE;
  readonly GROUP_INVITE_MESSAGE = GROUP_INVITE_TYPE;

  constructor() {
    effect((onCleanup) => {
      const id = this.firstUnreadId();
      if (id) {
        this.showNewMessageIndicator.set(true);
        const timer = setTimeout(() => {
          this.showNewMessageIndicator.set(false);
        }, 60_000);
        onCleanup(() => clearTimeout(timer));
      }
    });
  }

  getTypeId(msg: ChatMessage): string {
    return msg.typeId.entityId;
  }

  getReadCursorsForMessage(msgId: string): URN[] {
    const map = this.readCursors();
    return map.get(msgId) || [];
  }

  showTypingIndicator = computed(() => {
    const urn = this.selectedConversation();
    if (!urn) return false;
    const activityMap = this.typingActivity();
    const lastActive = activityMap.get(urn.toString());
    if (!lastActive) return false;
    try {
      const duration = this.now().since(lastActive);
      return duration.total({ unit: 'millisecond' }) < 5000;
    } catch {
      return false;
    }
  });

  isMyMessage = (msg: ChatMessage): boolean => {
    const myUrn = this.currentUserUrn();
    return !!myUrn && msg.senderId.toString() === myUrn.toString();
  };

  shouldShowDateDivider(msg: ChatMessage, index: number): boolean {
    if (index === 0) return true;
    const prevMsg = this.chatMessages()[index - 1];
    const currDate = Temporal.Instant.from(msg.sentTimestamp)
      .toZonedDateTimeISO('UTC')
      .toPlainDate();
    const prevDate = Temporal.Instant.from(prevMsg.sentTimestamp)
      .toZonedDateTimeISO('UTC')
      .toPlainDate();
    return !currDate.equals(prevDate);
  }

  shouldShowNewMessagesDivider(msg: ChatMessage): boolean {
    return this.showNewMessageIndicator() && msg.id === this.firstUnreadId();
  }

  getInviteViewModel(msg: ChatMessage): InviteViewModel {
    if (!msg.payloadBytes) {
      return { groupName: 'Unknown Group', groupUrn: '' };
    }
    try {
      const parsed = JSON.parse(new TextDecoder().decode(msg.payloadBytes));
      return {
        groupName: parsed.name || 'Unnamed Group',
        groupUrn: parsed.groupUrn || '',
      };
    } catch (e) {
      return { groupName: 'Corrupted Invite', groupUrn: '' };
    }
  }

  // getContentPayload(msg: ChatMessage): ContentPayload | null {
  //   if (msg.typeId.equals(MessageTypeText) && msg.textContent) {
  //     return { kind: 'text', text: msg.textContent };
  //   }
  //   if (!msg.payloadBytes || (msg.payloadBytes as any).length === 0) {
  //     return null;
  //   }
  //   try {
  //     const bytes =
  //       msg.payloadBytes instanceof Uint8Array
  //         ? msg.payloadBytes
  //         : new Uint8Array(Object.values(msg.payloadBytes));
  //     const decoded = new TextDecoder().decode(bytes);
  //     if (msg.typeId.equals(MessageTypeText)) {
  //       return { kind: 'text', text: decoded };
  //     }
  //     return JSON.parse(decoded);
  //   } catch (e) {
  //     return null;
  //   }
  // }

  isBroadcast(msg: ChatMessage): boolean {
    return (
      msg.tags?.some((t) => t.toString() === messageTagBroadcast.toString()) ??
      false
    );
  }

  isGhost(msg: ChatMessage): boolean {
    return msg.status === 'reference';
  }

  getReceiptSummary(msg: ChatMessage): string {
    if (!this.isMyMessage(msg)) return '';
    if (msg.status === 'reference') return 'Sent via Broadcast';
    const map = msg.receiptMap;
    if (map && Object.keys(map).length > 0) {
      const total = Object.keys(map).length;
      const readCount = Object.values(map).filter((s) => s === 'read').length;
      return `Read by ${readCount} of ${total}`;
    }
    switch (msg.status) {
      case 'read':
        return 'Read';
      case 'delivered':
        return 'Delivered';
      case 'sent':
        return 'Sent to Server';
      case 'pending':
        return 'Sending...';
      case 'failed':
        return 'Failed to Send';
      default:
        return '';
    }
  }

  async onRetryMessage(msg: ChatMessage): Promise<void> {
    if (msg.status !== 'failed') return;
    await this.appState.recoverFailedMessage(msg.id);
  }

  onContentAction(urnString: string): void {
    this.router.navigate(['/contacts/edit', urnString]);
  }

  async onAcceptInvite(msg: ChatMessage): Promise<void> {
    await this.appState.acceptInvite(msg);
    const vm = this.getInviteViewModel(msg);
    if (vm.groupUrn) {
      this.router.navigate(['/messenger', 'conversations', vm.groupUrn]);
    }
  }

  async onRejectInvite(msg: ChatMessage): Promise<void> {
    await this.appState.rejectInvite(msg);
  }

  onAlertVisibility(show: boolean): void {
    if (show) {
      const msgs = this.chatMessages();
      const latest = msgs[msgs.length - 1];
      if (latest?.textContent) {
        this.snackBar
          .open(`New: "${latest.textContent.slice(0, 30)}..."`, 'Scroll Down', {
            duration: 5000,
          })
          .onAction()
          .subscribe(() => this.autoScroll().scrollToBottom('smooth'));
      }
    } else {
      this.snackBar.dismiss();
    }
  }

  // --- ACTIONS ---

  onTyping(): void {
    this.appState.notifyTyping();
  }

  /**
   * ✅ PURE DELEGATION
   * The UI just hands the draft to the State.
   * No logic here about checking files vs text.
   */
  onSendDraft(draft: DraftMessage): void {
    this.appState.sendDraft(draft);
  }
}
