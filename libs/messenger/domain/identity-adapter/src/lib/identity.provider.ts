import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { IdentityResolver } from './interfaces/identity-resolver.interface';
import { ContactMessengerMapper } from './services/contact-messenger.mapper';

/**
 * Configures the Dependency Injection for the Messenger Identity system.
 * Usage: Add to your app.config.ts or main.ts providers array.
 */
export function provideMessengerIdentity(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: IdentityResolver, useClass: ContactMessengerMapper },
  ]);
}
