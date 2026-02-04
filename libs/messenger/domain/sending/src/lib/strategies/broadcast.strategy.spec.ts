import { TestBed } from '@angular/core/testing';
import { BroadcastStrategy } from './broadcast.strategy';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { SendContext } from '../send-strategy.interface';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MessageTypeText } from '@nx-platform-application/messenger-domain-message-content';

describe('BroadcastStrategy', () => {
  let strategy: BroadcastStrategy;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BroadcastStrategy] });
    strategy = TestBed.inject(BroadcastStrategy);
  });

  it('should fan-out to N separate conversation targets', async () => {
    const me = URN.parse('urn:contacts:user:me');
    const alice = URN.parse('urn:contacts:user:alice');
    const bob = URN.parse('urn:contacts:user:bob');
    const groupContext = URN.parse('urn:messenger:group:new-group');

    const ctx = {
      conversationUrn: groupContext, // The context is the new group
      recipients: [alice, bob], // Explicit list
    } as SendContext;

    const targets = await strategy.getTargets(ctx);

    expect(targets).toHaveLength(2);

    // Target 1: Context switches to Alice (1:1)
    expect(targets[0].conversationUrn.toString()).toBe(alice.toString());
    expect(targets[0].recipients[0].toString()).toBe(alice.toString());

    // Target 2: Context switches to Bob (1:1)
    expect(targets[1].conversationUrn.toString()).toBe(bob.toString());
    expect(targets[1].recipients[0].toString()).toBe(bob.toString());
  });

  it('should return empty list if no recipients provided', async () => {
    const me = URN.parse('urn:contacts:user:me');
    const alice = URN.parse('urn:contacts:user:alice');
    const message: ChatMessage = {
      id: 'uuid:1',
      conversationUrn: alice,
      senderId: me,
      typeId: MessageTypeText,
      sentTimestamp: '' as ISODateTimeString,
    };
    const ctx = {
      conversationUrn: me,
      recipientUrn: alice,
      optimisticMsg: message,
      isEphemeral: false,
      shouldPersist: true,
      recipients: [],
    } as SendContext;
    const targets = await strategy.getTargets(ctx);
    expect(targets).toHaveLength(0);
  });
});
