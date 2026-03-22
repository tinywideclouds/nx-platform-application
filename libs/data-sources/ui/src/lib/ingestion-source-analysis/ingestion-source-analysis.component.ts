import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DataSourceAnalysis } from '@nx-platform-application/data-sources-types';

@Component({
  selector: 'ingestion-source-analysis',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './ingestion-source-analysis.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngestionSourceAnalysisComponent {
  analysis = input.required<DataSourceAnalysis>();
  status = input.required<string>();

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
