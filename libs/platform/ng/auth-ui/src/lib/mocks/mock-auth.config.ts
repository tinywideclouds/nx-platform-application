import { InjectionToken } from '@angular/core';
import { User } from '@nx-platform-application/platform-types';

/**
 * An injection token used to provide a list of mock User
 * objects to the MockLoginComponent.
 */
export const MOCK_USERS_TOKEN = new InjectionToken<User[]>(
  'Mock users for login component'
);
