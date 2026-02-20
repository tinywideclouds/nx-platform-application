export interface NetworkMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string; // Maps to Go's time.Time (RFC3339/ISO8601)
}

export interface GenerateStreamRequest {
  session_id: string;
  history: NetworkMessage[];
  cache_id?: string;
}
