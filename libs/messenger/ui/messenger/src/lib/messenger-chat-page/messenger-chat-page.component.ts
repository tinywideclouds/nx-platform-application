import {
  Component,
  inject,
  computed,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';

import { Router, RouterOutlet, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { from } from 'rxjs';
import { Temporal } from '@js-temporal/polyfill';

// UI Layouts & Toolkits
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';
import {
  FeaturePlaceholderComponent,
  ListFilterComponent,
  ConfirmationDialogComponent,
} from '@nx-platform-application/platform-ui-toolkit';

// Chat UI Components
import { ChatConversationListComponent } from '@nx-platform-application/messenger-ui-chat';
import { ContactsSidebarComponent } from '@nx-platform-application/contacts-ui';
import { MessageRequestReviewComponent } from '../message-request-review/message-request-review.component';
import { StickyWizardComponent } from '@nx-platform-application/messenger-settings-ui';

// State & Data
import { AppState } from '@nx-platform-application/messenger-state-app';
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';

// Domain & Logic
import { QuarantineService } from '@nx-platform-application/messenger-domain-quarantine';
import { AddressBookManagementApi } from '@nx-platform-application/contacts-api';

// Types
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';

// Material
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

  // State Services
  private appState = inject(AppState);
  private chatData = inject(ChatDataService);

  // Action Services
  private addressBookManager = inject(AddressBookManagementApi);
  private quarantine = inject(QuarantineService);

  // UI Utilities
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  // --- UI SIGNALS ---

  showDetail = computed(() => !!this.appState.selectedConversation());

  // Direct check against the UI Source
  hasConversations = computed(() => this.chatData.uiConversations().length > 0);

  showWizard = this.appState.showWizard;

  sidebarMode = toSignal(
    this.route.queryParams.pipe(
      map((params) => (params['sidebar'] === 'new' ? 'new' : 'list')),
    ),
    { initialValue: 'list' },
  );

  searchQuery = signal<string>('');
  showRequestsPane = signal(false);

  // --- QUARANTINE DATA ---

  pendingRequests = toSignal(from(this.quarantine.getPendingRequests()), {
    initialValue: [] as URN[],
  });

  previewMessages = signal<Record<string, ChatMessage[]>>({});
  loadingPreviews = signal<Set<string>>(new Set());

  // --- THE CORE LIST (Zero Mapping) ---

  /**
   * Consumes UIConversation[] directly.
   * Handles local filtering and adding 'isActive' state.
   */
  conversationsList = computed(() => {
    const all = this.chatData.uiConversations();
    const query = this.searchQuery().toLowerCase().trim();
    const activeUrn = this.appState.selectedConversation()?.id;

    // 1. Filter
    const filtered = !query
      ? all
      : all.filter((item) => item.name.toLowerCase().includes(query));

    // 2. Attach UI State (isActive) - No data transformation
    return filtered.map((item) => ({
      ...item,
      isActive: activeUrn ? activeUrn.equals(item.id) : false,
    }));
  });

  // --- NAVIGATION ACTIONS ---

  setSidebarMode(mode: 'list' | 'new') {
    this.searchQuery.set('');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sidebar: mode === 'new' ? 'new' : null },
      queryParamsHandling: 'merge',
    });
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

  toggleRequestsPane() {
    this.showRequestsPane.update((v) => !v);
    if (this.showRequestsPane()) {
      this.appState.loadConversation(null);
    }
  }

  // --- QUARANTINE ACTIONS ---

  async onPeekRequests(urn: URN) {
    const urnStr = urn.toString();
    if (this.previewMessages()[urnStr]) return;

    this.loadingPreviews.update((s) => new Set(s).add(urnStr));

    try {
      const messages = await this.appState.getQuarantinedMessages(urn);
      const viewMessages = messages.map((m) => ({
        ...m,
        textContent: new TextDecoder().decode(m.payloadBytes),
      }));

      this.previewMessages.update((state) => ({
        ...state,
        [urnStr]: viewMessages,
      }));
    } catch (e) {
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
          messenger: { id: urn, alias: initialAlias, lastSeen: now },
        },
        lastModified: now,
      };

      await this.addressBookManager.saveContact(newContact);
      await this.appState.promoteQuarantinedMessages(urn, newContactId);

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
        await this.appState.block([event.urn], event.scope);
        this.showFeedback(`Blocked sender`);
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
        await this.appState.dismissPending([urn]);
        this.showFeedback(`Dismissed request`);
      }
    });
  }

  async onBlockAll() {
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
