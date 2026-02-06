import { Injectable, signal } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import {
  DirectoryQueryApi,
  DirectoryMutationApi,
  DirectoryManagementApi,
} from '@nx-platform-application/directory-api';
import {
  DirectoryGroup,
  DirectoryEntity,
  GroupMemberStatus,
} from '@nx-platform-application/directory-types';
import { MockServerDirectoryState } from '../types';

@Injectable({ providedIn: 'root' })
export class MockDirectoryService
  implements DirectoryQueryApi, DirectoryMutationApi, DirectoryManagementApi
{
  // --- IN-MEMORY DB ---
  private groups = new Map<string, DirectoryGroup>();
  private entities = new Map<string, DirectoryEntity>();

  // --- CONFIGURATION API ---
  loadScenario(config: MockServerDirectoryState) {
    console.log('[MockDirectory] 🔄 Configuring Directory:', config);
    this.groups.clear();
    this.entities.clear();

    if (config.groups) {
      config.groups.forEach((g) => this.groups.set(g.id.toString(), g));
    }
    if (config.entities) {
      config.entities.forEach((e) => this.entities.set(e.id.toString(), e));
    }
  }

  // --- QUERY API ---

  // ✅ MISSING METHOD 1
  async getEntities(ids: URN[]): Promise<DirectoryEntity[]> {
    return ids
      .map((id) => this.entities.get(id.toString()))
      .filter((e): e is DirectoryEntity => !!e);
  }

  // ✅ MISSING METHOD 2
  async getGroupMetadata(id: URN): Promise<{ memberCount: number }> {
    const group = this.groups.get(id.toString());
    // DirectoryGroup V9 has 'members' array (snapshot) or we count keys in memberState
    // Assuming memberState is the source of truth for counts:
    const count = group ? Object.keys(group.memberState).length : 0;
    return { memberCount: count };
  }

  async getGroup(id: URN): Promise<DirectoryGroup | undefined> {
    return this.groups.get(id.toString()) || undefined;
  }

  async getEntity(id: URN): Promise<DirectoryEntity | undefined> {
    return this.entities.get(id.toString()) || undefined;
  }

  // --- MUTATION API ---

  async saveGroup(group: DirectoryGroup): Promise<void> {
    console.log(`[MockDirectory] 💾 Saved Group ${group.id}`);
    this.groups.set(group.id.toString(), group);
  }

  async saveEntity(entity: DirectoryEntity): Promise<void> {
    console.log(`[MockDirectory] 💾 Saved Entity ${entity.id}`);
    this.entities.set(entity.id.toString(), entity);
  }

  // Just remove groups
  async clear(): Promise<void> {
    this.entities.clear();
    this.groups.clear();
    return;
  }

  async updateMemberStatus(
    groupUrn: URN,
    userUrn: URN,
    status: GroupMemberStatus,
  ): Promise<void> {
    const group = this.groups.get(groupUrn.toString());
    if (group) {
      console.log(
        `[MockDirectory] 📝 Update Status: ${userUrn} -> ${status} in ${groupUrn}`,
      );
      group.memberState[userUrn.toString()] = status;
    } else {
      console.warn(`[MockDirectory] ⚠️ Group not found: ${groupUrn}`);
    }
  }
}
