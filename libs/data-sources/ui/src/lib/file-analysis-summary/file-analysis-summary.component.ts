import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FileAnalysis } from '@nx-platform-application/data-sources-types';

@Component({
  selector: 'file-analysis-summary',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './file-analysis-summary.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileAnalysisSummaryComponent {
  analysis = input<FileAnalysis | undefined | null>(null);
  fallbackFileCount = input<number>(0);

  title = input.required<string>();
  icon = input.required<string>();
  subtitle = input<string | null>(null);
  warningMessage = input<string | null>(null);

  colorTheme = input<'slate' | 'green' | 'indigo'>('slate');

  topExtensions = computed(() => {
    const a = this.analysis();
    if (!a || !a.extensions) return [];

    return Object.entries(a.extensions)
      .map(([ext, count]) => ({
        ext: (ext || 'TXT').replace('.', '').toUpperCase(),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Keep the UI clean by capping at top 8
  });
}
