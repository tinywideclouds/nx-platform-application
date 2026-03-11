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
  WorkspaceAttachment,
} from '@nx-platform-application/llm-types';
import { DataSourceBundle } from '@nx-platform-application/data-sources-types';
import { DataSourcesService } from '@nx-platform-application/data-sources/features/state';

@Component({
  selector: 'llm-context-hierarchy',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './context-hierarchy.component.html',
  styleUrl: './context-hierarchy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmContextHierarchyComponent {
  private dataSourcesState = inject(DataSourcesService);

  // Updated Inputs to match explicit session buckets
  session = input.required<LlmSession | null>();
  inlineAttachments = input<WorkspaceAttachment[]>([]);
  systemAttachments = input<WorkspaceAttachment[]>([]);
  compiledContext = input<WorkspaceAttachment | undefined>(undefined);

  isCompiling = input<boolean>(false);

  // Outputs targeting specific buckets
  removeInline = output<URN>();
  removeSystem = output<URN>();
  removeCompiled = output<URN>();

  getDataSourceBundleDetails(urn: URN): DataSourceBundle | undefined {
    return this.dataSourcesState.bundles().find((c) => c.id.equals(urn));
  }

  /**
   * Identifies if a URN points to a Data Group vs a Raw Source
   */
  isGroup(urn: URN): boolean {
    return urn.entityType === 'group';
  }
}
