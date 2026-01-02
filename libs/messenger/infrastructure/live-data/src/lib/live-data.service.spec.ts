import { TestBed } from '@angular/core/testing';
import { ChatLiveDataService } from './live-data.service';
import { ConnectionStatus } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/console-logger';
import { vi } from 'vitest';
import { WSS_URL_TOKEN } from './live-data.config';
import { AppLifecycleService } from '@nx-platform-application/platform-lifecycle';
import { Subject } from 'rxjs';

const RealWebSocket = global.WebSocket;

/**
 * Robust Mock implementation of WebSocket.
 * Includes `readyState` management required by RxJS.
 */
class MockWebSocket {
  static instances: MockWebSocket[] = [];

  // WebSocket State Constants
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  protocol: string | string[] | undefined;
  readyState: number = MockWebSocket.CONNECTING;

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

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ wasClean: true } as CloseEvent);
    }
  });

  send = vi.fn();

  triggerOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen();
  }

  triggerMessage(data: string): void {
    if (this.onmessage) this.onmessage({ data });
  }

  triggerError(error: unknown): void {
    // Error doesn't necessarily close the socket immediately in spec,
    // but typically leads to close.
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
  debug: vi.fn(),
};

describe('ChatLiveDataService', () => {
  let service: ChatLiveDataService;
  let logger: Logger;
  const resumedSubject = new Subject<void>();

  const mockJwt = 'mock.jwt.token';
  const mockUrl = 'wss://api.example.com/connect';

  beforeEach(() => {
    // Inject our Mock Class
    global.WebSocket = MockWebSocket as any;

    // Add the constants to the class instance prototype if RxJS checks them statically
    // (RxJS checks instances, but sometimes checks the static constants on global.WebSocket)
    (global.WebSocket as any).CONNECTING = 0;
    (global.WebSocket as any).OPEN = 1;
    (global.WebSocket as any).CLOSING = 2;
    (global.WebSocket as any).CLOSED = 3;

    MockWebSocket.instances = [];
    vi.clearAllMocks();
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [
        ChatLiveDataService,
        { provide: Logger, useValue: mockLogger },
        { provide: WSS_URL_TOKEN, useValue: mockUrl },
        {
          provide: AppLifecycleService,
          useValue: { resumed$: resumedSubject.asObservable() },
        },
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
    expect(lastSocket?.readyState).toBe(MockWebSocket.CONNECTING);

    lastSocket?.triggerOpen();
    await Promise.resolve();

    expect(lastSocket?.readyState).toBe(MockWebSocket.OPEN);
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
      'ChatLiveDataService: Received "poke"',
    );
  });

  it('should log error on socket error and attempt retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    service.connect(mockJwt);
    await Promise.resolve();
    expect(MockWebSocket.instances.length).toBe(1);

    const testError = new Error('Socket failed');
    MockWebSocket.lastInstance?.triggerError(testError);
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      'ChatLiveDataService: WebSocket error',
      testError,
    );

    expect(logger.warn).toHaveBeenCalledWith(
      'WebSocket retry attempt 1, delay 2000ms',
    );

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

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
    // RxJS won't call close() if it doesn't think it's OPEN
    expect(instanceToClose?.readyState).toBe(MockWebSocket.OPEN);

    service.disconnect();

    // Flush microtasks
    await Promise.resolve();

    expect(instanceToClose?.close).toHaveBeenCalled();
    expect(statuses.pop()).toBe('disconnected');
  });
});
