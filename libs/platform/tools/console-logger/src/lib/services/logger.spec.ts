// libs/platform/ng/console-logger/src/lib/services/logger.spec.ts

import { TestBed } from '@angular/core/testing';
import { Logger } from './logger';
import { LOGGER_CONFIG, LogLevel } from '../logger.models';
import { vi } from 'vitest';

describe('Logger', () => {
  let service: Logger;

  // Spies
  let debugSpy: any;
  let infoSpy: any;
  let warnSpy: any;
  let errorSpy: any;
  let groupSpy: any;
  let groupCollapsedSpy: any;
  let groupEndSpy: any;

  function setupSpies() {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    groupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    groupCollapsedSpy = vi
      .spyOn(console, 'groupCollapsed')
      .mockImplementation(() => {});
    groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Grouping Logic (DEBUG Level)', () => {
    beforeEach(() => {
      setupSpies();
      TestBed.configureTestingModule({
        providers: [
          Logger,
          {
            provide: LOGGER_CONFIG,
            useValue: { level: LogLevel.DEBUG }, // Enabled
          },
        ],
      });
      service = TestBed.inject(Logger);
    });

    it('should call console.group', () => {
      service.group('Test Group');
      expect(groupSpy).toHaveBeenCalledWith('Test Group');
    });

    it('should call console.groupCollapsed', () => {
      service.groupCollapsed('Hidden Group');
      expect(groupCollapsedSpy).toHaveBeenCalledWith('Hidden Group');
    });

    it('should call console.groupEnd', () => {
      service.groupEnd();
      expect(groupEndSpy).toHaveBeenCalled();
    });
  });

  describe('Prefix Logic', () => {
    beforeEach(() => {
      setupSpies();
      TestBed.configureTestingModule({
        providers: [
          Logger,
          {
            provide: LOGGER_CONFIG,
            useValue: { level: LogLevel.DEBUG },
          },
        ],
      });
      service = TestBed.inject(Logger);
    });

    it('should create a child logger that inherits the parent log level', () => {
      const child = service.withPrefix('[Child]');
      // Verify behavior by logging
      child.debug('should be visible');
      expect(debugSpy).toHaveBeenCalledWith('[Child] should be visible');
    });

    it('should format messages with the prefix', () => {
      const child = service.withPrefix('[Mock:Driver]');
      child.info('Scenario loaded');
      expect(infoSpy).toHaveBeenCalledWith('[Mock:Driver] Scenario loaded');
    });

    it('should not affect the parent logger', () => {
      const child = service.withPrefix('[Child]');
      child.warn('Child Warning');
      service.warn('Parent Warning');

      expect(warnSpy).toHaveBeenCalledWith('[Child] Child Warning');
      expect(warnSpy).toHaveBeenCalledWith('Parent Warning');
    });

    it('should support nested prefixes if chained manually (optional behavior check)', () => {
      const parent = service.withPrefix('[Parent]');
      const child = parent.withPrefix('[Child]');

      child.info('Nested');
      // Our implementation appends the new prefix to a fresh logger,
      // but does NOT stack them recursively in the current simple implementation.
      // It just sets the new prefix.
      expect(infoSpy).toHaveBeenCalledWith('[Child] Nested');
    });
  });

  describe('Grouping Logic (WARN Level - Suppressed)', () => {
    beforeEach(() => {
      setupSpies();
      TestBed.configureTestingModule({
        providers: [Logger], // Default is WARN
      });
      service = TestBed.inject(Logger);
    });

    it('should NOT call console grouping methods', () => {
      service.group('Test');
      service.groupCollapsed('Test');
      service.groupEnd();

      expect(groupSpy).not.toHaveBeenCalled();
      expect(groupCollapsedSpy).not.toHaveBeenCalled();
      expect(groupEndSpy).not.toHaveBeenCalled();
    });
  });
});
