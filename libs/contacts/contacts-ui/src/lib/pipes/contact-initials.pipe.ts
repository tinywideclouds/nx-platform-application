import { Pipe, PipeTransform, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { ContactsStateService } from '@nx-platform-application/contacts-state';

@Pipe({
  name: 'contactInitials',
  standalone: true,
  pure: false, // ✅ Reacts to contact updates
})
export class ContactInitialsPipe implements PipeTransform {
  private state = inject(ContactsStateService);

  transform(value: URN | string | null | undefined): string {
    if (!value) return '?';

    // 1. Try to get the real contact
    const contactSignal = this.state.resolveContact(value);
    const contact = contactSignal();

    if (contact) {
      // 2. Derive initials from real name (e.g. "Alice Smith" -> "AS")
      const first = contact.firstName?.[0] || '';
      const last = contact.surname?.[0] || '';
      if (first || last) {
        return (first + last).toUpperCase();
      }
      // Fallback if contact exists but has no name set
      return contact.alias?.slice(0, 2).toUpperCase() || '??';
    }

    // 3. Fallback to URN parsing (for unknown users)
    const str = value.toString();
    const cleanId = str.includes(':') ? str.split(':').pop()! : str;
    const parts = cleanId.split(/[-_ .]/);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleanId.slice(0, 2).toUpperCase();
  }
}
