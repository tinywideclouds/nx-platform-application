import {
  Component,
  ChangeDetectionStrategy,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';
import { LlmMemorySidebarComponent } from '../memory-sidebar/memory-sidebar.component';
import { LlmManualDigestBuilderComponent } from '../manual-digest-builder/manual-digest-builder.component';
import { LlmDigestDetailComponent } from '../digest-detail/digest-detail.component';
import { URN } from '@nx-platform-application/platform-types';

@Component({
  selector: 'llm-session-memory',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MasterDetailLayoutComponent,
    LlmMemorySidebarComponent,
    LlmManualDigestBuilderComponent,
    LlmDigestDetailComponent,
  ],
  templateUrl: './session-memory.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmSessionMemoryComponent {
  closed = output<void>();
  isMobile = signal(false);

  activeView = signal<'empty' | 'builder' | 'digest'>('empty');
  activeDigestId = signal<URN | null>(null);

  onSelectDigest(id: URN) {
    this.activeDigestId.set(id);
    this.activeView.set('digest');
  }
}
