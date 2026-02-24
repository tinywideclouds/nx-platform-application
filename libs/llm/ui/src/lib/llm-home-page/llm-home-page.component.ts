import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

import {
  LlmToolbarComponent,
  LlmAppView,
} from '../llm-toolbar/llm-toolbar.component';

@Component({
  selector: 'llm-home-page',
  standalone: true,
  imports: [CommonModule, RouterOutlet, LlmToolbarComponent],
  templateUrl: './llm-home-page.component.html',
  styleUrl: './llm-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmHomePageComponent {
  private router = inject(Router);

  /**
   * Derives the active global view strictly from the URL to pass to the dumb toolbar.
   */
  activeView = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.getViewFromUrl(this.router.url)),
      startWith(this.getViewFromUrl(this.router.url)),
    ),
    { initialValue: 'chat' as LlmAppView },
  );

  private getViewFromUrl(url: string): LlmAppView {
    if (url.includes('/data-sources')) return 'data-sources';
    if (url.includes('/settings')) return 'settings';
    return 'chat';
  }

  // --- ACTIONS ---

  onViewChat() {
    this.router.navigate(['/chat']);
  }

  onViewDataSources() {
    this.router.navigate(['/data-sources']);
  }

  onViewSettings() {
    this.router.navigate(['/settings']);
  }
}
