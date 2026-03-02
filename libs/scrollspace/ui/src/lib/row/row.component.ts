import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
  effect,
  viewChild,
  ElementRef,
  TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ScrollItem,
  ScrollLayout,
  ScrollAdornments,
} from '@nx-platform-application/scrollspace-types';
import {
  ScrollspacePalette,
  DefaultPaletteService,
} from '@nx-platform-application/scrollspace-core';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'scrollspace-row',
  standalone: true,
  imports: [CommonModule, MatTooltipModule, MatCheckboxModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './row.component.html',
  styleUrls: ['./row.component.scss'],
})
export class ScrollspaceRowComponent {
  // --- Inputs ---
  item = input.required<ScrollItem<any>>();

  // --- Outputs ---
  // Emits item ID when it enters the viewport (Intersection Observer)
  visible = output<string>();

  isSelectionMode = input<boolean>(false);
  isSelected = input<boolean>(false);
  selectionTemplate = input<TemplateRef<any>>();
  gutterTemplate = input<TemplateRef<any>>();

  toggleSelection = output<void>();

  // --- Internals ---
  rowElement = viewChild.required<ElementRef<HTMLElement>>('rowElement');

  private palette =
    inject(ScrollspacePalette, { optional: true }) ??
    inject(DefaultPaletteService);

  get isSelectable(): boolean {
    return this.layout().selectable !== false;
  }

  // --- Computed Props ---
  layout = computed<ScrollLayout>(() => this.item().layout);
  adornments = computed<ScrollAdornments | undefined>(
    () => this.item().adornments,
  );

  hasCursors = computed<boolean>(
    () => (this.adornments()?.cursors?.length || 0) > 0,
  );

  // Type-Safe Palette Resolution
  paletteStyle = computed(() => {
    const actor = this.item().actor;
    // System messages (center) don't get colored bubbles
    if (!actor || this.layout().alignment === 'center') return null;

    // The palette service must handle the ScrollActor interface
    const style = this.palette.getBubbleStyle(actor);
    return { bg: style.backgroundColor, text: style.color };
  });

  constructor() {
    // Visibility Tracking
    effect((onCleanup) => {
      const element = this.rowElement().nativeElement;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.visible.emit(this.item().id);
          }
        },
        { threshold: 0.1 }, // 10% visibility trigger
      );

      observer.observe(element);

      onCleanup(() => observer.disconnect());
    });
  }
}
