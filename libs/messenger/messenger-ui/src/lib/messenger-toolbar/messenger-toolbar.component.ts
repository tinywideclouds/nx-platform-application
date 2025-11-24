// libs/messenger/messenger-ui/src/lib/messenger-toolbar/messenger-toolbar.component.ts

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { User } from '@nx-platform-application/platform-types';

export type SidebarView = 'conversations' | 'compose' | 'contacts';

@Component({
  selector: 'messenger-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule
  ],
  templateUrl: './messenger-toolbar.component.html',
  styleUrl: './messenger-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessengerToolbarComponent {
  currentUser = input.required<User | null>();
  activeView = input<SidebarView>('conversations');
  isComposeActive = input(false);

  // Sidebar Navigation Actions
  viewConversations = output<void>();
  viewCompose = output<void>();
  viewContacts = output<void>();
  
  // User Menu Actions
  viewSettings = output<void>(); // <--- NEW
  logout = output<void>();
  
  // REMOVED: resetKeys output (moved to Settings UI)

  get initials(): string {
    const user = this.currentUser();
    if (!user || !user.alias) return '?';
    return user.alias.slice(0, 2).toUpperCase();
  }
}