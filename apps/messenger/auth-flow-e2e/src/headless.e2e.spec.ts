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

// --- ➡️ Change 1: First describe block for individual service checks ---
describe('E2E: Service Health Checks', () => {
  let tokenA: string;
  let tokenB: string;

  // --- 1. Test Harness Setup (Remains beforeEach for independence) ---
  beforeEach(async () => {
    if (!E2E_SECRET) {
      throw new Error('E2E_TEST_SECRET is not defined in the test environment!');
    }
    console.log('[Health Check] Fetching tokens for test...');

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

    if (!tokenA || !tokenB) {
      throw new Error('Failed to fetch E2E tokens.');
    }
  });

  afterEach(() => {
    TestBed.resetTestingModule(); // Clean up the global TestBed
    vi.restoreAllMocks();
  });

  // --- 🩺 Phase 1: Identity Service Health (Port 3000) ---
  it.skip('[Phase 1] should connect to the identity-service (port 3000) health check', async () => {
    const healthUrl = 'http://localhost:3000/api/health-check';
    const response = await fetch(healthUrl);
    expect(response.ok, 'Identity /health-check failed').toBe(true);
  }, 10000);

  it.skip('[Phase 1] should get a valid 200 from the /e2e-token endpoint', async () => {
    const headers = {
      'Content-Type': 'application/json',
      'x-e2e-secret-key': E2E_SECRET,
    };
    const response = await fetch(
      'http://localhost:3000/api/e2e/generate-test-token',
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          id: 'urn:sm:user:test',
          email: 't@t.com',
          alias: 'T',
        }),
      }
    );
    expect(response.status, 'Identity /e2e-token did not return 200').toBe(200);
  }, 10000);

  // --- 🔑 Phase 2: Key Service Health (Port 8081) ---
  it.skip('[Phase 2] should connect to the key-service (port 8081) /readyz check', async () => {
    const readyUrl = 'http://localhost:8081/readyz';
    const response = await fetch(readyUrl);
    expect(response.ok, 'Key-service /readyz failed').toBe(true);
  }, 10000);

  it.skip('[Phase 2] should store and retrieve keys from the go-key-service (port 8081)', async () => {
    const mockKeys = { encKey: 'AQID', sigKey: 'BAUG' };
    const storeUrl = `http://localhost:8081/api/v2/keys/${URN_B.toString()}`;

    // Store
    const storeResponse = await fetch(storeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify(mockKeys),
    });
    expect(storeResponse.status, 'Key-service POST failed').toBe(201);

    // Retrieve
    const getResponse = await fetch(storeUrl, { method: 'GET' });
    expect(getResponse.ok, 'Key-service GET failed').toBe(true);
    const retrievedKeys = await getResponse.json();
    expect(retrievedKeys).toEqual(mockKeys);
  }, 10000);

  // --- 📡 Phase 3: Routing Service Health (Ports 8082 & 8083) ---
  it.skip('[Phase 3] should connect to the routing-api (port 8082) /readyz check', async () => {
    const readyUrl = 'http://localhost:8082/readyz';
    const response = await fetch(readyUrl);
    expect(response.ok, 'Routing-api /readyz failed').toBe(true);
  }, 10000);

  // --- ✨ Phase 4: Angular Service Health ---
  it.skip('[Phase 4] should connect the Angular SecureKeyService (port 8081)', async () => {
    // 1. Seed Client B's keys
    TestBed.resetTestingModule();
    // ➡️ **Change 2:** Explicitly pass options, setting `generateKeys: true`
    await createTestClient(URN_B, tokenB, {
      connectToWebsocket: false,
      generateKeys: true,
    });

    // 2. Create Client A, which will use the SecureKeyService
    TestBed.resetTestingModule();
    // ➡️ **Change 3:** Explicitly pass options, `generateKeys: false` (the default)
    const clientA = await createTestClient(URN_A, tokenA, {
      connectToWebsocket: false,
      generateKeys: false,
    });

    // 3. Use the service to get B's keys
    const keys = await clientA.keyService.getKey(URN_B);

    expect(keys).toBeDefined();
    expect(keys.encKey).toBeTruthy();
    expect(keys.sigKey).toBeTruthy();

    // clientA.chatService.ngOnDestroy(); // chatService is null, this would error
  }, 10000);

  it.skip('[Phase 4] should connect the Angular ChatLiveDataService (port 8083)', async () => {
    TestBed.resetTestingModule();
    // ➡️ **Change 4:** Pass options object
    const clientA = await createTestClient(URN_A, tokenA, {
      connectToWebsocket: true, // Need this for ChatLiveDataService
      generateKeys: false,
    });
    clientA.liveService.connect(clientA.token);
    await expect(
      awaitClientConnection('Client A', clientA.liveService)
    ).resolves.toBe('connected');
    clientA.chatService.ngOnDestroy(); // Manual cleanup
  }, 10000);

  it.skip('[Phase 4] should connect the Angular ChatDataService (port 8082)', async () => {
    TestBed.resetTestingModule();
    // ➡️ **Change 5:** Pass options object
    const clientA = await createTestClient(URN_A, tokenA, {
      connectToWebsocket: false,
      generateKeys: false,
    });

    // Just prove we can make a successful, authed call
    const messages = await firstValueFrom(
      clientA.dataService.getMessageBatch(10)
    );
    expect(messages).toBeDefined();
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBe(0); // Expect no messages
    // clientA.chatService.ngOnDestroy(); // chatService is null
  }, 10000);
});

