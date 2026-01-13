import { Injectable, inject, DestroyRef, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Subject, fromEvent } from 'rxjs';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({
  providedIn: 'root',
})
export class AppLifecycleService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef); // Modern Cleanup
  private readonly logger = inject(Logger);

  // Sources
  private readonly resumedSubject = new Subject<void>();
  private readonly pausedSubject = new Subject<void>();

  // Public Streams
  public readonly resumed$ = this.resumedSubject.asObservable();
  public readonly paused$ = this.pausedSubject.asObservable();

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // 1. SSR Guard
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // 2. Setup Listener
    const sub = fromEvent(this.document, 'visibilitychange').subscribe(() => {
      this.logger.debug('visibility change', this.document.visibilityState);
      if (this.document.visibilityState === 'visible') {
        this.resumedSubject.next();
      } else {
        this.pausedSubject.next();
      }
    });

    // 3. Modern Cleanup
    // Register the teardown logic immediately
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }
}
