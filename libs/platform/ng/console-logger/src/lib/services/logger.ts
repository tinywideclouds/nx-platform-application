// src/lib/services/logger.ts
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

  constructor(
    @Optional() @Inject(LOGGER_CONFIG) config: LoggerConfig | null
  ) {
    // Default to WARN if no config is provided via DI.
    // This is a sensible default for production environments.
    this.currentLevel = config?.level ?? LogLevel.WARN;
  }

  /**
   * Sets the active log level for the service instance.
   * @param level The new LogLevel to use.
   */
  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Checks if the service should log at the given level
   * based on the current configured level.
   */
  private shouldLog(level: LogLevel): boolean {
    // 1. Don't log if the global level is OFF
    if (this.currentLevel === LogLevel.OFF) {
      return false;
    }

    // 2. Log if the message's level is >= the global level
    // e.g., If currentLevel = WARN (2):
    // - DEBUG (0) >= 2? False.
    // - INFO (1) >= 2? False.
    // - WARN (2) >= 2? True.
    // - ERROR (3) >= 2? True.
    return level >= this.currentLevel;
  }

  // --- Logging Methods ---

  public debug(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(message, ...optionalParams);
    }
  }

  public info(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(message, ...optionalParams);
    }
  }

  public warn(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(message, ...optionalParams);
    }
  }

  public error(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(message, ...optionalParams);
    }
  }
}