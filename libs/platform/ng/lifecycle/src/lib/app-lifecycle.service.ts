import { Injectable, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Subject, Subscription, fromEvent } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';

@Injectable({
  providedIn: 'root',
})
export class AppLifecycleService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private logger = inject(Logger);

  // Sources
  private readonly resumedSubject = new Subject<void>();
  private readonly pausedSubject = new Subject<void>();

  // Public Streams (Pure Logic, No DOM types leaked)
  public readonly resumed$ = this.resumedSubject.asObservable();
  public readonly paused$ = this.pausedSubject.asObservable();

  private visibilitySub?: Subscription;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // 1. SSR Guard: Do nothing on the server
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // 2. centralized DOM Listener
    this.visibilitySub = fromEvent(this.document, 'visibilitychange').subscribe(
      () => {
        this.logger.debug('visibility change', this.document.visibilityState);
        if (this.document.visibilityState === 'visible') {
          this.resumedSubject.next();
        } else {
          this.pausedSubject.next();
        }
      },
    );
  }

  ngOnDestroy(): void {
    this.visibilitySub?.unsubscribe();
  }
}
