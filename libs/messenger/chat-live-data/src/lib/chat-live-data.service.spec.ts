import { TestBed } from '@angular/core/testing';
import {
  ChatLiveDataService,
  ConnectionStatus,
} from './chat-live-data.service';
import { Logger } from '@nx-platform-application/console-logger';
import { vi } from 'vitest';
import { WSS_URL_TOKEN } from './live-data.config';

const RealWebSocket = global.WebSocket;

/**
 * Mock implementation of WebSocket for testing RxJS webSocket behavior.
 * Allows manual triggering of open, message, error, and close events.
 */
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  protocol: string | string[] | undefined;

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  static get lastInstance(): MockWebSocket | null {
    return MockWebSocket.instances.length > 0
      ? MockWebSocket.instances[MockWebSocket.instances.length - 1]
      : null;
  }

  constructor(url: string, protocol?: string | string[] | undefined) {
    this.url = url;
    this.protocol = protocol;
    MockWebSocket.instances.push(this);
  }

  // Executing close synchronously prevents race conditions in tests 
  // where assertions happen immediately after disconnect().
  close = vi.fn(() => {
    if (this.onclose) {
      this.onclose({ wasClean: true } as CloseEvent);
    }
  });

  send = vi.fn();

  triggerOpen(): void {
    if (this.onopen) this.onopen();
  }
  triggerMessage(data: string): void {
    if (this.onmessage) this.onmessage({ data });
  }
  triggerError(error: unknown): void {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}

vi.mock('@nx-platform-application/messenger-types', () => ({
  deserializeJsonToEnvelope: vi.fn(),
}));

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(), // Added to satisfy service usage
};

describe('ChatLiveDataService', () => {
  let service: ChatLiveDataService;
  let logger: Logger;

  const mockJwt = 'mock.jwt.token';
  const mockUrl = 'wss://api.example.com/connect';

  beforeEach(() => {
    global.WebSocket = MockWebSocket as any;
    MockWebSocket.instances = [];
    vi.clearAllMocks();
    vi.useFakeTimers(); 

    TestBed.configureTestingModule({
      providers: [
        ChatLiveDataService,
        { provide: Logger, useValue: mockLogger },
        { provide: WSS_URL_TOKEN, useValue: mockUrl },
      ],
    });

    service = TestBed.inject(ChatLiveDataService);
    logger = TestBed.inject(Logger);
  });

  afterEach(() => {
    service.ngOnDestroy();
    global.WebSocket = RealWebSocket;
    vi.useRealTimers();
  });

  it('should be created and log initialization', () => {
    expect(service).toBeTruthy();
    expect(logger.info).toHaveBeenCalledWith('ChatLiveDataService initialized');
  });

  it('should connect with URL and JWT protocol', async () => {
    const statuses: ConnectionStatus[] = [];
    service.status$.subscribe((s) => statuses.push(s));

    service.connect(mockJwt);

    expect(statuses).toEqual(['disconnected', 'connecting']);
    const lastSocket = MockWebSocket.lastInstance;
    expect(lastSocket).toBeTruthy();
    expect(lastSocket?.url).toBe(mockUrl);
    expect(lastSocket?.protocol).toEqual([mockJwt]);

    lastSocket?.triggerOpen();
    await Promise.resolve();

    expect(statuses).toEqual(['disconnected', 'connecting', 'connected']);
  });

  it('should emit a void "poke" on any incoming message', async () => {
    let pokeCount = 0;
    service.incomingMessage$.subscribe(() => {
      pokeCount++;
    });

    service.connect(mockJwt);
    MockWebSocket.lastInstance?.triggerOpen();
    await Promise.resolve();

    const pokeMessage = '{"poke":true}';
    MockWebSocket.lastInstance?.triggerMessage(pokeMessage);
    await Promise.resolve();

    expect(pokeCount).toBe(1);
    expect(logger.info).toHaveBeenCalledWith(
      'ChatLiveDataService: Received "poke"'
    );
  });

  it('should log error on socket error and attempt retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {
      // suppress console error for clean test output
    });

    service.connect(mockJwt);
    await Promise.resolve();
    expect(MockWebSocket.instances.length).toBe(1); 

    const testError = new Error('Socket failed');
    MockWebSocket.lastInstance?.triggerError(testError);
    await Promise.resolve(); 

    expect(logger.error).toHaveBeenCalledWith(
      'ChatLiveDataService: WebSocket error',
      testError
    );

    // Retry logic: 1000 * 2^1 = 2000ms
    expect(logger.warn).toHaveBeenCalledWith(
      'WebSocket retry attempt 1, delay 2000ms'
    );

    // Advance timers to trigger the retry
    vi.advanceTimersByTime(2000);
    await Promise.resolve(); 

    // Expect a new socket instance created by the retry/defer
    expect(MockWebSocket.instances.length).toBe(2);
    expect(MockWebSocket.lastInstance?.protocol).toEqual([mockJwt]);
  });

  it('should transition to "disconnected" on disconnect()', async () => {
    const statuses: ConnectionStatus[] = [];
    service.status$.subscribe((s) => statuses.push(s));

    service.connect(mockJwt);
    MockWebSocket.lastInstance?.triggerOpen();
    await Promise.resolve();
    expect(statuses.pop()).toBe('connected');

    const instanceToClose = MockWebSocket.lastInstance;
    service.disconnect();

    await vi.runAllTicks();

    expect(instanceToClose?.close).toHaveBeenCalled();
    expect(statuses.pop()).toBe('disconnected');
  });
});