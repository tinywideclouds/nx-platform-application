import { TestBed } from '@angular/core/testing';
import { ContactNamePipe } from './contact-name.pipe';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { URN } from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('ContactNamePipe', () => {
  let pipe: ContactNamePipe;
  let state: ContactsStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ContactNamePipe,
        MockProvider(ContactsStateService, {
          // Mock returning a Signal that returns 'Alice'
          resolveContactName: vi.fn().mockReturnValue(signal('Alice')),
        }),
      ],
    });
    pipe = TestBed.inject(ContactNamePipe);
    state = TestBed.inject(ContactsStateService);
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return the name resolved by the state service', () => {
    const urn = URN.parse('urn:contacts:user:123');
    const result = pipe.transform(urn);

    expect(state.resolveContactName).toHaveBeenCalledWith(urn);
    expect(result).toBe('Alice');
  });

  it('should handle string inputs by passing them to state', () => {
    const result = pipe.transform('some-id');
    expect(state.resolveContactName).toHaveBeenCalledWith('some-id');
    expect(result).toBe('Alice');
  });
});
