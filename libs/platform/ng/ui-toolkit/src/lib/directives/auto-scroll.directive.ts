// libs/shared/ui/src/lib/auto-scroll.directive.ts
import {
  Directive,
  ElementRef,
  inject,
  effect,
  input, // Modern Signal Input
  output, // Modern Output
} from '@angular/core';

@Directive({
  selector: '[appAutoScroll]',
  standalone: true,
  exportAs: 'appAutoScroll',
})
export class AutoScrollDirective {
  private el = inject(ElementRef<HTMLElement>);

  // 1. Modern Signal Inputs
  // Alias allows us to keep the syntax: [appAutoScroll]="messages()"
  data = input.required<any[]>({ alias: 'appAutoScroll' });

  // Optional predicate function
  shouldForceScroll = input<(item: any) => boolean>();

  // 2. Modern Output
  readonly alertVisibility = output<boolean>();

  private isInitialLoad = true;
  private isAutoScrolling = false;
  private scrollTimeoutId: any;

  constructor() {
    // 3. Effect automatically tracks the 'data' input signal
    effect(() => {
      const items = this.data(); // Accessing the input signal
      if (!items || items.length === 0) return;

      // A. Initial Load
      if (this.isInitialLoad) {
        requestAnimationFrame(() => {
          this.scrollToBottom('auto');
          this.isInitialLoad = false;
        });
        return;
      }

      // B. Determine Scroll Logic
      const lastItem = items[items.length - 1];

      // Get the predicate function from the input signal
      const predicate = this.shouldForceScroll();
      const forceScroll = predicate ? predicate(lastItem) : false;

      const wasAtBottom = this.isUserNearBottom();
      const shouldScroll = forceScroll || wasAtBottom || this.isAutoScrolling;

      // C. Action
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (shouldScroll) {
            this.scrollToBottom('smooth');
            this.alertVisibility.emit(false);
          } else {
            this.alertVisibility.emit(true);
          }
        });
      });
    });
  }

  // (Cleanup is handled automatically by Angular for timers usually,
  // but good practice to keep manual cleanup for timeouts)
  ngOnDestroy() {
    clearTimeout(this.scrollTimeoutId);
  }

  public scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    const nativeEl = this.el.nativeElement;
    this.isAutoScrolling = true;

    nativeEl.scrollTo({ top: nativeEl.scrollHeight, behavior });

    clearTimeout(this.scrollTimeoutId);
    this.scrollTimeoutId = setTimeout(() => {
      this.isAutoScrolling = false;
    }, 1000);

    this.alertVisibility.emit(false);
  }

  private isUserNearBottom(): boolean {
    const el = this.el.nativeElement;
    const threshold = 150;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }
}
