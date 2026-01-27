import { Injectable } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import { StorableContact } from '../records/contact.record';

@Injectable({ providedIn: 'root' })
export class ContactMapper {
  toDomain(c: StorableContact): Contact {
    return {
      id: URN.parse(c.id),
      alias: c.alias,
      firstName: c.firstName,
      surname: c.surname,
      email: c.email,
      emailAddresses: c.emailAddresses,
      phoneNumbers: c.phoneNumbers,

      // Service contacts live in Directory now.
      serviceContacts: {},

      lastModified: c.lastModified,
    };
  }

  toStorable(c: Contact): StorableContact {
    return {
      id: c.id.toString(),
      alias: c.alias,
      firstName: c.firstName,
      surname: c.surname,
      email: c.email || '',
      emailAddresses: c.emailAddresses,
      phoneNumbers: c.phoneNumbers,

      // Use Temporal for current time if missing
      lastModified:
        c.lastModified ||
        (Temporal.Now.instant().toString() as ISODateTimeString),
    };
  }
}
