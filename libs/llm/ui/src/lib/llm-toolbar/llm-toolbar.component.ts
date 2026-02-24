import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export type LlmAppView = 'chat' | 'data-sources' | 'settings';

@Component({
  selector: 'llm-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './llm-toolbar.component.html',
  styleUrl: './llm-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmToolbarComponent {
  // --- INPUTS ---
  activeView = input<LlmAppView>('chat');

  // --- OUTPUTS ---
  viewChat = output<void>();
  viewDataSources = output<void>();
  viewSettings = output<void>();
}
