import { TestBed } from '@angular/core/testing';
import { URN } from '@nx-platform-application/platform-types';

// --- Import ALL the services we've built ---
import { ChatService } from '@nx-platform-application/chat-state';
import { AuthService } from '@nx-platform-application/auth-data-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-access';
import {
  ChatDataService,
  ChatSendService,
} from '@nx-platform-application/chat-data-access';
import { ChatLiveDataService } from '@nx-platform-application/chat-live-data';
import { ChatStorageService } from '@nx-platform-application/chat-storage';
import { Logger } from '@nx-platform-application/console-logger';
import { IndexedDb } from '@nx-platform-application/platform-storage';
import { BehaviorSubject } from "rxjs";

// --- Real Services (No Mocks) ---
// We will provide the *real* implementations of all our hard work
const realServiceProviders = [
  ChatService,
  MessengerCryptoService,
  ChatDataService,
  ChatSendService,
  ChatLiveDataService,
  ChatStorageService,
  IndexedDb,
  { provide: Logger, useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
];

// --- Mock Fixtures ---
const URN_A = URN.parse('urn:sm:user:client-a');
const URN_B = URN.parse('urn:sm:user:client-b');
const TOKEN_A = 'mock.jwt.token.A';
const TOKEN_B = 'mock.jwt.token.B';

// --- The Test Harness ---

interface TestClient {
  chatService: ChatService;
  liveService: ChatLiveDataService;
  dataService: ChatDataService;
  storageService: ChatStorageService;
  // ... any other services we want to spy on
}

/**
 * Test Harness Helper
 * Creates a new, clean Injector for a single client (A or B)
 * with a mocked AuthService.
 */
async function createTestClient(
  userUrn: URN,
  authToken: string
): Promise<TestClient> {
  // Create a mock AuthService for this specific client
  const mockAuthService = {
    currentUser$: new BehaviorSubject<any | null>({ id: userUrn }),
    currentUser: vi.fn(() => ({ id: userUrn })),
    getAuthToken: vi.fn(async () => authToken),
  };

  TestBed.configureTestingModule({
    providers: [
      ...realServiceProviders,
      { provide: AuthService, useValue: mockAuthService },
    ],
  });

  // Clear IndexedDb for this user
  const db = TestBed.inject(IndexedDb);
  await Promise.all([
    db.table('keyPairs').clear(),
    db.table('messages').clear(),
  ]);

  return {
    chatService: TestBed.inject(ChatService),
    liveService: TestBed.inject(ChatLiveDataService),
    dataService: TestBed.inject(ChatDataService),
    storageService: TestBed.inject(ChatStorageService),
  };
}

// --- The E2E Test ---

describe('E2E: Headless Conversation', () => {
  let clientA: TestClient;
  let clientB: TestClient;

  // --- 1. Test Harness Setup ---
  beforeEach(async () => {
    // Reset modules to ensure clean injectors
    TestBed.resetTestingModule();
    clientA = await createTestClient(URN_A, TOKEN_A);

    TestBed.resetTestingModule();
    clientB = await createTestClient(URN_B, TOKEN_B);

    // Spies
    vi.spyOn(clientA.liveService.incomingMessage$, 'next');
    vi.spyOn(clientB.liveService.incomingMessage$, 'next');
    vi.spyOn(clientA.dataService, 'getMessageBatch');
    vi.spyOn(clientB.dataService, 'getMessageBatch');
  });

  afterEach(() => {
    clientA.chatService.ngOnDestroy();
    clientB.chatService.ngOnDestroy();
    vi.restoreAllMocks();
  });

  // --- 2. Test Flow ---
  it('should complete a full message round trip (A -> B -> A)', async () => {
    // --- Step 1 & 2: Onboarding and B Comes Online ---
    // Note: init() is called automatically by the service constructor
    // We just need to wait for B to connect.
    await vi.waitFor(
      () => {
        expect(clientB.liveService.status$.value).toBe('connected');
      },
      { timeout: 5000 } // 5s timeout for WS connection
    );

    // --- Step 3: Sender (User A) Sends Message ---
    await clientA.chatService.sendMessage(URN_B, 'Hello, User B!');

    // Assert: Optimistic save
    expect(clientA.chatService.messages().length).toBe(1);
    expect(clientA.chatService.messages()[0].payloadBytes).toEqual(
      new TextEncoder().encode('Hello, User B!')
    );

    // --- Step 4: The "Poke-then-Pull" (B Receives) ---
    // Assert (Poke): Wait for B's "poke"
    await vi.waitFor(
      () => {
        expect(
          clientB.liveService.incomingMessage$.next
        ).toHaveBeenCalled();
      },
      { timeout: 10000 } // 10s for backend routing
    );

    // Assert (Pull): The poke triggers the pull
    await vi.waitFor(() => {
      expect(clientB.dataService.getMessageBatch).toHaveBeenCalled();
    });

    // Assert (Result): B's UI updates
    await vi.waitFor(() => {
      expect(clientB.chatService.messages().length).toBe(1);
    });
    expect(clientB.chatService.messages()[0].payloadBytes).toEqual(
      new TextEncoder().encode('Hello, User B!')
    );

    // --- Step 5: The Reply (B -> A) ---
    // First, A must be online
    await vi.waitFor(
      () => {
        expect(clientA.liveService.status$.value).toBe('connected');
      },
      { timeout: 5000 }
    );

    await clientB.chatService.sendMessage(URN_A, 'Hi back, User A!');

    // Assert (Optimistic B)
    expect(clientB.chatService.messages().length).toBe(2);

    // --- Step 6: The Round Trip (A Receives) ---
    // Assert (Poke A)
    await vi.waitFor(
      () => {
        expect(
          clientA.liveService.incomingMessage$.next
        ).toHaveBeenCalled();
      },
      { timeout: 10000 }
    );

    // Assert (Pull A)
    await vi.waitFor(() => {
      expect(clientA.dataService.getMessageBatch).toHaveBeenCalled();
    });

    // Assert (Result A)
    await vi.waitFor(() => {
      expect(clientA.chatService.messages().length).toBe(2); // 1 sent, 1 received
    });
    expect(clientA.chatService.messages()[1].payloadBytes).toEqual(
      new TextEncoder().encode('Hi back, User A!')
    );
  }, 120_000); // 2-minute timeout for the whole test
});
