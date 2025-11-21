import { InjectionToken } from '@angular/core';

/**
 * Injection token for the WebSocket URL.
 * Used to provide the base API URL for the Chat Live Data Service.
 */
export const WSS_URL_TOKEN = new InjectionToken<string>('WebSocket URL');