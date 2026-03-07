import { Pipe, PipeTransform } from '@angular/core';
import {
  FileProposalType,
  FileLinkType,
  LlmMessage,
  SSEProposalEvent,
  PointerPayload,
} from '@nx-platform-application/llm-types';

export type LlmContentPayload =
  | { type: 'text'; content: string }
  | { type: 'proposal'; event: SSEProposalEvent }
  | { type: 'pointer'; pointer: PointerPayload };

@Pipe({
  name: 'llmContent',
  standalone: true,
  pure: true,
})
export class LlmContentPipe implements PipeTransform {
  private decoder = new TextDecoder();

  transform(value: LlmMessage | undefined): LlmContentPayload {
    if (!value || !value.payloadBytes) {
      return { type: 'text', content: '' };
    }

    const decodedText = this.decoder.decode(value.payloadBytes);

    // 1. Intercept NEW Lightweight Registry Pointers
    if (value.typeId.equals(FileLinkType)) {
      try {
        const pointer = JSON.parse(decodedText) as PointerPayload;
        return { type: 'pointer', pointer };
      } catch (e) {
        console.error('Failed to parse file link pointer', e);
        return { type: 'text', content: decodedText };
      }
    }

    // 2. Intercept LEGACY Embedded JSON Payloads
    if (value.typeId.equals(FileProposalType)) {
      try {
        const parsed = JSON.parse(decodedText);
        const data =
          parsed.__type === 'workspace_proposal' ? parsed.data : parsed;
        return { type: 'proposal', event: data };
      } catch (e) {
        console.error('Failed to parse workspace proposal payload', e);
        // Graceful fallback: render as raw text if JSON is corrupted
        return { type: 'text', content: decodedText };
      }
    }

    // 3. Standard Text
    return { type: 'text', content: decodedText };
  }
}
