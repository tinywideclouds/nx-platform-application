import {
  ChangeProposalPbSchema,
  ChangeProposalPb,
  FileStatePbSchema,
  FileStatePb,
  SessionPbSchema,
} from '@nx-platform-application/llm-protos/builder/v1/builder_pb';
import { fromJson, fromJsonString } from '@bufbuild/protobuf';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { ProposalStatus } from '../../lib/session_types';

export interface FileState {
  content: string;
  isDeleted: boolean;
}

export interface ChangeProposal {
  id: string;
  sessionId: URN;
  filePath: string;
  patch?: string;
  newContent?: string;
  reasoning: string;
  createdAt: ISODateTimeString;
  status?: ProposalStatus;
}

export interface WorkspaceSession {
  id: URN;
  compiledCacheId: URN;
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
    sessionId: URN.parse(pk.sessionId),
    filePath: pk.filePath,
    patch: pk.patch,
    newContent: pk.newContent,
    reasoning: pk.reasoning,
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
    id: URN.parse(proto.id),
    compiledCacheId: URN.parse(proto.compiledCacheId),
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
    const proposal = changeProposalFromProto(proto);

    // Safely extract the frontend-only status field from the raw JSON
    proposal.status = (val as any).status || 'pending';

    result[key] = proposal;
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

  const protoProposal = fromJson(ChangeProposalPbSchema, raw.proposal);
  const proposal = changeProposalFromProto(protoProposal);

  // Safely extract the frontend-only status field
  proposal.status = raw.proposal.status || 'pending';

  return {
    proposal,
    originalContent: raw.originalContent || '',
  };
}
