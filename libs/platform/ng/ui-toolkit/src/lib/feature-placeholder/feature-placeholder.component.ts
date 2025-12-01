// libs/platform/platform-ui-toolkit/src/lib/feature-placeholder/feature-placeholder.component.ts

import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'lib-feature-placeholder',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './feature-placeholder.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturePlaceholderComponent {
  icon = input.required<string>();
  title = input.required<string>();
  message = input.required<string>();

  // Optional: For "No Chats -> Start One" scenarios
  actionLabel = input<string | undefined>(undefined);
  isError = input(false);

  action = output<void>();
}
