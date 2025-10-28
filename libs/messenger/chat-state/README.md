# **Chat Data Access Library**

This library provides the primary high-level service for handling all end-to-end encrypted chat functionality.

## **Purpose**

The ChatService is the central "smart facade" or "orchestrator" for all chat operations. It is responsible for coordinating multiple platform-level services to perform complex actions like sending an encrypted message or polling for new messages.

It acts as the single point of entry for any UI component that needs to interact with the chat system.

## **Architecture & Dependencies**

This service perfectly demonstrates the "facade" pattern. It **does not** contain any raw cryptographic or storage logic itself. Instead, it injects and coordinates other single-purpose services:

1. **AuthService (from @.../platform-auth-data-access):**

- Used to get the current user's ID (string) for loading their private keys and identifying them as the sender.

2. **KeyService (from @.../key-data-access):**

- Used to fetch the _public_ keys (PublicKeys object) of _other_ users (recipients) from the remote server.

3. **CryptoService (from @.../crypto-data-access):**

- **This is the most important dependency.** It is the _only_ service ChatService uses for any cryptographic operation.
- Used to load the current user's _private_ keys (PrivateKeys object) from local storage.
- Used to perform all high-level crypto actions: encryptForRecipient, decryptData, signData, and verifySender.

4. **HttpClient (from @angular/common/http):**

- Used to POST new encrypted messages (transport envelopes) to the backend API (/api/messages).
- Used to GET all new messages from the backend API.

5. **ContactsService (from @.../contacts-data-access):**

- (Dependency is injected, but not currently used in sendMessage or pollMessages. It would be used for displaying a contact list in the UI).

## **Public API**

### **messages (Signal)**

A read-only signal containing the array of decrypted messages.

public readonly messages \= signal\<DecryptedMessage\[\]\>(\[\]);

### **sendMessage()**

Orchestrates the entire process of sending a secure message.

async sendMessage(recipientUrn: string, plaintext: string): Promise\<void\>

**Workflow:**

1. Gets the current user's ID string from AuthService.
2. Gets the recipient's PublicKeys (Uint8Arrays) from KeyService.
3. Loads the user's PrivateKeys (CryptoKeys) from CryptoService.
4. Asks CryptoService to encryptForRecipient (using the recipient's public key) and signData (using the user's private key).
5. Converts the resulting byte arrays to Base64.
6. POSTs the complete TransportEnvelope to /api/messages.

### **pollMessages()**

Orchestrates the process of fetching, verifying, and decrypting all new messages.

async pollMessages(): Promise\<void\>

**Workflow:**

1. GETs an array of TransportEnvelopes from /api/messages.
2. Loads the user's PrivateKeys from CryptoService.
3. For each envelope:  
   a. Gets the sender's PublicKeys from KeyService.  
   b. Converts all Base64 fields back to Uint8Arrays.  
   c. Asks CryptoService to verifySender.  
   d. If valid, asks CryptoService to decryptData.  
   e. Converts the decrypted bytes to a string.
4. Updates the messages signal with the new array of DecryptedMessage objects.
