import { Injectable, inject, DestroyRef } from '@angular/core';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  BehaviorSubject,
  catchError,
  defer,
  EMPTY,
  retry,
  Subject,
  Subscription,
  timer,
} from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { WSS_URL_TOKEN } from './live-data.config';
import { ConnectionStatus } from '@nx-platform-application/platform-types';
import { AppLifecycleService } from '@nx-platform-application/platform-infrastructure-browser-lifecycle';
// ✅ Import Interface
import { IChatLiveDataService } from './live-data.interface';

@Injectable({
  providedIn: 'root',
})
export class ChatLiveDataService implements IChatLiveDataService {
  private readonly logger = inject(Logger);
  private readonly lifecycle = inject(AppLifecycleService);
  private readonly destroyRef = inject(DestroyRef); // ✅ Modern Cleanup
  private readonly baseApiUrl =
    inject(WSS_URL_TOKEN, { optional: true }) ?? 'api/connect';

  private socket$?: WebSocketSubject<void>;
  private subscription?: Subscription;
  private tokenProvider?: () => string;

  private readonly statusSubject = new BehaviorSubject<ConnectionStatus>(
    'disconnected',
  );
  public readonly status$ = this.statusSubject.asObservable();

  private readonly messageSubject = new Subject<void>();
  public readonly incomingMessage$ = this.messageSubject.asObservable();

  constructor() {
    this.logger.info('ChatLiveDataService initialized');

    // ✅ Co-located Subscription & Cleanup
    const resumeSub = this.lifecycle.resumed$.subscribe(() => {
      this.handleAppResume();
    });

    this.destroyRef.onDestroy(() => {
      resumeSub.unsubscribe();
      this.disconnect();
      this.statusSubject.complete();
      this.messageSubject.complete();
    });
  }

  private handleAppResume(): void {
    if (this.statusSubject.value === 'connected' && this.tokenProvider) {
      this.logger.info('[ChatLive] App resumed. Force-cycling connection...');
      this.disconnect();
      this.connect(this.tokenProvider);
    }
  }

  public connect(tokenProvider: () => string): void {
    this.tokenProvider = tokenProvider;
    if (this.subscription) return;

    this.logger.info('connecting websocket', this.baseApiUrl);
    this.statusSubject.next('connecting');

    const stream$ = defer(() => {
      const currentToken = this.tokenProvider ? this.tokenProvider() : '';
      const localSocket = webSocket<void>({
        url: this.baseApiUrl,
        protocol: [currentToken],
        deserializer: () => {
          return;
        },
        serializer: (value) => JSON.stringify(value),
        openObserver: {
          next: () => {
            if (this.socket$ === localSocket) {
              this.statusSubject.next('connected');
            }
          },
        },
        closeObserver: {
          next: () => {
            if (
              this.socket$ === localSocket &&
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
      retry({
        delay: (err, count) => timer(Math.min(1000 * 2 ** count, 30000)),
      }),
      catchError((err) => {
        this.logger.error('ChatLiveDataService: Unrecoverable Error', err);
        return EMPTY;
      }),
    );

    this.subscription = stream$.subscribe({
      next: () => this.messageSubject.next(),
      complete: () => this.resetState(),
      error: () => this.resetState(),
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

  private resetState(): void {
    this.subscription = undefined;
    this.socket$ = undefined;
    if (this.statusSubject.value !== 'disconnected') {
      this.statusSubject.next('disconnected');
    }
  }
}
