import { TestBed } from '@angular/core/testing';
import { DefaultPaletteService } from './palette.service';
import { URN } from '@nx-platform-application/platform-types';
import { ScrollActor } from '@nx-platform-application/scrollspace-types'; // <-- Missing import added
import { describe, it, expect, beforeEach } from 'vitest';

describe('DefaultPaletteService', () => {
  let service: DefaultPaletteService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DefaultPaletteService] });
    service = TestBed.inject(DefaultPaletteService);
  });

  it('should return a neutral gray style for the self user', () => {
    // Strictly typed as ScrollActor
    const selfActor: ScrollActor = {
      id: URN.parse('urn:app:actor:1'),
      displayName: 'Me',
      isSelf: true,
    };
    const style = service.getBubbleStyle(selfActor);

    expect(style.backgroundColor).toBe('#e5e7eb');
  });

  it('should return consistent hashed colors for other actors', () => {
    // Strictly typed as ScrollActor
    const actorA: ScrollActor = {
      id: URN.parse('urn:app:actor:bob'),
      displayName: 'Bob',
      isSelf: false,
    };
    const actorB: ScrollActor = {
      id: URN.parse('urn:app:actor:alice'),
      displayName: 'Alice',
      isSelf: false,
    };

    const styleA1 = service.getBubbleStyle(actorA);
    const styleA2 = service.getBubbleStyle(actorA);
    const styleB = service.getBubbleStyle(actorB);

    expect(styleA1.backgroundColor).toEqual(styleA2.backgroundColor); // Consistent hash
    expect(styleA1.backgroundColor).not.toEqual(styleB.backgroundColor); // Different string = different color
  });
});
