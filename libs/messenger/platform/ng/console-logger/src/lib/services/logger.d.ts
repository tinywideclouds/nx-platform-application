import { LogLevel, LoggerConfig } from '../logger.models';
import * as i0 from "@angular/core";
/**
 * An injectable logger service that wraps the browser console
 * and supports configurable log levels.
 */
export declare class Logger {
    private currentLevel;
    constructor(config: LoggerConfig | null);
    setLevel(level: LogLevel): void;
    private shouldLog;
    debug(message: string, ...optionalParams: unknown[]): void;
    info(message: string, ...optionalParams: unknown[]): void;
    warn(message: string, ...optionalParams: unknown[]): void;
    error(message: string, ...optionalParams: unknown[]): void;
    /**
     * Creates a new inline group in the console.
     * Gated by LogLevel.DEBUG to prevent production noise.
     */
    group(label: string): void;
    /**
     * Creates a new collapsed group in the console.
     * Ideal for tracing complex logic loops without cluttering the stream.
     * Gated by LogLevel.DEBUG.
     */
    groupCollapsed(label: string): void;
    /**
     * Exits the current inline group.
     * Gated by LogLevel.DEBUG.
     */
    groupEnd(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<Logger, [{ optional: true; }]>;
    static ɵprov: i0.ɵɵInjectableDeclaration<Logger>;
}
