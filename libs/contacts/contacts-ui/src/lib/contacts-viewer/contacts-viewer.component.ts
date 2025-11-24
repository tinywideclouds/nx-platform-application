import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabChangeEvent } from '@angular/material/tabs';

// LOGIC & DATA
import {
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-access';
import { URN } from '@nx-platform-application/platform-types';

// LAYOUT & UI
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-toolkit';

// FEATURE COMPONENTS
import { ContactsSidebarComponent } from '../contacts-sidebar/contacts-sidebar.component';
import { ContactDetailComponent } from '../contact-detail/contact-detail.component';
import { ContactGroupPageComponent } from '../contact-group-page/contact-group-page.component';
// IMPORT NEW PAGE
import { ContactPageComponent } from '../contact-page/contact-page.component';

@Component({
  selector: 'contacts-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MasterDetailLayoutComponent,
    ContactsSidebarComponent,
    ContactDetailComponent,
    ContactPageComponent, // Added to imports
    ContactGroupPageComponent,
  ],
  templateUrl: './contacts-viewer.component.html',
  styleUrl: './contacts-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsViewerComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // --- INPUTS ---
  selectionMode = input(false);
  selectedId = input<string | undefined>(undefined);

  // --- OUTPUTS ---
  contactSelected = output<Contact>();
  groupSelected = output<ContactGroup>();

  // --- ROUTER STATE ---
  private queryParams = toSignal(this.route.queryParamMap);

  // 1. Detect Creation Mode
  createMode = computed(() => {
    const params = this.queryParams();
    return params?.get('new'); // 'contact' | 'group' | null
  });

  // 2. Derive Selected URN (Existing Logic)
  selectedUrn = computed(() => {
    const id = this.selectedId();
    if (!id) return undefined;
    try {
      return URN.parse(id);
    } catch (e) {
      console.warn('Invalid URN in URL:', id);
      return undefined;
    }
  });

  activeTab = computed(() => {
    const tab = this.queryParams()?.get('tab');
    if (tab === 'groups') return 'groups';
    if (tab === 'manage') return 'manage';
    return 'contacts';
  });

  tabIndex = computed(() => {
    const tab = this.activeTab();
    if (tab === 'groups') return 1;
    if (tab === 'manage') return 2;
    return 0;
  });

  // --- ACTIONS ---

  onTabChange(event: MatTabChangeEvent): void {
    let tab = 'contacts';
    if (event.index === 1) tab = 'groups';
    if (event.index === 2) tab = 'manage';
    
    // Clear selection AND creation mode when switching tabs
    this.updateUrl({ tab, selectedId: null, new: null });
  }

  onContactSelect(contact: Contact): void {
    if (this.selectionMode()) {
      this.contactSelected.emit(contact);
      return;
    }
    // Clear 'new' param when selecting
    this.updateUrl({ selectedId: contact.id.toString(), new: null });
  }

  onGroupSelect(group: ContactGroup): void {
    if (this.selectionMode()) {
      this.groupSelected.emit(group);
      return;
    }
    this.updateUrl({ selectedId: group.id.toString(), new: null });
  }

  clearSelection(): void {
    this.updateUrl({ selectedId: null, new: null });
  }

  private updateUrl(params: any) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
    });
  }
}