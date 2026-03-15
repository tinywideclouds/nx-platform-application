import {
  Component,
  ChangeDetectionStrategy,
  input,
  model,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { LlmMessage } from '@nx-platform-application/llm-types';
import { Prompts } from '@nx-platform-application/llm-domain-digest-engine';

@Component({
  selector: 'llm-digest-builder-info',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    DatePipe,
    FormsModule,
    MatCheckboxModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './digest-builder-info.component.html',
})
export class LlmDigestBuilderInfoComponent {
  startMsg = input<LlmMessage | null>(null);
  endMsg = input<LlmMessage | null>(null);
  selectedCount = input<number>(0);
  excludedCount = input<number>(0);
  estimatedTokens = input<number>(0);

  // Two-way bindings back to the parent component
  includeRawProposals = model<boolean>(false);
  selectedPrompt = model<string>(Prompts.Standard);

  prompts = Prompts as Record<string, string>;
  strategyKeys = Object.keys(Prompts);
}
