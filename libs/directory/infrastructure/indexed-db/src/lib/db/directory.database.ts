import { Injectable } from '@angular/core';
import { Dexie, Table } from 'dexie';
import {
  StorableDirectoryEntity,
  StorableGroup,
} from '../records/directory.record';

@Injectable({ providedIn: 'root' })
export class DirectoryDatabase extends Dexie {
  entities!: Table<StorableDirectoryEntity, string>;
  groups!: Table<StorableGroup, string>;

  constructor() {
    super('directory');

    this.version(1).stores({
      entities: 'urn, type',
      groups: 'urn, *memberUrns', // MultiEntry index for reverse lookups
    });
  }
}
