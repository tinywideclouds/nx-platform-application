// libs/platform/ng/console-logger/src/lib/services/logger.ts

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

  constructor(@Optional() @Inject(LOGGER_CONFIG) config: LoggerConfig | null) {
    // Default to WARN if no config is provided via DI.
    this.currentLevel = config?.level ?? LogLevel.WARN;
  }

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
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

  // --- Grouping Methods (New) ---

  /**
   * Creates a new inline group in the console.
   * Gated by LogLevel.DEBUG to prevent production noise.
   */
  public group(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.group(label);
    }
  }

  /**
   * Creates a new collapsed group in the console.
   * Ideal for tracing complex logic loops without cluttering the stream.
   * Gated by LogLevel.DEBUG.
   */
  public groupCollapsed(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.groupCollapsed(label);
    }
  }

  /**
   * Exits the current inline group.
   * Gated by LogLevel.DEBUG.
   */
  public groupEnd(): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.groupEnd();
    }
  }
}
