import { Pipe, PipeTransform, inject } from '@angular/core';
import { Token } from 'marked';
import { MarkdownParser } from '@nx-platform-application/scrollspace-core';

@Pipe({
  name: 'markdownTokens',
  standalone: true,
  pure: true, // We keep it pure because we rely on the internal cache persistence of the pipe instance
})
export class MarkdownTokensPipe implements PipeTransform {
  private parser = inject(MarkdownParser);

  // ✅ Identity Cache
  private previousTokens: Token[] = [];

  transform(value: string | undefined): Token[] {
    if (!value) return [];

    const newTokens = this.parser.parse(value);

    // ✅ Stabilization Logic
    // If we have previous tokens, try to reuse their object references
    if (this.previousTokens.length > 0) {
      this.stabilize(newTokens, this.previousTokens);
    }

    this.previousTokens = newTokens;
    return newTokens;
  }

  /**
   * Mutates newTokens to use old object references where the raw content matches.
   * This tricks Angular into skipping DOM updates for those blocks.
   */
  private stabilize(newTokens: Token[], oldTokens: Token[]): void {
    // We assume the stream appends to the end or updates the tail.
    // We stop at the length of the new array or old array, whichever is smaller.
    const len = Math.min(newTokens.length, oldTokens.length);

    for (let i = 0; i < len; i++) {
      const nt = newTokens[i];
      const ot = oldTokens[i];

      // Heuristic: If the raw markdown source is identical, the token is identical.
      // We check 'raw' and 'type' to be safe.
      if (nt.raw === ot.raw && nt.type === ot.type) {
        newTokens[i] = ot; // Reuse the old object
      } else {
        // Once we find a divergence (e.g. the typing cursor moved here),
        // we can stop optimizing usually, but for safety we continue checking
        // in case of weird insertions.
      }
    }
  }
}
