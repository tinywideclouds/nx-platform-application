import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

// --- Angular Material Imports ---
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

// --- Platform/Feature Imports ---
import { ContactsService } from '@nx-platform-application/contacts-data-access';
import { LoggerService } from '@nx-platform-application/console-logger';

@Component({
  selector: 'lib-contacts',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
  ],
  templateUrl: './contacts.component.html',
})
export class ContactsComponent implements OnInit {
  // --- Injections ---
  private contactsService = inject(ContactsService);
  private logger = inject(LoggerService);

  // --- State ---
  // Expose the service's signal directly to the template
  public readonly contacts = this.contactsService.contacts;

  // --- Lifecycle ---
  ngOnInit(): void {
    // Delegate loading to the service
    this.contactsService.loadContacts();
  }

  // --- Event Handlers ---
  /**
   * Delegates adding a new contact to the ContactsService
   * @param email The email from the input field
   */
  onAddContact(email: string): void {
    if (!email) {
      this.logger.warn(
        '[ContactsComponent] Add contact attempt with no email.'
      );
      return;
    }
    this.logger.info(`[ContactsComponent] Attempting to add contact: ${email}`);
    // Delegate the "work" to the data-access service
    this.contactsService.addContact(email);
  }
}
