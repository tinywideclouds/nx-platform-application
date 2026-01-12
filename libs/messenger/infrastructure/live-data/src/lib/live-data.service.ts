import { Injectable, OnDestroy, inject } from '@angular/core';
import { Logger } from '@nx-platform-application/console-logger';
import {
  BehaviorSubject,
  catchError,
  defer,
  EMPTY,
  retry,
  Subject,
  Subscription,
  tap,
  timer,
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

  // FIX 1: Strictly type the subject as 'void' to match the deserializer
  private socket$?: WebSocketSubject<void>;

  private subscription?: Subscription;
  private resumeSub: Subscription;

  // Refactor: Store the provider function
  private tokenProvider?: () => string;

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
    if (this.statusSubject.value === 'connected' && this.tokenProvider) {
      this.logger.info(
        '[ChatLive] App resumed. Force-cycling connection to ensure health...',
      );
      this.disconnect();
      this.connect(this.tokenProvider);
    }
  }

  public connect(tokenProvider: () => string): void {
    this.tokenProvider = tokenProvider;

    if (this.subscription) {
      return;
    }
    this.logger.info('connecting websocket', this.baseApiUrl);
    this.statusSubject.next('connecting');

    const stream$ = defer(() => {
      this.logger.info(
        `WSS: Creating WebSocket connection to: ${this.baseApiUrl}`,
      );

      const currentToken = this.tokenProvider ? this.tokenProvider() : '';

      // FIX 2: Explicitly genericize the factory to <void>
      const localSocket = webSocket<void>({
        url: this.baseApiUrl,
        protocol: [currentToken],

        // FIX 3: Deserializer guarantees void return, matching the type
        deserializer: ({ data }) => {
          return;
        },

        serializer: (value) => JSON.stringify(value),

        openObserver: {
          next: () => {
            if (this.socket$ === localSocket) {
              this.logger.debug('WSS: Connection OPENED.');
              this.statusSubject.next('connected');
            }
          },
        },
        closeObserver: {
          next: (closeEvent) => {
            if (this.socket$ !== localSocket) return;

            this.logger.debug(
              `WSS: Connection CLOSED. Code: ${closeEvent.code}, Clean: ${closeEvent.wasClean}`,
            );

            if (
              this.statusSubject.value !== 'reconnection' &&
              this.statusSubject.value !== 'disconnected'
            ) {
              this.statusSubject.next('disconnected');
            }
          },
        },
      });

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
