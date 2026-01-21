//libs/messenger/infrastructure/chat-access/src/lib/chat-send.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SecureEnvelope,
  serializeEnvelopeToJson,
} from '@nx-platform-application/platform-types';
import { ROUTING_SERVICE_URL } from './chat-data.config';
import { IChatSendService } from './chat-send.interface';

@Injectable({
  providedIn: 'root',
})
export class ChatSendService implements IChatSendService {
  private readonly http = inject(HttpClient);
  private readonly baseApiUrl =
    inject(ROUTING_SERVICE_URL, { optional: true }) ?? '/api';
  private readonly sendUrl = `${this.baseApiUrl}/send`;

  /**
   * Sends a fully formed SecureEnvelope.
   * Endpoint: POST /api/send
   */
  sendMessage(envelope: SecureEnvelope): Observable<void> {
    const jsonPayload = serializeEnvelopeToJson(envelope);

    return this.http.post<void>(this.sendUrl, jsonPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
