import { Injectable, OnDestroy, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import {
  Observable,
  Subject,
  BehaviorSubject,
  EMPTY,
  catchError,
  tap,
  retry,
  timer,
  Subscription,
  defer,
} from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { WSS_URL_TOKEN } from './live-data.config';
import { ConnectionStatus } from '@nx-platform-application/platform-types';
import { AppLifecycleService } from '@nx-platform-application/platform-lifecycle';

@Injectable({
  providedIn: 'root',
})
export class ChatLiveDataService implements OnDestroy {
  private readonly logger = inject(Logger);
  private readonly lifecycle = inject(AppLifecycleService);
  private readonly baseApiUrl =
    inject(WSS_URL_TOKEN, { optional: true }) ?? 'api/connect';

  private socket$?: WebSocketSubject<unknown>;
  private subscription?: Subscription;
  private resumeSub: Subscription;
  private lastToken?: string;

  private readonly statusSubject = new BehaviorSubject<ConnectionStatus>(
    'disconnected',
  );
  public readonly status$ = this.statusSubject.asObservable();

  private readonly messageSubject = new Subject<void>();
  public readonly incomingMessage$ = this.messageSubject.asObservable();

  constructor() {
    this.logger.info('ChatLiveDataService initialized');

    this.resumeSub = this.lifecycle.resumed$.subscribe(() => {
      this.handleAppResume();
    });
  }

  private handleAppResume(): void {
    // Only force-cycle if we should be connected
    if (this.statusSubject.value === 'connected' && this.lastToken) {
      this.logger.info(
        '[ChatLive] App resumed. Force-cycling connection to ensure health...',
      );
      this.disconnect();
      this.connect(this.lastToken);
    }
  }

  public connect(jwtToken: string): void {
    this.lastToken = jwtToken;

    if (this.subscription) {
      return;
    }
    this.logger.info('connecting websocket', this.baseApiUrl);
    this.statusSubject.next('connecting');

    const stream$ = defer(() => {
      this.logger.info(
        `WSS: Creating WebSocket connection to: ${this.baseApiUrl}`,
      );

      // 1. Create the subject but don't assign to this.socket$ yet
      // We need a reference to 'this' specific instance for the observers below
      const localSocket = webSocket({
        url: this.baseApiUrl,
        protocol: [jwtToken],
        openObserver: {
          next: () => {
            // Guard: Only update if THIS is the active socket
            if (this.socket$ === localSocket) {
              this.logger.debug('WSS: Connection OPENED.');
              this.statusSubject.next('connected');
            }
          },
        },
        closeObserver: {
          next: (closeEvent) => {
            // Guard: Ignore close events from "Zombie" sockets (replaced instances)
            if (this.socket$ !== localSocket) {
              this.logger.debug(
                'WSS: Ignoring close event from replaced socket instance.',
              );
              return;
            }

            this.logger.debug(
              `WSS: Connection CLOSED. Code: ${closeEvent.code}, Clean: ${closeEvent.wasClean}`,
            );

            // Only update status if we aren't already handling a retry loop
            if (
              this.statusSubject.value !== 'reconnection' &&
              this.statusSubject.value !== 'disconnected'
            ) {
              this.statusSubject.next('disconnected');
            }
          },
        },
      });

      // 2. Now assign it as the active socket
      this.socket$ = localSocket;
      return localSocket;
    }).pipe(
      tap({
        error: (err) => {
          this.logger.error('ChatLiveDataService: WebSocket error', err);
          this.statusSubject.next('error');
        },
      }),
      retry({
        delay: (error, retryCount) => {
          this.statusSubject.next('reconnection');
          const delay = Math.min(1000 * 2 ** retryCount, 30000);
          this.logger.warn(
            `WebSocket retry attempt ${retryCount}, delay ${delay}ms`,
          );
          return timer(delay);
        },
      }),
      catchError((err) => {
        this.logger.error(
          'ChatLiveDataService: Unrecoverable WebSocket error',
          err,
        );
        return EMPTY;
      }),
    );

    this.subscription = stream$.subscribe({
      next: () => {
        this.logger.info('ChatLiveDataService: Received "poke"');
        this.messageSubject.next();
      },
      complete: () => {
        this.logger.info('ChatLiveDataService: Stream complete');
        if (this.statusSubject.value !== 'disconnected') {
          this.statusSubject.next('disconnected');
        }
        this.resetState();
      },
      error: () => {
        this.statusSubject.next('disconnected');
        this.resetState();
      },
    });
  }

  public disconnect(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }

    if (this.socket$) {
      this.socket$.complete();
      // We do NOT set socket$ to undefined here immediately if we want
      // the identity check to potentially work, but usually setting it to undefined
      // ensures the check (this.socket$ === localSocket) fails, which is what we want.
      this.socket$ = undefined;
    }

    if (this.statusSubject.value !== 'disconnected') {
      this.statusSubject.next('disconnected');
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.statusSubject.complete();
    this.messageSubject.complete();
    this.resumeSub.unsubscribe();
  }

  private resetState(): void {
    this.subscription = undefined;
    this.socket$ = undefined;
  }
}
