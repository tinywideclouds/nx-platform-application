import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  viewChild,
  ElementRef,
  TemplateRef,
  signal,
  effect,
  afterNextRender,
  Injector,
  inject,
  model,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { fromEvent } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import {
  ScrollItem,
  WeightUpdate,
} from '@nx-platform-application/scrollspace-types';
import { ScrollspaceRowComponent } from '../row/row.component';

@Component({
  selector: 'scrollspace-viewport',
  standalone: true,
  imports: [
    CommonModule,
    ScrollspaceRowComponent,
    // ✅ Required for template elements
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './viewport.component.html',
  styleUrl: './viewport.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollspaceViewportComponent<T> {
  // --- Inputs ---
  items = input.required<ScrollItem<T>[]>();
  historySpacerHeight = input(0);
  newItemsLabel = input('New Messages'); // ✅ Consumed by markerTemplate default

  // Pluggable Templates
  rowTemplate =
    input.required<TemplateRef<{ $implicit: T; meta: ScrollItem<T> }>>();

  gutterTemplate = input<TemplateRef<any>>();
  dateTemplate = input<TemplateRef<{ $implicit: string }>>();
  markerTemplate = input<TemplateRef<void>>();

  // --- Outputs ---
  itemsVisible = output<string[]>();
  scrolledToTop = output<void>();
  weightUpdate = output<WeightUpdate>();

  isSelectionMode = input<boolean>(false);
  selectedIds = model<Set<string>>(new Set());
  selectionTemplate = input<TemplateRef<any>>();

  // --- Internals ---
  viewport = viewChild.required<ElementRef<HTMLElement>>('viewportContainer');
  showScrollButton = signal(false);

  private isNearBottom = true;
  private injector = inject(Injector);

  constructor() {
    // 1. DATA CHANGE REACTION
    effect(() => {
      const currentItems = this.items();
      this.historySpacerHeight(); // Track dependency

      // Zoneless Scroll Scheduling
      afterNextRender(
        () => {
          this.handleAutoScroll(currentItems);
        },
        { injector: this.injector },
      );
    });

    // 2. SCROLL LISTENER
    effect((onCleanup) => {
      const el = this.viewport().nativeElement;

      const sub = fromEvent(el, 'scroll')
        .pipe(throttleTime(50, undefined, { leading: true, trailing: true }))
        .subscribe(() => this.onScroll(el));

      const ro = new ResizeObserver(() => {
        if (this.isNearBottom) {
          el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
        }
      });
      ro.observe(el);

      onCleanup(() => {
        sub.unsubscribe();
        ro.disconnect();
      });
    });
  }

  // --- LOGIC ---

  private onScroll(el: HTMLElement) {
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    if (scrollTop < 50) {
      this.scrolledToTop.emit();
    }

    const isSticky = distanceToBottom < 50;
    if (this.isNearBottom !== isSticky) {
      this.isNearBottom = isSticky;
      this.showScrollButton.set(!isSticky);
    }
  }

  private handleAutoScroll(items: ScrollItem<T>[]) {
    if (items.length === 0) return;
    const el = this.viewport().nativeElement;

    const lastItem = items[items.length - 1];
    const isSelf = lastItem.actor?.isSelf ?? false;

    if (this.isNearBottom || isSelf) {
      this.performSmartScroll(el);
    } else {
      this.showScrollButton.set(true);
    }
  }

  private performSmartScroll(el: HTMLElement) {
    const { scrollHeight, scrollTop, clientHeight } = el;
    const currentBottom = scrollTop + clientHeight;
    const distanceToNewBottom = scrollHeight - currentBottom;

    if (distanceToNewBottom > clientHeight * 2) {
      el.scrollTo({ top: currentBottom, behavior: 'smooth' });
    } else {
      el.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }

    this.isNearBottom = true;
    this.showScrollButton.set(false);
  }

  // ✅ Template Interaction Methods
  scrollToBottom() {
    const el = this.viewport().nativeElement;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    this.isNearBottom = true;
    this.showScrollButton.set(false);
  }

  onRowVisible(id: string) {
    this.itemsVisible.emit([id]);
  }

  toggleSelection(id: string) {
    // Clone the set to trigger signal reactivity
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedIds.set(current);
  }
}
