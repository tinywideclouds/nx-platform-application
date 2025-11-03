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

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

@Injectable({
  providedIn: 'root',
})
export class ChatLiveDataService implements OnDestroy {
  private readonly logger = inject(Logger);
  private readonly WSS_URL = 'wss://api.example.com/connect';

  private socket$?: WebSocketSubject<unknown>;
  private subscription?: Subscription;

  private readonly statusSubject = new BehaviorSubject<ConnectionStatus>(
    'disconnected'
  );
  public readonly status$ = this.statusSubject.asObservable();

  private readonly messageSubject = new Subject<void>();
  public readonly incomingMessage$: Observable<void> =
    this.messageSubject.asObservable();

  constructor() {
    this.logger.info('ChatLiveDataService initialized');
  }

  public connect(jwtToken: string): void {
    if (this.subscription) {
      return;
    }
    this.statusSubject.next('connecting');

    const stream$ = defer(() => {
      this.socket$ = webSocket({
        url: this.WSS_URL,
        protocol: [jwtToken],
        openObserver: {
          next: () => this.statusSubject.next('connected'),
        },
        closeObserver: {
          next: () => {
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
          const delay = Math.min(1000 * 2 ** retryCount, 30000);
          this.logger.warn(`WebSocket retry attempt ${retryCount}, delay ${delay}ms`);
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
        this.subscription = undefined;
        this.socket$ = undefined; // Clear socket ref on complete
      },
      error: () => {
        this.statusSubject.next('disconnected');
        this.subscription = undefined;
        this.socket$ = undefined; // Clear socket ref on error
      },
    });
  }

  public disconnect(): void {
    // --- THIS IS THE FIX ---
    // We must call .complete() on the socket subject itself.
    // This imperatively closes the connection and will trigger
    // our mock's .close() spy.
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = undefined;
    }
    // We still unsubscribe to clean up the RxJS chain.
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
    // --- END FIX ---
    if (this.statusSubject.value !== 'disconnected') {
      this.statusSubject.next('disconnected');
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.statusSubject.complete();
    this.messageSubject.complete();
  }
}
