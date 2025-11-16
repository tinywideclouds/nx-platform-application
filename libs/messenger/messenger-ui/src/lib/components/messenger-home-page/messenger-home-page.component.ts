// libs/messenger/messenger-ui/src/lib/messenger-home-page/messenger-home-page.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
// 1. Import toSignal and router events
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet, Event, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators'; // 2. Import RxJS operators

// --- Our Services ---
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';

import {
  URN,
} from '@nx-platform-application/platform-types';

import {
  Logger
} from '@nx-platform-application/console-logger';

// --- Our "Dumb" UI Libs ---
import {
  ChatConversationListComponent,
  ConversationViewItem,
} from '@nx-platform-application/chat-ui';
import {
  ContactListComponent,
  ContactGroupListComponent,
} from '@nx-platform-application/contacts-ui';

@Component({
  selector: 'messenger-home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ChatConversationListComponent,
    ContactListComponent,
    ContactGroupListComponent,
  ],
  templateUrl: './messenger-home-page.component.html',
  styleUrl: './messenger-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerHomePageComponent {
  private chatService = inject(ChatService);
  private contactsService = inject(ContactsStorageService);
  private router = inject(Router);
  private logger = inject(Logger);

  // --- 3. Create a signal that tracks router events ---
  private routerEvents$ = this.router.events;

  // --- 4. NEW: Signal to track if a chat is active ---
  /**
   * Reads the router events and checks if the current URL
   * includes '/chat/'. This is used to toggle the mobile
   * chat overlay.
   */
  isChatActive = toSignal(
    this.routerEvents$.pipe(
      filter((event: Event): event is NavigationEnd => 
        event instanceof NavigationEnd
      ),
      map((event: NavigationEnd) => 
        event.urlAfterRedirects.includes('/chat/')
      )
    ),
    // Check the initial URL on load
    { initialValue: this.router.url.includes('/chat/') }
  );

  // --- 1. Get State from Services ---
  private conversations = this.chatService.activeConversations;
  contacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });
  groups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });
  selectedConversationId = computed(() =>
    this.chatService.selectedConversation()?.toString()
  );

  // --- 2. Add new UI State Signal ---
  startChatView: WritableSignal<'contacts' | 'groups'> = signal('contacts');

  // --- 3. Create Lookups (for mapping) ---
  private contactsMap = computed(() =>
    new Map(this.contacts().map((c) => [c.id, c]))
  );
  private groupsMap = computed(() =>
    new Map(this.groups().map((g) => [g.id, g]))
  );

  // --- 4. Compute the "View Model" ---
  conversationViewItems = computed<ConversationViewItem[]>(() => {
    const contactsMap = this.contactsMap();
    const groupsMap = this.groupsMap();
    const selectedId = this.selectedConversationId();

    return this.conversations().map((summary) => {
      const conversationUrn = summary.conversationUrn;
      let name = 'Unknown';
      let initials = '?';
      let profilePictureUrl: string | undefined;

      // --- This is the key "join" logic ---
      if (summary.conversationUrn.entityType == 'user') {
        const contact = contactsMap.get(conversationUrn);
        if (contact) {
          name = contact.alias;
          initials = (contact.firstName?.[0] || '') + (contact.surname?.[0] || '');
          profilePictureUrl =
            contact.serviceContacts['messenger']?.profilePictureUrl;
        }
      } else if (summary.conversationUrn.entityType == 'group') {
        const group = groupsMap.get(conversationUrn.entityId);
        if (group) {
          name = group.name;
          initials = 'G'; // Placeholder for group avatar
        }
      }

      return {
        id: conversationUrn,
        name: name,
        latestMessage: summary.latestSnippet,
        timestamp: summary.timestamp,
        initials: initials.toUpperCase() || '?',
        profilePictureUrl: profilePictureUrl,
        unreadCount: summary.unreadCount,
        isActive: selectedId === conversationUrn.entityId,
      };
    });
  });

  // --- 5. Compute the View Mode ---
  viewMode = computed(() => {
    if (this.conversations().length > 0) {
      return 'conversations';
    }
    if (this.contacts().length > 0) {
      return 'start_conversation';
    }
    return 'new_user_welcome';
  });

  // --- 6. Event Handlers ---
  onSelectConversation(id: string): void {
    const urn = this.conversations().find(
      (c) => c.conversationUrn.toString() === id
    )?.conversationUrn;

    if (urn) {
      this.chatService.loadConversation(urn);
      // Navigate to the chat window (which will be in the router-outlet)
      // 5. Use relative root navigation
      this.router.navigate(['', 'chat', id]);
    }
  }

  onSelectContactToChat(contact: Contact): void {
    const urn= this.contacts().find((c) => c.id === contact.id)?.id;
  
    if (urn) {
      this.chatService.loadConversation(urn); 
      // 5. Use relative root navigation
      this.router.navigate(['', 'chat', urn]);
    }
  }

  onSelectGroupToChat(group: ContactGroup): void {
    const urnString = this.groups().find((g) => g.id === group.id)?.id;
    if (!urnString) {
      console.warn("urn must exist and parse")
      return;
    }
    const urn = URN.parse(urnString);
    if (urn) {
      this.chatService.loadConversation(urn);
      // 5. Use relative root navigation
      this.router.navigate(['', 'chat', urn]);
    }
  }
}