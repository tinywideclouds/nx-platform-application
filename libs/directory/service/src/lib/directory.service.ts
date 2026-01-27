import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';
import { URN } from '@nx-platform-application/platform-types';
import {
  DirectoryEntity,
  DirectoryGroup,
  GroupMemberStatus,
} from '@nx-platform-application/directory-types';
import {
  DirectoryQueryApi,
  DirectoryMutationApi,
} from '@nx-platform-application/directory-api';
// ✅ Import from Storage Lib
import { DirectoryStorageService } from '@nx-platform-application/directory-infrastructure-storage';

@Injectable({ providedIn: 'root' })
export class DirectoryService
  implements DirectoryQueryApi, DirectoryMutationApi
{
  private storage = inject(DirectoryStorageService);

  // --- QUERY API ---

  async getEntity(urn: URN): Promise<DirectoryEntity | undefined> {
    return this.storage.getEntity(urn);
  }

  async getEntities(urns: URN[]): Promise<DirectoryEntity[]> {
    return this.storage.getEntities(urns);
  }

  async getGroup(urn: URN): Promise<DirectoryGroup | undefined> {
    return this.storage.getGroup(urn);
  }

  async getGroupMetadata(urn: URN): Promise<{ memberCount: number }> {
    return this.storage.getGroupMetadata(urn);
  }

  // --- MUTATION API ---

  async saveEntity(entity: DirectoryEntity): Promise<void> {
    await this.storage.saveEntity(entity);
  }

  async saveGroup(group: DirectoryGroup): Promise<void> {
    await this.storage.saveGroup(group);
  }

  async updateMemberStatus(
    groupUrn: URN,
    memberUrn: URN,
    status: GroupMemberStatus,
  ): Promise<void> {
    const now = Temporal.Now.instant().toString();
    await this.storage.updateMemberStatus(groupUrn, memberUrn, status, now);
  }
}
