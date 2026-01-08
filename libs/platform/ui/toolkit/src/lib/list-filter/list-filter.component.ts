import {
  Component,
  ChangeDetectionStrategy,
  signal,
  model,
  viewChild,
  ElementRef,
  input,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'lib-list-filter',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './list-filter.component.html',
  styleUrl: './list-filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListFilterComponent {
  // --- INPUTS & STATE ---
  query = model<string>('');
  placeholder = input<string>('Search...');

  isOpen = signal(false);

  // --- VIEW CHILDREN ---
  private inputRef = viewChild<ElementRef<HTMLInputElement>>('filterInput');

  // --- ACTIONS ---

  toggle() {
    this.isOpen.update((v) => !v);

    if (this.isOpen()) {
      // Focus after render
      setTimeout(() => this.inputRef()?.nativeElement.focus());
    } else {
      this.clearAndClose();
    }
  }

  close() {
    this.isOpen.set(false);
    this.clearAndClose();
  }

  onQueryChange(val: string) {
    this.query.set(val);
  }

  clear() {
    this.query.set('');
    this.inputRef()?.nativeElement.focus();
  }

  private clearAndClose() {
    this.query.set('');
  }
}
