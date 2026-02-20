import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Token } from 'marked';
import { HighlightModule } from 'ngx-highlightjs';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MarkdownInlinePipe } from '../pipes/markdown-inline.pipe';
import { WeightUpdate } from '@nx-platform-application/scrollspace-types';

@Component({
  selector: 'scrollspace-markdown-bubble',
  standalone: true,
  imports: [CommonModule, HighlightModule, ClipboardModule, MarkdownInlinePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './markdown-bubble.component.html',
  styleUrl: './markdown-bubble.component.scss',
})
export class ScrollspaceMarkdownBubbleComponent {
  // Inputs
  itemId = input.required<string>(); // Needed for weight reporting
  tokens = input.required<Token[]>();

  // Outputs
  weightUpdate = output<WeightUpdate>();

  constructor() {
    // ✅ Self-Weighting Logic
    // Calculates complexity whenever tokens change
    effect(() => {
      const currentTokens = this.tokens();
      const id = this.itemId();

      // Heuristic:
      // Base = 1
      // +1 per 500 chars of text
      // +5 per Code Block (heavy DOM cost)
      // +2 per Table

      let weight = 1;

      for (const t of currentTokens) {
        if (t.type === 'code') weight += 5;
        else if (t.type === 'table') weight += 2;
        else if ('text' in t) {
          weight += Math.ceil((t.text?.length || 0) / 500);
        }
      }

      // Emit update to Viewport (via parent)
      this.weightUpdate.emit({ itemId: id, newWeight: weight });
    });
  }
}
