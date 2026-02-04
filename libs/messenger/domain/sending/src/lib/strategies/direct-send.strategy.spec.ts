import { TestBed } from '@angular/core/testing';
import { DirectSendStrategy } from './direct-send.strategy';
import { URN } from '@nx-platform-application/platform-types';
import { SendContext } from '../send-strategy.interface';

describe('DirectSendStrategy', () => {
  let strategy: DirectSendStrategy;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DirectSendStrategy] });
    strategy = TestBed.inject(DirectSendStrategy);
  });

  it('should return a single target pointing to the recipient', async () => {
    const ctx = {
      conversationUrn: URN.parse('urn:contacts:user:alice'),
      recipientUrn: URN.parse('urn:contacts:user:alice'),
    } as SendContext;

    const targets = await strategy.getTargets(ctx);

    expect(targets).toHaveLength(1);
    expect(targets[0].conversationUrn.toString()).toBe(
      'urn:contacts:user:alice',
    );
    expect(targets[0].recipients).toHaveLength(1);
    expect(targets[0].recipients[0].toString()).toBe('urn:contacts:user:alice');
  });
});
