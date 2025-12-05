import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  computed,
  model,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

// MATERIAL
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// SHARED UI
import { ListFilterComponent } from '@nx-platform-application/platform-ui-toolkit';

// DOMAIN
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-storage';

// UI COMPONENTS
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';

@Component({
  selector: 'contacts-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ContactsPageToolbarComponent,
    ContactListComponent,
    ContactGroupListComponent,
    ListFilterComponent, // Added
  ],
  templateUrl: './contacts-sidebar.component.html',
  styleUrl: './contacts-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsSidebarComponent {
  private contactsService = inject(ContactsStorageService);

  // --- INPUTS ---
  selectedId = input<string | undefined>(undefined);
  tabIndex = input(0);
  showAddActions = input(true);
  selectionMode = input(false);
  title = input<string>('Contacts');

  /** * Controls visibility of the internal filter.
   * Disable this if the parent component (e.g. Messenger) provides its own filter.
   */
  showFilter = input(true);

  /**
   * Search query.
   * Can be driven by the internal filter OR passed from a parent.
   */
  filterQuery = model<string>('');

  // --- OUTPUTS ---
  contactSelected = output<Contact>();
  groupSelected = output<ContactGroup>();
  tabChange = output<MatTabChangeEvent>();

  // --- DATA ---
  private rawContacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });
  private rawGroups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });

  // --- FILTER LOGIC (Forgiving) ---

  filteredContacts = computed(() => {
    const list = this.rawContacts();
    const rawQuery = this.filterQuery();

    // 1. Fast Exit
    if (!rawQuery?.trim()) return list;

    // 2. Tokenize (lower case, remove empty spaces)
    const tokens = rawQuery
      .toLowerCase()
      .split(' ')
      .filter((t) => t.length > 0);

    return list.filter((c) => {
      // 3. Construct Search Blob (All searchable text in one string)
      // We join them with spaces to ensure boundary separation
      const searchableText = [
        c.alias,
        c.firstName,
        c.surname,
        c.email,
        ...(c.emailAddresses || []),
        ...(c.phoneNumbers || []),
      ]
        .join(' ')
        .toLowerCase();

      // 4. Forgiving Rule: Every typed token must exist in the blob
      return tokens.every((token) => searchableText.includes(token));
    });
  });

  filteredGroups = computed(() => {
    const list = this.rawGroups();
    const rawQuery = this.filterQuery();

    if (!rawQuery?.trim()) return list;

    const tokens = rawQuery
      .toLowerCase()
      .split(' ')
      .filter((t) => t.length > 0);

    return list.filter((g) => {
      const searchableText = g.name.toLowerCase();
      return tokens.every((token) => searchableText.includes(token));
    });
  });

  onTabChange(event: MatTabChangeEvent) {
    this.tabChange.emit(event);
  }
}
