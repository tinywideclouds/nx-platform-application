import {
  CompiledCachePbSchema,
  CompiledCachePb,
} from '@nx-platform-application/llm-protos/builder/v1/builder_pb';
import { create, fromJsonString, toJsonString } from '@bufbuild/protobuf';
import {
  NetworkAttachment,
  networkAttachmentToProto,
  networkAttachmentFromProto,
} from './builder';

export interface CompiledCache {
  id: string;
  externalId: string;
  provider: string;
  attachmentsUsed: NetworkAttachment[];
  createdAt: string;
}

// --- INTERNAL MAPPERS ---

function compiledCacheToProto(k: CompiledCache): CompiledCachePb {
  return create(CompiledCachePbSchema, {
    id: k.id,
    externalId: k.externalId,
    provider: k.provider,
    attachmentsUsed: k.attachmentsUsed.map(networkAttachmentToProto),
    createdAt: k.createdAt,
  });
}

function compiledCacheFromProto(pk: CompiledCachePb): CompiledCache {
  return {
    id: pk.id,
    externalId: pk.externalId,
    provider: pk.provider,
    attachmentsUsed: pk.attachmentsUsed.map(networkAttachmentFromProto),
    createdAt: pk.createdAt,
  };
}

// --- PUBLIC FACADES ---

export function serializeCompiledCache(cache: CompiledCache): string {
  return toJsonString(CompiledCachePbSchema, compiledCacheToProto(cache));
}

export function deserializeCompiledCache(jsonString: string): CompiledCache {
  const proto = fromJsonString(CompiledCachePbSchema, jsonString);
  return compiledCacheFromProto(proto);
}
