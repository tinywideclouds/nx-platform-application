import {
  ChangeProposalPbSchema,
  ChangeProposalPb,
  FileStatePbSchema,
  FileStatePb,
  SessionPbSchema,
} from '@nx-platform-application/llm-protos/builder/v1/builder_pb';
import { fromJson, fromJsonString } from '@bufbuild/protobuf';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

export interface FileState {
  content: string;
  isDeleted: boolean;
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'staged';

export interface ChangeProposal {
  id: string;
  sessionId: string;
  filePath: string;
  patch?: string;
  newContent?: string;
  reasoning: string;
  status: ProposalStatus;
  createdAt: ISODateTimeString;
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
  let status: ProposalStatus = 'pending';
  switch (pk.status) {
    case 'accepted':
      status = 'accepted';
      break;
    case 'rejected':
      status = 'rejected';
      break;
    case 'staged':
      status = 'staged';
      break;
  }
  return {
    id: pk.id,
    sessionId: pk.sessionId,
    filePath: pk.filePath,
    patch: pk.patch,
    newContent: pk.newContent,
    reasoning: pk.reasoning,
    status,
    createdAt: pk.createdAt as ISODateTimeString,
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
