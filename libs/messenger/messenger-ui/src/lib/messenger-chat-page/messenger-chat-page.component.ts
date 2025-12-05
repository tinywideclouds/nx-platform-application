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

// SHARED & UI
import {
  MasterDetailLayoutComponent,
  FeaturePlaceholderComponent,
  ListFilterComponent,
  ConfirmationDialogComponent,
} from '@nx-platform-application/platform-ui-toolkit';
import {
  ChatConversationListComponent,
  ConversationViewItem,
} from '@nx-platform-application/chat-ui';
import { ContactsSidebarComponent } from '@nx-platform-application/contacts-ui';
import { MessageRequestReviewComponent } from '../message-request-review/message-request-review.component';

// SERVICES
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
  PendingIdentity,
  ServiceContact,
} from '@nx-platform-application/contacts-storage';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';

// MATERIAL
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

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
    MatSnackBarModule,
    MatDialogModule,
    MasterDetailLayoutComponent,
    ChatConversationListComponent,
    FeaturePlaceholderComponent,
    ContactsSidebarComponent,
    ListFilterComponent,
    MessageRequestReviewComponent,
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
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  // --- STATE SIGNALS ---
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

  searchQuery = signal<string>('');

  /**
   * If true, the MAIN area shows the request review component
   * instead of the chat window.
   */
  showRequestsPane = signal(false);

  /**
   * Cache for peeked messages in the request review.
   * Key: URN string, Value: List of messages.
   */
  previewMessages = signal<Record<string, ChatMessage[]>>({});

  /**
   * Track which URNs are currently loading (for the spinner).
   */
  loadingPreviews = signal<Set<string>>(new Set());

  // --- DATA SOURCES ---
  private allContacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });

  private allGroups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });

  // Source of Truth for Pending Requests (Gatekeeper)
  pendingRequests = toSignal(this.contactsService.pending$, {
    initialValue: [] as PendingIdentity[],
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
        // This implicitly hides 'Pending' requests from the main list.
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
    this.searchQuery.set('');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sidebar: mode === 'new' ? 'new' : null },
      queryParamsHandling: 'merge',
    });
  }

  toggleRequestsPane() {
    this.showRequestsPane.update((v) => !v);

    // If opening requests, deselect active chat to avoid visual confusion
    if (this.showRequestsPane()) {
      this.chatService.loadConversation(null);
    }
  }

  onConversationSelected(id: URN) {
    // Ensure Request pane is closed when selecting a real chat
    this.showRequestsPane.set(false);
    this.router.navigate(['/messenger', 'conversations', id.toString()]);
  }

  onNewChatSelected(item: Contact | ContactGroup) {
    // 1. Close the "New Chat" sidebar (return to list)
    this.setSidebarMode('list');
    // 2. Close requests pane if open
    this.showRequestsPane.set(false);
    // 3. Navigate to the selected conversation
    this.router.navigate(['/messenger', 'conversations', item.id.toString()]);
  }

  // --- REQUEST REVIEW ACTIONS ---

  async onPeekRequests(urn: URN) {
    const urnStr = urn.toString();
    const cached = this.previewMessages()[urnStr];

    // ✅ FIX: Relaxed Check
    // If we have cached content, show it.
    // If we have cached "Empty Array" (from a failed/early fetch), allow retry!
    if (cached && cached.length > 0) {
      return;
    }

    // Start Loading
    this.loadingPreviews.update((s) => {
      const n = new Set(s);
      n.add(urnStr);
      return n;
    });

    try {
      // 1. Fetch
      const messages = await this.chatService.getQuarantinedMessages(urn);

      // 2. Map
      const viewMessages: ChatMessage[] = messages.map((m) => ({
        id: m.messageId,
        conversationUrn: m.conversationUrn,
        senderId: m.senderId,
        sentTimestamp: m.sentTimestamp,
        typeId: m.typeId,
        payloadBytes: m.payloadBytes,
        textContent: new TextDecoder().decode(m.payloadBytes),
      }));

      // 3. Update State
      this.previewMessages.update((state) => ({
        ...state,
        [urnStr]: viewMessages,
      }));
    } catch (e) {
      console.error('[UI] Peek Failed', e);
      this.showFeedback('Could not load preview', true);
    } finally {
      // 4. Stop Loading
      this.loadingPreviews.update((s) => {
        const n = new Set(s);
        n.delete(urnStr);
        return n;
      });
    }
  }

  async onAcceptRequest(urn: URN) {
    try {
      this.showFeedback('Accepting request...');

      // 1. Generate New Contact Identity
      const newContactId = URN.parse(
        `urn:contacts:user:${crypto.randomUUID()}`
      );

      // 2. Create Skeleton Contact from Handle
      const isEmail = urn.entityType === 'email';
      const initialAlias = isEmail ? urn.entityId : 'New Contact';

      const newContact: Contact = {
        id: newContactId,
        alias: initialAlias,
        firstName: '',
        surname: '',
        email: isEmail ? urn.entityId : '',
        emailAddresses: isEmail ? [urn.entityId] : [],
        phoneNumbers: [],
        serviceContacts: {
          messenger: {
            id: urn, // Link the Service Contact ID (The Handle)
            alias: initialAlias,
            lastSeen: new Date().toISOString() as ISODateTimeString,
          },
        },
        lastModified: new Date().toISOString() as ISODateTimeString,
      };

      // 3. Save Contact
      await this.contactsService.saveContact(newContact);

      // 4. Promote Messages (Data Move + Index Update)
      await this.chatService.promoteQuarantinedMessages(urn, newContactId);

      // 5. Cleanup Pending
      await this.contactsService.deletePending(urn);

      // 6. Redirect to "Edit Contact" Page
      this.showFeedback('Contact created. Opening details...');
      this.showRequestsPane.set(false);

      this.router.navigate(
        ['/messenger/contacts/edit', newContactId.toString()],
        {
          queryParams: { returnUrl: '/messenger/conversations' },
        }
      );
    } catch (e) {
      console.error('Failed to accept request', e);
      this.showFeedback('Failed to accept request', true);
    }
  }

  // ✅ CONFIRM & BLOCK
  async onBlockRequest(event: { urn: URN; scope: 'messenger' | 'all' }) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Block Sender?',
        icon: 'block',
        message: `This will block <strong>${event.urn.toString()}</strong> from contacting you on ${
          event.scope === 'all' ? 'ALL apps' : 'Messenger'
        }.<br><br>All pending messages will be deleted.`,
        confirmText: 'Block',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.chatService.block([event.urn], event.scope);
          this.showFeedback(`Blocked sender`);
        } catch (e) {
          console.error('Block failed', e);
          this.showFeedback('Failed to block', true);
        }
      }
    });
  }

  // ✅ CONFIRM & DISMISS
  async onDismissRequest(urn: URN) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Dismiss Request?',
        icon: 'delete',
        message: `This will remove the request and <strong>permanently delete</strong> the pending messages.<br><br>The sender is NOT blocked and can request again.`,
        confirmText: 'Dismiss',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.chatService.dismissPending([urn]);
          this.showFeedback(`Dismissed request`);
        } catch (e) {
          console.error('Dismiss failed', e);
          this.showFeedback('Failed to dismiss', true);
        }
      }
    });
  }

  async onBlockAll() {
    const allUrns = this.pendingRequests().map((r) => r.urn);
    if (allUrns.length === 0) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Block All Requests?',
        icon: 'gpp_bad',
        message: `Are you sure you want to block <strong>${allUrns.length} senders</strong>?<br>This action cannot be easily undone in bulk.`,
        confirmText: 'Block All',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        await this.chatService.block(allUrns, 'messenger');
        this.showFeedback('Blocked all requests');
      }
    });
  }

  private showFeedback(msg: string, isError = false) {
    this.snackBar.open(msg, undefined, {
      duration: 3000,
      panelClass: isError ? 'bg-red-500' : '',
    });
  }

  showDetail = computed(() => !!this.selectedConversationUrn());
  hasConversations = computed(() => this.conversationsList().length > 0);
}
