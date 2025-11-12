import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import {
  QueuedMessage,
  deserializeJsonToQueuedMessages,
} from '@nx-platform-application/platform-types';
import { ROUTING_SERVICE_URL } from './chat-data.config';

/**
 * REFACTORED: Chat Data Service (The "Query" / "Pull" Service)
 *
 * This service is now responsible *only* for querying the
 * routing service's queue (GET /api/messages) and acknowledging
 * receipt of those messages (POST /api/messages/ack).
 *
 * It is no longer responsible for sending messages.
 */
@Injectable({
  providedIn: 'root',
})
export class ChatDataService {
  private readonly http = inject(HttpClient);

  private readonly baseApiUrl = inject(ROUTING_SERVICE_URL, {optional: true}) ?? '/api';

  /**
   * Fetches the next available batch of queued messages for the user.
   * This is the "PULL" in "Poke-then-Pull".
   *
   * Endpoint: GET /api/messages
   */
  getMessageBatch(limit: number = 50): Observable<QueuedMessage[]> {
    const url = `${this.baseApiUrl}/messages`;;
    const params = { limit: limit.toString() };

    // We expect a raw JSON object matching QueuedMessageListPb
    return this.http.get<unknown>(url, { params }).pipe(
      // Use the "smart" facade from platform-types to deserialize
      map((jsonResponse) => deserializeJsonToQueuedMessages(jsonResponse))
    );
  }

  /**
   * Acknowledges receipt of messages so the router can delete
   * them from the queue.
   *
   * Endpoint: POST /api/messages/ack
   */
  acknowledge(messageIds: string[]): Observable<void> {
    const url = `${this.baseApiUrl}/messages/ack`;
    const body = { messageIds };

    // Expects a 204 No Content
    return this.http.post<void>(url, body);
  }
}
