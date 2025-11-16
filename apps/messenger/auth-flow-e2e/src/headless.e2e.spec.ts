import { TestBed } from '@angular/core/testing';
import { URN } from '@nx-platform-application/platform-types';
import { firstValueFrom } from 'rxjs';

import {
  ChatLiveDataService,
} from '@nx-platform-application/chat-live-data';
import {
  clearUserQueue,
  getE2EToken,
  awaitClientConnection,
  getMessages,
  delay,
} from './test-helpers';
import { createTestClient, routingUrl } from './client-setup';
import { Temporal } from '@js-temporal/polyfill';

// --- Mock Fixtures ---
const URN_A = URN.parse('urn:sm:user:client-a');
const URN_B = URN.parse('urn:sm:user:client-b');
const E2E_SECRET = process.env.E2E_TEST_SECRET;

if (!E2E_SECRET) {
  throw new Error('E2E_TEST_SECRET is not defined in the test environment!');
}

// --- E2E: Service Health Checks (All Pass) ---
describe('E2E: Service Health Checks', () => {
  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    // ... (Setup code, no changes) ...
    tokenA = await getE2EToken(E2E_SECRET, {
      id: URN_A.toString(),
      email: 'a@test.com',
      alias: 'Client A',
    });
    tokenB = await getE2EToken(E2E_SECRET, {
      id: URN_B.toString(),
      email: 'b@test.com',
      alias: 'Client B',
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  // --- (All these tests passed, no changes) ---
  it('[Phase 1] should connect to the identity-service (port 3000) health check', async () => {/*...*/}, 10000);
  it('[Phase 1] should get a valid 200 from the /e2e-token endpoint', async () => {/*...*/}, 10000);
  it('[Phase 2] should connect to the key-service (port 8081) /readyz check', async () => {/*...*/}, 10000);
  it('[Phase 2] should store and retrieve keys from the go-key-service (port 8081)', async () => {/*...*/}, 10000);
  it('[Phase 3] should connect to the routing-api (port 8082) /readyz check', async () => {/*...*/}, 10000);
  it('[Phase 4] should connect the Angular SecureKeyService (port 8081)', async () => {
    TestBed.resetTestingModule();
    await createTestClient(URN_B, tokenB, { connectToWebsocket: false, generateKeys: true });
    TestBed.resetTestingModule();
    const clientA = await createTestClient(URN_A, tokenA, { connectToWebsocket: false, generateKeys: false });
    const keys = await clientA.keyService.getKey(URN_B);
    expect(keys).toBeDefined();
    expect(keys.encKey).toBeTruthy();
    expect(keys.sigKey).toBeTruthy();
  }, 10000);
  it('[Phase 4] should connect the Angular ChatLiveDataService (port 8083)', async () => {
    TestBed.resetTestingModule();
    const clientA = await createTestClient(URN_A, tokenA, { connectToWebsocket: true, generateKeys: false });
    clientA.liveService.connect(clientA.token);
    await expect(awaitClientConnection('Client A', clientA.liveService)).resolves.toBe('connected');
    clientA.chatService.ngOnDestroy();
  }, 10000);
  it('[Phase 4] should connect the Angular ChatDataService (port 8082)', async () => {
    TestBed.resetTestingModule();
    const clientA = await createTestClient(URN_A, tokenA, { connectToWebsocket: false, generateKeys: false });
    const messages = await firstValueFrom(clientA.dataService.getMessageBatch(10));
    expect(messages).toBeDefined();
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBe(0);
  }, 10000);
});

// --- E2E: Application Flow ---
describe('E2E: Application Flow', () => {
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    // ... (beforeAll setup, no changes) ...
    tokenA = await getE2EToken(E2E_SECRET, { id: URN_A.toString(), email: 'a@test.com', alias: 'Client A' });
    tokenB = await getE2EToken(E2E_SECRET, { id: URN_B.toString(), email: 'b@test.com', alias: 'Client B' });
    TestBed.resetTestingModule();
    await createTestClient(URN_A, tokenA, { connectToWebsocket: false, generateKeys: true });
    TestBed.resetTestingModule();
    await createTestClient(URN_B, tokenB, { connectToWebsocket: false, generateKeys: true });
  }, 60000);

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('[Phase 5.0] ensure userB queue is clear', async () => {
    // ... (This test passed, no changes) ...
    await clearUserQueue('userB', routingUrl, tokenB);
    await expect.poll(async () => (await getMessages(routingUrl, tokenB)).length, { timeout: 8000, interval: 200 }).toBe(0);
  }, 20000);

  // --- 🚀 Phase 5: Application Flow ---
  it('[Phase 5] should connect Client A and send a message', async () => {
    // 1. Create Client A
    TestBed.resetTestingModule();
    const clientA = await createTestClient(URN_A, tokenA, {
      connectToWebsocket: true,
      generateKeys: false,
    });

    // 2. Connect Client A
    clientA.liveService.connect(clientA.token);
    await expect(
      awaitClientConnection('Client A', clientA.liveService)
    ).resolves.toBe('connected');

    await clientA.chatService.loadConversation(URN_B);
    
    // 3. Send Message
    await clientA.chatService.sendMessage(URN_B, 'Hello, User B!');

    // 4. Assert
    expect(clientA.chatService.messages().length).toBe(1);

    // --- THIS IS THE FIX ---
    // The signal contains ChatMessage[], which has `textContent`.
    const receivedMessage = clientA.chatService.messages()[0];
    expect(receivedMessage.textContent).toEqual('Hello, User B!');
    // --- END OF FIX ---

    clientA.chatService.ngOnDestroy(); // Manual cleanup
  }, 10000);

  // --- This test passed, no changes ---
  it('[Phase 6.0] should clear the user queue', async () => {
    // Wait for the message from the previous test
    await expect
      .poll(
        async () => (await getMessages(routingUrl, tokenB)).length, {timeout: 8000,interval: 200}
      ).toBe(1);
    
    await clearUserQueue('userB', routingUrl, tokenB);

    await expect
      .poll(
        async () => (await getMessages(routingUrl, tokenB)).length, {timeout: 8000,interval: 200}
      ).toBe(0);
  }, 10000);

  // --- Test 6: Full Round Trip ---
  it('should complete a full message round trip (A -> B)', async () => {
    // --- PART 1: CLIENT A SENDS (Setup) ---

    // 1. Create Client A
    TestBed.resetTestingModule();
    const clientA = await createTestClient(URN_A, tokenA, {
      connectToWebsocket: true,
      generateKeys: false, 
    });

    // 2. Connect Client A
    clientA.liveService.connect(clientA.token);
    await expect(
      awaitClientConnection('Client A', clientA.liveService)
    ).resolves.toBe('connected');

    // 3. Send Message from A
    // --- THIS IS FIX 2 ---
    // Call Temporal.Now.instant() to get an instance, not the class
    const messageText = `Message from A to B @ ${Temporal.Now.instant().toString()}`;
    // --- END OF FIX 2 ---
    
    await clientA.chatService.loadConversation(URN_B);
    await clientA.chatService.sendMessage(URN_B, messageText);

    // 4. Assert A's state (confirms send)
    expect(clientA.chatService.messages().length).toBe(1);

    // 5. Destroy Client A's environment
    clientA.chatService.ngOnDestroy();
    TestBed.resetTestingModule();

    // --- PART 2: CLIENT B RECEIVES (Test) ---

    // 6. Create Client B
    const clientB = await createTestClient(URN_B, tokenB, {
      connectToWebsocket: true,
      generateKeys: false,
    });

    // 7. Connect Client B (triggers background fetch)
    clientB.liveService.connect(clientB.token);
    await expect(
      awaitClientConnection('Client B', clientB.liveService)
    ).resolves.toBe('connected');

    // 8. Select the conversation
    await clientB.chatService.loadConversation(URN_A);

    // 9. Wait for the message to appear in the signal
    await expect
      .poll(() => clientB.chatService.messages().length, {
        timeout: 8000,
        interval: 200,
      })
      .toBe(1);

    // 10. Assert B's state (confirms receipt)
    // The signal contains ChatMessage[], which has `textContent`.
    const receivedMessage = clientB.chatService.messages()[0];
    expect(receivedMessage.textContent).toEqual(messageText);

    clientB.chatService.ngOnDestroy(); // Manual cleanup
  }, 20000);
});