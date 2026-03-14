export interface LlmMemoryItemRecord {
  id: string;
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
}

export interface LlmKnowledgeNodeRecord extends LlmMemoryItemRecord {
  typeId: string;
  linkedNodes: string[];
  status: 'active' | 'deprecated';
  updatedAt: string;
}
