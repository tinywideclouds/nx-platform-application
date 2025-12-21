// libs/messenger/chat-ui/src/lib/pipes/contact-name.pipe.spec.ts

import { ContactNamePipe } from './contact-name.pipe';
import { URN } from '@nx-platform-application/platform-types';

describe('ContactNamePipe', () => {
  const pipe = new ContactNamePipe();

  it('should simplify URNs', () => {
    const urn = URN.parse('urn:user:bob');
    expect(pipe.transform(urn)).toBe('bob');
  });

  it('should handle strings', () => {
    expect(pipe.transform('alice')).toBe('alice');
  });
});
