import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

export type DataSourceActiveView = 'repos' | 'caches';

@Component({
  selector: 'llm-data-source-wrapper',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatIconModule],
  templateUrl: './data-source-wrapper.component.html',
  styleUrl: './data-source-wrapper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourceWrapperComponent {
  private router = inject(Router);

  // Reactively track the current route to keep the toggle switch perfectly in sync
  activeView = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.getViewFromUrl(this.router.url)),
      startWith(this.getViewFromUrl(this.router.url)),
    ),
    { initialValue: 'repos' as DataSourceActiveView },
  );

  private getViewFromUrl(url: string): DataSourceActiveView {
    if (url.includes('/data-sources/caches')) return 'caches';
    return 'repos'; // Default fallback
  }

  switchView(view: DataSourceActiveView) {
    if (view === 'repos') {
      this.router.navigate(['/data-sources/repos']);
    } else {
      this.router.navigate(['/data-sources/caches']);
    }
  }
}
