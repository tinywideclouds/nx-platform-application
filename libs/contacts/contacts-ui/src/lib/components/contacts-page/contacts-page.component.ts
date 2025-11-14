import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ContactsStorageService,
  Contact,
  ContactGroup, // 1. Import ContactGroup
} from '@nx-platform-application/contacts-data-access';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { Router, RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs'; // 2. Import MatTabsModule
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component'; // 3. Import new group list

@Component({
  selector: 'lib-contacts-page',
  standalone: true,
  imports: [
    CommonModule,
    ContactListComponent,
    RouterLink,
    MatTabsModule, // 4. Add MatTabsModule
    ContactGroupListComponent, // 5. Add new group list
  ],
  templateUrl: './contacts-page.component.html',
  styleUrl: './contacts-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPageComponent {
  private contactsService = inject(ContactsStorageService) as ContactsStorageService;
  private router = inject(Router);

  contacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });

  // 6. Add the new signal for groups
  groups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });

  /**
   * This now handles navigation to the "Edit" page.
   */
  onContactSelect(contact: Contact): void {
    console.log('Contact selected:', contact.id);
    // Navigate to the edit route with the contact's ID
    this.router.navigate(['/contacts/edit', contact.id]);
  }

  // 7. Add a handler for group selection
  onGroupSelect(group: ContactGroup): void {
    console.log('Group selected:', group.id);
    // We'll navigate to a future edit page.
    // This route doesn't exist yet, but we're planning for it.
    this.router.navigate(['/contacts/group-edit', group.id]);
  }
}