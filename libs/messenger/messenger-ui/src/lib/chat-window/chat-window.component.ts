// libs/messenger/messenger-ui/src/lib/chat-window/chat-window.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  effect,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ActivatedRoute,
  Router,
  RouterOutlet,
  NavigationEnd,
} from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

// --- Services ---
import { ChatService } from '@nx-platform-application/chat-state';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-access';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/console-logger';

// --- Components ---
import {
  ChatWindowHeaderComponent,
  ChatWindowMode,
} from '../chat-window-header/chat-window-header.component';
import { ChatParticipant } from '@nx-platform-application/messenger-types';

@Component({
  selector: 'messenger-chat-window',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ChatWindowHeaderComponent],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chatService = inject(ChatService);
  private contactsService = inject(ContactsStorageService);
  private logger = inject(Logger);

  // --- 1. Determine Mode from Router ---
  private routerEvents$ = this.router.events;

  viewMode = toSignal(
    this.routerEvents$.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => {
        const url = this.router.url;
        return url.endsWith('/details')
          ? ('details' as ChatWindowMode)
          : ('chat' as ChatWindowMode);
      })
    ),
    {
      initialValue: this.router.url.endsWith('/details')
        ? ('details' as ChatWindowMode)
        : ('chat' as ChatWindowMode),
    }
  );

  // --- 2. Data Loading Logic ---
  private routeParams = toSignal(this.route.paramMap);

  conversationUrnString = computed(() => this.routeParams()?.get('id') || null);

  conversationUrn = computed(() => {
    const urnStr = this.conversationUrnString();
    if (!urnStr) return null;
    try {
      return URN.parse(urnStr);
    } catch (err) {
      this.logger.error('Failed to parse URN from route:', err);
      return null;
    }
  });

  // --- 3. State Signals ---
  isKeyMissing = this.chatService.isRecipientKeyMissing;

  private contacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });
  private groups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });

  // --- 4. Participant Computation ---
  participant = computed<ChatParticipant | null>(() => {
    const urn = this.conversationUrn();
    if (!urn) return null;

    if (urn.entityType === 'user') {
      const contact = this.contacts().find((c) => c.id.equals(urn));
      if (!contact) return { urn, name: 'Unknown User', initials: '?' };
      return {
        urn,
        name: contact.alias,
        initials: (contact.firstName?.[0] || '') + (contact.surname?.[0] || ''),
        profilePictureUrl:
          contact.serviceContacts['messenger']?.profilePictureUrl,
      };
    }

    if (urn.entityType === 'group') {
      const group = this.groups().find(
        (g) => g.id.toString() === urn.toString()
      );
      if (!group) return { urn, name: 'Unknown Group', initials: 'G' };
      return { urn, name: group.name, initials: 'G' };
    }
    return null;
  });

  // --- REFACTOR: Field Initializer Effect ---
  // Cleaned up from constructor injection
  private conversationLoader = effect(() => {
    const urn = this.conversationUrn();
    if (urn) {
      untracked(() => {
        this.chatService.loadConversation(urn);
      });
    }
  });

  // --- Navigation Handlers ---

  onHeaderBack(): void {
    if (this.viewMode() === 'details') {
      this.router.navigate(['./'], { relativeTo: this.route });
    } else {
      this.router.navigate(['/messenger']);
    }
  }

  onToggleInfo(): void {
    if (this.viewMode() === 'chat') {
      this.router.navigate(['details'], { relativeTo: this.route });
    } else {
      this.router.navigate(['./'], { relativeTo: this.route });
    }
  }
}