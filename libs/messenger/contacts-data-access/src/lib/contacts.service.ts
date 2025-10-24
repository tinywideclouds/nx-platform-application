// libs/messenger/contacts-data-access/src/lib/contacts.service.ts

import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '@nx-platform-application/platform-types'; // [cite: 11, 23]
import { catchError, EMPTY, tap } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';

@Injectable({
  providedIn: 'root', // [cite: 21]
})
export class ContactsService {
  private http = inject(HttpClient);
  private logger = inject(Logger);

  // --- State ---
  // The single source of truth for the user's contacts list [cite: 14]
  public readonly contacts = signal<User[]>([]); // [cite: 22, 32]

  constructor() {
    // Load contacts immediately when the service is first instantiated
    this.loadContacts();
  }

  // --- Public Methods ---

  /**
   * Fetches the user's contacts from the API and updates the contacts signal [cite: 33]
   */
  public loadContacts(): void {
    this.http
      .get<User[]>('/api/contacts') // [cite: 8, 33]
      .pipe(
        tap((users) => {
          this.contacts.set(users); // Update the signal on success
          this.logger.info(
            `[ContactsService] Loaded ${users.length} contacts.`
          );
        }),
        catchError((err) => {
          this.logger.error('[ContactsService] Failed to load contacts', err);
          return EMPTY;
        })
      )
      .subscribe();
  }

  /**
   * Adds a new contact by email.
   * On success, this re-fetches the entire contact list to ensure
   * the state is consistent with the server. [cite: 34, 35]
   * @param email The email of the contact to add
   */
  public addContact(email: string): void {
    this.http
      .post<User>('/api/contacts', { email }) // [cite: 9, 34]
      .pipe(
        tap((newUser) => {
          this.logger.info(
            `[ContactsService] Successfully added contact: ${newUser.email}`
          );
          // On success, reload the full list from the server [cite: 35]
          this.loadContacts();
        }),
        catchError((err) => {
          this.logger.error('[ContactsService] Failed to add contact', err);
          // We could add a user-facing error signal here if needed
          return EMPTY;
        })
      )
      .subscribe();
  }
}
