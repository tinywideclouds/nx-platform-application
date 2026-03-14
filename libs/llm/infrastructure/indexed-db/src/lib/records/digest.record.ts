export interface LlmMemoryDigestRecord {
  id: string; // Primary Key (URN string)
  sessionId: string; // Indexed for querying by session
  coveredMessageIds: string[];
  content: string;
  editDeltaNotes?: string[];
  createdAt: string; // ISODateTimeString
}
