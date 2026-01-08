import { URN } from '@nx-platform-application/platform-types';
import { ParsedMessage } from '../models/content-types';

export interface ParsingContext {
  conversationId?: URN;
  tags: URN[];
}

export interface ContentParserStrategy {
  /**
   * Returns true if this strategy can handle the given Message Type URN.
   */
  supports(typeId: URN): boolean;

  /**
   * Converts the raw bytes (already unwrapped from metadata envelope if applicable)
   * into a Domain Message.
   */
  parse(
    typeId: URN,
    content: Uint8Array,
    context: ParsingContext,
  ): ParsedMessage;
}
