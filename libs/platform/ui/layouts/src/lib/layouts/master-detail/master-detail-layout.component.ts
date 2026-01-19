import {
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'platform-master-detail-layout',
  standalone: true,
  imports: [],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './master-detail-layout.component.html',
  styleUrl: './master-detail-layout.component.scss',
})
export class MasterDetailLayoutComponent {
  private readonly BREAKPOINT = 700;

  // --- SIGNALS ---
  containerRef = viewChild.required<ElementRef<HTMLElement>>('container');
  showDetail = input(false);

  // The Layout State
  isNarrow = signal(true);
  isNarrowChange = output<boolean>();

  // --- COMPUTED VISIBILITY ---
  shouldHideSidebar = computed(() => this.isNarrow() && this.showDetail());
  shouldHideMain = computed(() => this.isNarrow() && !this.showDetail());

  constructor() {
    effect((onCleanup) => {
      const element = this.containerRef().nativeElement;

      // Create the observer
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          const isNarrowNow = width < this.BREAKPOINT;

          // Update signal only on change
          if (this.isNarrow() !== isNarrowNow) {
            this.isNarrow.set(isNarrowNow);
            this.isNarrowChange.emit(isNarrowNow);
          }
        }
      });

      // Start observing
      observer.observe(element);

      // Register cleanup (replaces ngOnDestroy)
      onCleanup(() => {
        observer.disconnect();
      });
    });
  }
}
