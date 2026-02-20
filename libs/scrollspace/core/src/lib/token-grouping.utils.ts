import { Token } from 'marked';

export interface TokenGroup {
  type: 'thought' | 'content';
  tokens: Token[];
}

export class TokenGrouper {
  /**
   * Groups tokens into logical sections.
   * For example, it can separate <think> blocks from standard Markdown.
   */
  static group(tokens: Token[]): TokenGroup[] {
    const groups: TokenGroup[] = [];
    let currentGroup: TokenGroup = { type: 'content', tokens: [] };

    for (const token of tokens) {
      // 1. Detect "Thinking" blocks (Custom token type if we add the lexer back later)
      // For now, we assume standard markdown, but this is where the logic lives.
      const isThought =
        token.type === 'html' && token.raw.startsWith('<think>');

      if (isThought) {
        // If we were building content, save it
        if (currentGroup.tokens.length > 0) {
          groups.push(currentGroup);
        }
        // Push the thought group immediately
        groups.push({ type: 'thought', tokens: [token] });
        // Reset content group
        currentGroup = { type: 'content', tokens: [] };
      } else {
        currentGroup.tokens.push(token);
      }
    }

    if (currentGroup.tokens.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }
}
