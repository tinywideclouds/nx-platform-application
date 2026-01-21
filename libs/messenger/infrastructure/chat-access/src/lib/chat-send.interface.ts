import { Observable } from 'rxjs';
import { SecureEnvelope } from '@nx-platform-application/platform-types';

export abstract class IChatSendService {
  abstract sendMessage(envelope: SecureEnvelope): Observable<void>;
}
