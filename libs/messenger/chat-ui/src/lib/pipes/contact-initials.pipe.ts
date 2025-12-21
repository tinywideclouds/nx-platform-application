// libs/messenger/chat-ui/src/lib/pipes/contact-initials.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';

@Pipe({
  name: 'contactInitials',
  standalone: true,
})
export class ContactInitialsPipe implements PipeTransform {
  transform(value: URN | string | null | undefined): string {
    if (!value) return '?';

    const strValue = value.toString();

    // 1. Try to extract specific parts if it's a known URN format
    // e.g. "urn:user:bob-smith" -> "BS"
    if (strValue.startsWith('urn:')) {
      const parts = strValue.split(':');
      const idPart = parts[parts.length - 1]; // "bob-smith"
      return this.extractFromId(idPart);
    }

    // 2. Fallback for raw strings/UUIDs
    return this.extractFromId(strValue);
  }

  private extractFromId(id: string): string {
    // If it looks like a name (e.g. "Bob Smith"), take initials
    const words = id.split(/[-_ ]/);
    if (words.length > 1) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }

    // Otherwise just take the first two chars
    return id.slice(0, 2).toUpperCase();
  }
}
