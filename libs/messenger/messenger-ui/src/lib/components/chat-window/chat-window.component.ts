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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

// --- Services ---
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import {
  AuthService,
  IAuthService,
} from '@nx-platform-application/platform-auth-data-access';
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
  // RouterLink is no longer needed, as we use onBack()
  imports: [CommonModule, FormsModule],
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
  private authService = inject(IAuthService);

  @ViewChild('messageContainer')
  private messageContainer!: ElementRef;

  // --- 2. State from Services ---
  // All state now comes directly from the services
  messages = this.chatService.messages;
  currentConversationUrn = this.chatService.selectedConversation;
  currentUserUrn = this.chatService.currentUserUrn;

  // Real state from contacts service
  private contacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });
  private groups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });

  // --- 3. Route & Component State ---
  private routeParams = toSignal(this.route.paramMap);
  newMessageText = ''; // Using simple string for ngModel

  // Get the URN string from the route
  conversationUrnString = computed(() => this.routeParams()?.get('id') || null);

  // Parse the URN string into a URN object
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
      const contact = this.contacts().find((c) => c.id === urn);
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
      const group = this.groups().find((g) => g.id === urn.toString());
      if (!group) return { urn, name: 'Unknown Group', initials: 'G' };
      return {
        urn,
        name: group.name,
        initials: 'G',
        // profilePictureUrl: group.avatarUrl (if we add this)
      };
    }
    return null;
  });

  // --- 5. Effects ---
  // This effect reacts to the URN string changing and tells ChatService to load
  constructor(private logger: Logger) {
    effect(() => {
      // 1. This effect will *only* re-run when conversationUrn() changes.
      const urn = this.conversationUrn();
      
      if (urn) {
        // 2. We explicitly call the service in an "untracked" context.
        // This tells the effect to NOT track any signals that might
        // be read *inside* loadConversation().
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
      this.logger.error('Failed to scroll', err);
    }
  }

  // --- 7. Event Handlers ---
  onSendMessage(): void {
    const text = this.newMessageText.trim();
    const recipientUrn = this.conversationUrn();

    if (text && recipientUrn) {
      // Call the ChatService method
      this.chatService.sendMessage(recipientUrn, text);

      this.newMessageText = '';
      this.scrollToBottom();
    }
  }

  /**
   * On mobile, navigate back to the conversation list.
   */
  onBack(): void {
    this.router.navigate(['/']);
  }
}