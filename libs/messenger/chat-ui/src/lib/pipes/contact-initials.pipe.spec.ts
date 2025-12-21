// libs/messenger/chat-ui/src/lib/pipes/contact-initials.pipe.spec.ts

import { ContactInitialsPipe } from './contact-initials.pipe';
import { URN } from '@nx-platform-application/platform-types';

describe('ContactInitialsPipe', () => {
  let pipe: ContactInitialsPipe;

  beforeEach(() => {
    pipe = new ContactInitialsPipe();
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should extract initials from URN entity ID', () => {
    const urn = URN.parse('urn:user:bob-smith');
    expect(pipe.transform(urn)).toBe('BS');
  });

  it('should handle single word IDs', () => {
    const urn = URN.parse('urn:user:alice');
    expect(pipe.transform(urn)).toBe('AL');
  });

  it('should handle raw strings', () => {
    expect(pipe.transform('d4280c94')).toBe('D4');
  });

  it('should return ? for null', () => {
    expect(pipe.transform(null)).toBe('?');
  });
});
