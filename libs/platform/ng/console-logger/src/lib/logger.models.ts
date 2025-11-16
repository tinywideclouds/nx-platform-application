// src/lib/logger.models.ts
import { InjectionToken } from '@angular/core';

/**
 * Defines the available log levels, ordered by severity.
 * Lower numbers are more verbose.
 */
export enum LogLevel {
  DEBUG, // 0
  INFO,  // 1
  WARN,  // 2
  ERROR, // 3
  OFF    // 4
}

/**
 * Configuration object for the Logger service.
 */
export interface LoggerConfig {
  level: LogLevel;
}

/**
 * Injection token used to provide the LoggerConfig.
 * This allows you to configure the default log level for your application.
 */
export const LOGGER_CONFIG = new InjectionToken<LoggerConfig>('logger.config');