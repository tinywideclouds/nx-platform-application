import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

@Pipe({
  name: 'markdownInline',
  standalone: true,
})
export class MarkdownInlinePipe implements PipeTransform {
  transform(value: string | undefined): string {
    if (!value) return '';
    // marked.parse handles inline styles (bold, links, etc.)
    // We treat it as sync because we aren't using async highlighters here
    return marked.parse(value) as string;
  }
}
