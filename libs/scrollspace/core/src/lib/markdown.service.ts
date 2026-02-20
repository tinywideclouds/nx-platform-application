import { Injectable } from '@angular/core';
import { marked, Token } from 'marked';

@Injectable({ providedIn: 'root' })
export class MarkdownParser {
  parse(content: string): Token[] {
    // marked.lexer splits the string into an array of tokens
    return marked.lexer(content);
  }
}
