import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

// MATERIAL
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

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

  // --- OUTPUTS ---
  contactSelected = output<Contact>();
  groupSelected = output<ContactGroup>();
  tabChange = output<MatTabChangeEvent>();

  // --- DATA ---
  contacts = toSignal(this.contactsService.contacts$);
  groups = toSignal(this.contactsService.groups$);

  onTabChange(event: MatTabChangeEvent) {
    this.tabChange.emit(event);
  }
}
