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

import { ChatService } from '@nx-platform-application/messenger-state-chat-session';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import {
  MESSAGE_TYPE_TEXT,
  MESSAGE_TYPE_GROUP_INVITE,
  MESSAGE_TYPE_IMAGE,
  ImageContent,
  messageTagBroadcast,
  ContentPayload, // ✅ Import
} from '@nx-platform-application/messenger-domain-message-content';

import { AutoScrollDirective } from '@nx-platform-application/platform-ui-toolkit';
import {
  ChatMessageBubbleComponent,
  ChatMessageDividerComponent,
  ChatTypingIndicatorComponent,
  MessageRendererComponent,
  ChatInviteMessageComponent,
  InviteViewModel,
} from '@nx-platform-application/messenger-ui-chat';
import { ChatInputComponent } from '../chat-input/chat-input.component';
import { ContactNamePipe } from '@nx-platform-application/contacts-ui';

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
    ChatInputComponent,
    ContactNamePipe,
  ],
  providers: [DatePipe],
  templateUrl: './chat-conversation.component.html',
  styleUrl: './chat-conversation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatConversationComponent {
  private chatService = inject(ChatService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  autoScroll = viewChild.required<AutoScrollDirective>('autoScroll');

  chatMessages = this.chatService.messages;
  currentUserUrn = this.chatService.currentUserUrn;
  selectedConversation = this.chatService.selectedConversation;
  isLoading = this.chatService.isLoadingHistory;
  firstUnreadId = this.chatService.firstUnreadId;
  typingActivity = this.chatService.typingActivity;
  readCursors = this.chatService.readCursors;

  showNewMessageIndicator = signal(false);

  now = toSignal(interval(1000).pipe(map(() => Temporal.Now.instant())), {
    initialValue: Temporal.Now.instant(),
  });

  // Expose Constants to Template
  readonly MSG_TYPE_TEXT = MESSAGE_TYPE_TEXT;
  readonly MSG_TYPE_INVITE = MESSAGE_TYPE_GROUP_INVITE;
  readonly MSG_TYPE_IMAGE = MESSAGE_TYPE_IMAGE;

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

  // --- VIEW HELPERS ---

  /**
   * Safe Accessor for Switch Case
   * Ensures we compare strings to strings
   */
  getTypeId(msg: ChatMessage): string {
    return msg.typeId.toString();
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

  /**
   * ✅ FIXED: Robust Payload Hydration
   * 1. Prefers pre-decoded text (fixes broken text messages).
   * 2. Safely handles Byte Arrays (fixes crashes on image decode).
   */
  getContentPayload(msg: ChatMessage): ContentPayload | null {
    // A. Fast Path: Text (Pre-decoded by Mapper)
    if (this.getTypeId(msg) === MESSAGE_TYPE_TEXT && msg.textContent) {
      return { kind: 'text', text: msg.textContent };
    }

    // B. Safety Check
    if (!msg.payloadBytes || (msg.payloadBytes as any).length === 0) {
      return null;
    }

    try {
      // C. Normalization: Ensure Uint8Array (IndexedDB can return regular Arrays)
      // This is often the cause of "Unsupported" or crash errors in decoders.
      const bytes =
        msg.payloadBytes instanceof Uint8Array
          ? msg.payloadBytes
          : new Uint8Array(Object.values(msg.payloadBytes));

      const decoded = new TextDecoder().decode(bytes);

      // Text Fallback (if bytes existed but textContent was null)
      if (this.getTypeId(msg) === MESSAGE_TYPE_TEXT) {
        return { kind: 'text', text: decoded };
      }

      // JSON Content (Image, Contact, etc)
      return JSON.parse(decoded);
    } catch (e) {
      console.warn(
        `[ChatConversation] Failed to hydrate payload for ${msg.id}`,
        e,
      );
      return null;
    }
  }

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
    const restoredText = await this.chatService.recoverFailedMessage(msg.id);
    console.log('Retried message:', restoredText);
  }

  onContentAction(urnString: string): void {
    this.router.navigate(['/contacts/edit', urnString]);
  }

  onTyping(): void {
    this.chatService.notifyTyping();
  }

  onSendMessage(text: string): void {
    const recipient = this.selectedConversation();
    if (text && recipient) {
      this.chatService.sendMessage(recipient, text);
    }
  }

  onSendImage(content: ImageContent): void {
    const recipient = this.selectedConversation();
    if (recipient) {
      this.chatService.sendImage(recipient, content);
    }
  }

  async onAcceptInvite(msg: ChatMessage): Promise<void> {
    await this.chatService.acceptInvite(msg);
    const vm = this.getInviteViewModel(msg);
    if (vm.groupUrn) {
      this.router.navigate(['/messenger', 'conversations', vm.groupUrn]);
    }
  }

  async onRejectInvite(msg: ChatMessage): Promise<void> {
    await this.chatService.rejectInvite(msg);
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
}
