import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  computed,
  model,
} from '@angular/core';
import { RouterModule } from '@angular/router';

// MATERIAL
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// SHARED UI
import { ListFilterComponent } from '@nx-platform-application/platform-ui-toolkit';

// DOMAIN
import { ContactsStateService } from '@nx-platform-application/contacts-state'; // ✅ Switched to State
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';

// UI COMPONENTS
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { GroupBadgeResolver } from './../models/group-badge.model';

@Component({
  selector: 'contacts-sidebar',
  standalone: true,
  imports: [
    RouterModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ContactsPageToolbarComponent,
    ContactListComponent,
    ContactGroupListComponent,
    ListFilterComponent,
  ],
  templateUrl: './contacts-sidebar.component.html',
  styleUrl: './contacts-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsSidebarComponent {
  private state = inject(ContactsStateService); // ✅ Inject State

  // --- INPUTS ---
  selectedId = input<string | undefined>(undefined);
  tabIndex = input(0);
  showAddActions = input(true);
  selectionMode = input(false);
  title = input<string>('Contacts');
  badgeResolver = input<GroupBadgeResolver | undefined>(undefined);
  showFilter = input(true);
  filterQuery = model<string>('');

  // --- OUTPUTS ---
  contactSelected = output<Contact>();
  groupSelected = output<ContactGroup>();
  tabChange = output<MatTabChangeEvent>();

  // --- DATA (Direct from State Signals) ---
  private rawContacts = this.state.contacts;
  private rawGroups = this.state.groups;

  // --- FILTER LOGIC ---
  filteredContacts = computed(() => {
    const list = this.rawContacts();
    const rawQuery = this.filterQuery();

    if (!rawQuery?.trim()) return list;

    const tokens = rawQuery
      .toLowerCase()
      .split(' ')
      .filter((t) => t.length > 0);

    return list.filter((c) => {
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
