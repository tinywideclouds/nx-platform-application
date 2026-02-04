import { TestBed } from '@angular/core/testing';
import { ContactGroupStrategy } from './group-contacts.strategy';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SendContext } from '../send-strategy.interface';

describe('ContactGroupStrategy', () => {
  let strategy: ContactGroupStrategy;
  let contactsApi: ContactsQueryApi;
  let identityResolver: IdentityResolver;

  const groupUrn = URN.parse('urn:contacts:group:weekend-trip');
  const aliceContact = URN.parse('urn:contacts:user:alice');
  const aliceNetwork = URN.parse('urn:identity:google:alice');
  const bobContact = URN.parse('urn:contacts:user:bob');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ContactGroupStrategy,
        MockProvider(Logger),
        MockProvider(ContactsQueryApi, {
          getGroupParticipants: vi.fn(),
        }),
        MockProvider(IdentityResolver, {
          resolveToHandle: vi.fn(),
        }),
      ],
    });

    strategy = TestBed.inject(ContactGroupStrategy);
    contactsApi = TestBed.inject(ContactsQueryApi);
    identityResolver = TestBed.inject(IdentityResolver);
  });

  it('should resolve contact URNs to network URNs', async () => {
    // 1. Mock Contacts returning Alice
    vi.mocked(contactsApi.getGroupParticipants).mockResolvedValue([
      { id: aliceContact, alias: 'Alice' },
    ] as any);

    // 2. Mock Identity returning Alice's network handle
    vi.mocked(identityResolver.resolveToHandle).mockResolvedValue(aliceNetwork);

    const ctx = { recipientUrn: groupUrn } as SendContext;
    const targets = await strategy.getTargets(ctx);

    expect(targets).toHaveLength(1);
    expect(targets[0].conversationUrn.toString()).toBe(groupUrn.toString());

    // ✅ VERIFY: It sends to the Network URN, not the Contact URN
    expect(targets[0].recipients[0].toString()).toBe(aliceNetwork.toString());
  });

  it('should filter out unresolved users', async () => {
    vi.mocked(contactsApi.getGroupParticipants).mockResolvedValue([
      { id: aliceContact },
      { id: bobContact },
    ] as any);

    vi.mocked(identityResolver.resolveToHandle).mockImplementation(
      async (urn: URN) => {
        if (urn.equals(aliceContact)) return aliceNetwork;
        return URN.parse('urn:errors:type:not-found'); // Bob is not on the network
      },
    );

    const ctx = { recipientUrn: groupUrn } as SendContext;
    const targets = await strategy.getTargets(ctx);

    expect(targets[0].recipients).toHaveLength(1);
    expect(targets[0].recipients[0].toString()).toBe(aliceNetwork.toString());
  });

  it('should return empty if group is empty', async () => {
    vi.mocked(contactsApi.getGroupParticipants).mockResolvedValue([]);
    const ctx = { recipientUrn: groupUrn } as SendContext;
    const targets = await strategy.getTargets(ctx);
    expect(targets).toHaveLength(0);
  });
});
