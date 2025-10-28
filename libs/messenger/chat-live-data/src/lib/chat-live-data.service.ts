import { Injectable, OnDestroy, inject } from '@angular/core';
import {
  SecureEnvelope,
  deserializeJsonToEnvelope,
} from '@nx-platform-application/messenger-types';
import { Logger } from '@nx-platform-application/console-logger';
import {
  Observable,
  Subject,
  BehaviorSubject,
  EMPTY,
  catchError,
  tap,
  switchMap,
  retry,
  timer,
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
  private readonly WSS_URL = 'wss://api.example.com/live';

  private socket$?: WebSocketSubject<string>;

  private readonly statusSubject = new BehaviorSubject<ConnectionStatus>(
    'disconnected'
  );
  public readonly status$ = this.statusSubject.asObservable();

  private readonly messageSubject = new Subject<SecureEnvelope>();
  public readonly incomingMessage$: Observable<SecureEnvelope> =
    this.messageSubject.asObservable();

  constructor() {
    this.logger.info('ChatLiveDataService initialized');
  }

  public connect(url: string = this.WSS_URL): void {
    if (this.statusSubject.value === 'connected' || this.statusSubject.value === 'connecting') {
      return;
    }
    this.statusSubject.next('connecting');

    this.socket$ = webSocket<string>({
      url: url,
      // --- THIS IS THE FIX ---
      // Tell RxJS to just return the raw string data,
      // not to try and JSON.parse() it automatically.
      deserializer: (e: MessageEvent) => e.data,
      // ---------------------
      openObserver: {
        next: () => this.statusSubject.next('connected'),
      },
      closeObserver: {
        next: () => this.statusSubject.next('disconnected'),
      },
    });

    this.socket$
      .pipe(
        tap({
          error: (err) => {
            // This will now only catch *actual* socket errors,
            // not parsing errors.
            this.logger.error('ChatLiveDataService: WebSocket error', err);
            this.statusSubject.next('error');
          },
        }),
        retry({
          delay: (error, retryCount) => {
            const delay = Math.min(1000 * 2 ** retryCount, 30000);
            return timer(delay);
          },
        }),
        switchMap((message: string) => {
          // Now, 'message' is guaranteed to be the raw JSON string
          try {
            // 1. Parse the incoming JSON string (this is now our code)
            const jsonObject = JSON.parse(message);

            // 2. Use the types library to deserialize the raw object
            const envelope = deserializeJsonToEnvelope(jsonObject);

            return [envelope];
          } catch (error) {
            // This will now correctly catch SyntaxErrors
            this.logger.error('ChatLiveDataService: Failed to parse envelope', error, {
              receivedMessage: message,
            });
            return EMPTY; // Ignore this malformed message
          }
        }),
        catchError((err) => {
          this.logger.error('ChatLiveDataService: Unrecoverable WebSocket error', err);
          return EMPTY;
        })
      )
      .subscribe({
        next: (envelope) => {
          this.messageSubject.next(envelope);
        },
        complete: () => {
          if (this.statusSubject.value !== 'disconnected') {
            this.statusSubject.next('disconnected');
          }
        },
      });
  }

  public disconnect(): void {
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
  }
}
