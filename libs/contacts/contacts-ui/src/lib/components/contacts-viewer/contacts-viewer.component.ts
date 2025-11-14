// libs/contacts/contacts-ui/src/lib/contacts-page/contacts-page.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal, // 1. Import signal
  ElementRef, // 2. Import ElementRef
  OnDestroy, // 3. Import OnDestroy
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

  // 1. Get data signals from the service
  contacts = toSignal(this.contactsService.contacts$, {
    initialValue: [] as Contact[],
  });
  groups = toSignal(this.contactsService.groups$, {
    initialValue: [] as ContactGroup[],
  });

  // 2. Create signals from the URL query params
  private queryParams = toSignal(this.route.queryParamMap);
  activeTab = computed(() => {
    const tab = this.queryParams()?.get('tab');
    return tab === 'groups' ? 'groups' : 'contacts';
  });

  // 3. Compute the tab index for the mat-tab-group
  tabIndex = computed(() => (this.activeTab() === 'groups' ? 1 : 0));

  /**
   * Called when the user clicks a tab. Updates the URL.
   */
  onTabChange(event: MatTabChangeEvent): void {
    const tab = event.index === 1 ? 'groups' : 'contacts';
    // Update the URL query param without full navigation
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Navigates to the contact edit page.
   */
  onContactSelect(contact: Contact): void {
    this.router.navigate(['edit', contact.id], { relativeTo: this.route });
  }

  /**
   * Navigates to the group edit page.
   */
  onGroupSelect(group: ContactGroup): void {
    this.router.navigate(['group-edit', group.id], { relativeTo: this.route });
  }
}