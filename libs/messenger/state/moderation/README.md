# 🛡️ @nx-platform-application/messenger-state-moderation

This library acts as the **Moderation Orchestrator** for the messenger application. It aggregates blocking logic and quarantine management into a single state facade, preventing the main messaging service from handling low-level trust decisions.

## 🏛️ Architecture

The `ChatModerationFacade` sits in the **State Layer**. It coordinates between the **Contacts Gatekeeper** (API) and the **Messenger Quarantine** (Domain).

### Responsibilities

1.  **Block List Management**: Syncs the blocked users list from the Gatekeeper API and exposes it as a high-performance `Signal<Set<string>>` for UI filtering.
2.  **Quarantine Inspection**: Retrieves messages that were "held back" by the ingestion pipeline because the sender was unknown.
3.  **Promotion (Accept)**: Moves messages from the Quarantine Zone into the active conversation storage. This involves parsing the raw bytes (which were skipped during ingestion) and saving them as real `ChatMessage` objects.
4.  **Rejection (Block)**: Purges quarantined messages and adds the sender to the block list.

## 📦 Service API

### `ChatModerationFacade`

#### State Signals

- `blockedSet`: `Signal<Set<string>>`
  - A reactive Set containing the URNs of all blocked identities. Optimized for O(1) lookups in templates or pipes.

#### Actions

- `block(urns: URN[])`:
  - Blocks the users via the `GatekeeperApi` (scope: 'messenger').
  - Immediately rejects/deletes any messages they have in quarantine.
- `dismissPending(urns: URN[])`:
  - Clears the quarantine for these users _without_ blocking them (e.g., "Ignore for now").
- `getQuarantinedMessages(urn: URN)`:
  - Returns the raw `ChatMessage` objects currently held in the quarantine zone for inspection.
- `promoteQuarantinedMessages(senderUrn: URN)`:
  - The "Accept" flow. Retrieves raw messages, parses their content (decrypts/deserializes), and saves them to the main chat history.

## 🛠️ Usage Example

```typescript
@Component({ ... })
export class ChatRequestComponent {
  private moderation = inject(ChatModerationFacade);

  // Reactive list of blocked users
  blockedIds = this.moderation.blockedSet;

  async onAccept(senderUrn: URN) {
    await this.moderation.promoteQuarantinedMessages(senderUrn);
    // User is now "trusted" and messages appear in the main chat
  }

  async onBlock(senderUrn: URN) {
    await this.moderation.block([senderUrn]);
  }
}
```
