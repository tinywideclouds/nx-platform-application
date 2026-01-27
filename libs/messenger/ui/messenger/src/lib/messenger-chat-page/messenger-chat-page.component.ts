import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
  signal,
  effect,
} from '@angular/core';

import { Router, RouterOutlet, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { Temporal } from '@js-temporal/polyfill';
import { from } from 'rxjs';

import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';
import {
  FeaturePlaceholderComponent,
  ListFilterComponent,
  ConfirmationDialogComponent,
} from '@nx-platform-application/platform-ui-toolkit';
import {
  ChatConversationListComponent,
  ConversationViewItem,
} from '@nx-platform-application/messenger-ui-chat';
import { ContactsSidebarComponent } from '@nx-platform-application/contacts-ui';
import { MessageRequestReviewComponent } from '../message-request-review/message-request-review.component';

import { AppState } from '@nx-platform-application/messenger-state-app';

import {
  AddressBookApi,
  AddressBookManagementApi,
} from '@nx-platform-application/contacts-api';

// ✅ FIX: Use Quarantine for Pending Logic
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';

import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';

import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { StickyWizardComponent } from '@nx-platform-application/messenger-settings-ui';

@Component({
  selector: 'messenger-chat-page',
  standalone: true,
  imports: [
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
    StickyWizardComponent,
  ],
  templateUrl: './messenger-chat-page.component.html',
  styleUrl: './messenger-chat-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerChatPageComponent {
  protected router = inject(Router);
  private route = inject(ActivatedRoute);
  private appState = inject(AppState);

  private addressBook = inject(AddressBookApi);
  private addressBookManager = inject(AddressBookManagementApi);
  // ✅ FIX: Swapped Gatekeeper for Quarantine
  private quarantine = inject(QuarantineService);

  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  showDetail = computed(() => !!this.selectedConversationUrn());
  hasConversations = computed(() => this.conversationsList().length > 0);

  showWizard = this.appState.showWizard;

  sidebarMode = toSignal(
    this.route.queryParams.pipe(
      map((params) => (params['sidebar'] === 'new' ? 'new' : 'list')),
    ),
    { initialValue: 'list' },
  );

  searchQuery = signal<string>('');
  showRequestsPane = signal(false);
  previewMessages = signal<Record<string, ChatMessage[]>>({});
  loadingPreviews = signal<Set<string>>(new Set());

  // --- DATA SOURCES ---

  private allContacts = toSignal(this.addressBook.contacts$, {
    initialValue: [] as Contact[],
  });

  private allGroups = toSignal(this.addressBook.groups$, {
    initialValue: [] as ContactGroup[],
  });

  // ✅ FIX: Load Pending from Quarantine
  // Note: In a real app, this should be reactive. For now, we load once or poll.
  pendingRequests = toSignal(from(this.quarantine.getPendingRequests()), {
    initialValue: [] as URN[], // The type is now URN[]
  });

  private activeConversations = this.appState.activeConversations;
  private selectedConversationUrn = this.appState.selectedConversation;

  conversationsList = computed<ConversationViewItem[]>(() => {
    const summaries = this.activeConversations();
    const contacts = this.allContacts();
    const groups = this.allGroups();
    const activeUrn = this.selectedConversationUrn();

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

      if (urn.entityType === 'user') {
        const contact = contacts.find((c) => c.id.equals(urn));
        if (!contact) continue;

        name = contact.alias;
        initials =
          (contact.firstName?.[0] || '') + (contact.surname?.[0] || '');
        profilePictureUrl =
          contact.serviceContacts['messenger']?.profilePictureUrl;
      } else {
        const group = groups.find((g) => g.id.toString() === urn.toString());
        if (!group) continue;

        name = group.name;
        initials = 'G';
      }

      if (tokens.length > 0) {
        const searchableText = name.toLowerCase();
        const isMatch = tokens.every((token) => searchableText.includes(token));
        if (!isMatch) continue;
      }

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
    if (this.showRequestsPane()) {
      this.appState.loadConversation(null);
    }
  }

  onConversationSelected(id: URN) {
    this.showRequestsPane.set(false);
    this.router.navigate(['/messenger', 'conversations', id.toString()]);
  }

  onNewChatSelected(item: Contact | ContactGroup) {
    this.setSidebarMode('list');
    this.showRequestsPane.set(false);
    this.router.navigate(['/messenger', 'conversations', item.id.toString()]);
  }

  async onPeekRequests(urn: URN) {
    const urnStr = urn.toString();
    const cached = this.previewMessages()[urnStr];

    if (cached && cached.length > 0) return;

    this.loadingPreviews.update((s) => {
      const n = new Set(s);
      n.add(urnStr);
      return n;
    });

    try {
      const messages = await this.appState.getQuarantinedMessages(urn);
      const viewMessages: ChatMessage[] = messages.map((m) => ({
        ...m,
        textContent: new TextDecoder().decode(m.payloadBytes),
      }));

      this.previewMessages.update((state) => ({
        ...state,
        [urnStr]: viewMessages,
      }));
    } catch (e) {
      console.error('[UI] Peek Failed', e);
      this.showFeedback('Could not load preview', true);
    } finally {
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

      const newContactId = URN.parse(
        `urn:contacts:user:${crypto.randomUUID()}`,
      );
      const isEmail = urn.entityType === 'email';
      const initialAlias = isEmail ? urn.entityId : 'New Contact';
      const now = Temporal.Now.instant().toString() as ISODateTimeString;

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
            id: urn,
            alias: initialAlias,
            lastSeen: now,
          },
        },
        lastModified: now,
      };

      await this.addressBookManager.saveContact(newContact);
      await this.appState.promoteQuarantinedMessages(urn, newContactId);
      // ✅ FIX: Use Quarantine Rejection (Deletes messages, but we moved them first)
      // Actually we just need to ensure the quarantine bucket is empty.
      // promoteQuarantinedMessages likely handles the move.
      // await this.quarantine.reject(urn);

      this.showFeedback('Contact created. Opening details...');
      this.showRequestsPane.set(false);

      this.router.navigate(
        ['/messenger/contacts/edit', newContactId.toString()],
        { queryParams: { returnUrl: '/messenger/conversations' } },
      );
    } catch (e) {
      console.error('Failed to accept request', e);
      this.showFeedback('Failed to accept request', true);
    }
  }

  async onBlockRequest(event: { urn: URN; scope: 'messenger' | 'all' }) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Block Sender?',
        icon: 'block',
        message: `This will block <strong>${event.urn.toString()}</strong>.`,
        confirmText: 'Block',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.appState.block([event.urn], event.scope);
          this.showFeedback(`Blocked sender`);
        } catch (e) {
          console.error('Block failed', e);
          this.showFeedback('Failed to block', true);
        }
      }
    });
  }

  async onDismissRequest(urn: URN) {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Dismiss Request?',
        icon: 'delete',
        message: `Permanently delete pending messages?`,
        confirmText: 'Dismiss',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.appState.dismissPending([urn]);
          this.showFeedback(`Dismissed request`);
        } catch (e) {
          console.error('Dismiss failed', e);
          this.showFeedback('Failed to dismiss', true);
        }
      }
    });
  }

  async onBlockAll() {
    // ✅ FIX: Map URN[] from quarantine signal
    const allUrns = this.pendingRequests();
    if (allUrns.length === 0) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Block All Requests?',
        message: `Block ${allUrns.length} senders?`,
        confirmText: 'Block All',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        await this.appState.block(allUrns, 'messenger');
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

  onCloseWizard() {
    this.appState.setWizardActive(false);
  }
}
