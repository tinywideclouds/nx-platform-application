// src/lib/services/logger.spec.ts
import { TestBed } from '@angular/core/testing';
import { Logger } from './logger';
import { LOGGER_CONFIG, LogLevel } from '../logger.models'; // <-- Import models

describe('Logger', () => {
  let service: Logger;

  // Store all spies
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  // Helper to create fresh spies
  function setupSpies() {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  }

  afterEach(() => {
    // Restore all mocks after each test
    vi.restoreAllMocks();
  });

  // --- Test group for default level (WARN) ---
  describe('with default level (WARN)', () => {
    beforeEach(() => {
      setupSpies();
      TestBed.configureTestingModule({
        providers: [Logger], // No config provided, should use default
      });
      service = TestBed.inject(Logger);
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should NOT call console.debug', () => {
      service.debug('Test debug');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should NOT call console.info', () => {
      service.info('Test info');
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('should call console.warn', () => {
      service.warn('Test warn');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('Test warn');
    });

    it('should call console.error', () => {
      const err = new Error('Test Error');
      service.error('Test error', err);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('Test error', err);
    });
  });

  // --- Test group for configured level (DEBUG) ---
  describe('with configured level (DEBUG)', () => {
    beforeEach(() => {
      setupSpies();
      TestBed.configureTestingModule({
        providers: [
          Logger,
          {
            provide: LOGGER_CONFIG,
            useValue: { level: LogLevel.DEBUG }, // Provide DEBUG level
          },
        ],
      });
      service = TestBed.inject(Logger);
    });

    it('should call console.debug', () => {
      service.debug('Test debug', { id: 1 });
      expect(debugSpy).toHaveBeenCalledWith('Test debug', { id: 1 });
    });

    it('should call console.info', () => {
      service.info('Test info', { id: 2 });
      expect(infoSpy).toHaveBeenCalledWith('Test info', { id: 2 });
    });
  });

  // --- Test group for setLevel() functionality ---
  describe('setLevel()', () => {
    beforeEach(() => {
      setupSpies();
      TestBed.configureTestingModule({
        providers: [Logger], // Default level is WARN
      });
      service = TestBed.inject(Logger);
    });

    it('should change log level dynamically', () => {
      service.info('Test 1');
      expect(infoSpy).not.toHaveBeenCalled(); // Default level is WARN

      // Change level to INFO
      service.setLevel(LogLevel.INFO);
      service.info('Test 2');
      expect(infoSpy).toHaveBeenCalledWith('Test 2'); // Now it logs

      // Change level to OFF
      service.setLevel(LogLevel.OFF);
      service.error('Test 3');
      expect(errorSpy).not.toHaveBeenCalled(); // Even errors are suppressed
    });
  });
});