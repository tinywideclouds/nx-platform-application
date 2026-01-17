import {
  Component,
  ChangeDetectionStrategy,
  HostListener,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common'; // Needed for events
import { Contact } from '@nx-platform-application/contacts-types';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'contacts-list-item',
  standalone: true,
  imports: [
    ContactAvatarComponent,
    CommonModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './contact-list-item.component.html',
  styleUrl: './contact-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactListItemComponent {
  // 1. Inputs
  contact = input.required<Contact>();

  // 2. Outputs
  select = output<Contact>();
  delete = output<Contact>();

  // 3. Derived State
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

  // 4. Interaction Handlers

  // Triggered by main content click
  onContentClick(): void {
    this.select.emit(this.contact());
  }

  // Triggered by the slide-out button
  onDeleteClick(event: Event): void {
    event.stopPropagation(); // Stop row selection
    this.delete.emit(this.contact());
  }

  // Desktop: Right Click
  @HostListener('contextmenu', ['$event'])
  onRightClick(event: MouseEvent): void {
    // Only intercept if we are on a device that supports hover (Desktop)
    if (window.matchMedia('(hover: hover)').matches) {
      event.preventDefault(); // Stop browser menu
      this.delete.emit(this.contact());
    }
  }
}
