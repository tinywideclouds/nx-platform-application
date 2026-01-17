import {
  Component,
  ChangeDetectionStrategy,
  viewChild,
  ElementRef,
  output,
  signal,
  effect,
  HostListener,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'lib-swipeable-item',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './swipeable-item.component.html',
  styleUrl: './swipeable-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwipeableItemComponent {
  // --- CONFIGURATION ---
  /** Optional: Force enable/disable swipe physics. */
  enabled = input<boolean | undefined>(undefined);

  /** The Material Icon to show when pulling (e.g. 'delete_forever', 'archive') */
  triggerIcon = input<string>('delete_forever');

  /** The text to show under the icon (e.g. 'Release', 'Archive') */
  triggerLabel = input<string>('Release');

  /** The Tailwind class for the sentinel background (e.g. 'bg-red-700', 'bg-blue-500') */
  triggerColorClass = input<string>('bg-red-700');

  // --- OUTPUTS ---
  select = output<void>();
  swipe = output<void>();
  swipeStart = output<void>();
  secondaryPress = output<MouseEvent>();

  // --- QUERIES ---
  sentinel = viewChild<ElementRef>('sentinel');
  container = viewChild<ElementRef>('container');

  // --- STATE ---
  isActionVisible = signal(false);

  // --- CONSTRUCTOR ---
  constructor() {
    effect((onCleanup) => {
      const sentinelEl = this.sentinel()?.nativeElement;
      const containerEl = this.container()?.nativeElement;

      const isTouch =
        this.enabled() ?? !window.matchMedia('(hover: hover)').matches;

      if (sentinelEl && containerEl && isTouch) {
        const observer = this.createOverscrollObserver(containerEl);
        observer.observe(sentinelEl);
        onCleanup(() => observer.disconnect());
      }
    });
  }

  // --- PUBLIC API ---
  reset(animate = true): Promise<void> {
    const container = this.container()?.nativeElement as HTMLElement;
    if (!container) return Promise.resolve();

    this.isActionVisible.set(false);

    if (!animate) {
      container.style.scrollBehavior = 'auto';
      container.scrollLeft = 0;
      container.style.scrollBehavior = '';
    } else {
      container.scrollTo({
        left: 0,
        behavior: 'smooth',
      });
    }

    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  // --- LOGIC ---
  onScroll(): void {
    const scrollLeft = this.container()?.nativeElement.scrollLeft || 0;

    if (scrollLeft > 5 && !this.isActionVisible()) {
      this.swipeStart.emit();
    }

    this.isActionVisible.set(scrollLeft > 5);
  }

  onContentClick(): void {
    this.select.emit();
  }

  @HostListener('contextmenu', ['$event'])
  onRightClick(event: MouseEvent): void {
    this.secondaryPress.emit(event);
  }

  private createOverscrollObserver(root: HTMLElement): IntersectionObserver {
    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.intersectionRatio > 0.8) {
            if (navigator.vibrate) navigator.vibrate(50);
            this.swipe.emit();
          }
        });
      },
      { root, threshold: [0.2, 0.8] },
    );
  }
}
