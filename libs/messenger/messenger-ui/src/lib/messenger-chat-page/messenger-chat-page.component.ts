import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

// LAYOUT
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-toolkit';

// FEATURES
import {
  ChatConversationListComponent,
  ConversationViewItem,
} from '@nx-platform-application/chat-ui';

// SERVICES
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';
import { MatIconModule } from '@angular/material/icon';
import { MessengerNetworkStatusComponent } from '../messenger-network-status/messenger-network-status.component';

@Component({
  selector: 'messenger-chat-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatIconModule,
    MasterDetailLayoutComponent,
    ChatConversationListComponent,
    MessengerNetworkStatusComponent,
  ],
  templateUrl: './messenger-chat-page.component.html',
  styleUrl: './messenger-chat-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerChatPageComponent {
  protected router = inject(Router);
  private chatService = inject(ChatService);
  private contactsService = inject(ContactsStorageService);

  // --- DATA SOURCES ---
  private allContacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });

  // Added: Needed to validate group chats
  private allGroups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });

  private activeConversations = this.chatService.activeConversations;
  private selectedConversationUrn = this.chatService.selectedConversation;

  /**
   * Transforms raw summaries into view models.
   * FILTERS OUT: Conversations where the Contact/Group is not known (Pending/Blocked).
   */
  conversationsList = computed<ConversationViewItem[]>(() => {
    const summaries = this.activeConversations();
    const contacts = this.allContacts();
    const groups = this.allGroups();
    const activeUrn = this.selectedConversationUrn();

    const validItems: ConversationViewItem[] = [];

    for (const summary of summaries) {
      const urn = summary.conversationUrn;
      let name = '';
      let initials = '';
      let profilePictureUrl: string | undefined;

      // 1. User Logic
      if (urn.entityType === 'user') {
        const contact = contacts.find((c) => c.id.equals(urn));

        // GATEKEEPER: If not in contacts, skip it.
        if (!contact) continue;

        name = contact.alias;
        initials =
          (contact.firstName?.[0] || '') + (contact.surname?.[0] || '');
        profilePictureUrl =
          contact.serviceContacts['messenger']?.profilePictureUrl;
      }
      // 2. Group Logic
      else {
        const group = groups.find((g) => g.id.toString() === urn.toString());

        // GATEKEEPER: If group not found, skip it.
        if (!group) continue;

        name = group.name;
        initials = 'G';
      }

      // 3. Construct View Item
      validItems.push({
        id: urn,
        name,
        latestMessage: summary.latestSnippet || 'No messages',
        timestamp: summary.timestamp,
        initials: initials || name.slice(0, 2).toUpperCase(),
        profilePictureUrl,
        unreadCount: summary.unreadCount,
        isActive: activeUrn ? activeUrn.equals(urn) : false,
      });
    }

    return validItems;
  });

  // --- ACTIONS ---

  onConversationSelected(id: URN) {
    this.router.navigate(['/messenger', 'conversations', id.toString()]);
  }

  showDetail = computed(() => !!this.selectedConversationUrn());
}
