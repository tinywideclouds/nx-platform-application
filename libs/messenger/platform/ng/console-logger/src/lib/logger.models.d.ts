import { InjectionToken } from '@angular/core';
/**
 * Defines the available log levels, ordered by severity.
 * Lower numbers are more verbose.
 */
export declare enum LogLevel {
    DEBUG = 0,// 0
    INFO = 1,// 1
    WARN = 2,// 2
    ERROR = 3,// 3
    OFF = 4
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
export declare const LOGGER_CONFIG: InjectionToken<LoggerConfig>;
