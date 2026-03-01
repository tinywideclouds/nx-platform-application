import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { URN } from '@nx-platform-application/platform-types';
import {
  LlmSession,
  SessionAttachment,
  CacheBundle,
} from '@nx-platform-application/llm-types';
import { LlmDataSourcesStateService } from '@nx-platform-application/llm-features-data-sources';

@Component({
  selector: 'llm-context-hierarchy',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './context-hierarchy.component.html',
  styleUrl: './context-hierarchy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmContextHierarchyComponent {
  // Inject state to look up rich repo details (name, branch) from the raw cacheId URN
  private dataSourcesState = inject(LlmDataSourcesStateService);

  // --- INPUTS ---
  session = input.required<LlmSession | null>();
  attachments = input.required<SessionAttachment[]>();
  isCompiling = input<boolean>(false);

  // --- OUTPUTS ---
  removeAttachment = output<string>();
  compileCache = output<void>();

  // --- COMPUTED GROUPS ---
  groupedAttachments = computed(() => {
    const atts = this.attachments() || [];
    return {
      geminiCache: atts.filter((a) => a.target === 'gemini-cache'),
      inlineContext: atts.filter((a) => a.target === 'inline-context'),
      systemInstruction: atts.filter((a) => a.target === 'system-instruction'),
    };
  });

  // Helper to fetch the rich display data for a given cache URN
  getCacheDetails(urn: URN): CacheBundle | undefined {
    return this.dataSourcesState.caches().find((c) => c.id === urn.toString());
  }
}
