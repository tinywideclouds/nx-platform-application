// libs/llm/types/src/v1/builder/builder.ts
import {
  NetworkAttachmentPbSchema,
  NetworkAttachmentPb,
  BuildCacheRequestPbSchema,
  BuildCacheRequestPb,
  BuildCacheResponsePbSchema,
  NetworkMessagePbSchema,
  NetworkMessagePb,
  GenerateStreamRequestPbSchema,
  GenerateStreamRequestPb,
} from '@nx-platform-application/llm-protos/builder/v1/builder_pb';
import { create, fromJsonString, toJsonString } from '@bufbuild/protobuf';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { SessionAttachment } from '../../lib/session_types';

export interface NetworkMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

export interface BuildCacheRequest {
  sessionId: URN; // Strict URN
  model: string;
  attachments: SessionAttachment[]; // Strict Domain Type
  expiresAtHint?: ISODateTimeString;
}

export interface BuildCacheResponse {
  compiledCacheId: URN; // Strict URN
  expiresAt: ISODateTimeString;
}

export interface GenerateStreamRequest {
  sessionId: URN; // Strict URN
  model: string;
  history: NetworkMessage[];
  compiledCacheId?: URN; // Strict URN
  inlineAttachments?: SessionAttachment[]; // Strict Domain Type
}

// --- FACADE MAPPERS ---

export function sessionAttachmentToProto(
  k: SessionAttachment,
): NetworkAttachmentPb {
  return create(NetworkAttachmentPbSchema, {
    id: k.id.toString(),
    dataSourceId: k.dataSourceId.toString(),
    profileId: k.profileId?.toString(),
  });
}

function buildCacheRequestToProto(k: BuildCacheRequest): BuildCacheRequestPb {
  return create(BuildCacheRequestPbSchema, {
    model: k.model,
    sources: k.attachments.map(sessionAttachmentToProto),
    expiresAtHint: k.expiresAtHint,
  });
}

function networkMessageToProto(k: NetworkMessage): NetworkMessagePb {
  return create(NetworkMessagePbSchema, {
    id: k.id,
    role: k.role,
    content: k.content,
    timestamp: k.timestamp,
  });
}

function generateStreamRequestToProto(
  k: GenerateStreamRequest,
): GenerateStreamRequestPb {
  return create(GenerateStreamRequestPbSchema, {
    sessionId: k.sessionId.toString(),
    model: k.model,
    history: k.history.map(networkMessageToProto),
    compiledCacheId: k.compiledCacheId?.toString(),
    inlineAttachments: k.inlineAttachments?.map(sessionAttachmentToProto) || [],
  });
}

// --- PUBLIC SERIALIZATION ---

export function serializeBuildCacheRequest(request: BuildCacheRequest): string {
  const proto = buildCacheRequestToProto(request);
  return toJsonString(BuildCacheRequestPbSchema, proto);
}

export function deserializeBuildCacheResponse(
  jsonString: string,
): BuildCacheResponse {
  const proto = fromJsonString(BuildCacheResponsePbSchema, jsonString);
  return {
    compiledCacheId: URN.parse(proto.compiledCacheId),
    expiresAt: proto.expiresAt as ISODateTimeString,
  };
}

export function serializeGenerateStreamRequest(
  request: GenerateStreamRequest,
): string {
  const proto = generateStreamRequestToProto(request);
  return toJsonString(GenerateStreamRequestPbSchema, proto);
}
