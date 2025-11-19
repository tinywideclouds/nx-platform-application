// libs/messenger/messenger-ui/src/lib/messenger-toolbar/messenger-toolbar.component.ts

import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { User } from '@nx-platform-application/platform-types';

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
  // The current authenticated user
  currentUser = input.required<User | null>();


  isComposeActive = input(false);
  // Actions
  compose = output<void>();
  openAddressBook = output<void>();
  logout = output<void>();

  get initials(): string {
    const user = this.currentUser();
    if (!user || !user.alias) return '?';
    return user.alias.slice(0, 2).toUpperCase();
  }
}