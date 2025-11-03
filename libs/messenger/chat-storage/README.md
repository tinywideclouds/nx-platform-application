# 📖 @nx-platform-application/chat-storage

This library is the local persistence layer for the Messenger. It is responsible for storing and retrieving **decrypted messages** from the browser's IndexedDB.

This is a critical component of the "Poke-then-Pull" architecture, as the client is now responsible for maintaining its own message history.

## Architecture

This service is a thin, specialized wrapper around the generic `@nx-platform-application/platform-storage` (`IndexedDb`) service. It extends the `ActionIntentionDB` database with a new `messages` table and provides a type-safe API for chat-specific operations.

## Data Models

* **`DecryptedMessage`**: The "smart" object for a message that has been decrypted and verified. This is the primary data model for this service.
* **`ConversationSummary`**: A lightweight model used to populate the conversation list, containing only the latest message snippet and timestamp.

## Primary API

### `ChatStorageService`

An `@Injectable` Angular service that provides the following public methods:

**`saveMessage(message: DecryptedMessage): Promise<void>`**
* Saves a single `DecryptedMessage` to the `messages` table in IndexedDB.
* It automatically converts `URN` objects to strings for storage.

**`loadHistory(conversationUrn: URN): Promise<DecryptedMessage[]>`**
* Retrieves all messages for a specific conversation, sorted by timestamp.
* It automatically maps the stored records back into "smart" `DecryptedMessage` objects with `URN` instances.

**`loadConversationSummaries(): Promise<ConversationSummary[]>`**
* Efficiently queries the database to find the *single newest* message for *every* conversation.
* Returns an array of `ConversationSummary` objects, perfect for populating the main chat list on app load.

## Running unit tests

Run `nx test chat-storage` to execute the unit tests for this library.
