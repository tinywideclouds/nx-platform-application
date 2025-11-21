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
import {
  Router,
  RouterOutlet,
  Event,
  NavigationEnd,
  ActivatedRoute,
} from '@angular/router';
import { filter, map } from 'rxjs/operators';

// Services
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-access';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/console-logger';

// Components
import {
  ChatConversationListComponent,
  ConversationViewItem,
} from '@nx-platform-application/chat-ui';
import {
  ContactListComponent,
  ContactGroupListComponent,
  ContactsViewerComponent,
} from '@nx-platform-application/contacts-ui';

import {
  MessengerToolbarComponent,
  SidebarView,
} from '../messenger-toolbar/messenger-toolbar.component';
import { LogoutDialogComponent } from '../logout-dialog/logout-dialog.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'messenger-home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ChatConversationListComponent,
    ContactListComponent,
    ContactGroupListComponent,
    ContactsViewerComponent,
    MessengerToolbarComponent,
    MatDialogModule,
  ],
  templateUrl: './messenger-home-page.component.html',
  styleUrl: './messenger-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerHomePageComponent {
  private chatService = inject(ChatService);
  private contactsService = inject(ContactsStorageService);
  private authService = inject(IAuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private logger = inject(Logger);
  private dialog = inject(MatDialog);

  currentUser = this.authService.currentUser;

  // --- Router & View State ---
  private routerEvents$ = this.router.events;
  isChatActive = toSignal(
    this.routerEvents$.pipe(
      filter(
        (event: Event): event is NavigationEnd => event instanceof NavigationEnd
      ),
      map((event: NavigationEnd) => event.urlAfterRedirects.includes('/chat/'))
    ),
    { initialValue: this.router.url.includes('/chat/') }
  );

  private queryParams = toSignal(this.route.queryParams);

  sidebarView = computed<SidebarView>(() => {
    const view = this.queryParams()?.['view'];
    if (view === 'compose' || view === 'contacts') {
      return view;
    }
    return 'conversations'; // Default
  });

  // --- Data State ---
  private conversations = this.chatService.activeConversations;
  contacts = toSignal(this.contactsService.contacts$, { initialValue: [] });
  groups = toSignal(this.contactsService.groups$, { initialValue: [] });
  selectedConversationId = computed(() =>
    this.chatService.selectedConversation()?.toString()
  );

  startChatView: WritableSignal<'contacts' | 'groups'> = signal('contacts');

  private contactsMap = computed(
    () => new Map(this.contacts().map((c) => [c.id.toString(), c]))
  );
  private groupsMap = computed(
    () => new Map(this.groups().map((g) => [g.id.toString(), g]))
  );

  conversationViewItems = computed<ConversationViewItem[]>(() => {
    const contactsMap = this.contactsMap();
    const groupsMap = this.groupsMap();
    const selectedId = this.selectedConversationId();

    return this.conversations().map((summary) => {
      const conversationUrn = summary.conversationUrn;
      const conversationUrnString = conversationUrn.toString();
      let name = 'Unknown';
      let initials = '?';
      let profilePictureUrl: string | undefined;

      if (summary.conversationUrn.entityType == 'user') {
        const contact = contactsMap.get(conversationUrnString);
        if (contact) {
          name = contact.alias;
          initials =
            (contact.firstName?.[0] || '') + (contact.surname?.[0] || '');
          profilePictureUrl =
            contact.serviceContacts['messenger']?.profilePictureUrl;
        }
      } else if (summary.conversationUrn.entityType == 'group') {
        const group = groupsMap.get(conversationUrnString);
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
        isActive: selectedId === conversationUrnString,
      };
    });
  });

  // --- Navigation Actions ---

  // FIX: Navigate to ['.'] (relative to this route) instead of []
  // This forces the router to strip any child routes (like /chat/:id),
  // resetting the main window to the default state (empty) while changing the sidebar view.

  onViewConversations(): void {
    this.router.navigate(['.'], {
      relativeTo: this.route,
      queryParams: { view: 'conversations' },
      // We generally don't need queryParamsHandling: 'merge' here if we are resetting the view
    });
  }

  onViewCompose(): void {
    this.router.navigate(['.'], {
      relativeTo: this.route,
      queryParams: { view: 'compose' },
    });
  }

  onViewContacts(): void {
    this.router.navigate(['.'], {
      relativeTo: this.route,
      queryParams: { view: 'contacts' },
    });
  }

  onAddressBookClick(): void {
    this.router.navigate(['/contacts']);
  }

  onLogoutClick(): void {
    const dialogRef = this.dialog.open(LogoutDialogComponent);
    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        this.chatService.logout().then(() => {
          this.router.navigate(['/login']);
        });
      }
    });
  }

  onSelectConversation(urn: URN): void {
    if (urn) {
      // If we are selecting a conversation, we usually want to switch back to the list view
      // so the user sees their active chat in context.
      // we no longer need to load manually
      // this.chatService.loadConversation(urn);
      this.router.navigate(['', 'chat', urn.toString()], {
        // Reset view to conversations when entering a chat
        queryParams: { view: 'conversations' },
      });
    }
  }

  onSelectContactToChat(contact: Contact): void {
    if (this.sidebarView() === 'contacts') {
      // MODE: ADDRESS BOOK
      // Action: Open Contact Details (Card).
      // This loads the details route, which displays the card in the main window.
      this.router.navigate(['', 'chat', contact.id.toString(), 'details'], {
        queryParamsHandling: 'preserve',
      });
    } else {
      // MODE: COMPOSE
      // Action: Start/Open Conversation.
      this.onSelectConversation(contact.id);
    }
  }

  onSelectGroupToChat(group: ContactGroup): void {
    if (this.sidebarView() === 'contacts') {
      // Future: Open Group Details Card
      this.onSelectConversation(group.id);
    } else {
      this.onSelectConversation(group.id);
    }
  }

  onResetKeysClick(): void {
    // Basic confirmation
    if (
      confirm(
        'Are you sure? This will generate new keys and upload them. Existing chats might break.'
      )
    ) {
      this.chatService.resetIdentityKeys();
    }
  }
}
