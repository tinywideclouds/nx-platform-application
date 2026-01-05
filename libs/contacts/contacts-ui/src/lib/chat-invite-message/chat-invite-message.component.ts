import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { URN } from '@nx-platform-application/platform-types';

export interface InvitePayload {
  groupUrn: string;
  name: string;
}

@Component({
  selector: 'messenger-chat-invite-message',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div
      class="flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm max-w-xs"
    >
      <div
        class="bg-blue-50 p-4 flex items-center gap-3 border-b border-blue-100"
      >
        <div
          class="w-10 h-10 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center"
        >
          <mat-icon>hub</mat-icon>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs text-blue-600 font-bold uppercase tracking-wide">
            Group Invite
          </div>
          <div class="font-bold text-gray-900 truncate">
            {{ payload().name }}
          </div>
        </div>
      </div>

      <div class="p-4 text-sm text-gray-600">
        You've been invited to join this network group.
      </div>

      <div
        class="flex items-center justify-end gap-2 p-2 bg-gray-50 border-t border-gray-100"
      >
        <button mat-button color="warn" (click)="reject.emit()">Decline</button>
        <button mat-flat-button color="primary" (click)="accept.emit()">
          <mat-icon>login</mat-icon>
          Join Group
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatInviteMessageComponent {
  payload = input.required<InvitePayload>();

  accept = output<void>();
  reject = output<void>();
}
