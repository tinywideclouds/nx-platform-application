import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';

// Keeping the agreed-upon UI vocabulary alias
import { GithubIngestionTarget as IngestionSource } from '@nx-platform-application/data-sources-types';

@Component({
  selector: 'github-ingestion-header',
  standalone: true,
  imports: [
    CommonModule,
    MatSelectModule,
    MatIconModule,
    MatDividerModule,
    MatFormFieldModule,
  ],
  templateUrl: './github-ingestion-header.component.html',
  styleUrl: './github-ingestion-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GithubIngestionHeaderComponent {
  // --- INPUTS ---
  isNew = input.required<boolean>();
  source = input.required<IngestionSource | null | undefined>();
  availableBranches = input.required<IngestionSource[]>();

  // --- OUTPUTS ---
  branchChange = output<string>();
}
