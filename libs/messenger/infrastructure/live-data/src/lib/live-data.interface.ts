import { Observable } from 'rxjs';
import { ConnectionStatus } from '@nx-platform-application/platform-types';

export abstract class IChatLiveDataService {
  abstract readonly status$: Observable<ConnectionStatus>;
  abstract readonly incomingMessage$: Observable<void>;

  abstract connect(tokenProvider: () => string): void;
  abstract disconnect(): void;
}
