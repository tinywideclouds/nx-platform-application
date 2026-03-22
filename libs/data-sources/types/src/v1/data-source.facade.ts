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
  CreateIngestionTargetRequestPbSchema,
  IngestionTargetPbSchema,
  IngestionTargetPb,
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
} from '../lib/data-sources';

// --- SERIALIZERS ---

export function serializeCreateIngestionTargetRequest(
  repo: string,
  branch: string,
): string {
  const proto = create(CreateIngestionTargetRequestPbSchema, { repo, branch });
  return toJsonString(CreateIngestionTargetRequestPbSchema, proto);
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
  });
  return toJsonString(DataSourceRequestPbSchema, proto);
}

export function serializeDataGroupRequest(req: DataGroupRequest): string {
  const proto = create(DataGroupRequestPbSchema, {
    name: req.name,
    description: req.description,
    dataSourceIds: req.dataSourceIds.map((id) => id.toString()), // Direct array mapping
    metadata: req.metadata || {},
  });
  return toJsonString(DataGroupRequestPbSchema, proto);
}

// --- INTERNAL PROTO MAPPERS ---

function mapIngestionTargetFromProto(
  pb: IngestionTargetPb,
): GithubIngestionTarget {
  return {
    id: URN.parse(pb.id),
    repo: pb.displayName,
    branch: pb.description,
    syncedCommitSha: pb.syncedCommitSha,
    lastSyncedAt: Number(pb.lastSyncedAt),
    fileCount: pb.fileCount,
    status: pb.status as any,
    analysis: pb.analysis
      ? {
          totalFiles: pb.analysis.totalFiles,
          totalSizeBytes: pb.analysis.totalSizeBytes,
          extensions: pb.analysis.extensions as Record<string, number>,
        }
      : undefined,
  };
}

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
    name: pb.name,
    rulesYaml: pb.rulesYaml,
    createdAt: pb.createdAt as ISODateTimeString,
    updatedAt: pb.updatedAt as ISODateTimeString,
  };
}

function mapDataGroupFromProto(pb: DataGroupPb): DataGroup {
  return {
    id: URN.parse(pb.id),
    name: pb.name,
    description: pb.description,
    dataSourceIds: pb.dataSourceIds.map((idStr) => URN.parse(idStr)), // Direct array mapping
    metadata: pb.metadata,
    createdAt: pb.createdAt as ISODateTimeString | undefined,
    updatedAt: pb.updatedAt as ISODateTimeString | undefined,
  };
}

export function deserializeIngestionTargetList(
  jsonString: string,
): GithubIngestionTarget[] {
  const raw = JSON.parse(jsonString);
  const list = Array.isArray(raw) ? raw : raw.targets || raw.dataSources;
  if (!list || !Array.isArray(list)) return [];
  return list.map((c: any) =>
    mapIngestionTargetFromProto(fromJson(IngestionTargetPbSchema, c)),
  );
}

export function deserializeDataGroupList(jsonString: string): DataGroup[] {
  const raw = JSON.parse(jsonString);
  const list = Array.isArray(raw) ? raw : raw.dataGroups;
  if (!list || !Array.isArray(list)) return [];
  return list.map((g: any) =>
    mapDataGroupFromProto(fromJson(DataGroupPbSchema, g)),
  );
}

// --- DESERIALIZERS ---

export function deserializeIngestionTarget(
  jsonString: string,
): GithubIngestionTarget {
  const pb = fromJsonString(IngestionTargetPbSchema, jsonString);
  return mapIngestionTargetFromProto(pb);
}

export function deserializeSyncResponse(jsonString: string): SyncResponse {
  const pb = fromJsonString(SyncResponsePbSchema, jsonString);
  return {
    dataSourceId: URN.parse(pb.targetId) as any,
    status: pb.status,
    filesProcessed: pb.filesProcessed,
  };
}

export function deserializeFileMetadataList(
  jsonString: string,
): FileMetadata[] {
  const raw = JSON.parse(jsonString);
  if (!raw.files) return [];
  return raw.files.map((f: any) =>
    mapFileMetadataFromProto(fromJson(FileMetadataPbSchema, f)),
  );
}

export function deserializeDataSource(jsonString: string): DataSource {
  const pb = fromJsonString(DataSourcePbSchema, jsonString);
  return mapDataSourceFromProto(pb);
}

export function deserializeDataSourceList(jsonString: string): DataSource[] {
  const raw = JSON.parse(jsonString);
  const list = raw.dataSources || raw.profiles || [];
  return list.map((p: any) =>
    mapDataSourceFromProto(fromJson(DataSourcePbSchema, p)),
  );
}

export function deserializeDataGroup(jsonString: string): DataGroup {
  const pb = fromJsonString(DataGroupPbSchema, jsonString);
  return mapDataGroupFromProto(pb);
}
