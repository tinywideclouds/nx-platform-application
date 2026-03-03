import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'llm-session-subpage-header',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './session-subpage-header.component.html',
  styleUrl: './session-subpage-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmSessionSubpageHeaderComponent {
  // Main title and icon
  title = input.required<string>();
  icon = input.required<string>();
  iconColor = input<string>('text-gray-400'); // Default subtle color

  // Contextual session name
  sessionTitle = input<string | undefined>(undefined);

  // Events
  closed = output<void>();
}
