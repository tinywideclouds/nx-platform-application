import { Observable } from 'rxjs';
import { QueuedMessage } from '@nx-platform-application/platform-types';

export abstract class IChatDataService {
  abstract getMessageBatch(limit?: number): Observable<QueuedMessage[]>;
  abstract acknowledge(messageIds: string[]): Observable<void>;
}
