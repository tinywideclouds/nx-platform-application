// libs/contacts/contacts-ui/src/lib/components/contacts-viewer/contacts-viewer.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

@Component({
  selector: 'contacts-viewer',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTabsModule,
    ContactListComponent,
    ContactGroupListComponent,
    MatButtonModule,
    MatIconModule,
    ContactsPageToolbarComponent,
  ],
  templateUrl: './contacts-viewer.component.html',
  styleUrl: './contacts-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsViewerComponent {
  private contactsService = inject(ContactsStorageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  contacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });
  groups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });

  private queryParams = toSignal(this.route.queryParamMap);
  activeTab = computed(() => {
    const tab = this.queryParams()?.get('tab');
    return tab === 'groups' ? 'groups' : 'contacts';
  });

  tabIndex = computed(() => (this.activeTab() === 'groups' ? 1 : 0));

  onTabChange(event: MatTabChangeEvent): void {
    const tab = event.index === 1 ? 'groups' : 'contacts';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  onContactSelect(contact: Contact): void {
    this.router.navigate(['edit', contact.id], { relativeTo: this.route });
  }

  onGroupSelect(group: ContactGroup): void {
    this.router.navigate(['group-edit', group.id], { relativeTo: this.route });
  }
}