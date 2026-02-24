import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'llm-data-sources-placeholder',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  template: `
    <div class="flex flex-col items-center justify-center h-full text-gray-400">
      <mat-icon class="text-6xl mb-4 text-gray-300">source</mat-icon>
      <p class="text-lg mb-6">Select a datasource or:</p>
      <button mat-flat-button color="primary" routerLink="/data-sources/new">
        <mat-icon>add</mat-icon> Add a Datasource
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        width: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmDataSourcesPlaceholderComponent {}
