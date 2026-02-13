import {
  Component,
  inject,
  computed,
  signal,
  output,
  ChangeDetectionStrategy,
  viewChild,
  ElementRef,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

// Domain
import { ContactsSidebarComponent } from '@nx-platform-application/contacts-ui';
import { AddressBookManagementApi } from '@nx-platform-application/contacts-api';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';

import {
  validate,
  EmailSchema,
} from '@nx-platform-application/platform-ui-forms';

// Local
import { NewContactDialogComponent } from '@nx-platform-application/messenger-ui-chat';

@Component({
  selector: 'messenger-new-chat-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    ContactsSidebarComponent,
  ],
  templateUrl: './new-chat-sidebar.component.html',
  styleUrl: './new-chat-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewChatSidebarComponent {
  private dialog = inject(MatDialog);
  private addressBook = inject(AddressBookManagementApi);

  // --- UI References ---
  inputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  // --- State ---
  readonly query = signal('');

  // --- Outputs ---
  readonly contactSelected = output<Contact>();
  readonly groupSelected = output<ContactGroup>();
  readonly contactCreated = output<URN>();

  // --- Computed ---
  readonly validEmail = computed(() => {
    const q = this.query().trim();
    // ✅ Use Shared Schema (Aligns with Contact Form)
    return validate(EmailSchema, q) ? q : null;
  });

  constructor() {
    // Auto-Focus Logic
    effect(() => {
      const el = this.inputRef()?.nativeElement;
      if (el) {
        setTimeout(() => el.focus(), 50);
      }
    });
  }

  // --- Actions ---

  onInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.query.set(val);
  }

  onSmartCreate(email: string) {
    this.dialog
      .open(NewContactDialogComponent, {
        width: '400px',
        data: { email },
      })
      .afterClosed()
      .subscribe(async (alias) => {
        if (alias) {
          await this.createAndEmit(email, alias);
        }
      });
  }

  private async createAndEmit(email: string, alias: string) {
    try {
      // @ts-ignore - Assuming API update exists in your workspace
      const contact = await this.addressBook.createContact(email, alias);
      this.contactCreated.emit(contact.id);
    } catch (e) {
      console.error('Failed to create contact', e);
    }
  }
}
