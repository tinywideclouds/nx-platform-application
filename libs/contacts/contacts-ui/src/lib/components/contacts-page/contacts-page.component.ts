import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-data-access';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'lib-contacts-page',
  standalone: true,
  imports: [CommonModule, ContactListComponent, RouterLink], 
  templateUrl: './contacts-page.component.html',
  styleUrl: './contacts-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPageComponent {
  private contactsService = inject(ContactsStorageService) as ContactsStorageService;
  private router = inject(Router); // <-- Inject Router

  contacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });

  /**
   * This now handles navigation to the "Edit" page.
   */
  onContactSelect(contact: Contact): void {
    console.log('Contact selected:', contact.id);
    // Navigate to the edit route with the contact's ID
    this.router.navigate(['/contacts/edit', contact.id]);
  }
}