import { Component, inject, output, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { URN } from '@nx-platform-application/platform-types';
import { LlmDigestSource } from '@nx-platform-application/llm-features-memory';

@Component({
  selector: 'llm-memory-sidebar',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, DatePipe],
  templateUrl: './memory-sidebar.component.html',
})
export class LlmMemorySidebarComponent {
  source = inject(LlmDigestSource);

  selectedDigestId = input<URN | null>(null);

  closeView = output<void>();
  openBuilder = output<void>();
  selectDigest = output<URN>();
}