// --- ➡️ Change 6: Second describe block for integrated application flows ---
describe('E2E: Application Flow', () => {
  let tokenA: string;
  let tokenB: string;

  // --- 1. Test Harness Setup (Optimized with beforeAll) ---
  beforeAll(async () => {
    console.log('[Flow Test] Running beforeAll setup...');
    // --- A. GET TOKENS ONCE ---
    console.log('[Flow Test] Fetching tokens ONCE for the suite...');
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

    // --- B. SEED USER KEYS ONCE ---
    console.log('[Flow Test] Seeding keys for Client A...');
    TestBed.resetTestingModule();
    await createTestClient(URN_A, tokenA, {
      connectToWebsocket: false,
      generateKeys: true,
    });

    console.log('[Flow Test] Seeding keys for Client B...');
    TestBed.resetTestingModule();
    await createTestClient(URN_B, tokenB, {
      connectToWebsocket: false,
      generateKeys: true,
    });
    console.log('[Flow Test] beforeAll setup complete.');
  }, 60000); // Give 'beforeAll' a longer timeout

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  // --- (NEW) Focused test for queue clearing ---
  it('[Phase 5.0] ensure userB queue is clear', async () => {
    
    // 2. Call the clearUserQueue helper for Client B
    console.log('[Test] --- CALLING clearUserQueue (1st pass) ---');
    await clearUserQueue('userB', routingUrl, tokenB);

    await expect
      .poll(
        async () => {
          const msgs = await getMessages(routingUrl, tokenB);
          return msgs.length;
        },
        {
          timeout: 8000,
          interval: 200,
        }
      )
      .toBe(0);
  }, 20000);

  // --- 🚀 Phase 5: Application Flow ---
  it('[Phase 5] should connect Client A and send a message', async () => {
    // ➡️ **Change 8:** Remove seeding of Client B's keys (done in beforeAll)

    // 1. Create Client A (Keys already exist)
    TestBed.resetTestingModule();
    const clientA = await createTestClient(URN_A, tokenA, {
      connectToWebsocket: true,
      generateKeys: false, // Keys were seeded in beforeAll
    });

    // 2. Connect Client A to the live websocket
    clientA.liveService.connect(clientA.token);
    await expect(
      awaitClientConnection('Client A', clientA.liveService)
    ).resolves.toBe('connected');

    await clientA.chatService.loadConversation(URN_B);
    
    // 3. Send Message
    await clientA.chatService.sendMessage(URN_B, 'Hello, User B!');

    // 4. Assert
    expect(clientA.chatService.messages().length).toBe(1);

    const decodedPayload = new TextDecoder().decode(
      clientA.chatService.messages()[0].payloadBytes
    );
    expect(decodedPayload).toEqual('Hello, User B!');

    clientA.chatService.ngOnDestroy(); // Manual cleanup
  }, 10000);

  // --- (NEW) Find message from previous step and then clear the queue ---
  it('[Phase 6.0] should clear the user queue', async () => {
    await expect
      .poll(
        async () => (await getMessages(routingUrl, tokenB)).length, {timeout: 8000,interval: 200}
      ).toBe(1);
    // 1. Call the clearUserQueue helper for Client B
    console.log('[Test] --- CALLING clearUserQueue (1st pass) ---');
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
    const messageText = `Message from A to B @ ${Temporal.Instant.toString()}`;
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
      generateKeys: false, // Keys already seeded
    });

    // 7. Connect Client B (triggers background fetch)
    clientB.liveService.connect(clientB.token);
    await expect(
      awaitClientConnection('Client B', clientB.liveService)
    ).resolves.toBe('connected');

    // 8. Select the conversation
    await clientB.chatService.loadConversation(URN_A);

    await expect
      .poll(() => clientB.chatService.messages().length, {
        timeout: 8000,
        interval: 200,
      })
      .toBe(1);

    // 9. Assert B's state (confirms receipt)
    const decodedPayload = new TextDecoder().decode(
      clientB.chatService.messages()[0].payloadBytes
    );
    expect(decodedPayload).toEqual(messageText);

    clientB.chatService.ngOnDestroy(); // Manual cleanup
  }, 20000);
});