import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  HostListener,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Contact } from '@nx-platform-application/contacts-access';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

@Component({
  selector: 'contacts-list-item',
  standalone: true,
  imports: [CommonModule, ContactAvatarComponent],
  templateUrl: './contact-list-item.component.html',
  styleUrl: './contact-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactListItemComponent {
  @Input({ required: true }) contact!: Contact;
  @Output() select = new EventEmitter<Contact>();

  // 1. Create a signal to hold the input value
  // (This bridges the gap between @Input and Signals)
  private _contact = signal<Contact | null>(null);

  // 2. Derive values using computed()
  // These are now cached. They only run when _contact updates.
  initials = computed(() => {
    const c = this._contact();
    if (!c) return '?';
    const first = c.firstName?.[0] || '';
    const last = c.surname?.[0] || '';
    return (first + last).toUpperCase() || '?';
  });

  profilePictureUrl = computed(() => {
    const c = this._contact();
    return c?.serviceContacts['messenger']?.profilePictureUrl;
  });

  @HostListener('click')
  onHostClick(): void {
    this.select.emit(this.contact);
  }
}