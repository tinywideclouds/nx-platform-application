import { TestBed } from '@angular/core/testing';
import { Temporal } from '@js-temporal/polyfill';
import { ChatWindowComponent } from './chat-window.component';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ChatWindowHeaderComponent } from '@nx-platform-application/messenger-ui-chat';

// Services
import { AppState } from '@nx-platform-application/messenger-state-app';
import { ContactsStorageService } from '@nx-platform-application/contacts-infrastructure-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

// ng-mocks
import { MockComponent, MockProvider } from 'ng-mocks';

// Mock Data
const mockContactUrn = URN.parse('urn:contacts:user:alice');
const mockContact: Contact = {
  id: mockContactUrn,
  alias: 'Alice',
  email: 'alice@test.com',
  firstName: 'Alice',
  surname: 'Wonderland',
  lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: { messenger: { profilePictureUrl: 'img.png' } } as any,
};

describe('ChatWindowComponent', () => {
  let harness: RouterTestingHarness;
  let component: ChatWindowComponent;

  // Signals
  const selectedConversation = signal(null);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatWindowComponent, MockComponent(ChatWindowHeaderComponent)],
      providers: [
        provideRouter([
          { path: 'chat/:id', component: ChatWindowComponent },
          { path: 'chat/:id/details', component: ChatWindowComponent },
          {
            path: 'messenger/conversations/:id',
            component: ChatWindowComponent,
          },
        ]),
        // Mock AppState directly since it's the new delegate
        MockProvider(AppState, {
          loadConversation: vi.fn(),
          upgradeGroup: vi.fn(),
          selectedConversation,
          isRecipientKeyMissing: signal(false),
          messages: signal([]),
        }),
        // Also mock ChatService if it's still used by some internals,
        // but AppState is the primary one we are testing.
        MockProvider(AppState, {
          loadConversation: vi.fn(),
          selectedConversation,
          isRecipientKeyMissing: signal(false),
        }),
        MockProvider(ContactsStorageService, {
          contacts$: of([mockContact]),
          groups$: of([]),
        }),
        MockProvider(Logger),
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
  });

  it('should load conversation when route ID is present', async () => {
    // Navigate to the route
    component = await harness.navigateByUrl(
      `/chat/${mockContactUrn.toString()}`,
      ChatWindowComponent,
    );

    const appState = TestBed.inject(AppState);

    expect(appState.loadConversation).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'alice' }),
    );
  });

  it('should calculate participant correctly', async () => {
    component = await harness.navigateByUrl(
      `/chat/${mockContactUrn.toString()}`,
      ChatWindowComponent,
    );

    const participant = component.participant();
    expect(participant).toBeTruthy();
    expect(participant?.name).toBe('Alice');
    expect(participant?.profilePictureUrl).toBe('img.png');
  });

  it('should detect "details" view mode from router', async () => {
    component = await harness.navigateByUrl(
      `/chat/${mockContactUrn.toString()}/details`,
      ChatWindowComponent,
    );
    expect(component.viewMode()).toBe('details');
  });

  // [NEW] Test Case for Upgrade Flow
  it('should call upgradeGroup and navigate on success', async () => {
    // 1. Setup
    const localUrn = URN.parse('urn:contacts:group:local-1');
    const newNetworkUrn = URN.parse('urn:messenger:group:new-uuid');

    component = await harness.navigateByUrl(
      `/chat/${localUrn.toString()}`,
      ChatWindowComponent,
    );

    // Mock the AppState
    const appState = TestBed.inject(AppState);
    vi.spyOn(appState, 'upgradeGroup').mockResolvedValue(newNetworkUrn);

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    // 2. Action
    await component.onCreateGroupChat();

    // 3. Verification
    expect(appState.upgradeGroup).toHaveBeenCalledWith(
      expect.objectContaining({ id: localUrn.entityId }),
    );

    expect(router.navigate).toHaveBeenCalledWith(
      ['/messenger', 'conversations', newNetworkUrn.toString()],
      expect.objectContaining({ replaceUrl: true }),
    );
  });
});
