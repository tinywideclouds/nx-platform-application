import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
  ElementRef,
  OnDestroy,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';

const COMPACT_THRESHOLD_REM = 24; // 24rem

export type pageMode = "full" | "compact" | undefined;

@Component({
  selector: 'contacts-page-toolbar',
  standalone: true,
  imports: [CommonModule, MatToolbarModule],
  templateUrl: './contacts-page-toolbar.component.html',
  styleUrl: './contacts-page-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPageToolbarComponent implements OnDestroy {
  private elRef = inject(ElementRef);
  private resizeObserver!: ResizeObserver;
  private elementWidth = signal(0);
  private compactBreakpointPx = 0;

  forceIconMode = input(false);

  /** The internal mode, computed from the component's own width. */
  public readonly mode = computed<pageMode>(() => {
    // quick check for forced mode
    if (this.forceIconMode()) {
      return 'compact';
    }

    const width = this.elementWidth();

    // If width is not yet set (0), mode is undefined.
    // This allows the UI to wait for the first measurement.
    if (!width) {
      return undefined;
    }

    return width < this.compactBreakpointPx ? 'compact' : 'full';
  });

  constructor() {
    try {
      const rootFontSizePx = parseFloat(
        getComputedStyle(document.documentElement).fontSize
      );
      this.compactBreakpointPx = COMPACT_THRESHOLD_REM * rootFontSizePx;
    } catch (e) {
      this.compactBreakpointPx = COMPACT_THRESHOLD_REM * 16;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        this.elementWidth.set(entries[0].contentRect.width);
      }
    });

    this.resizeObserver.observe(this.elRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver.unobserve(this.elRef.nativeElement);
    this.resizeObserver.disconnect();
  }
}