import {
  Component,
  ChangeDetectionStrategy,
  HostListener,
  computed,
  input,
  output,
} from '@angular/core';

import { Contact } from '@nx-platform-application/contacts-storage';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

@Component({
  selector: 'contacts-list-item',
  standalone: true,
  imports: [ContactAvatarComponent],
  templateUrl: './contact-list-item.component.html',
  styleUrl: './contact-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactListItemComponent {
  // 1. Modern Signal Input (Replaces @Input)
  // This creates a Signal<Contact> which is reactive.
  contact = input.required<Contact>();

  // 2. Modern Output Function (Replaces @Output)
  // This creates an OutputEmitterRef<Contact> which is optimized for the new core.
  select = output<Contact>();

  // 3. Derived State (Computed Signals)
  // These update automatically when the 'contact' input signal changes.
  initials = computed(() => {
    const c = this.contact();
    const first = c.firstName?.[0] || '';
    const last = c.surname?.[0] || '';
    return (first + last).toUpperCase() || '?';
  });

  profilePictureUrl = computed(() => {
    const c = this.contact();
    return c.serviceContacts['messenger']?.profilePictureUrl;
  });

  @HostListener('click')
  onHostClick(): void {
    // We emit the value of the signal
    this.select.emit(this.contact());
  }
}
