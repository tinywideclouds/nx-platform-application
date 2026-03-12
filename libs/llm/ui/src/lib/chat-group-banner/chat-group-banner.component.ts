import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'llm-chat-group-banner',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './chat-group-banner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmFocusedGroupBannerComponent {
  focusedUrn = input.required<string>();
  groupName = input<string>('Group');

  clear = output<void>();
  branch = output<void>();
}
