import {
  create,
  fromJson,
  toJsonString,
  fromJsonString,
} from '@bufbuild/protobuf';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  CreateGithubIngestionTargetRequestPbSchema,
  GithubIngestionTargetPbSchema,
  GithubIngestionTargetPb,
  SyncRequestPbSchema,
  DataSourceRequestPbSchema,
  SyncResponsePbSchema,
  FileMetadataPbSchema,
  FileMetadataPb,
  DataSourcePbSchema,
  DataSourcePb,
  DataGroupPb,
  DataGroupPbSchema,
  DataGroupRequestPbSchema,
  CommitInfoPbSchema,
} from '@nx-platform-application/data-sources-protos/types/v1/data-source_pb';
import {
  GithubIngestionTarget,
  SyncResponse,
  FileMetadata,
  DataSource,
  DataSourceRequest,
  FilterRules,
  DataGroup,
  DataGroupRequest,
  SyncStatus,
  RemoteTrackingState,
} from '../lib/data-sources';

// --- SERIALIZERS ---

export function serializeCreateGithubIngestionTargetRequest(
  repo: string,
  branch: string,
): string {
  const proto = create(CreateGithubIngestionTargetRequestPbSchema, {
    repo,
    branch,
  });
  return toJsonString(CreateGithubIngestionTargetRequestPbSchema, proto);
}

export function serializeSyncRequest(rules: FilterRules): string {
  const proto = create(SyncRequestPbSchema, {
    ingestionRules: { include: rules.include, exclude: rules.exclude },
  });
  return toJsonString(SyncRequestPbSchema, proto);
}

export function serializeDataSourceRequest(req: DataSourceRequest): string {
  const proto = create(DataSourceRequestPbSchema, {
    name: req.name,
    rulesYaml: req.rulesYaml,
    description: req.description,
  });
  return toJsonString(DataSourceRequestPbSchema, proto);
}

export function serializeDataGroupRequest(req: DataGroupRequest): string {
  const proto = create(DataGroupRequestPbSchema, {
    name: req.name,
    description: req.description,
    dataSourceIds: req.dataSourceIds.map((id) => id.toString()),
    metadata: req.metadata || {},
  });
  return toJsonString(DataGroupRequestPbSchema, proto);
}

export function serializeCommitInfoRequest(id: URN, commitSha: string): string {
  const proto = create(CommitInfoPbSchema, {
    id: id.toString(),
    commitSha: commitSha,
  });
  return toJsonString(CommitInfoPbSchema, proto);
}

// --- INTERNAL PROTO MAPPERS ---

function mapFileMetadataFromProto(pb: FileMetadataPb): FileMetadata {
  return {
    path: pb.path,
    sizeBytes: pb.sizeBytes,
    extension: pb.extension,
  };
}

function mapDataSourceFromProto(pb: DataSourcePb): DataSource {
  return {
    id: URN.parse(pb.id),
    targetId: URN.parse(pb.targetId),
    name: pb.name,
    description: pb.description,
    rulesYaml: pb.rulesYaml,
    createdAt: pb.createdAt as ISODateTimeString,
    updatedAt: pb.updatedAt as ISODateTimeString,
    analysis: pb.analysis
      ? {
          totalSizeBytes: pb.analysis.totalSizeBytes,
          totalFiles: pb.analysis.totalFiles,
          extensions: pb.analysis.extensions as Record<string, number>,
          directories: pb.analysis.directories || [],
        }
      : undefined,
  };
}

function mapDataGroupFromProto(pb: DataGroupPb): DataGroup {
  return {
    id: URN.parse(pb.id),
    name: pb.name,
    description: pb.description,
    dataSourceIds: pb.dataSourceIds.map((idStr) => URN.parse(idStr)),
    metadata: pb.metadata,
    createdAt: pb.createdAt as ISODateTimeString | undefined,
    updatedAt: pb.updatedAt as ISODateTimeString | undefined,
  };
}

