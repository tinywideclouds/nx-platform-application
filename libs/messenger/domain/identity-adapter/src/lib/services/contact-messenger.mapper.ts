import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { ContactsStorageService } from '@nx-platform-application/contacts-infrastructure-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { IdentityResolver } from '../interfaces/identity-resolver.interface';

@Injectable()
export class ContactMessengerMapper implements IdentityResolver {
  private logger = inject(Logger);
  private contactsService = inject(ContactsStorageService);
  private authService = inject(IAuthService);

  async resolveToHandle(urn: URN): Promise<URN> {
    // 1. Self-Resolution (Auth Identity -> Public Email Handle)
    const currentUser = this.authService.currentUser();
    if (currentUser && urn.equals(currentUser.id)) {
      if (currentUser.email) {
        return URN.create('email', currentUser.email, 'lookup');
      }
      this.logger.warn('Mapper: Current user has no email to use as a handle.');
    }

    // 2. Passthrough if already a Handle
    if (this.isHandle(urn)) {
      return urn;
    }

    // 3. Identity Links (Handshake)
    const links = await this.contactsService.getLinkedIdentities(urn);
    if (links.length > 0) {
      return links[0];
    }

    // 4. Email Discovery (Opportunistic)
    const contact = await this.contactsService.getContact(urn);
    const email = contact?.email || contact?.emailAddresses?.[0];

    if (email) {
      return URN.create('email', email, 'lookup');
    }

    // 5. Fallback
    this.logger.warn(`Mapper: Could not resolve Contact ${urn} to a Handle.`);
    return urn;
  }

  async resolveToContact(handle: URN): Promise<URN> {
    // 1. Email Lookup
    if (handle.namespace === 'lookup' && handle.entityType === 'email') {
      const email = handle.entityId;
      if (email) {
        const contact = await this.contactsService.findByEmail(email);
        if (contact) return contact.id;
      }
    }

    // 2. Auth/Identity Lookup
    // TODO ### recheck this logic later
    // if (handle.namespace === 'auth') {
    //   const contact = await this.contactsService.findContactByAuthUrn(handle);
    //   if (contact) return contact.id;
    // }
    if (handle.namespace === 'auth' || handle.namespace === 'identity') {
      const contact = await this.contactsService.findContactByAuthUrn(handle);
      if (contact) return contact.id;
    }

    // 3. Fallback (Stranger)
    return handle;
  }

  async getStorageUrn(urn: URN): Promise<URN> {
    if (!this.isHandle(urn)) {
      return urn;
    }
    return this.resolveToContact(urn);
  }

  private isHandle(urn: URN): boolean {
    return urn.namespace === 'lookup' || urn.namespace === 'auth';
  }
}
