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

import { DataSourceBundle } from '@nx-platform-application/data-sources-types';

@Component({
  selector: 'data-sources-header',
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
export class DataSourceHeaderComponent {
  // --- INPUTS ---
  isNew = input.required<boolean>();
  cache = input.required<DataSourceBundle | null | undefined>();
  availableBranches = input.required<DataSourceBundle[]>();

  // --- OUTPUTS ---
  branchChange = output<string>();
}
