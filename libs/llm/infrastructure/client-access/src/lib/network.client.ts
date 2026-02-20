import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { GenerateStreamRequest } from '@nx-platform-application/llm-types';

/**
 * CONTRACT: The "Gemini Access Lib" must provide this.
 * Decouples the Domain from the specific HTTP/WebSocket implementation.
 */
export interface LlmNetworkClient {
  generateStream(request: GenerateStreamRequest): Observable<string>;
}

export const LLM_NETWORK_CLIENT = new InjectionToken<LlmNetworkClient>(
  'LLM_NETWORK_CLIENT',
);