export function deserializeGithubIngestionTargetList(
  jsonString: string,
): GithubIngestionTarget[] {
  const raw = JSON.parse(jsonString);
  const list = Array.isArray(raw) ? raw : raw.targets || raw.dataSources || [];
  if (!list || !Array.isArray(list)) return [];
  return list.map((c: any) =>
    mapGithubIngestionTargetFromProto(
      fromJson(GithubIngestionTargetPbSchema, c),
    ),
  );
}

export function deserializeDataGroupList(jsonString: string): DataGroup[] {
  const raw = JSON.parse(jsonString);
  const list = Array.isArray(raw) ? raw : raw.dataGroups || [];
  if (!list || !Array.isArray(list)) return [];
  return list.map((g: any) =>
    mapDataGroupFromProto(fromJson(DataGroupPbSchema, g)),
  );
}

// --- DESERIALIZERS ---

export function deserializeRemoteTrackingState(
  jsonString: string,
): RemoteTrackingState {
  const raw = JSON.parse(jsonString);
  return {
    commitSha: raw.commitSha,
    analysis: {
      totalSizeBytes: raw.analysis?.totalSizeBytes || 0,
      totalFiles: raw.analysis?.totalFiles || 0,
      extensions: raw.analysis?.extensions || {},
      directories: raw.analysis?.directories || [],
    },
  };
}

export function deserializeGithubIngestionTarget(
  jsonString: string,
): GithubIngestionTarget {
  const pb = fromJsonString(GithubIngestionTargetPbSchema, jsonString);
  return mapGithubIngestionTargetFromProto(pb);
}

export function deserializeSyncResponse(jsonString: string): SyncResponse {
  const pb = fromJsonString(SyncResponsePbSchema, jsonString);
  return {
    targetId: URN.parse(pb.targetId),
    status: pb.status,
    filesProcessed: pb.filesProcessed,
  };
}

export function deserializeFileMetadataList(
  jsonString: string,
): FileMetadata[] {
  const raw = JSON.parse(jsonString);
  const list = Array.isArray(raw) ? raw : raw.files || [];
  if (!list || !Array.isArray(list)) return [];
  return list.map((f: any) =>
    mapFileMetadataFromProto(fromJson(FileMetadataPbSchema, f)),
  );
}

export function deserializeDataSource(jsonString: string): DataSource {
  const pb = fromJsonString(DataSourcePbSchema, jsonString);
  return mapDataSourceFromProto(pb);
}

export function deserializeDataSourceList(jsonString: string): DataSource[] {
  const raw = JSON.parse(jsonString);
  const list = Array.isArray(raw) ? raw : raw.dataSources || raw.profiles || [];
  return list.map((p: any) =>
    mapDataSourceFromProto(fromJson(DataSourcePbSchema, p)),
  );
}

export function deserializeDataGroup(jsonString: string): DataGroup {
  const pb = fromJsonString(DataGroupPbSchema, jsonString);
  return mapDataGroupFromProto(pb);
}

function mapGithubIngestionTargetFromProto(
  pb: GithubIngestionTargetPb,
): GithubIngestionTarget {
  return {
    id: URN.parse(pb.id),
    displayName: pb.displayName,
    description: pb.description,
    status: pb.status as SyncStatus,
    fileCount: pb.fileCount,
    lastSyncedAt: pb.lastSyncedAt as ISODateTimeString,
    repo: pb.repo,
    branch: pb.branch,
    commitSha: pb.commitSha,
    syncedCommitSha: pb.syncedCommitSha,
    analysis: pb.analysis
      ? {
          totalSizeBytes: pb.analysis.totalSizeBytes,
          totalFiles: pb.analysis.totalFiles,
          extensions: pb.analysis.extensions as Record<string, number>,
          directories: pb.analysis.directories || [],
        }
      : undefined,
    lakeAnalysis: pb.lakeAnalysis
      ? {
          totalSizeBytes: pb.lakeAnalysis.totalSizeBytes,
          totalFiles: pb.lakeAnalysis.totalFiles,
          extensions: pb.lakeAnalysis.extensions as Record<string, number>,
          directories: pb.lakeAnalysis.directories || [],
        }
      : undefined,
  };
}
