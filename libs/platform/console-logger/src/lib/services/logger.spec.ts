import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger';
//

// No imports from 'vitest' are needed when globals are enabled.

describe('LoggerService', () => {
  let service: LoggerService;

  // Correctly type the spies by inferring the return type
  // from the global 'vi.spyOn' function.
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh spies *before* each test
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {
      // Non-empty mock for linter
    });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Non-empty mock for linter
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Non-empty mock for linter
    });

    TestBed.configureTestingModule({
      providers: [LoggerService],
    });
    service = TestBed.inject(LoggerService);
  });

  afterEach(() => {
    // Restore all mocks *after* each test
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call console.info when info() is called', () => {
    const message = 'Test info message';
    const data = { id: 1 };
    service.info(message, data);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(message, data);
  });

  it('should call console.warn when warn() is called', () => {
    const message = 'Test warn message';
    service.warn(message);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(message);
  });

  it('should call console.error when error() is called', () => {
    const message = 'Test error message';
    const err = new Error('Test Error');
    service.error(message, err);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(message, err);
  });
});
