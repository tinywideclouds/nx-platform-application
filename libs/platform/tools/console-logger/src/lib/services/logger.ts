import { Injectable, Inject, Optional } from '@angular/core';
import { LogLevel, LOGGER_CONFIG, LoggerConfig } from '../logger.models';

/**
 * An injectable logger service that wraps the browser console
 * and supports configurable log levels.
 */
@Injectable({
  providedIn: 'root',
})
export class Logger {
  private currentLevel: LogLevel;
  // ✅ NEW: Internal state for narrative logging
  private prefix = '';

  constructor(@Optional() @Inject(LOGGER_CONFIG) config: LoggerConfig | null) {
    // Default to WARN if no config is provided via DI.
    this.currentLevel = config?.level ?? LogLevel.WARN;
  }

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * ✅ NEW: Factory method for "Child Loggers"
   * Returns a NEW instance that inherits the current log level
   * but prepends the specific string to all messages.
   *
   * Example: logger.withPrefix('[Mock:Router]')
   */
  public withPrefix(prefix: string): Logger {
    // We manually instantiate so we don't need to mess with DI
    const childLogger = new Logger({ level: this.currentLevel });
    // Add a space for readability: "[Prefix] Message"
    childLogger.prefix = `${prefix} `;
    return childLogger;
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.currentLevel === LogLevel.OFF) {
      return false;
    }
    return level >= this.currentLevel;
  }

  // --- Logging Methods ---

  public debug(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.format(message), ...optionalParams);
    }
  }

  public info(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.format(message), ...optionalParams);
    }
  }

  public warn(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.format(message), ...optionalParams);
    }
  }

  public error(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.format(message), ...optionalParams);
    }
  }

  // --- Grouping Methods ---

  public group(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.group(this.format(label));
    }
  }

  public groupCollapsed(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.groupCollapsed(this.format(label));
    }
  }

  public groupEnd(): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.groupEnd();
    }
  }

  // ✅ NEW: Helper to safely apply prefix
  private format(message: string): string {
    return this.prefix ? `${this.prefix}${message}` : message;
  }
}
