import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { URN } from '@nx-platform-application/platform-types';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';

import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';

// --- Import ALL the services we've built ---
import { ChatService } from '@nx-platform-application/messenger-state-app';
import {
  AuthService,
  IAuthService,
  provideAuth,
  AUTH_API_URL,
} from '@nx-platform-application/platform-auth-access';
import {
  MessengerCryptoService,
  CryptoEngine,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import {
  ChatDataService,
  ChatSendService,
  ROUTING_SERVICE_URL,
} from '@nx-platform-application/messenger-infrastructure-chat-access';
import {
  ChatLiveDataService,
  WSS_URL_TOKEN,
  ConnectionStatus,
} from '@nx-platform-application/messenger-infrastructure-live-data';
import { ChatStorageService } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import {
  SecureKeyService,
  KEY_SERVICE_URL,
} from '@nx-platform-application/messenger-infrastructure-key-access';
import { Logger } from '@nx-platform-application/console-logger';
import { WebKeyDbStore } from '@nx-platform-application/platform-web-key-storage';
import { TestClient } from './test-helpers';

const identityUrl = 'http://localhost:3000/api/auth';
const authUrl = 'http://localhost:3000/api/auth';
const keyUrl = 'http://localhost:8081/keys';
const wssUrl = 'ws://localhost:8083/connect';

export const routingUrl = 'http://localhost:8082/api';

const mockLogger = {
  debug: (...args: any[]) => console.debug('[AppLogger DEBUG]', ...args),
  info: (...args: any[]) => console.info('[AppLogger INFO]', ...args),
  warn: (...args: any[]) => console.warn('[AppLogger WARN]', ...args),
  error: (...args: any[]) => console.error('[AppLogger ERROR]', ...args),
};

export interface ClientOptions {
  connectToWebsocket: boolean;
  /** ➡️ **Change 1:** Add a new option to control key generation. */
  generateKeys?: boolean;
}
/**
 * Creates a new, clean Injector for a single client
 * and (optionally) GENERATES THEIR KEYS.
 */
export async function createTestClient(
  userUrn: URN,
  authToken: string,
  /** ➡️ **Change 2:** Default `generateKeys` to `false`. */
  options: ClientOptions = { connectToWebsocket: false, generateKeys: false },
): Promise<TestClient> {
  const mockUser = {
    id: userUrn.toString(),
    alias: 'Test Client',
    email: 'test@e2e.com',
  };
  const mockAuthResponse = {
    authenticated: true,
    user: mockUser,
    token: authToken,
  };

  const mockAuthService = {
    sessionLoaded$: new BehaviorSubject<any | null>(mockAuthResponse),
    currentUser$: new BehaviorSubject<any | null>(mockUser),
    currentUser: vi.fn(() => mockUser),
    getJwtToken: vi.fn(() => authToken),
  };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptorsFromDi()),
      provideAuth(),
      { provide: IAuthService, useValue: mockAuthService },
      { provide: Logger, useValue: mockLogger },
      CryptoEngine,
      MessengerCryptoService,
      ChatStorageService,
      SecureKeyService,
      ChatDataService,
      ChatSendService,
      // Conditionally provide "live" services
      options.connectToWebsocket ? ChatLiveDataService : [],
      options.connectToWebsocket ? ChatService : [],
      KeyCacheService,
      WebKeyDbStore,
      { provide: AUTH_API_URL, useValue: authUrl },
      { provide: KEY_SERVICE_URL, useValue: keyUrl },
      { provide: ROUTING_SERVICE_URL, useValue: routingUrl },
      { provide: WSS_URL_TOKEN, useValue: wssUrl },
    ],
  });

  const storageService = TestBed.inject(ChatStorageService);
  await storageService.clearDatabase();

  /** ➡️ **Change 3:** Wrap the key generation logic in the new option. */
  if (options.generateKeys) {
    const cryptoService = TestBed.inject(MessengerCryptoService);
    console.log(`[Test] Generating keys for ${userUrn.toString()}...`);
    await cryptoService.generateAndStoreKeys(userUrn);
    console.log(`[Test] Keys generated for ${userUrn.toString()}.`);
  } else {
    console.log(`[Test] Skipping key generation for ${userUrn.toString()}.`);
  }

  // Only inject these if they were provided
  const chatService = options.connectToWebsocket
    ? TestBed.inject(ChatService)
    : (null as any);
  const liveService = options.connectToWebsocket
    ? TestBed.inject(ChatLiveDataService)
    : (null as any);

  const dataService = TestBed.inject(ChatDataService);
  const sendService = TestBed.inject(ChatSendService);
  const keyService = TestBed.inject(SecureKeyService);

  return {
    urn: userUrn,
    token: authToken,
    chatService,
    liveService,
    dataService,
    sendService,
    keyService,
    storageService,
  };
}
