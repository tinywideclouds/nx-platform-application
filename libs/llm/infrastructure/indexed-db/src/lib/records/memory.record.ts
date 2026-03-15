export interface LlmMemoryItemRecord {
  id: string;
  typeId: string;
  sessionId: string;
  title?: string;
  description?: string;
  registryEntities: string[];
  content: string;
  createdAt: string;
}

export interface LlmMemoryDigestRecord extends LlmMemoryItemRecord {
  coveredMessageIds: string[];
  editDeltaNotes?: string[];
  startTime: string;
  endTime: string;
}

export interface LlmKnowledgeNodeRecord extends LlmMemoryItemRecord {
  linkedNodes: string[];
  status: 'active' | 'deprecated';
  updatedAt: string;
}
