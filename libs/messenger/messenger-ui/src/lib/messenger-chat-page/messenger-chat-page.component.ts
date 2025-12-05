import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

// LAYOUT & SHARED
import {
  MasterDetailLayoutComponent,
  FeaturePlaceholderComponent,
  ListFilterComponent,
} from '@nx-platform-application/platform-ui-toolkit';

// FEATURES
import {
  ChatConversationListComponent,
  ConversationViewItem,
} from '@nx-platform-application/chat-ui';
import { ContactsSidebarComponent } from '@nx-platform-application/contacts-ui';

// SERVICES
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';

// MATERIAL
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'messenger-chat-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
    MatTooltipModule,
    MasterDetailLayoutComponent,
    ChatConversationListComponent,
    FeaturePlaceholderComponent,
    ContactsSidebarComponent,
    ListFilterComponent,
  ],
  templateUrl: './messenger-chat-page.component.html',
  styleUrl: './messenger-chat-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerChatPageComponent {
  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private chatService = inject(ChatService);
  private contactsService = inject(ContactsStorageService);

  // --- UI STATE (Route Driven) ---
  /**
   * 'new' = Show Contacts/Groups Tabs
   * 'list' = Show Active Conversations
   */
  sidebarMode = toSignal(
    this.route.queryParams.pipe(
      map((params) => (params['sidebar'] === 'new' ? 'new' : 'list'))
    ),
    { initialValue: 'list' }
  );

  // --- UI STATE (Local) ---
  /**
   * The single source of truth for the filter string.
   * Feeds into EITHER conversationsList OR contacts-sidebar.
   */
  searchQuery = signal<string>('');

  // --- DATA SOURCES ---
  private allContacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });

  private allGroups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });

  private activeConversations = this.chatService.activeConversations;
  private selectedConversationUrn = this.chatService.selectedConversation;

  // --- COMPUTED: Filtered Conversation List ---
  conversationsList = computed<ConversationViewItem[]>(() => {
    const summaries = this.activeConversations();
    const contacts = this.allContacts();
    const groups = this.allGroups();
    const activeUrn = this.selectedConversationUrn();

    // 1. Prepare Filter Tokens (Forgiving Logic)
    const rawQuery = this.searchQuery();
    const tokens = rawQuery
      ? rawQuery
          .toLowerCase()
          .split(' ')
          .filter((t) => t.length > 0)
      : [];

    const validItems: ConversationViewItem[] = [];

    for (const summary of summaries) {
      const urn = summary.conversationUrn;
      let name = '';
      let initials = '';
      let profilePictureUrl: string | undefined;

      // 2a. Resolve User
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
      // 2b. Resolve Group
      else {
        const group = groups.find((g) => g.id.toString() === urn.toString());
        if (!group) continue;

        name = group.name;
        initials = 'G';
      }

      // 3. Apply Filter (Token-based)
      // If tokens exist, ALL tokens must be present in the name
      if (tokens.length > 0) {
        const searchableText = name.toLowerCase();
        const isMatch = tokens.every((token) => searchableText.includes(token));
        if (!isMatch) continue;
      }

      // 4. Construct View Item
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

  setSidebarMode(mode: 'list' | 'new') {
    // UX: Clear the filter when switching modes to avoid confusion
    this.searchQuery.set('');

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sidebar: mode === 'new' ? 'new' : null },
      queryParamsHandling: 'merge',
    });
  }

  onConversationSelected(id: URN) {
    this.router.navigate(['/messenger', 'conversations', id.toString()]);
  }

  onNewChatSelected(item: Contact | ContactGroup) {
    // 1. Close the "New Chat" sidebar (return to list)
    this.setSidebarMode('list');
    // 2. Navigate to the selected conversation
    this.router.navigate(['/messenger', 'conversations', item.id.toString()]);
  }

  showDetail = computed(() => !!this.selectedConversationUrn());
  hasConversations = computed(() => this.conversationsList().length > 0);
}
