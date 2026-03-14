import {
  NetworkAttachmentPbSchema,
  NetworkAttachmentPb,
  BuildCacheRequestPbSchema,
  BuildCacheRequestPb,
  BuildCacheResponsePbSchema,
  NetworkMessagePbSchema,
  NetworkMessagePb,
  GenerateRequestPb,
  GenerateRequestPbSchema,
  GenerateStreamRequestPbSchema,
  GenerateStreamRequestPb,
  GenerateResponsePbSchema,
} from '@nx-platform-application/llm-protos/builder/v1/builder_pb';
import { create, fromJsonString, toJsonString } from '@bufbuild/protobuf';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ContextAttachment } from '../../lib/types';

/**
 * Domain-to-Network message interface for history segments.
 */
export interface NetworkMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

/**
 * Request payload for the CompiledCache compilation action.
 * Uses ContextAttachment (the flattened physical sources).
 */
export interface BuildCacheRequest {
  model: string;
  attachments: ContextAttachment[];
  expiresAtHint?: ISODateTimeString;
}

/**
 * Response payload from the Go backend after successful compilation.
 */
export interface BuildCacheResponse {
  compiledCacheId: URN;
  expiresAt: ISODateTimeString;
}

/**
 * The unified request for initiating an LLM stream.
 */
export interface GenerateStreamRequest {
  sessionId: URN;
  model: string;
  history: NetworkMessage[];
  compiledCacheId?: URN;
  inlineAttachments?: ContextAttachment[];
}

function generateRequestToProto(k: GenerateRequest): GenerateRequestPb {
  return create(GenerateRequestPbSchema, {
    model: k.model,
    systemPrompt: k.systemPrompt,
    prompt: k.prompt,
  });
}

export function serializeGenerateRequest(request: GenerateRequest): string {
  const proto = generateRequestToProto(request);
  return toJsonString(GenerateRequestPbSchema, proto);
}

export function deserializeGenerateResponse(
  jsonString: string,
): GenerateResponse {
  const proto = fromJsonString(GenerateResponsePbSchema, jsonString);
  return {
    content: proto.content,
    finishReason: proto.finishReason,
    promptTokenCount: proto.promptTokenCount,
    candidateTokenCount: proto.candidateTokenCount,
  };
}

// --- FACADE MAPPERS ---

export interface GenerateResponse {
  content: string;
  finishReason: string;
  promptTokenCount: number;
  candidateTokenCount: number;
}

export interface GenerateRequest {
  model: string;
  systemPrompt?: string;
  prompt: string;
}

/**
 * Maps a single flattened ContextAttachment to its Protobuf wire representation.
 */
export function contextAttachmentToProto(
  k: ContextAttachment,
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
    // Backend expects 'sources' as the field name for BuildCache
    sources: k.attachments.map(contextAttachmentToProto),
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
    inlineAttachments: k.inlineAttachments?.map(contextAttachmentToProto) || [],
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
