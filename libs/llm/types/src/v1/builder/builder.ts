import {
  NetworkAttachmentPbSchema,
  NetworkAttachmentPb,
  BuildCacheRequestPbSchema,
  BuildCacheRequestPb,
  BuildCacheResponsePbSchema,
  BuildCacheResponsePb,
  NetworkMessagePbSchema,
  NetworkMessagePb,
  GenerateStreamRequestPbSchema,
  GenerateStreamRequestPb,
} from '@nx-platform-application/llm-protos/builder/v1/builder_pb';
import { create, fromJsonString, toJsonString } from '@bufbuild/protobuf';

// --- SMART TYPES ---

export interface NetworkMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

export interface NetworkAttachment {
  id: string;
  cacheId: string;
  profileId?: string;
}

export interface BuildCacheRequest {
  sessionId: string;
  model: string;
  attachments: NetworkAttachment[];
}

export interface BuildCacheResponse {
  geminiCacheId: string;
}

export interface GenerateStreamRequest {
  sessionId: string;
  model: string;
  history: NetworkMessage[];
  cacheId?: string;
  inlineAttachments?: NetworkAttachment[];
}

export function networkAttachmentToProto(
  k: NetworkAttachment,
): NetworkAttachmentPb {
  return create(NetworkAttachmentPbSchema, {
    id: k.id,
    cacheId: k.cacheId,
    profileId: k.profileId,
  });
}

export function networkAttachmentFromProto(
  pk: NetworkAttachmentPb,
): NetworkAttachment {
  return {
    id: pk.id,
    cacheId: pk.cacheId,
    profileId: pk.profileId, // Bufbuild maps this perfectly, even if it's undefined
  };
}

function buildCacheRequestToProto(k: BuildCacheRequest): BuildCacheRequestPb {
  return create(BuildCacheRequestPbSchema, {
    sessionId: k.sessionId,
    model: k.model,
    // FIX: Properly map the array of smart objects to proto objects
    attachments: k.attachments.map(networkAttachmentToProto),
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
    sessionId: k.sessionId,
    model: k.model,
    history: k.history.map(networkMessageToProto),
    geminiCacheId: k.cacheId,
    inlineAttachments: k.inlineAttachments?.map(networkAttachmentToProto) || [],
  });
}

// --- PUBLIC SERIALIZATION FACADES ---

export function serializeBuildCacheRequest(request: BuildCacheRequest): string {
  const proto = buildCacheRequestToProto(request);
  return toJsonString(BuildCacheRequestPbSchema, proto);
}

export function deserializeBuildCacheResponse(
  jsonString: string,
): BuildCacheResponse {
  const proto = fromJsonString(BuildCacheResponsePbSchema, jsonString);
  return { geminiCacheId: proto.geminiCacheId };
}

export function serializeGenerateStreamRequest(
  request: GenerateStreamRequest,
): string {
  const proto = generateStreamRequestToProto(request);
  return toJsonString(GenerateStreamRequestPbSchema, proto);
}
