import { computed, inject, Injectable, Signal } from '@angular/core';
import {
  ScrollspaceSource,
  ScrollItem,
} from '@nx-platform-application/scrollspace-core';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { ActiveChatFacade } from '@nx-platform-application/messenger-state-active-chat';
import { Temporal } from '@js-temporal/polyfill';

@Injectable()
export class MessengerScrollSource {
  private activeChat = inject(ActiveChatFacade);

  // Signals from your existing facade
  private rawMessages = this.activeChat.messages; // Signal<ChatMessage[]>
  private firstUnreadId = this.activeChat.firstUnreadId; // Signal<string | null>
  private readCursors = this.activeChat.readCursors; // Signal<Map<msgId, URN[]>>
  private myIdentity = this.activeChat.myIdentity;

  // THE TRANSFORMER: Flattens the logic into a renderable list
  items = computed<ScrollItem[]>(() => {
    const msgs = this.rawMessages();
    const unreadId = this.firstUnreadId();
    const cursorMap = this.readCursors();
    const myUrn = this.myIdentity()?.toString();

    const results: ScrollItem[] = [];
    let lastDate: string | null = null;
    let lastSenderId: string | null = null;

    for (const msg of msgs) {
      // 1. DATE DIVIDER LOGIC
      const msgDate = Temporal.Instant.from(msg.sentTimestamp)
        .toZonedDateTimeISO('UTC')
        .toPlainDate()
        .toString();

      if (msgDate !== lastDate) {
        results.push({
          id: `date-${msgDate}`,
          type: 'date-divider',
          timestamp: 0, // irrelevant for dividers
          layout: { alignment: 'center', isContinuous: false },
          data: msgDate, // The date string is the data
        });
        lastDate = msgDate;
        lastSenderId = null; // Reset continuity on date change
      }

      // 2. NEW MESSAGES DIVIDER LOGIC
      if (msg.id === unreadId) {
        results.push({
          id: 'new-messages-marker',
          type: 'new-messages-divider',
          timestamp: 0,
          layout: { alignment: 'center', isContinuous: false },
          data: 'New Messages',
        });
        lastSenderId = null; // Break continuity visual
      }

      // 3. CONTENT ITEM MAPPING
      const isMine = msg.senderId.toString() === myUrn;
      const cursors = cursorMap.get(msg.id) || [];

      results.push({
        id: msg.id,
        type: 'content',
        timestamp: Date.parse(msg.sentTimestamp),
        actor: {
          id: msg.senderId.toString(),
          isSelf: isMine,
          displayName: 'mapped-by-pipe-later',
        },
        layout: {
          alignment: isMine ? 'end' : 'start',
          isContinuous: lastSenderId === msg.senderId.toString(),
        },
        adornments: {
          cursors: cursors.map((urn) => ({
            id: urn.toString(),
            label: urn.toString(),
          })),
        },
        data: msg, // Pass the full ChatMessage to the renderer
      });

      lastSenderId = msg.senderId.toString();
    }

    return results;
  });
}
