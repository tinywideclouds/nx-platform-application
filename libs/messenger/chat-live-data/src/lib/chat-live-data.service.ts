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

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * Service responsible for managing the WebSocket connection for live chat data.
 * Handles automatic reconnection strategies, connection status tracking, and
 * incoming "poke" notifications.
 */
@Injectable({
  providedIn: 'root',
})
export class ChatLiveDataService implements OnDestroy {
  private readonly logger = inject(Logger);
  private readonly baseApiUrl =
    inject(WSS_URL_TOKEN, { optional: true }) ?? 'api/connect';

  private socket$?: WebSocketSubject<unknown>;
  private subscription?: Subscription;

  private readonly statusSubject = new BehaviorSubject<ConnectionStatus>(
    'disconnected'
  );
  public readonly status$ = this.statusSubject.asObservable();

  private readonly messageSubject = new Subject<void>();

  /**
   * Emits whenever a message is received from the WebSocket.
   * The payload is void as the message acts as a signal to refresh data.
   */
  public readonly incomingMessage$: Observable<void> =
    this.messageSubject.asObservable();

  constructor() {
    this.logger.info('ChatLiveDataService initialized');
  }

  /**
   * Establishes a WebSocket connection using the provided JWT.
   * If a connection is already active, this method does nothing.
   * * @param jwtToken The authentication token for the WebSocket protocol.
   */
  public connect(jwtToken: string): void {
    if (this.subscription) {
      return;
    }
    this.logger.info('connecting websocket', this.baseApiUrl);
    this.statusSubject.next('connecting');

    // defer() ensures the WebSocket is created only when subscribed to,
    // and recreated fresh on retries.
    const stream$ = defer(() => {
      this.logger.info(
        `WSS: Creating WebSocket connection to: ${this.baseApiUrl}`
      );

      this.socket$ = webSocket({
        url: this.baseApiUrl,
        protocol: [jwtToken],
        openObserver: {
          next: () => {
            this.logger.debug('WSS: Connection OPENED.');
            this.statusSubject.next('connected');
          },
        },
        closeObserver: {
          next: (closeEvent) => {
            this.logger.debug(
              `WSS: Connection CLOSED. Code: ${closeEvent.code}, Clean: ${closeEvent.wasClean}`
            );
            if (this.statusSubject.value !== 'disconnected') {
              this.statusSubject.next('disconnected');
            }
          },
        },
      });
      return this.socket$;
    }).pipe(
      tap({
        error: (err) => {
          this.logger.error('ChatLiveDataService: WebSocket error', err);
          this.statusSubject.next('error');
        },
      }),
      retry({
        delay: (error, retryCount) => {
          // Exponential backoff: 1s, 2s, 4s... capped at 30s
          const delay = Math.min(1000 * 2 ** retryCount, 30000);
          this.logger.warn(
            `WebSocket retry attempt ${retryCount}, delay ${delay}ms`
          );
          return timer(delay);
        },
      }),
      catchError((err) => {
        this.logger.error(
          'ChatLiveDataService: Unrecoverable WebSocket error',
          err
        );
        return EMPTY;
      })
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

  /**
   * Manually disconnects the WebSocket and cleans up subscriptions.
   */
  public disconnect(): void {
    // Call .complete() on the socket subject to imperatively close the connection
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = undefined;
    }

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }

    if (this.statusSubject.value !== 'disconnected') {
      this.statusSubject.next('disconnected');
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.statusSubject.complete();
    this.messageSubject.complete();
  }

  private resetState(): void {
    this.subscription = undefined;
    this.socket$ = undefined;
  }
}
