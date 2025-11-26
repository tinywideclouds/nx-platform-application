import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Logger } from '@nx-platform-application/console-logger';

@Injectable({ providedIn: 'root' })
export class ContactMessengerMapper {
  private logger = inject(Logger);
  private contactsService = inject(ContactsStorageService);

  /**
   * Forward Resolution (UI -> Network)
   * Converts a local Contact URN into a routable Handle URN.
   */
  async resolveToHandle(urn: URN): Promise<URN> {
    // 1. Passthrough if already a Handle (lookup or auth)
    if (this.isHandle(urn)) {
      return urn;
    }

    // 2. Identity Links (Handshake)
    const links = await this.contactsService.getLinkedIdentities(urn);
    if (links.length > 0) {
      return links[0];
    }

    // 3. Email Discovery (Opportunistic)
    const contact = await this.contactsService.getContact(urn);
    const email = contact?.email || contact?.emailAddresses?.[0];

    if (email) {
      // URN.create(entityType, entityId, namespace?)
      // Creates: urn:lookup:email:bob@gmail.com
      return URN.create('email', email, 'lookup');
    }

    // 4. Fallback
    this.logger.warn(`Mapper: Could not resolve Contact ${urn} to a Handle.`);
    return urn;
  }

  /**
   * Reverse Resolution (Network -> UI)
   * Maps an incoming Sender Handle to a local Contact URN if one exists.
   */
  async resolveToContact(handle: URN): Promise<URN> {
    // 1. Email Lookup: urn:lookup:email:bob@...
    // Correctly accessing the 'namespace' and 'entityType' properties
    if (handle.namespace === 'lookup' && handle.entityType === 'email') {
      const email = handle.entityId; 
      if (email) {
        const contact = await this.contactsService.findByEmail(email);
        if (contact) return contact.id;
      }
    }

    // 2. Auth Lookup: urn:auth:google:123
    if (handle.namespace === 'auth') {
      const contact = await this.contactsService.findContactByAuthUrn(handle);
      if (contact) return contact.id;
    }

    // 3. Fallback (Stranger)
    return handle;
  }

  /**
   * Storage Identity Strategy
   * Determines the Canonical ID to use for local history.
   */
  async getStorageUrn(urn: URN): Promise<URN> {
    // If it's already a Contact URN, trust it.
    if (urn.entityType === 'user' && urn.namespace === 'sm') {
      return urn;
    }

    // If it's a Handle, try to map it to a Contact.
    return this.resolveToContact(urn);
  }

  private isHandle(urn: URN): boolean {
    return urn.namespace === 'lookup' || urn.namespace === 'auth';
  }
}