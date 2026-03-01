import {
  ChangeProposalPbSchema,
  ChangeProposalPb,
  FileStatePbSchema,
  FileStatePb,
  SessionPbSchema,
  SessionPb,
} from '@nx-platform-application/llm-protos/builder/v1/builder_pb';
import { fromJson, fromJsonString } from '@bufbuild/protobuf';

export interface FileState {
  content: string;
  isDeleted: boolean;
}

export interface ChangeProposal {
  id: string;
  sessionId: string;
  filePath: string;
  patch?: string;
  newContent?: string;
  reasoning: string;
  status: string;
  createdAt: string;
}

export interface WorkspaceSession {
  id: string;
  compiledCacheId: string;
  updatedAt: string;
}

export interface SSEProposalEvent {
  proposal: ChangeProposal;
  originalContent: string;
}

// --- INTERNAL MAPPERS ---

function changeProposalFromProto(pk: ChangeProposalPb): ChangeProposal {
  return {
    id: pk.id,
    sessionId: pk.sessionId,
    filePath: pk.filePath,
    patch: pk.patch,
    newContent: pk.newContent,
    reasoning: pk.reasoning,
    status: pk.status,
    createdAt: pk.createdAt,
  };
}

function fileStateFromProto(pk: FileStatePb): FileState {
  return {
    content: pk.content,
    isDeleted: pk.isDeleted,
  };
}

// --- PUBLIC FACADES ---

export function deserializeSession(jsonString: string): WorkspaceSession {
  const proto = fromJsonString(SessionPbSchema, jsonString);
  return {
    id: proto.id,
    compiledCacheId: proto.compiledCacheId,
    updatedAt: proto.updatedAt,
  };
}

export function deserializeChangeProposalMap(
  jsonString: string,
): Record<string, ChangeProposal> {
  const rawObj = JSON.parse(jsonString);
  const result: Record<string, ChangeProposal> = {};

  for (const [key, val] of Object.entries(rawObj)) {
    const proto = fromJson(ChangeProposalPbSchema, val as any);
    result[key] = changeProposalFromProto(proto);
  }
  return result;
}

export function deserializeFileStateMap(
  jsonString: string,
): Record<string, FileState> {
  const rawObj = JSON.parse(jsonString);
  const result: Record<string, FileState> = {};

  for (const [key, val] of Object.entries(rawObj)) {
    const proto = fromJson(FileStatePbSchema, val as any);
    result[key] = fileStateFromProto(proto);
  }
  return result;
}

export function deserializeSSEProposalEvent(
  jsonString: string,
): SSEProposalEvent {
  const raw = JSON.parse(jsonString);

  // Safely parse the nested protobuf object
  const protoProposal = fromJson(ChangeProposalPbSchema, raw.proposal);

  return {
    proposal: changeProposalFromProto(protoProposal),
    originalContent: raw.originalContent || '',
  };
}
