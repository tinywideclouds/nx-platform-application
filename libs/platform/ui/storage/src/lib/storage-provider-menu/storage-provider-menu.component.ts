import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StorageOption } from '@nx-platform-application/platform-types';

@Component({
  selector: 'platform-storage-provider-menu',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="flex flex-col gap-2">
      @for (option of options; track option.id) {
        <button
          mat-stroked-button
          color="primary"
          class="w-full justify-start"
          [disabled]="disabled"
          (click)="select.emit(option.id)"
        >
          <mat-icon class="mr-2">cloud_queue</mat-icon>
          Connect {{ option.name }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      button {
        text-align: left;
      }
    `,
  ],
})
export class StorageProviderMenuComponent {
  @Input({ required: true }) options: StorageOption[] = [];
  @Input() disabled = false;
  @Output() select = new EventEmitter<string>();
}
