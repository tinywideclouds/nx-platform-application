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

// Services
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';
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
} from '@nx-platform-application/contacts-ui';
import { MessengerToolbarComponent } from '../messenger-toolbar/messenger-toolbar.component';
import { LogoutDialogComponent } from '../logout-dialog/logout-dialog.component'; // <-- Import

// Modules
import { MatDialog, MatDialogModule } from '@angular/material/dialog'; // <-- Import

@Component({
  selector: 'messenger-home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ChatConversationListComponent,
    ContactListComponent,
    ContactGroupListComponent,
    MessengerToolbarComponent,
    MatDialogModule, // <-- Add Module
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
  private logger = inject(Logger);
  private dialog = inject(MatDialog); // <-- Inject

  currentUser = this.authService.currentUser;
  
  private routerEvents$ = this.router.events;
  isChatActive = toSignal(
    this.routerEvents$.pipe(
      filter((event: Event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd) => event.urlAfterRedirects.includes('/chat/'))
    ),
    { initialValue: this.router.url.includes('/chat/') }
  );

  private conversations = this.chatService.activeConversations;
  contacts = toSignal(this.contactsService.contacts$, { initialValue: [] });
  groups = toSignal(this.contactsService.groups$, { initialValue: [] });
  selectedConversationId = computed(() => this.chatService.selectedConversation()?.toString());

  showNewChatPicker = signal(false);
  startChatView: WritableSignal<'contacts' | 'groups'> = signal('contacts');

  private contactsMap = computed(() => new Map(this.contacts().map((c) => [c.id.toString(), c])));
  private groupsMap = computed(() => new Map(this.groups().map((g) => [g.id.toString(), g])));

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
          initials = (contact.firstName?.[0] || '') + (contact.surname?.[0] || '');
          profilePictureUrl = contact.serviceContacts['messenger']?.profilePictureUrl;
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

  // --- Actions ---

  onComposeClick(): void {
    this.showNewChatPicker.set(true);
  }

  onAddressBookClick(): void {
    this.router.navigate(['/contacts']);
  }

  // --- LOGOUT LOGIC ---
  onLogoutClick(): void {
    // 1. Open Dialog
    const dialogRef = this.dialog.open(LogoutDialogComponent);

    // 2. Wait for result
    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        this.performLogout();
      }
    });
  }

  private performLogout(): void {
    // 3. Call Service to wipe data
    this.chatService.logout().then(() => {
      // 4. Navigate to login
      this.router.navigate(['/login']);
    });
  }

  onSelectConversation(urn: URN): void {
    if (urn) {
      this.showNewChatPicker.set(false);
      this.chatService.loadConversation(urn);
      this.router.navigate(['', 'chat', urn.toString()]);
    }
  }

  onSelectContactToChat(contact: Contact): void {
    this.onSelectConversation(contact.id);
  }

  onSelectGroupToChat(group: ContactGroup): void {
    this.onSelectConversation(group.id);
  }
}