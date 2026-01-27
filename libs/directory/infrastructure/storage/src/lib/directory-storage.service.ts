import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  DirectoryEntity,
  DirectoryGroup,
  GroupMemberStatus,
} from '@nx-platform-application/directory-types';
import {
  DirectoryDatabase,
  DirectoryEntityMapper,
  DirectoryGroupMapper,
} from '@nx-platform-application/directory-infrastructure-indexed-db';

@Injectable({ providedIn: 'root' })
export class DirectoryStorageService {
  private db = inject(DirectoryDatabase);
  private entityMapper = inject(DirectoryEntityMapper);
  private groupMapper = inject(DirectoryGroupMapper);

  // --- GOD MODE (Seeding) ---

  async clearDatabase(): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.entities,
      this.db.groups,
      async () => {
        await this.db.entities.clear();
        await this.db.groups.clear();
      },
    );
  }

  async bulkUpsert(entities: DirectoryEntity[]): Promise<void> {
    const records = entities.map((e) => this.entityMapper.toStorable(e));
    await this.db.entities.bulkPut(records);
  }

  // --- ENTITIES ---

  async saveEntity(entity: DirectoryEntity): Promise<void> {
    const record = this.entityMapper.toStorable(entity);
    await this.db.entities.put(record);
  }

  async getEntity(urn: URN): Promise<DirectoryEntity | undefined> {
    const record = await this.db.entities.get(urn.toString());
    return record ? this.entityMapper.toDomain(record) : undefined;
  }

  async getEntities(urns: URN[]): Promise<DirectoryEntity[]> {
    const records = await this.db.entities.bulkGet(
      urns.map((u) => u.toString()),
    );
    return records
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => this.entityMapper.toDomain(r));
  }

  // --- GROUPS ---

  async saveGroup(group: DirectoryGroup): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.entities,
      this.db.groups,
      async () => {
        // 1. Upsert Member Entities (Required for hydration)
        if (group.members.length > 0) {
          const entityRecords = group.members.map((m) =>
            this.entityMapper.toStorable(m),
          );
          await this.db.entities.bulkPut(entityRecords);
        }

        // 2. Upsert Group Record
        const groupRecord = this.groupMapper.toStorable(group);
        await this.db.groups.put(groupRecord);
      },
    );
  }

  async getGroup(urn: URN): Promise<DirectoryGroup | undefined> {
    const record = await this.db.groups.get(urn.toString());
    if (!record) return undefined;

    // Hydrate Members
    const memberRecords = await this.db.entities.bulkGet(record.memberUrns);
    const validMembers = memberRecords
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => this.entityMapper.toDomain(r));

    return this.groupMapper.toDomain(record, validMembers);
  }

  /**
   * ✅ OPTIMIZED: Metadata Query
   * Returns basic stats without hydrating the entities.
   */
  async getGroupMetadata(urn: URN): Promise<{ memberCount: number }> {
    const record = await this.db.groups.get(urn.toString());
    return { memberCount: record ? record.memberUrns.length : 0 };
  }

  async updateMemberStatus(
    groupUrn: URN,
    memberUrn: URN,
    status: GroupMemberStatus,
    lastUpdated: string,
  ): Promise<void> {
    await this.db.transaction('rw', this.db.groups, async () => {
      const group = await this.db.groups.get(groupUrn.toString());
      if (group) {
        group.memberState[memberUrn.toString()] = status;
        group.lastUpdated = lastUpdated;
        await this.db.groups.put(group);
      }
    });
  }
}
