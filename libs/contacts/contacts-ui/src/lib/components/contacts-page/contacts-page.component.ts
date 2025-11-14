// libs/contacts/contacts-ui/src/lib/contacts-page/contacts-page.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
  ElementRef,
  OnDestroy,
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

// 1. Define our breakpoint in logical REM units
const COMPACT_THRESHOLD_REM = 24;

@Component({
  selector: 'lib-contacts-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTabsModule,
    ContactListComponent,
    ContactGroupListComponent,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './contacts-page.component.html',
  styleUrl: './contacts-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPageComponent implements OnDestroy {
  private contactsService = inject(ContactsStorageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private elRef = inject(ElementRef);

  private resizeObserver!: ResizeObserver;
  private elementWidth = signal(0);
  
  // 2. This will hold our calculated pixel breakpoint
  private compactBreakpointPx = 0;

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
   * Defines the display mode.
   * 'full' = Standard page with text buttons.
   * 'compact' = Sidebar view with icon buttons.
   */
  // 4. 'mode' now compares against our rem-based pixel value
  mode = computed(() => {
    return this.elementWidth() < this.compactBreakpointPx ? 'compact' : 'full';
  });

  constructor() {
    // 3. Calculate the pixel breakpoint based on the user's root font size
    try {
      const rootFontSizePx = parseFloat(
        getComputedStyle(document.documentElement).fontSize
      );
      this.compactBreakpointPx = COMPACT_THRESHOLD_REM * rootFontSizePx;
    } catch (e) {
      // Fallback for safety (e.g., in a weird test environment)
      // 18rem * 16px/rem = 288px
      this.compactBreakpointPx = COMPACT_THRESHOLD_REM * 16;
    }

    // Set up the observer
    this.resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        this.elementWidth.set(entries[0].contentRect.width);
      }
    });

    // Start observing the component's host element
    this.resizeObserver.observe(this.elRef.nativeElement);
  }

  ngOnDestroy(): void {
    // Clean up the observer
    this.resizeObserver.unobserve(this.elRef.nativeElement);
    this.resizeObserver.disconnect();
  }

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