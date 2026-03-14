import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
  computed,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { URN } from '@nx-platform-application/platform-types';
import { LlmDigestSource } from '@nx-platform-application/llm-features-memory'; // Or wherever your source lives
import {
  ScrollspaceMarkdownBubbleComponent,
  MarkdownTokensPipe,
} from '@nx-platform-application/scrollspace-ui';

@Component({
  selector: 'llm-digest-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    DatePipe,
    ScrollspaceMarkdownBubbleComponent,
    MarkdownTokensPipe,
  ],
  templateUrl: './digest-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmDigestDetailComponent {
  source = inject(LlmDigestSource);

  digestId = input.required<URN | null>();

  activeDigest = computed(() => {
    const id = this.digestId();
    if (!id) return null;
    return this.source.digests().find((d) => d.id.equals(id)) || null;
  });
}
