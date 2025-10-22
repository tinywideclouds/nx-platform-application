import { Injectable, InjectionToken, inject, isDevMode } from '@angular/core';

/**
 * Enum defining the available log levels.
 * The numeric values are important for comparison.
 */
export enum LogLevel {
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  OFF = 5,
}

/**
 * Injection token to provide the desired log level for the application.
 */
export const LOG_LEVEL = new InjectionToken<LogLevel>('APP_LOG_LEVEL');

/**
 * A centralized, environment-aware logging service.
 *
 * It checks the provided log level before writing to the console.
 * This service is designed to be zoneless and tree-shakable.
 */
@Injectable({
  providedIn: 'root',
})
export class Logger {
  // Inject the provided log level, defaulting to INFO if not found [cite: 23]
  private readonly level = inject(LOG_LEVEL, { optional: true }) ?? LogLevel.INFO;

  // Cache isDevMode() for performance
  private readonly isDev = isDevMode();

  /**
   * Logs a 'debug' message.
   * Only logs if the configured level is DEBUG.
   */
  public debug(message: string, ...optionalParams: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...optionalParams);
    }
  }

  /**
   * Logs an 'info' message.
   * Only logs if the configured level is INFO or lower.
   */
  public info(message: string, ...optionalParams: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...optionalParams);
    }
  }

  /**
   * Logs a 'warn' message.
   * Only logs if the configured level is WARN or lower.
   */
  public warn(message: string, ...optionalParams: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...optionalParams);
    }
  }

  /**
   * Logs an 'error' message.
   * Only logs if the configured level is ERROR or lower (i.e., not OFF).
   */
  public error(message: string, error?: Error, ...optionalParams: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      // Include the stack trace if it's an error object and in dev mode
      if (error && this.isDev) {
        console.error(`[ERROR] ${message}`, error, ...optionalParams);
      } else {
        console.error(`[ERROR] ${message}`, ...optionalParams);
      }
    }
  }
}
