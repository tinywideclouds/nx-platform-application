import { Injectable } from '@angular/core';

/**
 * A simple, injectable logger service that wraps the browser console.
 * This provides a consistent logging interface for Angular applications
 * and can be easily mocked in tests.
 */
@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  public info(message: string, ...optionalParams: unknown[]): void {
    console.info(message, ...optionalParams);
  }

  public warn(message: string, ...optionalParams: unknown[]): void {
    console.warn(message, ...optionalParams);
  }

  public error(message: string, ...optionalParams: unknown[]): void {
    console.error(message, ...optionalParams);
  }
}
