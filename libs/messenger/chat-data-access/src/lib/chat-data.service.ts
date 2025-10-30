import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';

// --- Imports from messenger-types ---
// It imports the "smart" models and the serialization helpers
import {
  SecureEnvelope,
  serializeEnvelopeToJson,
  deserializeJsonToEnvelopes,
} from '@nx-platform-application/platform-types';

@Injectable({
  providedIn: 'root',
})
export class ChatDataService {
  private readonly http = inject(HttpClient);

  // Base URL for the routing service
  private readonly baseApiUrl = '/api/messages'; // (Or your injected routing service URL)

  /**
   * Posts a "smart" SecureEnvelope by serializing it to a JSON string.
   * Endpoint: POST /api/messages/send
   */
  postMessage(envelope: SecureEnvelope): Observable<void> {
    const url = `${this.baseApiUrl}/send`;
    // Use the helper from messenger-types to get the JSON string
    const jsonPayload = serializeEnvelopeToJson(envelope);

    return this.http.post<void>(url, jsonPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Checks if the authenticated user has any new messages (via JWT).
   * Endpoint: GET /api/messages/count
   */
  checkForNewMessages(): Observable<{ hasNewMessages: boolean }> {
    const url = `${this.baseApiUrl}/count`;
    // Assuming the API returns a simple JSON like { "hasNewMessages": true }
    return this.http.get<{ hasNewMessages: boolean }>(url);
  }

  /**
   * Fetches the encrypted message digest for the authenticated user (via JWT).
   * Deserializes the JSON response into the "smart" EncryptedDigest model.
   * Endpoint: GET /api/messages/digest
   */
  fetchMessageDigest(): Observable<EncryptedDigest> {
    const url = `${this.baseApiUrl}/digest`;
    // We expect the raw JSON object matching EncryptedDigestPb schema
    return this.http.get<any>(url).pipe(
      // Pass the raw JSON object to the deserializer from messenger-types
      map((jsonResponse) => deserializeJsonToDigest(jsonResponse))
    );
  }

  /**
   * Fetches the full message history for a specific conversation URN.
   * Deserializes the JSON response into an array of "smart" SecureEnvelopes.
   * Endpoint: GET /api/messages/history/{conversationUrn}
   */
  fetchConversationHistory(conversationUrn: URN): Observable<SecureEnvelope[]> {
    const url = `${this.baseApiUrl}/history/${conversationUrn.toString()}`;
    // We expect the raw JSON object matching SecureEnvelopeListPb schema
    return this.http.get<any>(url).pipe(
      // Pass the raw JSON object to the deserializer from messenger-types
      map((jsonResponse) => deserializeJsonToEnvelopes(jsonResponse))
    );
  }
}
