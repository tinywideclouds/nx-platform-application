//libs/messenger/infrastructure/chat-access/src/lib/chat-data.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  QueuedMessage,
  deserializeJsonToQueuedMessages,
} from '@nx-platform-application/platform-types';
import { IChatDataService } from './chat-data.interface';
import { ROUTING_SERVICE_URL } from './chat-data.config';

interface QueuedMessageRawResponse {
  messages: Array<{
    id: string;
    envelope: Record<string, unknown>;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class ChatDataService implements IChatDataService {
  private readonly http = inject(HttpClient);
  private readonly baseApiUrl =
    inject(ROUTING_SERVICE_URL, { optional: true }) ?? '/api';

  /**
   * Fetches the next available batch of queued messages.
   * Endpoint: GET /api/messages
   */
  getMessageBatch(limit: number = 50): Observable<QueuedMessage[]> {
    const url = `${this.baseApiUrl}/messages`;
    const params = { limit: limit.toString() };

    return this.http
      .get<QueuedMessageRawResponse>(url, { params })
      .pipe(
        map((jsonResponse) => deserializeJsonToQueuedMessages(jsonResponse)),
      );
  }

  /**
   * Acknowledges receipt of messages.
   * Endpoint: POST /api/messages/ack
   */
  acknowledge(messageIds: string[]): Observable<void> {
    const url = `${this.baseApiUrl}/messages/ack`;
    const body = { messageIds };

    return this.http.post<void>(url, body);
  }
}
