import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

// LAYOUT
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-toolkit';

// FEATURES
import { ContactsSidebarComponent } from '@nx-platform-application/contacts-ui';

// TYPES
import { Contact, ContactGroup } from '@nx-platform-application/contacts-access';

@Component({
  selector: 'messenger-compose-page',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MasterDetailLayoutComponent,
    ContactsSidebarComponent
  ],
  templateUrl: './messenger-compose-page.component.html',
  styleUrl: './messenger-compose-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessengerComposePageComponent {
  private router = inject(Router);

  // We are always in "Detail" mode visually because the sidebar is purely for selection
  // and the main area explains what to do.
  showDetail = signal(false); 

  onContactSelected(contact: Contact): void {
    this.startChat(contact.id.toString());
  }

  onGroupSelected(group: ContactGroup): void {
    this.startChat(group.id.toString());
  }

  private startChat(id: string): void {
    // Navigate to the conversation view with the selected ID
    this.router.navigate(['/messenger', 'conversations', id]);
  }
}