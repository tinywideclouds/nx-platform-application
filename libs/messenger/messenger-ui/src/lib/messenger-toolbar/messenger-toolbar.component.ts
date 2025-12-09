import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { User } from '@nx-platform-application/platform-types';

// IMPORT NETWORK STATUS
import { MessengerNetworkStatusComponent } from '../messenger-network-status/messenger-network-status.component';

export type SidebarView = 'conversations' | 'contacts';
// Note: Removed 'compose' from type as it's no longer a top-level view

@Component({
  selector: 'messenger-toolbar',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MessengerNetworkStatusComponent
],
  templateUrl: './messenger-toolbar.component.html',
  styleUrl: './messenger-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerToolbarComponent {
  currentUser = input.required<User | null>();
  activeView = input<SidebarView>('conversations');

  // REMOVED: isComposeActive input (no longer needed)

  // Sidebar Navigation Actions
  viewConversations = output<void>();
  viewContacts = output<void>();

  // REMOVED: viewCompose output

  // User Menu Actions
  viewSettings = output<void>();
  logout = output<void>();

  get initials(): string {
    const user = this.currentUser();
    if (!user || !user.alias) return '?';
    return user.alias.slice(0, 2).toUpperCase();
  }
}
