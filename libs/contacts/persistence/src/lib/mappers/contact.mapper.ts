import { Injectable } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  Contact,
  ServiceContact,
  PendingIdentity,
  BlockedIdentity,
} from '@nx-platform-application/contacts-types';
import {
  StorableContact,
  StorableServiceContact,
  StorablePendingIdentity,
  StorableBlockedIdentity,
} from '../records/contact.record';

@Injectable({ providedIn: 'root' })
export class ContactMapper {
  toDomain(c: StorableContact): Contact {
    const serviceContacts: Record<string, ServiceContact> = {};
    for (const [key, s] of Object.entries(c.serviceContacts || {})) {
      if (s && s.id) {
        serviceContacts[key] = { ...s, id: URN.parse(s.id) };
      }
    }
    return {
      ...c,
      id: URN.parse(c.id),
      serviceContacts,
      lastModified: c.lastModified,
    };
  }

  toStorable(c: Contact): StorableContact {
    const serviceContacts: Record<string, StorableServiceContact> = {};
    for (const [key, s] of Object.entries(c.serviceContacts || {})) {
      if (s) {
        serviceContacts[key] = { ...s, id: s.id.toString() };
      }
    }
    return {
      ...c,
      id: c.id.toString(),
      serviceContacts,
      lastModified: c.lastModified,
    };
  }

  toPendingDomain(p: StorablePendingIdentity): PendingIdentity {
    return {
      ...p,
      urn: URN.parse(p.urn),
      vouchedBy: p.vouchedBy ? URN.parse(p.vouchedBy) : undefined,
    };
  }

  toBlockedDomain(b: StorableBlockedIdentity): BlockedIdentity {
    return {
      ...b,
      urn: URN.parse(b.urn),
    };
  }
}
