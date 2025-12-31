This library implements the **Secure Ingestion Pipeline** (the "Airlock") for the Messenger. It is the only component authorized to accept encrypted envelopes from the network, verify their safety, and promote them to the application state.

### **🛡️ Security Model: The "Airlock"**

We strictly separate **Transport Data** (untrusted bytes) from **Domain Content** (parsed objects) using a three-stage pipeline.

| Stage           | Responsibility      | Action                                                                                        |
| --------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| **1. Decrypt**  | `CryptoService`     | Verify signature and decrypt the envelope. If this fails, the message is dropped immediately. |
| **2. Gatekeep** | `QuarantineService` | Check if the Sender is blocked or a stranger. <br>                                            |

<br>✅ **Trusted:** Pass to Stage 3. <br>

<br>❌ **Stranger:** Save to "Jail" (Quarantine DB). **Stop.** <br>

<br>🚫 **Blocked:** Drop immediately. **Stop.** |
| **3. Parse** | `ContentParser` | **Only reached if trusted.** Parse the raw bytes into a `ChatMessage` or `Signal` and save to the main database. |

### **📦 API**

#### `IngestionService`

The coordinator service that pulls from the queue and orchestrates the pipeline.

```typescript
// Main Entry Point
process(
  myKeys: PrivateKeys,
  myUrn: URN,
  blockedSet: Set<string>,
  batchSize?: number
): Promise<IngestionResult>;

```

- **Inputs:** Private keys (to decrypt), User Identity (to route), Block List (for fast-fail).
- **Outputs:** A summary of what was ingested (messages, typing indicators, read receipts).

### **🏛️ Architecture Dependencies**

- **Upstream:** `@nx-platform-application/chat-access` (The Data Queue)
- **Downstream:**
- `messenger-crypto-bridge` (Decryption)
- `messenger-quarantine` (Gatekeeping)
- `message-content` (Parsing)
- `chat-storage` (Persistence)

### **🛠️ Usage**

Inject the service into your state orchestrator (e.g., `ChatService`).

```typescript
@Injectable()
export class ChatService {
  private ingestion = inject(IngestionService);

  async fetchMessages() {
    const result = await this.ingestion.process(myKeys, myUrn, blockedList);
    // Result contains only SAFE, PARSED messages ready for the UI.
  }
}
```
