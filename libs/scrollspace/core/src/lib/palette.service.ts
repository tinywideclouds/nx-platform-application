import { Injectable } from '@angular/core';
import {
  ScrollActor,
  ScrollBubbleStyle,
} from '@nx-platform-application/scrollspace-types';

/**
 * The Palette determines the LOOK based on the ACTOR.
 * It is completely decoupled from alignment.
 */
export abstract class ScrollspacePalette {
  abstract getBubbleStyle(actor: ScrollActor): ScrollBubbleStyle;
  abstract getAvatarClass(actor: ScrollActor): string;
}

@Injectable({ providedIn: 'root' })
export class DefaultPaletteService implements ScrollspacePalette {
  private readonly colors = [
    '#EF476F',
    '#FFD166',
    '#06D6A0',
    '#118AB2',
    '#9D4EDD',
    '#FF9F1C',
  ];

  getBubbleStyle(actor: ScrollActor): ScrollBubbleStyle {
    // 1. If it's "Me", provide a neutral default (or the app overrides this)
    if (actor.isSelf) {
      return { backgroundColor: '#e5e7eb', color: '#1f2937' }; // Gray-200 / Gray-800
    }

    // 2. For everyone else, consistent hash-based coloring
    const bg = this.getColorForString(actor.id.toString());
    const isDark = this.isColorDark(bg);

    return {
      backgroundColor: bg,
      color: isDark ? '#FFFFFF' : '#000000',
    };
  }

  getAvatarClass(_: ScrollActor): string {
    return 'rounded-full';
  }

  private getColorForString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % this.colors.length);
    return this.colors[index];
  }

  private isColorDark(hex: string): boolean {
    // Simple logic to determine text contrast
    return hex !== '#FFD166' && hex !== '#FF9F1C';
  }
}
