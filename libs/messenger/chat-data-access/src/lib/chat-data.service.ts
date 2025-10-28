import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

// --- Imports from messenger-types ---
// This is the *only* thing it knows about.
// It imports the "smart" model and the "string/json" mappers.
import {
  SecureEnvelope,
  serializeEnvelopeToJson,
  deserializeJsonToEnvelopes,
} from '@nx-platform-application/messenger-types'; // Assumed path

@Injectable({
  providedIn: 'root',
})
export class ChatDataService {
  private readonly http = inject(HttpClient);

  // You mentioned a routing service, so I'll assume you inject that
  // or have a way to get this URL. For now, it's hardcoded.
  private readonly apiUrl = '/api/messages';

  /**
   * Fetches the raw JSON list, then maps it to "smart" SecureEnvelope
   * objects using the helper from messenger-types.
   */
  fetchMessages(): Observable<SecureEnvelope[]> {
    // 1. Fetch raw JSON (HttpClient parses it into an object)
    // We expect the response to be the raw JSON for a SecureEnvelopeList
    return this.http.get<any>(this.apiUrl).pipe(
      // 2. Pass the raw JSON object to the deserializer
      map((jsonResponse) => deserializeJsonToEnvelopes(jsonResponse))
    );
  }

  /**
   * Posts a "smart" SecureEnvelope by serializing it to a JSON string
   * using the helper from messenger-types.
   */
  postMessage(envelope: SecureEnvelope): Observable<void> {
    // 1. Serialize the "smart" model all the way to a JSON string
    const jsonPayload = serializeEnvelopeToJson(envelope);

    // 2. POST the JSON string as the body
    return this.http.post<void>(this.apiUrl, jsonPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
