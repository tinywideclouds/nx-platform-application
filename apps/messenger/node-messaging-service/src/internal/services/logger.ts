import pino from 'pino';

// Configuration optimized for Google Cloud Logging
const pinoConfig = {
  // Google Cloud Logging reads the 'message' field for the main log text.
  messageKey: 'message',
  // Google Cloud Logging uses 'severity' for log levels.
  formatters: {
    level(label) {
      // Map pino's log level labels to Google Cloud's Severity enum.
      // https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
      switch (label) {
        case 'trace':
          return { severity: 'DEBUG' };
        case 'debug':
          return { severity: 'DEBUG' };
        case 'info':
          return { severity: 'INFO' };
        case 'warn':
          return { severity: 'WARNING' };
        case 'error':
          return { severity: 'ERROR' };
        case 'fatal':
          return { severity: 'CRITICAL' };
        default:
          return { severity: 'DEFAULT' };
      }
    },
  },
};

export const logger = pino(pinoConfig);
