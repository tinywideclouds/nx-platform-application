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
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterOutlet, Event, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';

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

  private routerEvents$ = this.router.events;

  isChatActive = toSignal(
    this.routerEvents$.pipe(
      filter((event: Event): event is NavigationEnd => 
        event instanceof NavigationEnd
      ),
      map((event: NavigationEnd) => 
        event.urlAfterRedirects.includes('/chat/')
      )
    ),
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

  startChatView: WritableSignal<'contacts' | 'groups'> = signal('contacts');

  // --- 3. Create Lookups (for mapping) ---
  private contactsMap = computed(() =>
    // Create map with STRING keys
    new Map(this.contacts().map((c) => [c.id.toString(), c]))
  );
  private groupsMap = computed(() =>
    // Create map with STRING keys
    new Map(this.groups().map((g) => [g.id.toString(), g]))
  );

  // --- 4. Compute the "View Model" ---
  conversationViewItems = computed<ConversationViewItem[]>(() => {
    const contactsMap = this.contactsMap();
    const groupsMap = this.groupsMap();
    const selectedId = this.selectedConversationId();

    return this.conversations().map((summary) => {
      const conversationUrn = summary.conversationUrn;
      // --- FIX: Use string for map lookup ---
      const conversationUrnString = conversationUrn.toString();
      let name = 'Unknown';
      let initials = '?';
      let profilePictureUrl: string | undefined;

      if (summary.conversationUrn.entityType == 'user') {
        const contact = contactsMap.get(conversationUrnString); // <-- FIX
        if (contact) {
          name = contact.alias;
          initials = (contact.firstName?.[0] || '') + (contact.surname?.[0] || '');
          profilePictureUrl =
            contact.serviceContacts['messenger']?.profilePictureUrl;
        }
      } else if (summary.conversationUrn.entityType == 'group') {
        const group = groupsMap.get(conversationUrnString); // <-- FIX
        if (group) {
          name = group.name;
          initials = 'G';
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
        // --- FIX: Compare two strings ---
        isActive: selectedId === conversationUrnString,
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
  
  // --- FIX: Event is now a URN ---
  onSelectConversation(urn: URN): void {
    if (urn) {
      this.chatService.loadConversation(urn);
      // --- FIX: Navigate with string ---
      this.router.navigate(['', 'chat', urn.toString()]);
    }
  }

  onSelectContactToChat(contact: Contact): void {
    const urn = contact.id; // Get URN directly
  
    if (urn) {
      this.chatService.loadConversation(urn); 
      // --- FIX: Navigate with string ---
      this.router.navigate(['', 'chat', urn.toString()]);
    }
  }

  onSelectGroupToChat(group: ContactGroup): void {
    const urn = group.id; // Get URN directly
    
    if (urn) {
      this.chatService.loadConversation(urn);
      // --- FIX: Navigate with string ---
      this.router.navigate(['', 'chat', urn.toString()]);
    }
  }
}