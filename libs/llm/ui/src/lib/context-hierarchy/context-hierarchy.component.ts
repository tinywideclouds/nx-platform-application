import {
  Component,
  input,
  output,
  computed,
  signal,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { URN } from '@nx-platform-application/platform-types';
import {
  LlmSession,
  SessionAttachment,
} from '@nx-platform-application/llm-types';
import { DataSourceBundle } from '@nx-platform-application/data-sources-types';
import { DataSourcesService } from '@nx-platform-application/data-sources/features/state';

@Component({
  selector: 'llm-context-hierarchy',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './context-hierarchy.component.html',
  styleUrl: './context-hierarchy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmContextHierarchyComponent {
  private dataSourcesState = inject(DataSourcesService);

  session = input.required<LlmSession | null>();
  attachments = input.required<SessionAttachment[]>();
  isCompiling = input<boolean>(false);

  removeAttachment = output<URN>();
  compileCache = output<number | undefined>();

  ttlValue = signal<number | undefined>(undefined);

  groupedAttachments = computed(() => {
    const atts = this.attachments() || [];
    return {
      inlineContext: atts.filter((a) => a.target === 'inline-context'),
      systemInstruction: atts.filter((a) => a.target === 'system-instruction'),
    };
  });

  getDataSourceBundleDetails(urn: URN): DataSourceBundle | undefined {
    return this.dataSourcesState.bundles().find((c) => c.id.equals(urn));
  }
}
