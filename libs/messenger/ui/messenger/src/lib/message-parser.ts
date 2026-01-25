import { MessagePart } from '@nx-platform-application/messenger-ui-chat';

export function parseMessageText(text: string | undefined): MessagePart[] {
  if (!text) return [];

  // A standard regex for capturing http/https links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const segments: MessagePart[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add the text before the link
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }
    // Add the link itself
    segments.push({
      type: 'link',
      url: match[0],
    });
    lastIndex = urlRegex.lastIndex;
  }

  // Add any remaining text after the last link
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
