import {
  Component,
  ChangeDetectionStrategy,
  effect,
  input,
  output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

import { URN } from '@nx-platform-application/platform-types';
import {
  LlmSession,
  WorkspaceAttachment,
} from '@nx-platform-application/llm-types';
import {
  DataSourceBundle,
  DataGroup,
  FilteredDataSource,
} from '@nx-platform-application/data-sources-types';
import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { CompiledCacheService } from '@nx-platform-application/llm-domain-compiled-cache';
import { DataSourceResolver } from '@nx-platform-application/llm-features-workspace';

@Component({
  selector: 'llm-context-hierarchy',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  templateUrl: './context-hierarchy.component.html',
  styleUrl: './context-hierarchy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmContextHierarchyComponent {
  private dataSourcesState = inject(DataSourcesService);
  protected cacheService = inject(CompiledCacheService);
  private readonly resolver = inject(DataSourceResolver);

  session = input.required<LlmSession | null>();
  inlineAttachments = input<WorkspaceAttachment[]>([]);
  systemAttachments = input<WorkspaceAttachment[]>([]);
  compiledContext = input<WorkspaceAttachment | undefined>(undefined);

  removeInline = output<URN>();
  removeSystem = output<URN>();
  removeCompiled = output<URN>();

  // Updated Output to include TTL
  requestCompile = output<{ intent: WorkspaceAttachment; ttl?: number }>();

  // We need a signal to hold the resolved sources for the current intent
  private readonly currentIntentSources = signal<FilteredDataSource[]>([]);

  // Minor TTL Selection Logic
  readonly ttlOptions = [
    { label: 'Default', value: undefined },
    { label: '1h', value: 1 },
    { label: '24h', value: 24 },
    { label: '7d', value: 168 },
  ];
  selectedTtl = signal<number | undefined>(undefined);

  constructor() {
    effect(async () => {
      const intent = this.compiledContext();
      if (intent) {
        const resolved = await this.resolver.resolve(intent);
        this.currentIntentSources.set(resolved);
      } else {
        this.currentIntentSources.set([]);
      }
    });
  }

  getDataSourceBundleDetails(urn: URN): DataSourceBundle | undefined {
    return this.dataSourcesState.bundles().find((c) => c.id.equals(urn));
  }

  getDataGroupDetails(urn: URN): DataGroup | undefined {
    return this.dataSourcesState.dataGroups().find((g) => g.id.equals(urn));
  }

  hasWarmCache = computed(() => {
    const s = this.session();
    const sources = this.currentIntentSources();

    if (!s?.llmModel || sources.length === 0) return false;

    // Use the service's built-in hashing lookup logic
    return !!this.cacheService.getValidCache(sources, s.llmModel);
  });
}
