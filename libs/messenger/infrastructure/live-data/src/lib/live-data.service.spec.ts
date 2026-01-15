import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ChatLiveDataService } from './live-data.service';
import { ConnectionStatus } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import { WSS_URL_TOKEN } from './live-data.config';
import { AppLifecycleService } from '@nx-platform-application/platform-infrastructure-browser-lifecycle';
import { Subject } from 'rxjs';
import { WebSocketSubject } from 'rxjs/webSocket';

// 1. Mock 'rxjs/webSocket' module
// We need to hoist this so it runs before imports
vi.mock('rxjs/webSocket', () => ({
  webSocket: vi.fn(),
}));

// Import the mocked function to configure it in tests
import { webSocket } from 'rxjs/webSocket';

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

  // The Subject that will act as our "Socket"
  let mockSocketSubject: Subject<any>;
  // Captured config passed to webSocket() so we can trigger observers
  let capturedConfig: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Use fake timers to control retry delays
    vi.useFakeTimers();

    // 2. Setup the webSocket mock
    mockSocketSubject = new Subject<any>();
    // Add the .complete() method to mimic WebSocketSubject
    (mockSocketSubject as any).complete = vi.fn();

    (webSocket as Mock).mockImplementation((configOrUrl) => {
      capturedConfig = configOrUrl;
      return mockSocketSubject as unknown as WebSocketSubject<any>;
    });

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
    vi.useRealTimers();
  });

  it('should be created and log initialization', () => {
    expect(service).toBeTruthy();
    expect(logger.info).toHaveBeenCalledWith('ChatLiveDataService initialized');
  });

  it('should connect with URL and JWT protocol', () => {
    const statuses: ConnectionStatus[] = [];
    service.status$.subscribe((s) => statuses.push(s));

    service.connect(() => mockJwt);

    // Assert configuration
    expect(webSocket).toHaveBeenCalled();
    expect(capturedConfig.url).toBe(mockUrl);
    expect(capturedConfig.protocol).toEqual([mockJwt]);

    // Initial state
    expect(statuses).toEqual(['disconnected', 'connecting']);

    // Simulate Open Event
    capturedConfig.openObserver.next();

    expect(statuses).toEqual(['disconnected', 'connecting', 'connected']);
  });

  it('should emit a void "poke" on any incoming message', () => {
    let pokeCount = 0;
    service.incomingMessage$.subscribe(() => {
      pokeCount++;
    });

    service.connect(() => mockJwt);
    capturedConfig.openObserver.next();

    // Simulate Message from Socket
    mockSocketSubject.next({ some: 'data' });

    expect(pokeCount).toBe(1);
    expect(logger.info).toHaveBeenCalledWith(
      'ChatLiveDataService: Received "poke"',
    );
  });

  it('should log error on socket error and attempt retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    service.connect(() => mockJwt);
    capturedConfig.openObserver.next();

    // 1. Simulate Error
    const testError = new Error('Socket failed');
    mockSocketSubject.error(testError);

    // Service should catch, log, and schedule retry
    expect(logger.error).toHaveBeenCalledWith(
      'ChatLiveDataService: WebSocket error',
      testError,
    );

    // Should enter reconnection state
    // (Note: The retry delay calculation happens inside the retry operator)
    // We advance time to trigger the retry
    vi.advanceTimersByTime(2000);

    // Expect reconnection attempt (webSocket called again)
    expect(webSocket).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket retry attempt'),
    );
  });

  it('should transition to "disconnected" on disconnect()', () => {
    const statuses: ConnectionStatus[] = [];
    service.status$.subscribe((s) => statuses.push(s));

    service.connect(() => mockJwt);
    capturedConfig.openObserver.next();
    expect(statuses[statuses.length - 1]).toBe('connected');

    service.disconnect();

    // Verify cleanup
    expect((mockSocketSubject as any).complete).toHaveBeenCalled();
    expect(statuses[statuses.length - 1]).toBe('disconnected');
  });

  it('should handle deserializer returning void (Configuration Check)', () => {
    service.connect(() => mockJwt);
    expect(capturedConfig.deserializer).toBeDefined();

    const result = capturedConfig.deserializer({ data: '{"test":1}' });
    expect(result).toBeUndefined();
  });
});
