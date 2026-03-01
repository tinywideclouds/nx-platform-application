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

import { CacheBundle } from '@nx-platform-application/llm-types';

@Component({
  selector: 'llm-data-source-header',
  standalone: true,
  imports: [
    CommonModule,
    MatSelectModule,
    MatIconModule,
    MatDividerModule,
    MatFormFieldModule,
  ],
  templateUrl: './data-source-header.component.html',
  styleUrl: './data-source-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmDataSourceHeaderComponent {
  // --- INPUTS ---
  isNew = input.required<boolean>();
  cache = input.required<CacheBundle | null | undefined>();
  availableBranches = input.required<CacheBundle[]>();

  // --- OUTPUTS ---
  branchChange = output<string>();
}
