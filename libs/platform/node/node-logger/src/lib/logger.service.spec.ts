// src/lib/logger.service.spec.ts
import pino, { Logger } from 'pino';
import { pinoGcpConfig } from './logger.service'; // Import the config
import { PassThrough } from 'stream'; // Import a stream to write to

// Define the type for the log
interface TestLog {
  message?: string;
  msg?: string;
  severity?: string;
  level?: number;
  time?: number;
  pid?: number;
  hostname?: string;
}

let testLogger: Logger; // The logger instance for our tests
let outputStream: PassThrough; // The in-memory stream
let outputData: string; // The captured string data from the stream

/**
 * Parses the newline-delimited JSON output captured from the stream.
 * @returns The last logged JSON object.
 */
function getLastLog(): TestLog {
  if (!outputData) {
    return {};
  }
  // Pino writes newline-delimited JSON
  const lines = outputData.trim().split('\n');
  const lastLine = lines[lines.length - 1];
  try {
    return JSON.parse(lastLine) as TestLog;
  } catch (e) {
    console.error('Failed to parse log line:', lastLine, e);
    return {};
  }
}

describe('Pino Logger (Google Cloud Config)', () => {
  beforeEach(() => {
    // Reset captured data
    outputData = '';

    // 1. Create an in-memory stream
    outputStream = new PassThrough();

    // 2. Create a NEW logger instance using the imported config
    //    and pipe its output to our stream
    testLogger = pino(pinoGcpConfig, outputStream);

    // 3. Listen for data on the stream and capture it
    outputStream.on('data', (chunk) => {
      outputData += chunk.toString();
    });

    // 4. Set default level for tests
    testLogger.level = 'info';
  });

  afterEach(() => {
    // Clean up the stream
    outputStream.end();
  });

  it('should be a pino instance', () => {
    expect(testLogger).toBeDefined();
    expect(typeof testLogger.info).toBe('function');
  });

  it('should use "message" as the messageKey (not "msg")', () => {
    testLogger.info('hello world');
    const log = getLastLog();
    expect(log.message).toBe('hello world');
    expect(log.msg).toBeUndefined();
  });

  it('should format "info" level to { severity: "INFO" }', () => {
    testLogger.info('test info');
    const log = getLastLog();
    expect(log.severity).toBe('INFO');
    expect(log.level).toBeUndefined();
  });

  it('should format "warn" level to { severity: "WARNING" }', () => {
    testLogger.warn('test warn');
    const log = getLastLog();
    expect(log.severity).toBe('WARNING');
  });

  it('should format "error" level to { severity: "ERROR" }', () => {
    testLogger.error('test error');
    const log = getLastLog();
    expect(log.severity).toBe('ERROR');
  });

  it('should format "fatal" level to { severity: "CRITICAL" }', () => {
    testLogger.fatal('test fatal');
    const log = getLastLog();
    expect(log.severity).toBe('CRITICAL');
  });

  it('should format "debug" level to { severity: "DEBUG" }', () => {
    testLogger.level = 'debug';
    testLogger.debug('test debug');
    const log = getLastLog();
    expect(log.severity).toBe('DEBUG');
  });

  it('should format "trace" level to { severity: "DEBUG" }', () => {
    testLogger.level = 'trace';
    testLogger.trace('test trace');
    const log = getLastLog();
    expect(log.severity).toBe('DEBUG');
  });

  it('should not log debug messages if level is "info"', () => {
    testLogger.debug('you should not see this');
    expect(outputData).toBe('');
  });
});
