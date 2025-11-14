import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { ContactGroupFormComponent } from '../contact-group-form/contact-group-form.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

@Component({
  selector: 'contacts-group-edit-page',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink,
    MatButtonModule,
    MatIconModule,
    ContactGroupFormComponent,
    ContactsPageToolbarComponent,
  ],
  templateUrl: './contact-group-edit-page.component.html',
  styleUrl: './contact-group-edit-page.component.scss',
})
export class ContactGroupEditPageComponent {
  // 1. Inject services
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private contactsService = inject(ContactsStorageService);

  // 2. --- NEW: Signal for initial state ---
  startInEditMode = signal(false);

  // 2. Get all contacts (needed for the multi-selector)
  allContacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });

  // 3. Define stream for the group being edited
  private id$: Observable<string | null> = this.route.paramMap.pipe(
    map((params) => params.get('id'))
  );

  private groupStream$: Observable<ContactGroup | null> = this.id$.pipe(
    switchMap((id) => {
      // Switches between "edit" and "new" mode
      return id ? this.getGroup(id) : this.getNewGroup();
    })
  );

  // 4. Convert the group stream to a public signal
  groupToEdit = toSignal(this.groupStream$, {
    initialValue: null as ContactGroup | null,
  });

  // --- Event Handlers ---

  async onSave(group: ContactGroup): Promise<void> {
    await this.contactsService.saveGroup(group);
    // --- THIS IS THE FIX ---
    // Navigate back to the 'groups' tab
    this.router.navigate(['/contacts'], { queryParams: { tab: 'groups' } });
  }

  onCancel(): void {
    // --- THIS IS THE FIX ---
    // Navigate back to the 'groups' tab
    this.router.navigate(['/contacts'], { queryParams: { tab: 'groups' } });
  }

  // --- Private Helper Methods ---

  /**
   * EDIT MODE: Returns a stream for an existing group.
   */
  private getGroup(id: string): Observable<ContactGroup | null> {
    return from(this.contactsService.getGroup(id)).pipe(
      map((group) => group ?? null) // Ensure undefined becomes null
    );
  }

  /**
   * ADD MODE: Returns a stream for a new, empty group.
   */
  private getNewGroup(): Observable<ContactGroup> {
    return of({
      id: `urn:sm:group:${crypto.randomUUID()}`,
      name: '',
      description: '',
      contactIds: [],
    });
  }
}