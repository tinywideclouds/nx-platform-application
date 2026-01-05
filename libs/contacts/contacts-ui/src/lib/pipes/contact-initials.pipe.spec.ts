import { TestBed } from '@angular/core/testing';
import { ContactInitialsPipe } from './contact-initials.pipe';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { URN } from '@nx-platform-application/platform-types';
import { MockProvider } from 'ng-mocks';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('ContactInitialsPipe', () => {
  let pipe: ContactInitialsPipe;
  let state: ContactsStateService;

  // We need a writable signal to change the return value between tests
  const mockContactSignal = signal<any>(undefined);

  beforeEach(() => {
    mockContactSignal.set(undefined); // Reset state

    TestBed.configureTestingModule({
      providers: [
        ContactInitialsPipe,
        MockProvider(ContactsStateService, {
          resolveContact: vi.fn().mockReturnValue(mockContactSignal),
        }),
      ],
    });
    pipe = TestBed.inject(ContactInitialsPipe);
    state = TestBed.inject(ContactsStateService);
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return "?" for null or undefined input', () => {
    expect(pipe.transform(null)).toBe('?');
    expect(pipe.transform(undefined)).toBe('?');
  });

  // --- Scenario 1: Known Contact (Has Name) ---
  it('should derive initials from First/Last name if contact exists', () => {
    mockContactSignal.set({ firstName: 'Alice', surname: 'Wonderland' });
    const urn = URN.parse('urn:contacts:user:alice');

    expect(pipe.transform(urn)).toBe('AW');
  });

  // --- Scenario 2: Known Contact (No Name, Has Alias) ---
  it('should derive initials from Alias if Name is missing', () => {
    mockContactSignal.set({ firstName: '', surname: '', alias: 'Rabbit' });
    const urn = URN.parse('urn:contacts:user:rabbit');

    expect(pipe.transform(urn)).toBe('RA');
  });

  // --- Scenario 3: Unknown Contact (Fallback to URN) ---
  it('should parse initials from URN string if contact is unknown', () => {
    mockContactSignal.set(undefined); // Simulate unknown user
    const urn = URN.parse('urn:contacts:user:bob-smith');

    expect(pipe.transform(urn)).toBe('BS');
  });

  it('should handle single-word URN IDs for unknown contacts', () => {
    mockContactSignal.set(undefined);
    const urn = URN.parse('urn:contacts:user:alice');

    // Fallback logic takes first 2 chars of ID "alice" -> "AL"
    expect(pipe.transform(urn)).toBe('AL');
  });
});
