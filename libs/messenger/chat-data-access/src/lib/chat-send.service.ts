import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// --- Imports from platform-types ---
import {
  SecureEnvelope,
  serializeEnvelopeToJson,
} from '@nx-platform-application/platform-types';

/**
 * NEW: Chat Send Service (The "Command" / "Send" Service)
 *
 * This service is responsible *only* for sending a message.
 * It serializes the "smart" SecureEnvelope into a JSON string
 * and POSTs it to the /api/send endpoint.
 */
@Injectable({
  providedIn: 'root',
})
export class ChatSendService {
  private readonly http = inject(HttpClient);
  private readonly sendUrl = '/api/send';

  /**
   * Sends a fully formed "smart" SecureEnvelope.
   *
   * Endpoint: POST /api/send
   */
  sendMessage(envelope: SecureEnvelope): Observable<void> {
    // 1. Use the "smart" facade to serialize the envelope to a JSON string
    const jsonPayload = serializeEnvelopeToJson(envelope);

    // 2. POST the raw JSON string as the body
    return this.http.post<void>(this.sendUrl, jsonPayload, {
      // The backend expects a raw JSON string
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
