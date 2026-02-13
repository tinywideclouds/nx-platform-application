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

import { NewChatSidebarComponent } from '../new-chat-sidebar/new-chat-sidebar.component';

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

// ✅ STATE LAYERS (Strict Separation)
import { AppState } from '@nx-platform-application/messenger-state-app';
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';
import { ActiveChatFacade } from '@nx-platform-application/messenger-state-active-chat';
import { ChatModerationFacade } from '@nx-platform-application/messenger-state-moderation';

// Types
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
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
    NewChatSidebarComponent,
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
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  // ✅ INJECTED STATE
  private appState = inject(AppState); // For Wizard (Global Mode)
  private chatData = inject(ChatDataService); // For List
  private activeChat = inject(ActiveChatFacade); // For Selection
  private moderation = inject(ChatModerationFacade); // For Requests/Blocking

  // --- UI SIGNALS ---

  // Detail View State (Driven by ActiveChat)
  showDetail = computed(() => !!this.activeChat.selectedConversation());

  // Empty State (Driven by ChatData)
  hasConversations = computed(() => this.chatData.uiConversations().length > 0);

  // Global Wizard Mode (Driven by AppState)
  showWizard = this.appState.showWizard;

  sidebarMode = toSignal(
    this.route.queryParams.pipe(
      map((params) => (params['sidebar'] === 'new' ? 'new' : 'list')),
    ),
    { initialValue: 'list' },
  );

  searchQuery = signal<string>('');
  showRequestsPane = signal(false);

  // --- MODERATION DATA ---

  pendingRequests = this.moderation.pendingRequests;
  previewMessages = signal<Record<string, ChatMessage[]>>({});
  loadingPreviews = signal<Set<string>>(new Set());

  // --- LIST PROJECTION ---

  conversationsList = computed(() => {
    const all = this.chatData.uiConversations();
    const query = this.searchQuery().toLowerCase().trim();
    const activeUrn = this.activeChat.selectedConversation()?.id;

    const filtered = !query
      ? all
      : all.filter((item) => item.name.toLowerCase().includes(query));

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
      // Clear active selection via Facade when opening requests
      this.activeChat.loadConversation(null);
    }
  }

  // --- GLOBAL ACTIONS (AppState) ---

  onCloseWizard() {
    this.appState.setWizardActive(false);
  }

  // --- MODERATION ACTIONS (Delegated to Facade) ---

  async onPeekRequests(urn: URN) {
    const urnStr = urn.toString();
    if (this.previewMessages()[urnStr]) return;

    this.loadingPreviews.update((s) => new Set(s).add(urnStr));

    try {
      // Facade handles the domain fetch
      const messages = await this.moderation.getQuarantinedMessages(urn);

      // UI decodes bytes for preview rendering
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

      // ✅ STATE LAYER handles Contact Creation, Message Promotion & Data Refresh
      const newUrn = await this.moderation.promoteQuarantinedMessages(urn);

      // Force UI list refresh to see new contact immediately
      await this.chatData.refreshActiveConversations();

      this.showFeedback('Request accepted');
      this.showRequestsPane.set(false);

      if (newUrn) {
        this.router.navigate([
          '/messenger',
          'conversations',
          newUrn.toString(),
        ]);
      }
    } catch (e) {
      console.error(e);
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
        await this.moderation.block([event.urn], event.scope);
        await this.chatData.refreshActiveConversations();
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
        await this.moderation.dismissPending([urn]);
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
        await this.moderation.block(allUrns, 'messenger');
        await this.chatData.refreshActiveConversations();
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

  onFastContactCreated(urn: URN) {
    this.chatData.refreshActiveConversations();
    this.setSidebarMode('list');
    this.router.navigate(['/messenger', 'conversations', urn.toString()]);
    this.showFeedback('Contact created');
  }
}
