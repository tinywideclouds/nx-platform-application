import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { ContactGroupFormComponent } from '../contact-group-form/contact-group-form.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import { from, of, Observable } from 'rxjs';

@Component({
  selector: 'lib-contact-group-edit-page',
  standalone: true,
  imports: [CommonModule, ContactGroupFormComponent],
  templateUrl: './contact-group-edit-page.component.html',
  styleUrl: './contact-group-edit-page.component.scss',
})
export class ContactGroupEditPageComponent {
  // 1. Inject services
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private contactsService = inject(ContactsStorageService);

  // 2. Get all contacts (needed for the multi-selector)
  //    This is converted directly to a signal.
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
    // Navigate back to the main contacts page
    this.router.navigate(['/contacts']);
  }

  onCancel(): void {
    this.router.navigate(['/contacts']);
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