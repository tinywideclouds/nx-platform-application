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
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'messenger-chat-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatIconModule,
    MasterDetailLayoutComponent,
    ChatConversationListComponent,
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
    initialValue: [],
  });
  private activeConversations = this.chatService.activeConversations;
  private selectedConversationUrn = this.chatService.selectedConversation;

  /**
   * Transforms raw conversation summaries into rich view models
   * by joining with Contact data.
   */
  conversationsList = computed<ConversationViewItem[]>(() => {
    const summaries = this.activeConversations();
    const contacts = this.allContacts();
    const activeUrn = this.selectedConversationUrn();

    return summaries.map((summary) => {
      let name = 'Unknown';
      let initials = '?';
      let profilePictureUrl: string | undefined;

      if (summary.conversationUrn.entityType === 'user') {
        const contact = contacts.find((c) =>
          c.id.equals(summary.conversationUrn)
        );
        if (contact) {
          name = contact.alias;
          initials =
            (contact.firstName?.[0] || '') + (contact.surname?.[0] || '');
          profilePictureUrl =
            contact.serviceContacts['messenger']?.profilePictureUrl;
        }
      } else {
        name = 'Group';
        initials = 'G';
      }

      return {
        id: summary.conversationUrn,
        name,
        latestMessage: summary.latestSnippet || 'No messages',
        timestamp: summary.timestamp,
        initials: initials || name.slice(0, 2),
        profilePictureUrl,
        unreadCount: summary.unreadCount,
        isActive: activeUrn ? activeUrn.equals(summary.conversationUrn) : false,
      };
    });
  });

  // --- ACTIONS ---

  onConversationSelected(id: URN) {
    // Relative navigation: ./ID
    // This allows the router to handle the structure (e.g. /messenger/conversations/123)
    this.router.navigate([id.toString()], {
      relativeTo: this.router.routerState.root.firstChild?.firstChild,
      // Note: We'll refine the route relativity in the Routes definition phase if needed.
      // For now, absolute path is safer until we lock down the route tree.
    });

    // Better Approach for now: Absolute path to ensure stability during refactor
    this.router.navigate(['/messenger', 'conversations', id.toString()]);
  }

  /**
   * Helper to determine if we are viewing a specific chat
   * (Used to toggle visibility on mobile)
   */
  showDetail = computed(() => !!this.selectedConversationUrn());
}
