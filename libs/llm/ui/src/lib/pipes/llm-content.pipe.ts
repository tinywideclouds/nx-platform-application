import { Pipe, PipeTransform } from '@angular/core';
import { SSEProposalEvent } from '@nx-platform-application/llm-types';

export type LlmContentPayload =
  | { type: 'text'; content: string }
  | { type: 'proposal'; event: SSEProposalEvent };

@Pipe({
  name: 'llmContent',
  standalone: true,
  pure: true,
})
export class LlmContentPipe implements PipeTransform {
  private decoder = new TextDecoder();

  transform(value: any): LlmContentPayload {
    console.log('transforming message', value);
    // Robust check for the domain object shape
    if (!value || !value.payloadBytes) {
      return { type: 'text', content: '' };
    }

    // Decode Uint8Array -> String
    const decodedText = this.decoder.decode(value.payloadBytes);

    // 1. Intercept specialized JSON payloads
    if (decodedText.startsWith('{"__type":"workspace_proposal"')) {
      try {
        const parsed = JSON.parse(decodedText);
        return { type: 'proposal', event: parsed.data };
      } catch (e) {
        console.error('Failed to parse workspace proposal payload', e);
        // Graceful fallback: render as raw text if JSON is corrupted
        return { type: 'text', content: decodedText };
      }
    }

    // 2. Default: Standard Markdown Text
    return { type: 'text', content: decodedText };
  }
}
