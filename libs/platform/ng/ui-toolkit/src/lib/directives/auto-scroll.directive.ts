import {
  Directive,
  ElementRef,
  inject,
  effect,
  input,
  output,
  DestroyRef,
} from '@angular/core';

@Directive({
  selector: '[appAutoScroll]',
  standalone: true,
  exportAs: 'appAutoScroll',
})
export class AutoScrollDirective {
  private el = inject(ElementRef<HTMLElement>);
  // ✅ Modern DestroyRef (replaces ngOnDestroy)
  private destroyRef = inject(DestroyRef);

  data = input.required<any[]>({ alias: 'appAutoScroll' });
  shouldForceScroll = input<(item: any) => boolean>();

  readonly alertVisibility = output<boolean>();

  private isInitialLoad = true;
  private isAutoScrolling = false;
  private scrollTimeoutId: any;

  constructor() {
    // ✅ Pass 'onCleanup' to handle effect-specific teardown
    effect((onCleanup) => {
      const items = this.data();
      if (!items || items.length === 0) return;

      // 1. Initial Load Logic
      if (this.isInitialLoad) {
        const rafId = requestAnimationFrame(() => {
          this.scrollToBottom('auto');
          this.isInitialLoad = false;
        });

        // Cleanup: Cancel if component dies OR effect re-runs
        onCleanup(() => cancelAnimationFrame(rafId));
        return;
      }

      // 2. Standard Scroll Logic
      const lastItem = items[items.length - 1];
      const predicate = this.shouldForceScroll();
      const forceScroll = predicate ? predicate(lastItem) : false;
      const wasAtBottom = this.isUserNearBottom();
      const shouldScroll = forceScroll || wasAtBottom || this.isAutoScrolling;

      // 3. Nested RAF for Layout Thrashing protection
      const outerRafId = requestAnimationFrame(() => {
        const innerRafId = requestAnimationFrame(() => {
          if (shouldScroll) {
            this.scrollToBottom('smooth');
            this.alertVisibility.emit(false);
          } else {
            this.alertVisibility.emit(true);
          }
        });

        // Register inner cleanup
        onCleanup(() => cancelAnimationFrame(innerRafId));
      });

      // Register outer cleanup
      onCleanup(() => cancelAnimationFrame(outerRafId));
    });

    // ✅ Clean up the scroll lock timeout using DestroyRef
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.scrollTimeoutId);
    });
  }

  public scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    const nativeEl = this.el.nativeElement;
    this.isAutoScrolling = true;

    // Safety check for JSDOM or detached elements
    if (nativeEl.scrollTo) {
      nativeEl.scrollTo({ top: nativeEl.scrollHeight, behavior });
    }

    clearTimeout(this.scrollTimeoutId);

    // Set lock
    this.scrollTimeoutId = setTimeout(() => {
      this.isAutoScrolling = false;
    }, 1000);
  }

  private isUserNearBottom(): boolean {
    const el = this.el.nativeElement;
    const threshold = 150;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }
}
