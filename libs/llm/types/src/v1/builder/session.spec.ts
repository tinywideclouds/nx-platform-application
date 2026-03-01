import { describe, it, expect } from 'vitest';
import {
  deserializeChangeProposalMap,
  deserializeFileStateMap,
  deserializeSSEProposalEvent,
} from './session';

describe('Session Facade', () => {
  it('should deserialize a map of Change Proposals', () => {
    const rawGoJson = `{
      "prop-1": {
        "id": "prop-1",
        "session_id": "sess-abc",
        "file_path": "main.go",
        "patch": "@@ -1,3 +1,4 @@",
        "reasoning": "Added a print statement",
        "status": "pending",
        "created_at": "2026-02-27T16:00:00Z"
      }
    }`;

    const map = deserializeChangeProposalMap(rawGoJson);
    expect(map['prop-1'].sessionId).toBe('sess-abc');
    expect(map['prop-1'].patch).toBe('@@ -1,3 +1,4 @@');
    expect(map['prop-1'].status).toBe('pending');
  });

  it('should deserialize a map of File States', () => {
    const rawGoJson = `{
      "main.go": {
        "content": "package main",
        "is_deleted": false
      }
    }`;

    const map = deserializeFileStateMap(rawGoJson);
    expect(map['main.go'].content).toBe('package main');
    expect(map['main.go'].isDeleted).toBe(false);
  });

  it('should parse the custom SSE proposal_created event payload', () => {
    const ssePayload = `{
      "originalContent": "old file content",
      "proposal": {
        "id": "prop-123",
        "file_path": "test.txt",
        "new_content": "new file content",
        "reasoning": "testing",
        "status": "pending",
        "created_at": "2026-02-27T16:00:00Z"
      }
    }`;

    const event = deserializeSSEProposalEvent(ssePayload);

    // Check root custom field
    expect(event.originalContent).toBe('old file content');

    // Check nested protobuf parsing
    expect(event.proposal.id).toBe('prop-123');
    expect(event.proposal.filePath).toBe('test.txt');
    expect(event.proposal.newContent).toBe('new file content');
  });
});
