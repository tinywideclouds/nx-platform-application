import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import {
  LlmMessage,
  FileProposalType,
  FileLinkType,
  RegistryEntry,
} from '@nx-platform-application/llm-types';

export interface DigestPreviewData {
  messages: LlmMessage[];
  includeRawProposals: boolean;
  systemPrompt: string;
  activeProposals: RegistryEntry[];
  showSnippetWarning?: boolean; // NEW FLAG
}

@Component({
  selector: 'llm-digest-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  templateUrl: './digest-preview.dialog.html',
})
export class LlmDigestPreviewDialogComponent {
  data = inject<DigestPreviewData>(MAT_DIALOG_DATA);
  private decoder = new TextDecoder();

  isToolCall(msg: LlmMessage): boolean {
    return (
      msg.typeId.equals(FileProposalType) || msg.typeId.equals(FileLinkType)
    );
  }

  parsePayload(msg: LlmMessage): any {
    if (!msg.payloadBytes) return '';
    const text = this.decoder.decode(msg.payloadBytes);

    if (this.isToolCall(msg)) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return text;
  }

  resolveCode(payload: any): string {
    if (typeof payload === 'string') return payload;
    const urnStr = payload?.proposalId || payload?.pointer?.id;
    if (!urnStr) return payload?.snippet || '';

    const fullProposal = this.data.activeProposals?.find(
      (p) => p.id.toString() === urnStr,
    );

    return (
      fullProposal?.patch ||
      fullProposal?.newContent ||
      payload.snippet ||
      'No code found in registry.'
    );
  }
}
