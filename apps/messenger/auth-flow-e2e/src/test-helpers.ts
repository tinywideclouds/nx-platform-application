import { URN } from '@nx-platform-application/platform-types';

// --- Import ALL the services we've built ---
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/messenger-infrastructure-chat-access';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import {
  SecureKeyService,
  KEY_SERVICE_URL,
} from '@nx-platform-application/messenger-infrastructure-key-access';
export interface TestClient {
  urn: URN;
  token: string;
  chatService: ChatService;
  liveService: ChatLiveDataService;
  dataService: ChatDataService;
  sendService: ChatSendService;
  keyService: SecureKeyService;
  storageService: ChatStorageService;
}

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
/**
 * Fetches a real, valid E2E token from the identity service.
 */
export async function getE2EToken(
  secret: string,
  user: { id: string; email: string; alias: string },
): Promise<string> {
  const headers = {
    'Content-Type': 'application/json',
    'x-e2e-secret-key': secret,
  };
  const response = await fetch(
    'http://localhost:3000/api/e2e/generate-test-token',
    {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(user),
    },
  );
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      'Failed to fetch E2E token. Server responded with:',
      response.status,
      errorBody,
    );
    throw new Error(`Failed to fetch E2E token. Status: ${response.status}`);
  }
  const data = await response.json();
  return data.token;
}

/**
 * A reusable helper to wait for a client's connection status.
 */
export const awaitClientConnection = (
  clientName: string,
  service: ChatLiveDataService,
) => {
  return new Promise((resolve, reject) => {
    console.log(`[Test] Waiting for ${clientName} connection status...`);
    const sub = service.status$.subscribe((status) => {
      console.log(`[Test] ${clientName} Status emitted: ${status}`);
      if (status === 'connected') {
        sub.unsubscribe();
        resolve(status);
      }
      if (status === 'error' || status === 'disconnected') {
        reject(
          new Error(`${clientName} connection failed. Status: '${status}'`),
        );
      }
    });
  });
};

/**
 * Clears a user's message queue by fetching and acknowledging all
 * pending messages. This uses the application's real API.
 */
export async function clearUserQueue(
  user: string,
  routingUrl: string,
  userToken: string,
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${userToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Fetch all pending messages
    const getResp = await fetch(`${routingUrl}/messages?limit=500`, {
      headers,
    });
    if (!getResp.ok) {
      console.warn(
        `[Test] Failed to get messages during queue clear. Status: ${getResp.status}`,
      );
      return; // Fail gracefully, don't block test
    }

    const data = await getResp.json();

    console.log('got response for get messages', user, data);

    const messageIds = data.messages?.map((m: any) => m.id) || [];

    if (messageIds.length === 0) {
      console.log('[Test] Queue is already clear. Skipping ack.');
      return; // Nothing to clear
    }

    console.log(
      `[Test] Clearing ${messageIds.length} stale messages from queue...`,
    );

    // 2. Acknowledge them to delete them
    const ackResp = await fetch(`${routingUrl}/messages/ack`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ messageIds }),
    });

    if (!ackResp.ok) {
      console.warn(
        `[Test] Failed to ack messages during queue clear. Status: ${ackResp.status}`,
      );
    }
    console.log('[Test] Queue clear completed.');
  } catch (e) {
    console.error('[Test] Error during queue clear:', e);
  }
}

export async function getMessages(
  routingUrl: string,
  userToken: string,
): Promise<any[]> {
  const headers = { Authorization: `Bearer ${userToken}` };
  try {
    const getResp = await fetch(`${routingUrl}/messages?limit=500`, {
      headers,
    });

    // ➡️ Change 1: Throw on bad HTTP status instead of returning an error array
    if (!getResp.ok) {
      console.warn(`[Test] getMessages: Failed. Status: ${getResp.status}`);
      // Throw an error so the poll retries immediately or fails after timeout
      throw new Error(`Failed to fetch messages. Status: ${getResp.status}`);
    }

    const data = await getResp.json();
    // Assuming the actual messages are in data.messages
    return data.messages || [];
  } catch (e) {
    console.error(`[Test] getMessages: Error`, e);

    // ➡️ Change 2: Throw on fetch/JSON exception
    // Re-throw the error so the poll retries
    throw e;
  }
}
