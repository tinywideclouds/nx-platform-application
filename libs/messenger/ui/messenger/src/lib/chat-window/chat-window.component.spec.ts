import { TestBed } from '@angular/core/testing';
import { ChatWindowComponent } from './chat-window.component';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

// Services
import { ChatService } from '@nx-platform-application/messenger-state-app';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';

// ng-mocks
import { MockComponent, MockProvider } from 'ng-mocks';
import { ChatWindowHeaderComponent } from '../chat-window-header/chat-window-header.component';

// Mock Data
const mockContactUrn = URN.parse('urn:contacts:user:alice');
const mockContact: Contact = {
  id: mockContactUrn,
  alias: 'Alice',
  email: 'alice@test.com',
  firstName: 'Alice',
  surname: 'Wonderland',
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
        ]),
        MockProvider(ChatService, {
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

    const chatService = TestBed.inject(ChatService);

    // Check if the service was called
    expect(chatService.loadConversation).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'alice' }), // Loose URN matching or explicit check
    );
    // Note: Since URN object equality is strict, we might need to check toString if the mock call uses a new URN instance
    const callArg = (chatService.loadConversation as any).mock.calls[0][0];
    expect(callArg.toString()).toBe(mockContactUrn.toString());
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

  it('should detect "chat" view mode from router', async () => {
    component = await harness.navigateByUrl(
      `/chat/${mockContactUrn.toString()}`,
      ChatWindowComponent,
    );
    expect(component.viewMode()).toBe('chat');
  });
});
