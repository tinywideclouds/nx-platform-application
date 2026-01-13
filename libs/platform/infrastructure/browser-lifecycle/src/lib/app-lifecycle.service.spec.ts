import { TestBed } from '@angular/core/testing';
import { AppLifecycleService } from './app-lifecycle.service';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { PLATFORM_ID } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('AppLifecycleService', () => {
  let service: AppLifecycleService;
  let mockDocument: Document;

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    mockDocument = document.implementation.createHTMLDocument();
    Object.defineProperty(mockDocument, 'visibilityState', {
      value: 'visible',
      writable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        AppLifecycleService,
        { provide: Logger, useValue: mockLogger },
        { provide: DOCUMENT, useValue: mockDocument },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(AppLifecycleService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should emit resumed$ when document becomes visible', () => {
    const spy = vi.fn();
    const sub = service.resumed$.subscribe(spy);

    // Simulate switching to visible
    Object.defineProperty(mockDocument, 'visibilityState', { value: 'visible' });
    mockDocument.dispatchEvent(new Event('visibilitychange'));

    expect(spy).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('visibility change'),
      'visible'
    );
    sub.unsubscribe();
  });

  it('should emit paused$ when document becomes hidden', () => {
    const spy = vi.fn();
    const sub = service.paused$.subscribe(spy);

    // Simulate switching to hidden
    Object.defineProperty(mockDocument, 'visibilityState', { value: 'hidden' });
    mockDocument.dispatchEvent(new Event('visibilitychange'));

    expect(spy).toHaveBeenCalled();
    sub.unsubscribe();
  });
});