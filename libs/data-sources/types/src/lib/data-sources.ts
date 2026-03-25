import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

export interface FileAnalysis {
  totalSizeBytes: number;
  totalFiles: number;
  extensions: Record<string, number>;
  directories: string[];
}

export type SyncStatus = 'unsynced' | 'syncing' | 'ready' | 'failed';

export interface GithubIngestionTarget {
  id: URN;
  displayName: string;
  description?: string;
  status: SyncStatus;
  fileCount: number;
  lastSyncedAt: ISODateTimeString;

  repo: string;
  branch: string;
  commitSha?: string;
  syncedCommitSha?: string;

  analysis?: FileAnalysis;
  lakeAnalysis?: FileAnalysis;
}

export interface FileMetadata {
  path: string;
  sizeBytes: number;
  extension: string;
}

export interface SyncStreamEvent {
  stage: string;
  details: Record<string, any>;
}

export interface DataSource {
  id: URN;
  targetId: URN;
  name: string;
  description: string;
  rulesYaml: string;
  analysis?: FileAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface FilterRules {
  include: string[];
  exclude: string[];
}

export interface DataGroup {
  id: URN;
  name: string;
  description?: string;
  dataSourceIds: URN[];
  metadata?: Record<string, string>;
  createdAt?: ISODateTimeString;
  updatedAt?: ISODateTimeString;
}

// --- API Requests & Responses ---

export interface SyncRequest {
  ingestionRules: FilterRules;
}

export interface SyncResponse {
  targetId: URN;
  status: string;
  filesProcessed: number;
}

export interface DataSourceRequest {
  name: string;
  rulesYaml: string;
  description: string;
}

export interface DataGroupRequest {
  name: string;
  description?: string;
  dataSourceIds: URN[];
  metadata?: Record<string, string>;
}

// NEW: Aligned with CommitInfoPb
export interface CommitInfo {
  id: URN;
  commitSha: string;
}

// NEW: Represents the read-only response from the Rescan endpoint
export interface RemoteTrackingState {
  commitSha: string;
  analysis: FileAnalysis;
}
