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

import { MatToolbarModule } from '@angular/material/toolbar';

const COMPACT_THRESHOLD_REM = 24; // ~384px at 16px base

export type pageMode = 'full' | 'compact';

@Component({
  selector: 'contacts-page-toolbar',
  standalone: true,
  imports: [MatToolbarModule],
  templateUrl: './contacts-page-toolbar.component.html',
  styleUrl: './contacts-page-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPageToolbarComponent implements OnDestroy {
  private elRef = inject(ElementRef);
  private resizeObserver!: ResizeObserver;
  private elementWidth = signal(0);
  private compactBreakpointPx = 0;

  title = input<string>('Contacts');

  /** * Forces the toolbar into icon-only mode regardless of width.
   * Useful for sidebars or narrow contexts.
   */
  forceIconMode = input(false);

  /** * The internal mode, computed from the component's own width.
   * Defaults to 'compact' to prevent layout shift/flicker on init.
   */
  public readonly mode = computed<pageMode>(() => {
    // 1. Priority: Forced Mode
    if (this.forceIconMode()) {
      return 'compact';
    }

    // 2. Priority: Measured Width
    const width = this.elementWidth();

    // If width is 0 (initial render), default to compact (safe).
    // Avoiding 'undefined' ensures content renders immediately.
    if (!width) {
      return 'compact';
    }

    return width < this.compactBreakpointPx ? 'compact' : 'full';
  });

  private rafId: number | null = null;

  constructor() {
    // Calculate pixel threshold based on current root font size
    try {
      const rootFontSizePx = parseFloat(
        getComputedStyle(document.documentElement).fontSize
      );
      this.compactBreakpointPx = COMPACT_THRESHOLD_REM * (rootFontSizePx || 16);
    } catch (e) {
      this.compactBreakpointPx = COMPACT_THRESHOLD_REM * 16;
    }

    // Setup ResizeObserver with requestAnimationFrame debouncing
    this.resizeObserver = new ResizeObserver((entries) => {
      if (this.rafId) cancelAnimationFrame(this.rafId);

      this.rafId = requestAnimationFrame(() => {
        this.elementWidth.set(entries[0].contentRect.width);
        this.rafId = null;
      });
    });

    this.resizeObserver.observe(this.elRef.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
  }
}
