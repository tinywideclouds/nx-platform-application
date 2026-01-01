import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';

export interface WrappedPayload {
  conversationId?: URN;
  tags?: URN[];
  content: Uint8Array;
}

@Injectable({ providedIn: 'root' })
export class MessageMetadataService {
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();

  /**
   * Only wraps if metadata is provided.
   * Otherwise, returns the original bytes for lean signaling.
   */
  wrap(content: Uint8Array, conversationId?: URN, tags?: URN[]): Uint8Array {
    if (!conversationId && (!tags || tags.length === 0)) {
      return content;
    }

    const envelope = {
      c: conversationId?.toString(),
      t: tags?.map((t) => t.toString()) || [],
      d: Array.from(content),
    };
    return this.encoder.encode(JSON.stringify(envelope));
  }

  /**
   * Attempts to unwrap. If the first byte isn't '{',
   * it's likely a flat signal.
   */
  unwrap(bytes: Uint8Array): WrappedPayload {
    const jsonCandidate = this.decoder.decode(bytes);

    // Quick check if this is likely our JSON envelope
    if (!jsonCandidate.startsWith('{"c":')) {
      return { content: bytes };
    }

    try {
      const envelope = JSON.parse(jsonCandidate);
      return {
        conversationId: envelope.c ? URN.parse(envelope.c) : undefined,
        tags: (envelope.t || []).map((t: string) => URN.parse(t)),
        content: new Uint8Array(envelope.d),
      };
    } catch {
      return { content: bytes };
    }
  }
}
