// src/lib/logger.service.ts
import pino from 'pino';

// Configuration optimized for Google Cloud Logging
// RENAME and EXPORT this config
export const pinoGcpConfig = {
  // Google Cloud Logging reads the 'message' field for the main log text.
  messageKey: 'message',
  // Google Cloud Logging uses 'severity' for log levels.
  formatters: {
    level(label: string) {
      // ... (formatter code)
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

// Your default logger still works as before
export const logger = pino(pinoGcpConfig);
