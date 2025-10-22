import { TestBed } from '@angular/core/testing';
import { Logger, LOG_LEVEL, LogLevel } from './logger.service';
import { Provider } from '@angular/core';
// (No imports from 'vitest' needed due to globals)

/**
 * Zoneless test setup helper.
 * Configures TestBed with optional providers and uses
 * `runInInjectionContext` to get the service instance.
 */
function setup(levelProvider?: Provider): Logger {
  const providers: Provider[] = [Logger]; // The service is always needed
  if (levelProvider) {
    providers.push(levelProvider);
  }

  TestBed.configureTestingModule({ providers });

  let service: Logger;
  TestBed.runInInjectionContext(() => {
    service = TestBed.inject(Logger);
  });
  return service!;
}

// Spies on all console methods using Vitest globals
const consoleSpies = {
  debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
  info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};

describe('LoggerService (Zoneless Tests with Vitest)', () => {
  // Reset all spies after each test
  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule(); // <-- ADD THIS LINE
  });

  it('should default to LogLevel.INFO if no level is provided', () => {
    // Arrange: Setup service without any provider
    const service = setup();

    // Act
    service.debug('test debug');
    service.info('test info');
    service.warn('test warn');
    service.error('test error');

    // Assert: Debug should be skipped, others should log
    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.info).toHaveBeenCalledWith(
      '[INFO] test info'
    );
    expect(consoleSpies.warn).toHaveBeenCalledWith(
      '[WARN] test warn'
    );
    expect(consoleSpies.error).toHaveBeenCalledWith(
      '[ERROR] test error'
    );
  });

  it('should log DEBUG and INFO when LogLevel.DEBUG is provided', () => {
    // Arrange: Provide DEBUG level
    const provider = { provide: LOG_LEVEL, useValue: LogLevel.DEBUG };
    const service = setup(provider);

    // Act
    service.debug('test debug');
    service.info('test info');

    // Assert: Both debug and info messages are logged
    expect(consoleSpies.debug).toHaveBeenCalledWith(
      '[DEBUG] test debug'
    );
    expect(consoleSpies.info).toHaveBeenCalledWith(
      '[INFO] test info'
    );
  });

  it('should log INFO but NOT DEBUG when LogLevel.INFO is provided', () => {
    // Arrange: Provide INFO level
    const provider = { provide: LOG_LEVEL, useValue: LogLevel.INFO };
    const service = setup(provider);

    // Act
    service.debug('test debug');
    service.info('test info');

    // Assert: Debug is not logged, Info is logged
    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.info).toHaveBeenCalledWith(
      '[INFO] test info'
    );
  });

  it('should log ONLY ERROR when LogLevel.ERROR is provided', () => {
    // Arrange: Provide ERROR level
    const provider = { provide: LOG_LEVEL, useValue: LogLevel.ERROR };
    const service = setup(provider);

    // Act
    service.debug('test debug');
    service.info('test info');
    service.warn('test warn');
    service.error('test error');

    // Assert: Only error messages are logged
    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    expect(consoleSpies.error).toHaveBeenCalledWith(
      '[ERROR] test error'
    );
  });

  it('should log NOTHING when LogLevel.OFF is provided', () => {
    // Arrange: Provide OFF level
    const provider = { provide: LOG_LEVEL, useValue: LogLevel.OFF };
    const service = setup(provider);

    // Act
    service.debug('test debug');
    service.info('test info');
    service.warn('test warn');
    service.error('test error');

    // Assert: Nothing is logged
    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    expect(consoleSpies.error).not.toHaveBeenCalled();
  });
});
