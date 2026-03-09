import {
  Component,
  input,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FileMetadata } from '@nx-platform-application/data-sources-types';

@Component({
  selector: 'llm-file-explorer-display',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './file-explorer.component.html',
  styleUrl: './file-explorer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmFileExplorerDisplayComponent {
  files = input<FileMetadata[]>([]);

  // Note: In a production refinement, we would use a library like 'minimatch' and 'js-yaml'
  // to evaluate this rulesYaml string against the files() array and visually dim excluded files.
  activeRulesYaml = input<string | null>(null);

  totalSize = computed(() => {
    return this.files().reduce((acc, f) => acc + f.sizeBytes, 0);
  });

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
