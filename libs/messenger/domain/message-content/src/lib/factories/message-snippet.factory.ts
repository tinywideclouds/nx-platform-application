import { Injectable } from '@angular/core';
import { ParsedMessage } from '../models/content-types';

@Injectable({ providedIn: 'root' })
export class MessageSnippetFactory {
  /**
   * Generates a user-friendly preview string for the sidebar.
   * Handles rich content types (Images, Invites) that Infrastructure cannot parse.
   */
  createSnippet(parsed: ParsedMessage): string {
    if (parsed.kind === 'unknown') {
      return 'Unsupported message';
    }

    if (parsed.kind === 'signal') {
      // Signals (like typing/read-receipts) are usually hidden from the history
      // But if one persists (e.g. system signal), we return empty or specific text
      return '';
    }

    const content = parsed.payload;

    switch (content.kind) {
      case 'text':
        // We truncate here to prevent storing massive strings in the index
        return this.truncate(content.text);

      case 'image':
        return '📷 Photo';

      case 'group-invite':
        return `👥 Invite: ${content.data.name}`;

      case 'group-system':
        return this.formatGroupSystem(content.data.status);

      case 'rich':
        // Differentiate based on sub-type if needed
        if (content.subType === 'contact-share') {
          return '👤 Contact';
        }
        return '📄 Attachment';

      default:
        return 'Message';
    }
  }

  private formatGroupSystem(status: string): string {
    switch (status) {
      case 'joined':
        return 'You joined the group';
      case 'declined':
        return 'You declined the invite';
      case 'created':
        return 'Group created';
      case 'left':
        return 'You left the group';
      default:
        return 'System message';
    }
  }

  private truncate(text: string, length = 60): string {
    const safeText = text.trim().replace(/[\r\n]+/g, ' '); // Flatten newlines
    if (safeText.length <= length) return safeText;
    return safeText.slice(0, length) + '...';
  }
}
