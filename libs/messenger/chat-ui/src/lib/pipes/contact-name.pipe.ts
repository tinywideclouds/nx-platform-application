// libs/messenger/chat-ui/src/lib/pipes/contact-name.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';

@Pipe({
  name: 'contactName',
  standalone: true,
})
export class ContactNamePipe implements PipeTransform {
  transform(value: URN | string | null | undefined): string {
    if (!value) return 'Unknown';
    // In a real implementation, this would look up the contact name in a store.
    // For now, we return the entity ID to hide the raw URN prefix.
    const str = value.toString();
    const parts = str.split(':');
    return parts.length > 1 ? parts[parts.length - 1] : str;
  }
}
