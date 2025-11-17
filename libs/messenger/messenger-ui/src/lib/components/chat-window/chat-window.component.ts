// libs/messenger/messenger-ui/src/lib/chat-window/chat-window.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  effect,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router'; // RouterLink removed
import { toSignal } from '@angular/core/rxjs-interop';

// --- Services ---
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import {
  IAuthService,
} from '@nx-platform-application/platform-auth-data-access'; // IAuthService
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/console-logger';

// --- Types ---
import {
  ChatMessage,
  ChatParticipant,
} from '@nx-platform-application/messenger-types';

@Component({
  selector: 'messenger-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule], // RouterLink removed
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowComponent implements AfterViewChecked {
  // --- 1. Injected Services & Route ---
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chatService = inject(ChatService);
  private contactsService = inject(ContactsStorageService);
  private authService = inject(IAuthService); // Injected but not used

  @ViewChild('messageContainer')
  private messageContainer!: ElementRef;

  // --- 2. State from Services ---
  messages = this.chatService.messages;
  currentConversationUrn = this.chatService.selectedConversation;
  currentUserUrn = this.chatService.currentUserUrn;

  private contacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });
  private groups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });

  // --- 3. Route & Component State ---
  private routeParams = toSignal(this.route.paramMap);
  newMessageText = '';

  conversationUrnString = computed(() => this.routeParams()?.get('id') || null);

  conversationUrn = computed(() => {
    const urnStr = this.conversationUrnString();
    if (!urnStr) return null;
    try {
      return URN.parse(urnStr);
    } catch (err) {
      this.logger.error('Failed to parse URN from route:', err);
      return null;
    }
  });

  // --- 4. Computed View Models ---
  participant = computed<ChatParticipant | null>(() => {
    const urn = this.conversationUrn();
    if (!urn) return null;

    if (urn.entityType === 'user') {
      // Find by comparing two URN objects
      const contact = this.contacts().find((c) => c.id.equals(urn));
      if (!contact) return { urn, name: 'Unknown User', initials: '?' };
      return {
        urn,
        name: contact.alias,
        initials:
          (contact.firstName?.[0] || '') + (contact.surname?.[0] || ''),
        profilePictureUrl:
          contact.serviceContacts['messenger']?.profilePictureUrl,
      };
    }

    if (urn.entityType === 'group') {
      // --- THIS IS THE FIX ---
      // Compare two strings: the URN from the group (g.id) and the URN from the route (urn)
      const group = this.groups().find((g) => g.id.toString() === urn.toString());
      // --- END FIX ---
      if (!group) return { urn, name: 'Unknown Group', initials: 'G' };
      return {
        urn,
        name: group.name,
        initials: 'G',
      };
    }
    return null;
  });

  // --- 5. Effects ---
  constructor(private logger: Logger) {
    effect(() => {
      const urn = this.conversationUrn();
      
      if (urn) {
        untracked(() => {
          this.chatService.loadConversation(urn);
        });
      }
    });
  }

  // --- 6. Lifecycle for Scrolling ---
  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.messageContainer.nativeElement.scrollTop =
        this.messageContainer.nativeElement.scrollHeight;
    } catch (err) {
      // Errors here are common during init, safe to ignore
    }
  }

  // --- 7. Event Handlers ---
  onSendMessage(): void {
    const text = this.newMessageText.trim();
    const recipientUrn = this.conversationUrn();

    if (text && recipientUrn) {
      this.chatService.sendMessage(recipientUrn, text);
      this.newMessageText = '';
      this.scrollToBottom();
    }
  }

  onBack(): void {
    // --- FIX: Navigate back to the base route ---
    // We were navigating to '/' which is wrong
    this.router.navigate(['/messenger']);
  }
}